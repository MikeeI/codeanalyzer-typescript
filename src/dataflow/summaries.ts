/**
 * Stages 5–6 — the interprocedural half: SCC condensation of the (frozen, provenance-merged)
 * call graph, then bottom-up relational function summaries composed over the condensation DAG.
 *
 * A summary answers, per callable: which argument positions flow to the return value, which
 * module-level globals it (transitively) reads and writes, and which globals flow to its return.
 * Summaries are node-granular — dependence is tracked between CFG nodes, not sub-expressions —
 * which keeps them sound-leaning and over-approximate (the contract's precision posture).
 *
 * Composition order is Tarjan's SCC emission order (callees before callers). Within an SCC
 * (mutual recursion), member summaries are co-defined: each member's def-use is recomputed with
 * the current callee summaries applied at its call sites (globals become extra uses/defs on the
 * callsite node), iterating to a monotone fixpoint. Termination: summary domains are finite —
 * argument indices are bounded by arity and global paths are k-limited — and grow monotonically.
 *
 * External / unresolved callees: conservative pass-through — every argument may flow to the
 * result (applied at SDG/SUMMARY emission); their global effects are unmodeled (documented
 * unsoundness: npm internals are not analyzed).
 */
import type { Logger } from "../utils";
import { type CallEffects, type DefUseResult, type GlobalPath, computeDefUse, renderGlobal } from "./defuse";
import type { FunctionCfgBuild } from "./model";

/** A call site inside a callable, mapped onto its CFG statement node. */
export interface CallSiteRef {
  nodeId: number;
  /** Callee signature (symbol-table / external / synthesized key), or null when unresolved. */
  callee: string | null;
  argCount: number;
}

export interface FunctionSummary {
  /** Argument indices whose value may flow to the return value. */
  param_flows: number[];
  global_reads: GlobalPath[];
  global_writes: GlobalPath[];
  /** Rendered global paths that may flow to the return value. */
  globals_to_return: string[];
  /** Callee signatures this summary was composed from (recorded for later incrementality). */
  deps: string[];
}

export interface SummaryResult {
  summaries: Map<string, FunctionSummary>;
  /** The fixpoint def-use per callable (its DDG already reflects callee global effects). */
  defUse: Map<string, DefUseResult>;
  /** SCCs in composition (reverse-topological, callees-first) order — exposed for tests. */
  sccs: string[][];
}

export function composeSummaries(
  builds: Map<string, FunctionCfgBuild>,
  callSites: Map<string, CallSiteRef[]>,
  root: string,
  k: number,
  log: Logger,
): SummaryResult {
  const sigs = [...builds.keys()].sort();
  const adj = new Map<string, string[]>();
  for (const s of sigs) {
    const targets = new Set<string>();
    for (const cs of callSites.get(s) ?? []) {
      if (cs.callee && builds.has(cs.callee) && cs.callee !== s) targets.add(cs.callee);
    }
    adj.set(s, [...targets].sort());
  }

  const sccs = tarjan(sigs, adj); // emitted callees-first
  const summaries = new Map<string, FunctionSummary>();
  const defUse = new Map<string, DefUseResult>();

  for (const scc of sccs) {
    // Co-define the SCC members' summaries to a fixpoint (a singleton converges in one pass +
    // one confirmation pass only when it is self-recursive; plain members need a single pass).
    const members = [...scc].sort();
    const selfReferential =
      members.length > 1 ||
      (callSites.get(members[0] as string) ?? []).some((cs) => cs.callee === members[0]);
    let iterations = 0;
    for (;;) {
      let changed = false;
      for (const sig of members) {
        const build = builds.get(sig) as FunctionCfgBuild;
        const effects = effectsFor(callSites.get(sig) ?? [], summaries);
        const du = computeDefUse(build, root, k, effects);
        const next = summarize(build, du, callSites.get(sig) ?? []);
        if (!summaries.has(sig) || !sameSummary(summaries.get(sig) as FunctionSummary, next)) changed = true;
        summaries.set(sig, next);
        defUse.set(sig, du);
      }
      iterations++;
      if (!changed || !selfReferential) break;
      if (iterations > 100) {
        log.warn(`summary fixpoint did not settle after ${iterations} iterations for SCC [${members.join(", ")}]`);
        break;
      }
    }
  }
  return { summaries, defUse, sccs };
}

