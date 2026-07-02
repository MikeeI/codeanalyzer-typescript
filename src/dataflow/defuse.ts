/**
 * Stage 3 — variable identity (k-limited access paths) and local def-use (the DDG).
 *
 * Access-path model: `base(.field | [*])*`, where the base is a local, parameter, `this`,
 * captured variable, or module binding — identified by its *declaration node* (so shadowed names
 * in nested scopes never share a base) and labeled by its name. Module bindings are canonical
 * `<modulePrefix>.<name>` (the same prefix as signatures), which is what lets globals ride the
 * SDG across functions and files. Depth is k-limited (`--graph-field-depth`): `x.f.g.h` with k=3
 * becomes `x.f.g.*`, which conservatively aliases every deeper path.
 *
 * Aliasing (MVP substrate, per issue #2 / SCHEMA_DECISIONS.md): flow-insensitive union-find over
 * bases connected by direct copies (`const q = p`); a write through one name weakly updates the
 * other. Points-to-backed aliasing via Jelly's solved state is the staged upgrade (PR F).
 *
 * Def-use: classic forward may reaching-definitions over the stage-1 CFG. Strong (killing)
 * defs are whole-base writes to locals/params; every field write is weak. Captured/module/this
 * bases get a synthetic def at ENTRY (their value on function entry) — the same convention the
 * SDG uses when it targets ENTRY with global PARAM_IN edges. Reads inside nested callables of
 * variables they capture are attributed to the declaring statement node (capture-at-declaration).
 *
 * Call-site global effects (`callEffects`): the summary driver (stage 6) re-runs this analysis
 * with the transitive global reads/writes of each call's callee applied at the callsite node,
 * which is how cross-function global flow becomes visible in the caller's DDG.
 */
import { Node, SyntaxKind } from "ts-morph";
import type { PdgEdge } from "../schema";
import { fileKeyOf } from "../schema";
import { isFunctionBoundary } from "./cfg";
import { adjacency, type DfNode, type FunctionCfgBuild } from "./model";

// ------------------------------------------------------------------------------------------------
// Access paths
// ------------------------------------------------------------------------------------------------

export type BaseKind = "local" | "param" | "this" | "captured" | "module";

export interface PathRef {
  /** Unique base identity: decl-position for locals/params/captured, canonical path for module, "this". */
  key: string;
  /** Human label for the base (the variable name / canonical module path). */
  label: string;
  baseKind: BaseKind;
  fields: string[]; // "f" | "[*]" | "*" (trailing truncation star)
}

export function renderPath(p: PathRef): string {
  let s = p.label;
  for (const f of p.fields) s += f === "[*]" ? "[*]" : `.${f}`;
  return s;
}

/** A global (module-binding) path as carried by summaries: canonical base + fields. */
export interface GlobalPath {
  key: string; // == the canonical `<modulePrefix>.<name>` label
  fields: string[];
}

export function renderGlobal(g: GlobalPath): string {
  return renderPath({ key: g.key, label: g.key, baseKind: "module", fields: g.fields });
}

function kLimit(fields: string[], k: number): string[] {
  return fields.length > k ? [...fields.slice(0, k), "*"] : fields;
}

/** May two field lists overlap? "*" (truncation) matches any tail; "[*]" matches any one step. */
function fieldsMayAlias(a: string[], b: string[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] as string;
    const y = b[i] as string;
    if (x === "*" || y === "*") return true;
    if (x === "[*]" || y === "[*]") continue; // dynamic index may hit any member
    if (x !== y) return false;
  }
  return true; // one path is a prefix of the other (whole-object vs member)
}

// ------------------------------------------------------------------------------------------------
// Per-node dataflow facts
// ------------------------------------------------------------------------------------------------

export interface DefFact {
  ref: PathRef;
  /** Strong defs kill; only whole-base writes of locals/params qualify (field writes are weak). */
  strong: boolean;
}

export interface NodeFacts {
  defs: DefFact[];
  uses: PathRef[];
}

export interface CallEffects {
  reads: GlobalPath[];
  writes: GlobalPath[];
}

export interface DefUseResult {
  ddg: PdgEdge[];
  facts: Map<number, NodeFacts>;
  /** Union-find representative per base key (the copy-alias classes). */
  aliasRep: Map<string, string>;
  /** Nodes that produce the function's return value (`return expr` / arrow expression body). */
  returnValueNodes: Set<number>;
}

