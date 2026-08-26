/**
 * Schema v2 — the wire envelope + application root, and the historical `V2*` names for the tree
 * node types. The tree shapes themselves are the NATIVE model in `../schema.ts` (the stages
 * build them directly); this file adds only what exists at serialization scope: the envelope,
 * the assembled root, and the cross-callable edge shapes.
 *
 * The `V2*` aliases keep the projection/tests compiling during the native-model transition
 * (#96); the Stage-4 teardown folds this file into `../schema.ts` and retires the aliases.
 */

import type { TSCallable, TSField, TSModule, TSSpan, TSType } from "../schema";
import type { TSBodyNode } from "../schema";
import type { TSExternalNode, TSSynthesizedNode } from "../homing";
import type { WireCallEdge } from "../l2Callees";

/** The one universal attribute. `bytes` are char offsets into the owning module's `source`. */
export type Span = TSSpan;

// ----------------------------------------------------------------------------------------------
// Root
// ----------------------------------------------------------------------------------------------

export interface V2Application {
  schema_version: string; // "2.1.0"
  language: string; // "typescript"
  max_level: number; // highest level populated; consumers read this, not key-sniffing
  k_limit?: number; // access-path depth bound for the L3/L4 dataflow (present at L3+)
  analyzer: V2Analyzer; // which analyzer produced this artifact, and at what version
  application: V2Root;
}

/** Analyzer identity — lets consumers correlate an `analysis.json` with the tool/version that emitted it. */
export interface V2Analyzer {
  name: string; // "codeanalyzer-typescript"
  version: string; // ANALYZER_VERSION (src/utils/version.ts)
}

export interface V2Root {
  id: string; // can://<lang>/<app>
  kind: "application";
  symbol_table: Record<string, TSModule>; // keyed by project-relative POSIX path (with extension)
  call_graph: WireCallEdge[]; // L2 — callable → callable (empty at L1)
  param_in: V2ParamEdge[]; // L4 (empty until L4)
  param_out: V2ParamEdge[]; // L4
  // TS-additive (parity): edge endpoints outside the containment tree need an id home.
  external_symbols?: Record<string, TSExternalNode>; // L2 — imported/library call targets, keyed by id
  // L2 — 2.1.0 compatibility index: pre-2.1.0 anonymous-callable id → the tree id that replaced
  // it. Anonymous callables are real nodes in the tree; entries whose key equals their own `id`
  // are the residual fallback nodes for signatures no provider could name.
  synthesized_callables?: Record<string, TSSynthesizedNode>;
}

// ----------------------------------------------------------------------------------------------
// Cross-callable edges (application scope)
// ----------------------------------------------------------------------------------------------

export type V2CallEdge = WireCallEdge;

export interface V2ParamEdge {
  src: string;
  dst: string;
  var?: string;
}

// ----------------------------------------------------------------------------------------------
// Historical names for the native tree types (transition aliases, retired at Stage 4)
// ----------------------------------------------------------------------------------------------

export type V2Module = TSModule;
export type V2Type = TSType;
export type V2Callable = TSCallable;
export type V2Field = TSField;
export type V2BodyNode = TSBodyNode;
export type V2External = TSExternalNode;

/** A loosely-typed node view for consumers that probe optional attributes (the Neo4j projection). */
export interface V2Node {
  id: string;
  kind: string;
  span?: Span;
  [attr: string]: unknown;
}
