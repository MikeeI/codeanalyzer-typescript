/**
 * Level 3 — the program-graphs pipeline (stages 1–7 of the dataflow contract), run only at
 * `-a 3` after the symbol table and call graph exist:
 *
 *   identity map (signature → AST callable)         — the same signatureOf() canonicalizer
 *   → stage 1  CFG per callable                     (cfg.ts)
 *   → stage 2  post-dominance + control dependence  (dominance.ts)
 *   → stage 3  access paths + reaching defs → DDG   (defuse.ts, re-run inside the fixpoint)
 *   → stage 5  SCC condensation of the call graph   (summaries.ts)
 *   → stage 6  bottom-up relational summaries       (summaries.ts)
 *   → stage 4+7  PDG assembly + SDG edges           (here + sdg.ts)
 *   → emission of the `program_graphs` section, scoped by `--graphs`
 *
 * Determinism: callables are processed in sorted-signature order, node ids are source-span
 * ordered, and every edge list is collect-then-sorted before emission.
 *
 * Summaries (with their callee dependency edges and the owning module's content hash) are
 * persisted to `<cache_dir>/graphs_summaries.json` — recorded from day one so incremental
 * re-analysis can later consume them; nothing reads them yet.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { Node, ts, type Project, type SourceFile } from "ts-morph";
import type { AnalysisOptions } from "../options";
import {
  PROGRAM_GRAPHS_SCHEMA_VERSION,
  computeSignatureForDecl,
  type FunctionGraphs,
  type GraphNode,
  type PdgEdge,
  type ProgramGraphs,
  type TSCallable,
  type TSCallsite,
  type TSClass,
  type TSModule,
  type TSNamespace,
} from "../schema";
import type { Logger } from "../utils";
import { buildCfg } from "./cfg";
import { controlDependence, postDominators } from "./dominance";
import type { FunctionCfgBuild } from "./model";
import { type CallSiteRef, composeSummaries } from "./summaries";
import { assembleSdg } from "./sdg";

export { backwardSlice, type SliceCriterion } from "./slice";

export interface BuildGraphsArgs {
  project: Project;
  symbol_table: Record<string, TSModule>;
  opts: AnalysisOptions;
  log: Logger;
}

export function buildProgramGraphs({ project, symbol_table, opts, log }: BuildGraphsArgs): ProgramGraphs {
  const k = opts.graphFieldDepth;
  const root = opts.input;

  // ---- identity map: canonical signature → the function-like AST node that owns the body ----
  const astIndex = indexCallableDecls(project, root);

  // ---- collect symbol-table callables (the node universe) ----
  const callables = new Map<string, TSCallable>();
  for (const mod of Object.values(symbol_table)) collectModule(mod, callables);

  // ---- stage 1: CFGs, in deterministic signature order ----
  const builds = new Map<string, FunctionCfgBuild>();
  for (const sig of [...callables.keys()].sort()) {
    const fn = astIndex.get(sig);
    if (!fn) continue; // bodiless (interface/abstract/ambient/implicit) or unmatchable
    const build = buildCfg(sig, fn);
    if (build) builds.set(sig, build);
  }
  log.info(`program graphs: ${builds.size} callables (of ${callables.size} in the symbol table)`);

  // ---- map recorded call sites onto CFG statement nodes ----
  const callSites = new Map<string, CallSiteRef[]>();
  for (const [sig, build] of builds) {
    const refs: CallSiteRef[] = [];
    for (const site of (callables.get(sig) as TSCallable).call_sites) {
      const nodeId = containingNode(build, site);
      if (nodeId === null) continue;
      refs.push({ nodeId, callee: site.callee_signature, argCount: site.argument_types.length });
    }
    refs.sort((a, b) => a.nodeId - b.nodeId || (a.callee ?? "").localeCompare(b.callee ?? ""));
    callSites.set(sig, refs);
  }

  // ---- stages 5–6: SCC condensation + summary fixpoint (re-runs stage 3 per iteration) ----
  const { summaries, defUse, sccs } = composeSummaries(builds, callSites, root, k, log);
  log.debug(`program graphs: ${sccs.length} SCCs, largest ${Math.max(0, ...sccs.map((s) => s.length))}`);

  // ---- stages 2 + 4: control dependence, PDG assembly; emission per --graphs selector ----
  const wantCfg = opts.graphs.includes("cfg");
  const wantPdg = opts.graphs.includes("pdg");
  const wantDfg = opts.graphs.includes("dfg");
  const wantSdg = opts.graphs.includes("sdg");

  const functions: Record<string, FunctionGraphs> = {};
  for (const [sig, build] of [...builds.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fg: FunctionGraphs = {};
    if (wantCfg) {
      fg.cfg = {
        nodes: build.nodes.map((n) => emitNode(n.id, n.kind, n.ast, build)),
        edges: [...build.edges].sort((a, b) => a.source - b.source || a.target - b.target || a.kind.localeCompare(b.kind)),
      };
    }
    if (wantPdg || wantDfg) {
      const edges: PdgEdge[] = [];
      if (wantPdg) edges.push(...controlDependence(build, postDominators(build)));
      edges.push(...(defUse.get(sig)?.ddg ?? []));
      fg.pdg = {
        edges: edges.sort(
          (a, b) =>
            a.source - b.source || a.target - b.target || a.type.localeCompare(b.type) || (a.var ?? "").localeCompare(b.var ?? ""),
        ),
      };
    }
    functions[sig] = fg;
  }

  const sdg_edges = wantSdg ? assembleSdg(builds, callSites, summaries) : [];

  persistSummaries(opts, symbol_table, callables, summaries, k, log);

  return { schema_version: PROGRAM_GRAPHS_SCHEMA_VERSION, k_limit: k, functions, sdg_edges };
}

// ------------------------------------------------------------------------------------------------
// Identity mapping
// ------------------------------------------------------------------------------------------------

/**
 * Walk every project source file and index callable declarations by canonical signature — the
 * same computeSignatureForDecl the symbol table and call graph use, so keys byte-match. For
 * `const f = () => {}` the signature keys the VariableDeclaration but the CFG is built from the
 * initializer (the node that owns parameters and body).
 */