// ------------------------------------------------------------------------------------------------
// Base resolution
// ------------------------------------------------------------------------------------------------

function enclosingCallable(node: Node): Node | undefined {
  let cur: Node | undefined = node.getParent();
  while (cur) {
    if (
      Node.isFunctionDeclaration(cur) ||
      Node.isFunctionExpression(cur) ||
      Node.isArrowFunction(cur) ||
      Node.isMethodDeclaration(cur) ||
      Node.isConstructorDeclaration(cur) ||
      Node.isGetAccessorDeclaration(cur) ||
      Node.isSetAccessorDeclaration(cur)
    )
      return cur;
    cur = cur.getParent();
  }
  return undefined;
}

/** Resolve an identifier (in value position) to a trackable base, relative to callable `fn`. */
function resolveBase(id: Node, fn: Node, root: string): PathRef | null {
  let sym = id.getSymbol();
  if (!sym) return null;
  const aliased = sym.getAliasedSymbol();
  if (aliased) sym = aliased;
  const decls = sym.getDeclarations();
  const decl = decls && decls.length ? decls[0] : undefined;
  if (!decl) return null;

  // Only variable-like declarations are dataflow bases. Callables, classes, enums, interfaces,
  // namespaces and type aliases are code/type identities, not mutable values we track.
  const isVarLike =
    Node.isVariableDeclaration(decl) || Node.isBindingElement(decl) || Node.isParameterDeclaration(decl);
  if (!isVarLike) return null;

  const name = (decl as unknown as { getName?: () => string }).getName?.() ?? id.getText();
  const declFn = enclosingCallable(decl);
  if (declFn === fn) {
    const kind: BaseKind = Node.isParameterDeclaration(decl) ? "param" : "local";
    return { key: `${kind}:${decl.getStart()}`, label: name, baseKind: kind, fields: [] };
  }
  if (declFn === undefined) {
    // Module-level binding. Only project-internal modules become canonical global paths.
    const sf = decl.getSourceFile();
    const fp = sf.getFilePath();
    if (sf.isDeclarationFile() || fp.includes("/node_modules/")) return null;
    const { modulePrefix } = fileKeyOf(fp, root);
    const canonical = `${modulePrefix}.${name}`;
    return { key: canonical, label: canonical, baseKind: "module", fields: [] };
  }
  // Declared in some other (enclosing) callable: captured.
  return { key: `cap:${decl.getStart()}`, label: name, baseKind: "captured", fields: [] };
}

// ------------------------------------------------------------------------------------------------
// Expression walking (defs/uses extraction)
// ------------------------------------------------------------------------------------------------

class ExprWalker {
  defs: DefFact[] = [];
  uses: PathRef[] = [];

  constructor(
    private fn: Node,
    private root: string,
    private k: number,
    private union: (a: string, b: string) => void,
  ) {}

