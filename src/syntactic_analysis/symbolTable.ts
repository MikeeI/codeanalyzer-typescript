import * as path from "node:path";
import { Project, ts } from "ts-morph";
import { buildModule } from "./builders";
import { fileMeta, fileUnchanged } from "../utils";
import { discoverSourceFiles, resolveTargetFiles, type DiscoveredFile } from "./discovery";
import type { Materialization, ProgramSpec } from "../build";
import type { AnalysisOptions } from "../options";
import type { Node } from "ts-morph";
import type { TSModule } from "../schema";
import type { Logger } from "../utils";

/** One constructed ts-morph program plus the symbol-table keys (fileKeys) it owns. */
export interface BuiltProgram {
  project: Project;
  fileKeys: Set<string>;
  // The tsconfig this program was built from (null = default options) — the owning config for
  // every file in `fileKeys`. This is the file→program config map the L3 workers would thread.
  configPath: string | null;
}

export interface SymbolTableResult {
  // The ROOT program's Project — single-program consumers keep working unchanged.
  project: Project;
  symbol_table: Record<string, TSModule>;
  files: DiscoveredFile[];
  // One entry per discovered program (deepest scope first, root last).
  programs: BuiltProgram[];
}

/** Is `file` inside `dir` (or is `dir` the file's own directory)? */
function contains(dir: string, file: string): boolean {
  const rel = path.relative(dir, file);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * The program that owns `absPath`: the DEEPEST program whose scope dir contains it. `programs` is
 * ordered deepest-first with the root program last, so the first containing program wins and the
 * root program is the guaranteed fallback.
 */
function ownerProgram(absPath: string, programs: ProgramSpec[]): ProgramSpec {
  for (const p of programs) if (contains(p.scopeDir, absPath)) return p;
  return programs[programs.length - 1]!; // root program is a universal ancestor; unreachable fallback
}

export function buildSymbolTable(
  opts: AnalysisOptions,
  mat: Materialization,
  cached: Record<string, TSModule> | null,
  log: Logger,
): SymbolTableResult {
  const root = opts.input;
  const specs = mat.programs;

  const targets = opts.targetFiles ? resolveTargetFiles(root, opts.targetFiles) : null;
  const allProjectFiles = discoverSourceFiles(root, opts.skipTests);
  // The set of files to BUILD (targets in -t mode, else all).
  const buildFiles = targets ?? allProjectFiles;

  // Assign every discovered file to exactly one program (deepest scope wins), then construct one
  // Project per program from ONLY its files — so each file resolves under the tsconfig that governs
  // it (module resolution, `paths` aliases, lib) instead of a single root program swallowing all.
  const assignment = new Map<ProgramSpec, DiscoveredFile[]>();
  for (const s of specs) assignment.set(s, []);
  for (const f of allProjectFiles) assignment.get(ownerProgram(f.absPath, specs))!.push(f);

  const projectOf = new Map<ProgramSpec, Project>();
  const programs: BuiltProgram[] = [];
  for (const s of specs) {
    const project = s.configPath
      ? new Project({ tsConfigFilePath: s.configPath, skipAddingFilesFromTsConfig: true })
      : new Project({ compilerOptions: defaultCompilerOptions() });
    const files = assignment.get(s)!;
    const fileKeys = new Set<string>();
    for (const f of files) {
      fileKeys.add(f.fileKey);
      try {
        project.addSourceFileAtPath(f.absPath);
      } catch (e) {
        log.warn(`failed to load ${f.fileKey}: ${(e as Error).message}`);
      }
    }
    projectOf.set(s, project);
    programs.push({ project, fileKeys, configPath: s.configPath });
    log.info(`program: ${s.configPath ? path.relative(root, s.configPath) : "default"} (${files.length} files)`);
  }

  const symbol_table: Record<string, TSModule> = {};
  let built = 0;
  let fromCache = 0;
  for (const f of buildFiles) {
    if (cached && !opts.eager && cached[f.fileKey] && fileUnchanged(f.absPath, cached[f.fileKey])) {
      symbol_table[f.fileKey] = cached[f.fileKey];
      fromCache++;
      continue;
    }
    const sf = projectOf.get(ownerProgram(f.absPath, specs))!.getSourceFile(f.absPath);
    if (!sf) continue;
    const mod = buildModule(sf as unknown as Node, root);
    const meta = fileMeta(f.absPath);
    mod.content_hash = meta.content_hash;
    mod.last_modified = meta.last_modified;
    mod.file_size = meta.file_size;
    symbol_table[f.fileKey] = mod;
    built++;
  }
  log.info(`symbol table: ${built} built, ${fromCache} cached, ${Object.keys(symbol_table).length} modules`);

  // The root program is always last; its Project is the one legacy single-program consumers expect.
  const rootProject = projectOf.get(specs[specs.length - 1]!)!;
  return { project: rootProject, symbol_table, files: buildFiles, programs };
}

/** The fallback compiler options when the target has no tsconfig (shared with graph workers). */
export function defaultCompilerOptions(): ts.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    allowJs: true,
    strict: false,
    skipLibCheck: true,
    esModuleInterop: true,
  };
}
