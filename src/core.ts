import * as path from "node:path";
import { type ExtractionHandle, buildProgramGraphs, startExtraction } from "./dataflow";
import type { CallableGraphData } from "./dataflow/model";
import { type CallGraphResult, type LinkerResolutions, mergeCallGraphs, runDefuseLinker, tscProvider } from "./semantic_analysis";
import { loadCache, saveCache } from "./utils";
import { materialize } from "./build";
import { inventoryArtifacts } from "./artifacts";
import type { AnalysisOptions } from "./options";
import type { AnalysisInternal } from "./schema";
import { type AnalysisResult, finalizeAnalysis } from "./schema/emit";
import { buildSymbolTable } from "./syntactic_analysis";
import { Logger } from "./utils";
import { checkerFailures, resetCheckerFailures } from "./schema/checker";

export type { AnalysisResult } from "./schema/emit";

/**
 * The orchestrator. Order mirrors the reference analyzers (python core.py): materialize deps →
 * build the symbol table → call-graph providers → program graphs → cache the id-free base →
 * run the per-run pass spine (ids / body / heritage / homing / callees / attach) and assemble
 * the wire envelope. Returns BOTH views: the wire `application` and the live `internal` tree.
 */
export async function analyze(opts: AnalysisOptions): Promise<AnalysisResult> {
  const log = new Logger(opts.verbosity);
  log.info(`analyzing ${opts.input} (level ${opts.analysisLevel})`);
  resetCheckerFailures();
  const cacheDir = opts.cacheDir ?? path.join(opts.input, ".codeanalyzer");

  const mat = materialize(opts, log);
  for (const note of mat.notes) log.debug(note);

  const cached = opts.eager ? null : loadCache(cacheDir);
  const { project, symbol_table, programs } = buildSymbolTable(opts, mat, cached?.symbol_table ?? null, log);

  // Each program owns both its checker and its graph extraction configuration. Start extraction
  // before resolving that program's calls so worker mode preserves the intended overlap, then join
  // before advancing. Reusing one pool bounds worker-project residency across monorepo programs.
  const graphData = new Map<string, CallableGraphData>();
  let graphPool: ExtractionHandle["pool"] = null;

  let cg: CallGraphResult = { edges: [], external_symbols: {}, synthesized_callables: {} };
  const resolutions: LinkerResolutions = new Map();
  for (const prog of programs) {
    const ownedSymbols = Object.fromEntries(
      Object.entries(symbol_table).filter(([fileKey]) => prog.fileKeys.has(fileKey)),
    );
    const extraction: ExtractionHandle | null = opts.analysisLevel >= 3
      ? startExtraction(prog.project, ownedSymbols, prog.configPath, opts, log, graphPool)
      : null;

    try {
      if (opts.analysisLevel >= 2) {
        const ctx = {
          project: prog.project,
          symbol_table,
          root: opts.input,
          log,
          phantoms: opts.phantoms,
          only: prog.fileKeys,
        };
        cg = mergeCallGraphs(cg, tscProvider.build(ctx));
        // The defuse linker overlays the tsc base: it reads the callee_signature backfill the tsc
        // leg just wrote, resolves what remains (tiers T1–T5, defuseLinker.ts), and returns its
        // body-node resolutions out-of-band (never persisted — cache provenance rule).
        const linked = runDefuseLinker(ctx);
        cg = mergeCallGraphs(cg, linked.result);
        for (const [caller, m] of linked.resolutions) {
          const ex = resolutions.get(caller);
          if (!ex) resolutions.set(caller, m);
          else for (const [k, v] of m) if (!ex.has(k)) ex.set(k, v);
        }
      }

      if (extraction) {
        for (const [signature, data] of await extraction.promise) graphData.set(signature, data);
        graphPool = extraction.pool;
      }
    } catch (error) {
      extraction?.pool?.close();
      if (graphPool !== extraction?.pool) graphPool?.close();
      throw error;
    }
  }
  const call_graph = cg.edges;

  const extraction: ExtractionHandle | null = opts.analysisLevel >= 3
    ? { promise: Promise.resolve(graphData), pool: graphPool }
    : null;
  const pg = extraction ? await buildProgramGraphs(extraction, symbol_table, opts, log) : null;

  // Repository-artifact layer (#101, python PR #160 parity): level-free, identical at every -a.
  const layer = inventoryArtifacts(opts.input, opts, symbol_table);
  log.info(
    `artifacts: ${Object.keys(layer.artifacts).length} files, ${layer.dependencies.length} dependency records, ` +
      `${layer.unresolved_imports.length} unresolved imports`,
  );

  const app: AnalysisInternal = {
    symbol_table,
    call_graph,
    external_symbols: cg.external_symbols,
    synthesized_callables: cg.synthesized_callables,
    artifacts: layer.artifacts,
    dependencies: layer.dependencies,
    unresolved_imports: layer.unresolved_imports,
  };

  // Graph extraction and the provider-backed call graph are joined above before artifacts and
  // per-run schema passes, so every program contributes to the same deterministic graph envelope.

  // Cache the id-free base (ids/body/heritage are per-run layers stamped by finalizeAnalysis;
  // the cached tree must stay --app-name-free).
  saveCache(cacheDir, { symbol_table });
  // Never let "some edges are missing" look like "there were no edges": a node the checker could
  // not resolve is skipped (see schema/checker.ts), and the count is said out loud.
  const skipped = checkerFailures();
  if (skipped) log.warn(`${skipped} symbol resolution(s) skipped — the TypeScript checker could not resolve them; affected call edges are absent`);
  return finalizeAnalysis(app, pg, opts, resolutions, project);
}