  walk(node: Node): void {
    if (Node.isIdentifier(node)) {
      const b = resolveBase(node, this.fn, this.root);
      if (b) this.uses.push(b);
      return;
    }
    if (node.getKind() === SyntaxKind.ThisKeyword) {
      this.uses.push({ key: "this", label: "this", baseKind: "this", fields: [] });
      return;
    }
    if (Node.isPropertyAccessExpression(node) || Node.isElementAccessExpression(node)) {
      const p = this.pathOf(node);
      if (p) this.uses.push(p);
      else for (const c of node.forEachChildAsArray()) this.walk(c);
      if (Node.isElementAccessExpression(node)) {
        const arg = node.getArgumentExpression();
        if (arg) this.walk(arg); // the index expression is read even when the path resolves
      }
      return;
    }
    if (Node.isBinaryExpression(node)) {
      const opKind = node.getOperatorToken().getKind();
      if (isAssignmentOperator(opKind)) {
        this.assignTarget(node.getLeft(), opKind !== SyntaxKind.EqualsToken);
        this.walk(node.getRight());
        if (opKind === SyntaxKind.EqualsToken) this.copyUnion(node.getLeft(), node.getRight());
        return;
      }
      this.walk(node.getLeft());
      this.walk(node.getRight());
      return;
    }
    if (Node.isPrefixUnaryExpression(node) || Node.isPostfixUnaryExpression(node)) {
      const op = node.getOperatorToken();
      if (op === SyntaxKind.PlusPlusToken || op === SyntaxKind.MinusMinusToken) {
        this.assignTarget(node.getOperand(), true);
        return;
      }
      this.walk(node.getOperand());
      return;
    }
    if (Node.isVariableDeclaration(node)) {
      const nameNode = node.getNameNode();
      this.bindingDefs(nameNode);
      const init = node.getInitializer();
      if (init) {
        this.walk(init);
        if (Node.isIdentifier(nameNode)) this.copyUnion(nameNode, init);
      }
      return;
    }
    if (Node.isShorthandPropertyAssignment(node)) {
      const b = resolveBase(node.getNameNode(), this.fn, this.root);
      if (b) this.uses.push(b);
      return;
    }
    if (Node.isPropertyAssignment(node)) {
      const init = node.getInitializer();
      if (init) this.walk(init);
      const nm = node.getNameNode();
      if (Node.isComputedPropertyName(nm)) this.walk(nm);
      return;
    }
    if (isFunctionBoundary(node)) {
      this.captureScan(node);
      return;
    }
    // Generic recursion. Type-position identifiers resolve to type declarations, which
    // resolveBase rejects, so descending everywhere else is safe.
    for (const c of node.forEachChildAsArray()) this.walk(c);
  }

  /** LHS of an assignment / operand of ++ --: a def (plus a use for compound operators). */
  assignTarget(lhs: Node, alsoUses: boolean): void {
    const target = unwrapExpr(lhs);
    const p = this.pathOf(target) ?? (Node.isIdentifier(target) ? resolveBase(target, this.fn, this.root) : null);
    if (target.getKind() === SyntaxKind.ThisKeyword) return; // `this` is not assignable
    if (p) {
      const strong = p.fields.length === 0 && (p.baseKind === "local" || p.baseKind === "param");
      this.defs.push({ ref: p, strong });
      if (alsoUses) this.uses.push(p);
      if (Node.isElementAccessExpression(target)) {
        const arg = target.getArgumentExpression();
        if (arg) this.walk(arg);
      }
      return;
    }
    if (Node.isObjectLiteralExpression(target) || Node.isArrayLiteralExpression(target)) {
      // Destructuring assignment pattern: each element identifier is a def.
      for (const el of target.forEachChildAsArray()) this.assignTarget(el, false);
      return;
    }
    // Untrackable target (e.g. `f().x = 1`): its subexpressions are still reads.
    this.walk(target);
  }

  /** Declaration name / binding pattern: strong defs for every bound name. */
  bindingDefs(nameNode: Node): void {
    if (Node.isIdentifier(nameNode)) {
      const b = resolveBase(nameNode, this.fn, this.root);
      if (b) this.defs.push({ ref: b, strong: b.baseKind === "local" || b.baseKind === "param" });
      return;
    }
    // Object/array binding pattern: defs for each element name, uses for defaults/computed keys.
    for (const el of nameNode.getDescendantsOfKind(SyntaxKind.BindingElement)) {
      const n = el.getNameNode();
      if (Node.isIdentifier(n)) {
        const b = resolveBase(n, this.fn, this.root);
        if (b) this.defs.push({ ref: b, strong: b.baseKind === "local" || b.baseKind === "param" });
      }
      const init = el.getInitializer();
      if (init) this.walk(init);
    }
  }

  /** Build a k-limited access path from a property/element access chain, if the root is trackable. */
  private pathOf(node: Node): PathRef | null {
    const fields: string[] = [];
    let cur: Node = node;
    for (;;) {
      cur = unwrapExpr(cur);
      if (Node.isPropertyAccessExpression(cur)) {
        fields.unshift(cur.getNameNode().getText());
        cur = cur.getExpression();
      } else if (Node.isElementAccessExpression(cur)) {
        fields.unshift("[*]");
        cur = cur.getExpression();
      } else {
        break;
      }
    }
    let base: PathRef | null = null;
    if (Node.isIdentifier(cur)) base = resolveBase(cur, this.fn, this.root);
    else if (cur.getKind() === SyntaxKind.ThisKeyword) base = { key: "this", label: "this", baseKind: "this", fields: [] };
    if (!base) return null;
    return { ...base, fields: kLimit(fields, this.k) };
  }

