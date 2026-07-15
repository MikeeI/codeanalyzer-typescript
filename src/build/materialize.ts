import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { ts } from "ts-morph";
import type { AnalysisOptions } from "../options";
import { SKIP_DIRS } from "../syntactic_analysis/discovery";
import type { Logger } from "../utils";

/**
 * One ts-morph program to construct. `configPath` is the tsconfig the Project is built from (or
 * `null` for default compiler options); `scopeDir` is the subtree this program CLAIMS — every
 * discovered source file is assigned to the DEEPEST program whose `scopeDir` is an ancestor of it.
 * For a leaf config reached through a solution-style config, `scopeDir` is the SOLUTION config's
 * directory (so its sibling files aren't stranded), which is why scope is tracked separately.
 */
export interface ProgramSpec {
  configPath: string | null;
  scopeDir: string;
}

export interface Materialization {
  // The ROOT program's tsconfig — kept for single-program consumers (dataflow, backward compat).
  tsConfigFilePath: string | null;
  // Every program to build, DEEPEST-scope programs first and the root program LAST.
  programs: ProgramSpec[];
  degraded: boolean;
  notes: string[];
}

/**
 * Materialize the target project's dependencies BEFORE parsing, so the ts-morph checker can
 * resolve types and call targets. This is the TypeScript analog of Java's
 * `downloadLibraryDependencies` and Python's `.venv` build — and, like them, it runs **by
 * default** (the analyzer is far more useful with deps present). `--no-build` opts out.
 *
 * Design choices that matter:
 * - **In-place `node_modules`.** Unlike Python's relocatable venv, Node's module resolution
 *   requires `node_modules` to live in the project tree, so we install there (and reuse it).
 * - **`--ignore-scripts`.** A source-level resolver needs the packages' `.d.ts`/JS *present*, not
 *   their native addons *compiled*. Skipping install scripts makes materialization fast and robust
 *   (projects with native deps like sqlite3 no longer fail the whole install).
 * - **Degrade, never crash.** If install fails (offline, broken dep), we log and continue with
 *   partial types — a symbol table with some unresolved types beats an exception.
 * - **`--eager` reinstalls**, mirroring Python recreating its venv.
 */
export function materialize(opts: AnalysisOptions, log: Logger): Materialization {
  const root = opts.input;
  const notes: string[] = [];
  let degraded = false;

  const programs = discoverPrograms(root, opts.skipTests);
  const rootProgram = programs[programs.length - 1]!; // root is always last (see discoverPrograms)
  const tsconfig = rootProgram.configPath;
  notes.push(tsconfig ? `config: ${path.relative(root, tsconfig) || path.basename(tsconfig)}` : "no tsconfig/jsconfig — using default compiler options");
  for (const p of programs) {
    if (p === rootProgram) continue;
    notes.push(`nested program: ${path.relative(root, p.configPath ?? p.scopeDir)} (scope ${path.relative(root, p.scopeDir) || "."})`);
  }

  // Materialize deps at the root, then at each nested program scope that has its own package.json
  // (Angular monorepos install the frontend separately — its node_modules never lives at the root).
  // Dedup by resolved scope dir so a solution config with several referenced leaves installs once.
  const installedScopes = new Set<string>([path.resolve(root)]);
  if (installDeps(root, opts, log, notes)) degraded = true;
  for (const p of programs) {
    const dir = path.resolve(p.scopeDir);
    if (installedScopes.has(dir)) continue;
    installedScopes.add(dir);
    if (!fs.existsSync(path.join(dir, "package.json"))) continue;
    if (installDeps(dir, opts, log, notes)) degraded = true;
  }

  return { tsConfigFilePath: tsconfig, programs, degraded, notes };
}

/**
 * Install dependencies in `dir` (the root, or a nested program scope). Same policy everywhere:
 * `--no-build` / no package.json / present-node_modules (unless `--eager`) all skip; failures
 * degrade rather than crash. Returns whether the install DEGRADED (failed).
 */
function installDeps(dir: string, opts: AnalysisOptions, log: Logger, notes: string[]): boolean {
  const rel = path.relative(opts.input, dir) || ".";
  const hasPkg = fs.existsSync(path.join(dir, "package.json"));
  const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));

  if (opts.noBuild) {
    notes.push(`--no-build: skipping dependency materialization (${rel})`);
    return false;
  }
  if (!hasPkg) {
    notes.push(`no package.json — nothing to materialize (${rel})`);
    return false;
  }
  if (hasNodeModules && !opts.eager) {
    notes.push(`node_modules present — reused (${rel}; pass --eager to reinstall)`);
    return false;
  }
  const inst = resolveInstaller(dir);
  try {
    log.info(`materializing dependencies (${rel}): ${inst.label}`);
    execFileSync(inst.bin, inst.args, { cwd: dir, stdio: ["ignore", "ignore", "inherit"], timeout: 600_000 });
    notes.push(`ran ${inst.label} (${rel})`);
    return false;
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 160);
    notes.push(`dependency install failed — continuing with partial types (${rel}: ${msg})`);
    log.warn(`dependency materialization failed (${rel}); continuing with partial types`);
    return true;
  }
}

interface Installer {
  bin: string;
  args: string[];
  label: string;
}

/**
 * Pick the package manager from the lockfile (so we don't build a wrong tree), falling back to
 * npm when the preferred PM isn't installed. Always `--ignore-scripts` (types, not native builds).
 */