/** Project the current callee summaries onto a function's call sites as global read/write effects. */
function effectsFor(sites: CallSiteRef[], summaries: Map<string, FunctionSummary>): Map<number, CallEffects> {
  const out = new Map<number, CallEffects>();
  for (const cs of sites) {
    if (!cs.callee) continue;
    const s = summaries.get(cs.callee);
    if (!s) continue;
    const cur = out.get(cs.nodeId) ?? { reads: [], writes: [] };
    cur.reads.push(...s.global_reads);
    cur.writes.push(...s.global_writes);
    out.set(cs.nodeId, cur);
  }
  return out;
}

function summarize(build: FunctionCfgBuild, du: DefUseResult, _sites: CallSiteRef[]): FunctionSummary {
  // Forward DDG adjacency (def-node → use-node = "use-node depends on def-node").
  const fwd = new Map<number, Set<number>>();
  for (const e of du.ddg) {
    if (!fwd.has(e.source)) fwd.set(e.source, new Set());
    fwd.get(e.source)?.add(e.target);
  }
  const reaches = (starts: number[]): Set<number> => {
    const seen = new Set<number>(starts);
    const stack = [...starts];
    while (stack.length) {
      const n = stack.pop() as number;
      for (const s of fwd.get(n) ?? []) {
        if (!seen.has(s)) {
          seen.add(s);
          stack.push(s);
        }
      }
    }
    return seen;
  };
  const touchesReturn = (starts: number[]): boolean => {
    for (const n of reaches(starts)) if (du.returnValueNodes.has(n)) return true;
    return false;
  };

  const param_flows: number[] = [];
  for (const [i, pid] of build.paramIds.entries()) {
    if (touchesReturn([pid])) param_flows.push(i);
  }

  // Global reads/writes: module-kind uses/defs anywhere in the function. Callee effects were
  // already injected into the facts by computeDefUse, so transitive effects fall out for free.
  // ENTRY's synthetic ambient defs are initializations, not writes — exclude them.
  const readsByKey = new Map<string, GlobalPath>();
  const writesByKey = new Map<string, GlobalPath>();
  const usedAt = new Map<string, number[]>();
  for (const [nodeId, f] of du.facts) {
    for (const u of f.uses) {
      if (u.baseKind !== "module") continue;
      const g: GlobalPath = { key: u.key, fields: u.fields };
      readsByKey.set(renderGlobal(g), g);
      const arr = usedAt.get(u.key) ?? [];
      arr.push(nodeId);
      usedAt.set(u.key, arr);
    }
    if (nodeId === build.entryId) continue;
    for (const d of f.defs) {
      if (d.ref.baseKind !== "module") continue;
      const g: GlobalPath = { key: d.ref.key, fields: d.ref.fields };
      writesByKey.set(renderGlobal(g), g);
    }
  }

  const globals_to_return: string[] = [];
  for (const [rendered, g] of readsByKey) {
    const nodes = usedAt.get(g.key) ?? [];
    if (nodes.length && touchesReturn(nodes)) globals_to_return.push(rendered);
  }

  const deps = new Set<string>();
  for (const cs of _sites) if (cs.callee) deps.add(cs.callee);

  return {
    param_flows: param_flows.sort((a, b) => a - b),
    global_reads: sortGlobals([...readsByKey.values()]),
    global_writes: sortGlobals([...writesByKey.values()]),
    globals_to_return: globals_to_return.sort(),
    deps: [...deps].sort(),
  };
}

function sortGlobals(gs: GlobalPath[]): GlobalPath[] {
  return gs.sort((a, b) => renderGlobal(a).localeCompare(renderGlobal(b)));
}

function sameSummary(a: FunctionSummary, b: FunctionSummary): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ------------------------------------------------------------------------------------------------
// Tarjan SCC — emission order is reverse-topological (an SCC is emitted after every SCC it calls).
// ------------------------------------------------------------------------------------------------

function tarjan(nodes: string[], adj: Map<string, string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  let counter = 0;

  const strongconnect = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongconnect(w);
        low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) as number, index.get(w) as number));
      }
    }
    if (low.get(v) === index.get(v)) {
      const scc: string[] = [];
      for (;;) {
        const w = stack.pop() as string;
        onStack.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      out.push(scc);
    }
  };

  for (const v of nodes) if (!index.has(v)) strongconnect(v);
  return out;
}