  /** `q = p` on bare bases: q and p may alias from here on (flow-insensitive, weak). */
  private copyUnion(lhs: Node, rhs: Node): void {
    const l = unwrapExpr(lhs);
    const r = unwrapExpr(rhs);
    if (!Node.isIdentifier(l) || !Node.isIdentifier(r)) return;
    const lb = resolveBase(l, this.fn, this.root);
    const rb = resolveBase(r, this.fn, this.root);
    if (lb && rb) this.union(lb.key, rb.key);
  }

  /**
   * A nested callable: don't descend normally — attribute its reads of variables declared
   * OUTSIDE it (captured locals, module bindings, `this`) to the declaring node (capture edges).
   */
  captureScan(fnNode: Node): void {
    fnNode.forEachDescendant((n) => {
      if (Node.isIdentifier(n)) {
        // Skip property-name positions; the receiver carries the read.
        const parent = n.getParent();
        if (parent && Node.isPropertyAccessExpression(parent) && parent.getNameNode() === n) return;
        if (parent && Node.isPropertyAssignment(parent) && parent.getNameNode() === n) return;
        const b = resolveBase(n, this.fn, this.root);
        if (!b) return;
        // Only reads that escape the nested callable count: a decl inside it resolves to
        // local/param of the *outer* fn only when it isn't nested — resolveBase already keys by
        // decl site, so filter decls physically inside the nested subtree.
        const decl = declOf(n);
        if (decl && decl.getStart() >= fnNode.getStart() && decl.getEnd() <= fnNode.getEnd()) return;
        this.uses.push(b);
      } else if (n.getKind() === SyntaxKind.ThisKeyword) {
        this.uses.push({ key: "this", label: "this", baseKind: "this", fields: [] });
      }
    });
  }
}

function declOf(id: Node): Node | undefined {
  let sym = id.getSymbol();
  if (!sym) return undefined;
  const aliased = sym.getAliasedSymbol();
  if (aliased) sym = aliased;
  const decls = sym.getDeclarations();
  return decls && decls.length ? decls[0] : undefined;
}

function unwrapExpr(n: Node): Node {
  let cur = n;
  for (;;) {
    if (
      Node.isParenthesizedExpression(cur) ||
      Node.isAsExpression(cur) ||
      Node.isNonNullExpression(cur) ||
      Node.isSatisfiesExpression(cur)
    ) {
      cur = cur.getExpression();
    } else {
      return cur;
    }
  }
}

function isAssignmentOperator(k: SyntaxKind): boolean {
  return k >= SyntaxKind.FirstAssignment && k <= SyntaxKind.LastAssignment;
}

// ------------------------------------------------------------------------------------------------
// Per-node fact extraction
// ------------------------------------------------------------------------------------------------