function resolveInstaller(root: string): Installer {
  const has = (f: string): boolean => fs.existsSync(path.join(root, f));
  const npmCommon = ["--ignore-scripts", "--no-audit", "--no-fund"];

  if (has("pnpm-lock.yaml") && binAvailable("pnpm")) {
    return { bin: "pnpm", args: ["install", "--ignore-scripts"], label: "pnpm install --ignore-scripts" };
  }
  if (has("yarn.lock") && binAvailable("yarn")) {
    return { bin: "yarn", args: ["install", "--ignore-scripts", "--silent"], label: "yarn install --ignore-scripts" };
  }
  if (has("package-lock.json")) {
    // npm ci is reproducible and lockfile-driven (it wipes/recreates node_modules).
    return { bin: "npm", args: ["ci", ...npmCommon], label: "npm ci --ignore-scripts" };
  }
  // No lockfile: install from package.json without writing a lockfile into the user's repo.
  return { bin: "npm", args: ["install", ...npmCommon, "--no-package-lock"], label: "npm install --ignore-scripts" };
}

function binAvailable(bin: string): boolean {
  try {
    execFileSync(bin, ["--version"], { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================================
// Program discovery — find every ts-morph program the monorepo needs, not just the root one.
// ==============================================================================================

/**
 * Discover the programs to build. The ROOT program keeps the historical `findProjectConfig`
 * behavior (root tsconfig or default options) and is returned LAST. Nested programs come from
 * every `tsconfig.json` found under the tree (outside `node_modules`), resolved to LEAF configs:
 * a solution-style config (`files: []`/absent + non-empty `references`) contributes its referenced
 * configs instead of itself, scoped to the solution config's own directory. Deeper-scope programs
 * are returned before shallower ones so a first-match-wins assignment picks the deepest owner.
 */
export function discoverPrograms(root: string, skipTests: boolean): ProgramSpec[] {
  const rootResolved = path.resolve(root);
  const nested: ProgramSpec[] = [];
  const seenLeaf = new Set<string>();

  for (const cfg of walkTsconfigs(root)) {
    const dir = path.dirname(cfg);
    if (path.resolve(dir) === rootResolved) continue; // the root config is the root program's job
    for (const leaf of resolveLeafConfigs(cfg, skipTests, new Set())) {
      const key = `${path.resolve(leaf)}|${path.resolve(dir)}`;
      if (seenLeaf.has(key)) continue;
      seenLeaf.add(key);
      nested.push({ configPath: leaf, scopeDir: dir });
    }
  }

  // Deepest scope first — file assignment takes the first program whose scope contains the file.
  nested.sort((a, b) => b.scopeDir.length - a.scopeDir.length);
  nested.push({ configPath: findProjectConfig(root), scopeDir: root }); // root program, always last
  return nested;
}

/** Recursively collect files literally named `tsconfig.json`, skipping vendored/build trees. */
function walkTsconfigs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(abs);
      } else if (e.isFile() && e.name === "tsconfig.json") {
        out.push(abs);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Resolve one config to the LEAF configs a program should be built from. A solution-style config
 * (no `files`/empty + non-empty `references`) contributes the configs it references rather than
 * itself; the follow is defensive-recursive (a referenced config can itself be solution-style)
 * guarded by a visited set. Test/spec configs are dropped when `skipTests`.
 */
function resolveLeafConfigs(cfg: string, skipTests: boolean, visited: Set<string>): string[] {
  const abs = path.resolve(cfg);
  if (visited.has(abs) || !fs.existsSync(abs)) return [];
  visited.add(abs);

  const json = readTsconfig(abs);
  const refs: Array<{ path?: string }> = Array.isArray(json?.references) ? json.references : [];
  const files: unknown = json?.files;
  const isSolution = (!Array.isArray(files) || files.length === 0) && refs.length > 0;

  if (!isSolution) {
    if (skipTests && isTestConfig(abs)) return [];
    return [abs];
  }

  const out: string[] = [];
  for (const ref of refs) {
    if (!ref?.path) continue;
    const refPath = resolveReferencePath(path.dirname(abs), ref.path);
    if (!refPath) continue;
    if (skipTests && isTestConfig(refPath)) continue;
    out.push(...resolveLeafConfigs(refPath, skipTests, visited));
  }
  return out;
}

/** A project reference `path` may point at a config file or a directory containing `tsconfig.json`. */
function resolveReferencePath(fromDir: string, refPath: string): string | null {
  const abs = path.resolve(fromDir, refPath);
  if (abs.endsWith(".json")) return fs.existsSync(abs) ? abs : null;
  const asDir = path.join(abs, "tsconfig.json");
  return fs.existsSync(asDir) ? asDir : null;
}

/** Read a (possibly jsonc, trailing-comma) tsconfig via the TS parser; `{}` on any error. */
function readTsconfig(abs: string): { references?: unknown; files?: unknown } {
  try {
    const r = ts.readConfigFile(abs, (p) => fs.readFileSync(p, "utf8"));
    return (r.config as { references?: unknown; files?: unknown }) ?? {};
  } catch {
    return {};
  }
}

/** A config is a test/spec config when its filename carries a `spec`/`test` marker. */
function isTestConfig(cfg: string): boolean {
  return /\b(spec|test)\b/i.test(path.basename(cfg));
}

/** tsconfig.json → any tsconfig*.json → jsconfig.json (JS projects). */
function findProjectConfig(root: string): string | null {
  const direct = path.join(root, "tsconfig.json");
  if (fs.existsSync(direct)) return direct;
  try {
    const ts = fs.readdirSync(root).find((n) => /^tsconfig.*\.json$/.test(n));
    if (ts) return path.join(root, ts);
  } catch {
    /* unreadable dir */
  }
  const js = path.join(root, "jsconfig.json");
  return fs.existsSync(js) ? js : null;
}
