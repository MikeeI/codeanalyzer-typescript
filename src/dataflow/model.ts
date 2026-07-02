/**
 * Internal (non-emitted) working model shared by the level-3 dataflow stages. The emitted shapes
 * live in schema/graphs.ts; everything here additionally keeps the ts-morph AST links the later
 * stages (def-use, summaries, SDG) need, and is dropped before serialization.
 */
import type { Node, SourceFile } from "ts-morph";
import type { CfgEdge, GraphNodeKind } from "../schema";

/** A CFG node with its AST link. `ast` is null only for the synthetic ENTRY/EXIT pair. */
export interface DfNode {
  id: number;
  kind: GraphNodeKind;
  ast: Node | null;
}

/** The per-callable CFG build product (stage 1), input to every later stage. */
export interface FunctionCfgBuild {
  signature: string;
  /** The function-like AST node (FunctionDeclaration / Method / Ctor / accessor / arrow / fn-expr). */
  fn: Node;
  sf: SourceFile;
  /** Ordered by id; nodes[0] is ENTRY, nodes[nodes.length - 1] is EXIT. */
  nodes: DfNode[];
  edges: CfgEdge[];
  entryId: number;
  exitId: number;
  /** node ids of the `param` nodes, in declaration order (the SDG formal-in nodes). */
  paramIds: number[];
}

/** Successor/predecessor adjacency over CFG edges, built on demand. */
export function adjacency(build: FunctionCfgBuild): { succ: Map<number, number[]>; pred: Map<number, number[]> } {
  const succ = new Map<number, number[]>();
  const pred = new Map<number, number[]>();
  for (const n of build.nodes) {
    succ.set(n.id, []);
    pred.set(n.id, []);
  }
  for (const e of build.edges) {
    succ.get(e.source)?.push(e.target);
    pred.get(e.target)?.push(e.source);
  }
  return { succ, pred };
}