function extractFacts(
  n: DfNode,
  build: FunctionCfgBuild,
  root: string,
  k: number,
  union: (a: string, b: string) => void,
): NodeFacts {
  const w = new ExprWalker(build.fn, root, k, union);
  const ast = n.ast;
  if (!ast) return { defs: [], uses: [] };

  if (n.kind === "param") {
    if (Node.isParameterDeclaration(ast)) {
      w.bindingDefs(ast.getNameNode());
      const init = ast.getInitializer();
      if (init) w.walk(init);
    }
    return { defs: w.defs, uses: w.uses };
  }

  if (Node.isCatchClause(ast)) {
    const v = ast.getVariableDeclaration();
    if (v) w.bindingDefs(v.getNameNode());
    return { defs: w.defs, uses: w.uses };
  }
  if (Node.isIfStatement(ast) || Node.isWhileStatement(ast) || Node.isDoStatement(ast) || Node.isSwitchStatement(ast)) {
    w.walk(ast.getExpression());
    return { defs: w.defs, uses: w.uses };
  }
  if (Node.isForStatement(ast)) {
    const init = ast.getInitializer();
    if (init) w.walk(init);
    const cond = ast.getCondition();
    if (cond) w.walk(cond);
    const incr = ast.getIncrementor();
    if (incr) w.walk(incr);
    return { defs: w.defs, uses: w.uses };
  }
  if (Node.isForOfStatement(ast) || Node.isForInStatement(ast)) {
    const init = ast.getInitializer();
    if (init) {
      if (Node.isVariableDeclarationList(init)) {
        for (const d of init.getDeclarations()) w.bindingDefs(d.getNameNode());
      } else {
        w.assignTarget(init, false);
      }
    }
    w.walk(ast.getExpression());
    return { defs: w.defs, uses: w.uses };
  }
  if (Node.isReturnStatement(ast) || Node.isThrowStatement(ast)) {
    const e = (ast as unknown as { getExpression: () => Node | undefined }).getExpression();
    if (e) w.walk(e);
    return { defs: w.defs, uses: w.uses };
  }
  if (Node.isFunctionDeclaration(ast) || Node.isClassDeclaration(ast)) {
    // Nested declaration statement: binds its name; body reads of outer state are capture uses.
    const nm = (ast as unknown as { getNameNode?: () => Node | undefined }).getNameNode?.();
    if (nm && Node.isIdentifier(nm)) {
      const b = resolveBase(nm, build.fn, root);
      if (b) w.defs.push({ ref: b, strong: true });
    }
    w.captureScan(ast);
    return { defs: w.defs, uses: w.uses };
  }
  if (Node.isBreakStatement(ast) || Node.isContinueStatement(ast) || Node.isDebuggerStatement(ast)) {
    return { defs: [], uses: [] };
  }
  // Expression statement, variable statement, arrow expression body, or any other leaf.
  w.walk(ast);
  return { defs: w.defs, uses: w.uses };
}

// ------------------------------------------------------------------------------------------------
// Reaching definitions → DDG
// ------------------------------------------------------------------------------------------------