function indexCallableDecls(project: Project, root: string): Map<string, Node> {
  const idx = new Map<string, Node>();
  for (const sf of project.getSourceFiles()) {
    const fp = sf.getFilePath();
    if (sf.isDeclarationFile() || fp.includes("/node_modules/")) continue;
    sf.forEachDescendant((n) => {
      if (
        Node.isFunctionDeclaration(n) ||
        Node.isMethodDeclaration(n) ||
        Node.isConstructorDeclaration(n) ||
        Node.isGetAccessorDeclaration(n) ||
        Node.isSetAccessorDeclaration(n)
      ) {
        const sig = computeSignatureForDecl(n, root);
        if (sig && !idx.has(sig)) idx.set(sig, n);
      } else if (Node.isVariableDeclaration(n)) {
        const init = n.getInitializer();
        if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
          const sig = computeSignatureForDecl(n, root);
          if (sig && !idx.has(sig)) idx.set(sig, init);
        }
      }
    });
  }
  return idx;
}

// ------------------------------------------------------------------------------------------------
// Call-site → CFG-node mapping
// ------------------------------------------------------------------------------------------------

/** The innermost CFG node whose AST span contains the recorded call site, or null. */
function containingNode(build: FunctionCfgBuild, site: TSCallsite): number | null {
  const pos = positionOf(build.sf, site.start_line, site.start_column);
  if (pos === null) return null;
  let best: { id: number; len: number } | null = null;
  for (const n of build.nodes) {
    if (!n.ast) continue;
    const start = n.ast.getStart();
    const end = n.ast.getEnd();
    if (pos < start || pos >= end) continue;
    const len = end - start;
    if (!best || len < best.len) best = { id: n.id, len };
  }
  return best?.id ?? null;
}

function positionOf(sf: SourceFile, line: number, column: number): number | null {
  try {
    return ts.getPositionOfLineAndCharacter(sf.compilerNode, line - 1, column - 1);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------------------------
// Emission helpers
// ------------------------------------------------------------------------------------------------

function emitNode(id: number, kind: GraphNode["kind"], ast: Node | null, build: FunctionCfgBuild): GraphNode {
  const target = ast ?? build.fn; // ENTRY/EXIT carry the whole callable's span
  const s = build.sf.getLineAndColumnAtPos(target.getStart());
  const e = build.sf.getLineAndColumnAtPos(target.getEnd());
  return { id, kind, start_line: s.line, start_column: s.column, end_line: e.line, end_column: e.column };
}

// ------------------------------------------------------------------------------------------------
// Summary persistence (dependency-recorded, for later incrementality; write-only today)
// ------------------------------------------------------------------------------------------------

function persistSummaries(
  opts: AnalysisOptions,
  symbol_table: Record<string, TSModule>,
  callables: Map<string, TSCallable>,
  summaries: Map<string, import("./summaries").FunctionSummary>,
  k: number,
  log: Logger,
): void {
  try {
    const cacheDir = opts.cacheDir ?? path.join(opts.input, ".codeanalyzer");
    fs.mkdirSync(cacheDir, { recursive: true });
    const entries: Record<string, unknown> = {};
    for (const sig of [...summaries.keys()].sort()) {
      const c = callables.get(sig);
      entries[sig] = {
        ...summaries.get(sig),
        content_hash: (c && symbol_table[c.path]?.content_hash) ?? null,
      };
    }
    const payload = { schema_version: PROGRAM_GRAPHS_SCHEMA_VERSION, k_limit: k, summaries: entries };
    fs.writeFileSync(path.join(cacheDir, "graphs_summaries.json"), JSON.stringify(payload, null, 2));
  } catch (e) {
    log.warn(`could not persist graph summaries: ${(e as Error).message}`);
  }
}

// ------------------------------------------------------------------------------------------------
// Symbol-table collection (signature → callable), recursing through every container kind
// ------------------------------------------------------------------------------------------------

function collectModule(mod: TSModule, out: Map<string, TSCallable>): void {
  for (const f of Object.values(mod.functions)) collectCallable(f, out);
  for (const c of Object.values(mod.classes)) collectClass(c, out);
  for (const ns of Object.values(mod.namespaces)) collectNamespace(ns, out);
}

function collectNamespace(ns: TSNamespace, out: Map<string, TSCallable>): void {
  for (const f of Object.values(ns.functions)) collectCallable(f, out);
  for (const c of Object.values(ns.classes)) collectClass(c, out);
  for (const n of Object.values(ns.namespaces)) collectNamespace(n, out);
}

function collectClass(c: TSClass, out: Map<string, TSCallable>): void {
  for (const m of Object.values(c.methods)) collectCallable(m, out);
  for (const ic of Object.values(c.inner_classes)) collectClass(ic, out);
}

function collectCallable(c: TSCallable, out: Map<string, TSCallable>): void {
  out.set(c.signature, c);
  for (const ic of Object.values(c.inner_callables)) collectCallable(ic, out);
  for (const cl of Object.values(c.inner_classes)) collectClass(cl, out);
}
