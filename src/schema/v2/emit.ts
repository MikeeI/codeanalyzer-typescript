/**
 * Schema-v2 emission: run the per-run passes over the NATIVELY-built tree, assemble the envelope,
 * and strip the INTERNAL fields. No reshaping happens here any more — the builders construct the
 * wire shapes directly (src/syntactic_analysis/builders.ts) and the passes stamp the per-run
 * layers (python-parity architecture, #96):
 *
 *   assignIds       — can:// ids (per-run: ids embed --app-name; the cache stays id-free)
 *   populateL1Body  — call_sites → body{} `call` nodes, callee: null
 *   resolveHeritage — extends_ids / implements_ids (resolved-only)
 *   [L2] homeExternals / homeSynthesized / backfillCallees / reidentifyCallGraph
 *   [L3/4] applyDataflow — program_graphs → body{} + cfg/cdg/ddg/summary + param_in/param_out
 *
 * The returned application is a DEEP, INTERNAL-FIELD-STRIPPED copy: the live tree keeps
 * `call_sites`, `abs_path`, and the cache metadata for the resolver/dataflow/cache, while every
 * consumer of the emission (JSON writer, Neo4j projection, tests) sees exactly the wire.
 */

import * as path from "node:path";
import type { AnalysisOptions } from "../../options";
import { ANALYZER_VERSION } from "../../utils/version";
import type { TSApplication } from "../schema";
import { assignIds } from "../assignIds";
import { populateL1Body } from "../l1Body";
import { resolveHeritageIds } from "../heritage";
import { homeExternals, homeSynthesized } from "../homing";
import { backfillCallees, reidentifyCallGraph } from "../l2Callees";
import { applyDataflow } from "./dataflow";
import type { V2Application, V2Root } from "./model";

const LANGUAGE = "typescript";
const SCHEMA_VERSION = "2.1.0";
const ANALYZER_NAME = "codeanalyzer-typescript";
/** Highest analysis level this emitter populates today (L1 tree, L2 call graph, L3/L4 dataflow). */
const MAX_IMPLEMENTED = 4;

/** INTERNAL model fields — never on the wire (see schema.ts header). */
const INTERNAL_KEYS = new Set<string>(["call_sites", "abs_path", "content_hash", "last_modified", "file_size"]);

// ----------------------------------------------------------------------------------------------
// entry point
// ----------------------------------------------------------------------------------------------

export interface ToV2Result {
  application: V2Application;
  idBySig: Map<string, string>; // signature → can:// id (real callables + externals + synthesized)
  collisions: string[]; // signatures that mapped to two distinct ids (L1 id-uniqueness gate)
  dangling: string[]; // call-graph endpoints with no id home (L2 no-dangling gate; should be empty)
}

export function toV2Detailed(app: TSApplication, opts: AnalysisOptions): ToV2Result {
  const level = opts.analysisLevel;
  const appName = (opts.appName ?? (opts.input ? path.basename(opts.input) : "") ?? "").trim() || "app";

  // L1 — stamp ids, derive body{}, project heritage (all overwrite-idempotent per-run passes).
  const { appId, idBySig, callableBySig, collisions } = assignIds(app, appName);
  populateL1Body(app);
  resolveHeritageIds(app, idBySig);

  const root: V2Root = { id: appId, kind: "application", symbol_table: app.symbol_table, call_graph: [], param_in: [], param_out: [] };

  // L2 — home the off-tree edge endpoints, backfill `callee`, re-identify the call graph.
  const dangling: string[] = [];
  if (level >= 2) {
    root.external_symbols = homeExternals(app, appId, idBySig);
    root.synthesized_callables = homeSynthesized(app, appId, idBySig);
    backfillCallees(app, idBySig);
    root.call_graph = reidentifyCallGraph(app.call_graph ?? [], idBySig, dangling);
  }

  // L3/L4 — grow body{} + cfg/cdg/ddg/summary on callables and param_in/param_out on the app.
  let k_limit: number | undefined;
  if (level >= 3 && app.program_graphs) {
    applyDataflow(root, app, idBySig, callableBySig, level);
    k_limit = app.program_graphs.k_limit;
  }

  const envelope: V2Application = {
    schema_version: SCHEMA_VERSION,
    language: LANGUAGE,
    max_level: Math.min(level, MAX_IMPLEMENTED),
    ...(k_limit !== undefined ? { k_limit } : {}),
    analyzer: { name: ANALYZER_NAME, version: ANALYZER_VERSION },
    application: root,
  };
  // The wire copy: deep, detached from the live tree, internal fields stripped by key.
  const application = JSON.parse(
    JSON.stringify(envelope, (key, value) => (INTERNAL_KEYS.has(key) ? undefined : value)),
  ) as V2Application;
  return { application, idBySig, collisions, dangling };
}

/** The default emitter surface: native app + options → schema-v2 Application (the wire). */
export function toV2(app: TSApplication, opts: AnalysisOptions): V2Application {
  return toV2Detailed(app, opts).application;
}