export function computeDefUse(
  build: FunctionCfgBuild,
  root: string,
  k: number,
  callEffects: Map<number, CallEffects>,
): DefUseResult {
  // --- union-find over base keys (copy aliases) ---
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r) as string;
    return r;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // --- facts per node ---
  const facts = new Map<number, NodeFacts>();
  for (const n of build.nodes) {
    if (n.kind === "entry" || n.kind === "exit") {
      facts.set(n.id, { defs: [], uses: [] });
      continue;
    }
    facts.set(n.id, extractFacts(n, build, root, k, union));
  }

  // --- apply callee global effects at callsite nodes ---
  for (const [nodeId, eff] of callEffects) {
    const f = facts.get(nodeId);
    if (!f) continue;
    for (const g of eff.reads) f.uses.push({ key: g.key, label: g.key, baseKind: "module", fields: g.fields });
    for (const g of eff.writes)
      f.defs.push({ ref: { key: g.key, label: g.key, baseKind: "module", fields: g.fields }, strong: false });
  }

  // --- ENTRY defs for ambient bases (module / captured / this): their value on entry ---
  const entryFacts = facts.get(build.entryId) as NodeFacts;
  const ambient = new Map<string, PathRef>();
  for (const f of facts.values()) {
    for (const u of f.uses) if (u.baseKind !== "local" && u.baseKind !== "param") ambient.set(u.key, u);
    for (const d of f.defs) if (d.ref.baseKind !== "local" && d.ref.baseKind !== "param") ambient.set(d.ref.key, d.ref);
  }
  for (const [key, ref] of ambient) {
    entryFacts.defs.push({ ref: { key, label: ref.label, baseKind: ref.baseKind, fields: [] }, strong: false });
  }

  // --- def universe + GEN/KILL ---
  interface DefEntry {
    node: number;
    ref: PathRef;
    strong: boolean;
  }
  const universe: DefEntry[] = [];
  const genOf = new Map<number, Set<number>>();
  for (const n of build.nodes) {
    const gen = new Set<number>();
    for (const d of facts.get(n.id)?.defs ?? []) {
      gen.add(universe.length);
      universe.push({ node: n.id, ref: d.ref, strong: d.strong });
    }
    genOf.set(n.id, gen);
  }
  const killOf = new Map<number, Set<number>>();
  for (const n of build.nodes) {
    const kill = new Set<number>();
    for (const d of facts.get(n.id)?.defs ?? []) {
      if (!d.strong) continue;
      for (const [i, u] of universe.entries()) {
        if (u.node !== n.id && find(u.ref.key) === find(d.ref.key)) kill.add(i);
      }
    }
    killOf.set(n.id, kill);
  }

  // --- worklist ---
  const { succ, pred } = adjacency(build);
  const inOf = new Map<number, Set<number>>();
  const outOf = new Map<number, Set<number>>();
  for (const n of build.nodes) {
    inOf.set(n.id, new Set());
    outOf.set(n.id, new Set());
  }
  const work: number[] = build.nodes.map((n) => n.id);
  while (work.length) {
    const id = work.shift() as number;
    const inSet = new Set<number>();
    for (const p of pred.get(id) ?? []) for (const d of outOf.get(p) ?? []) inSet.add(d);
    const outSet = new Set<number>(genOf.get(id));
    const kill = killOf.get(id) as Set<number>;
    for (const d of inSet) if (!kill.has(d)) outSet.add(d);
    inOf.set(id, inSet);
    const prev = outOf.get(id) as Set<number>;
    if (outSet.size !== prev.size || [...outSet].some((d) => !prev.has(d))) {
      outOf.set(id, outSet);
      for (const s of succ.get(id) ?? []) if (!work.includes(s)) work.push(s);
    }
  }

  // --- DDG edges: def → use of a may-aliasing path ---
  const mayAlias = (a: PathRef, b: PathRef): boolean =>
    find(a.key) === find(b.key) && fieldsMayAlias(a.fields, b.fields);
  const ddg: PdgEdge[] = [];
  const seen = new Set<string>();
  for (const n of build.nodes) {
    const f = facts.get(n.id) as NodeFacts;
    if (!f.uses.length) continue;
    const reaching = inOf.get(n.id) as Set<number>;
    for (const u of f.uses) {
      for (const di of reaching) {
        const d = universe[di] as DefEntry;
        if (!mayAlias(d.ref, u)) continue;
        const k2 = `${d.node}>${n.id}>${renderPath(u)}`;
        if (seen.has(k2)) continue;
        seen.add(k2);
        ddg.push({ source: d.node, target: n.id, type: "DDG", var: renderPath(u) });
      }
    }
  }

  // --- return-value nodes ---
  const returnValueNodes = new Set<number>();
  const body = getBody(build.fn);
  const isExprBody = body !== undefined && !Node.isBlock(body);
  for (const n of build.nodes) {
    if (!n.ast) continue;
    if (Node.isReturnStatement(n.ast) && n.ast.getExpression()) returnValueNodes.add(n.id);
    else if (isExprBody && n.ast === body) returnValueNodes.add(n.id); // arrow expression body
  }

  // --- formal-out routing: EXIT doubles as the SDG formal-out node ---
  // PARAM_OUT edges source at the callee's EXIT, so the value that leaves the function must flow
  // INTO it: return-value nodes carry the return value, module-global writes are live-out state.
  // Without these edges a slice descending a PARAM_OUT would dead-end at EXIT.
  for (const r of [...returnValueNodes].sort((a, b) => a - b)) {
    const k2 = `${r}>${build.exitId}>return`;
    if (!seen.has(k2)) {
      seen.add(k2);
      ddg.push({ source: r, target: build.exitId, type: "DDG", var: "return" });
    }
  }
  for (const n of build.nodes) {
    if (n.id === build.entryId) continue;
    for (const d of facts.get(n.id)?.defs ?? []) {
      if (d.ref.baseKind !== "module") continue;
      const rendered = renderPath(d.ref);
      const k2 = `${n.id}>${build.exitId}>${rendered}`;
      if (!seen.has(k2)) {
        seen.add(k2);
        ddg.push({ source: n.id, target: build.exitId, type: "DDG", var: rendered });
      }
    }
  }

  const aliasRep = new Map<string, string>();
  for (const f of facts.values()) {
    for (const u of f.uses) aliasRep.set(u.key, find(u.key));
    for (const d of f.defs) aliasRep.set(d.ref.key, find(d.ref.key));
  }

  return { ddg, facts, aliasRep, returnValueNodes };
}

function getBody(fn: Node): Node | undefined {
  return (fn as unknown as { getBody?: () => Node | undefined }).getBody?.();
}
