# Anonymous callables become first-class callables (schema 2.1.0)

- **Status:** accepted, not yet implemented
- **Scope:** `codeanalyzer-typescript` only; TypeScript-local production pending Group A ratification
- **Schema version:** 2.0.0 → 2.1.0 (MINOR)
- **Supersedes:** the endpoint-plaque approach introduced by #13

## Problem

An unnamed function-like node — an arrow or function expression that is not a
variable initializer — is not modelled as a callable. Two independent facts
combine so that its contents are invisible to every analysis level above L1.

Worked example, the Express route handler idiom:

```ts
export function login () {
  return (req: Request, res: Response, next: NextFunction) => {
    models.sequelize.query(
      `SELECT * FROM Users WHERE email = '${req.body.email || ''}' …`)
  }
}
```

**1. The handler is never indexed as a callable.** `computeSignatureForDecl`
(`src/schema/signatures.ts:46`) returns `null` for it, documented at
`signatures.ts:43-44` as "not a nameable declaration (e.g. an anonymous inline
callback)". Consequently `indexCallableDecls` (`src/dataflow/extract.ts:52`)
never sees it, so no CFG, CDG or DDG is ever built for it.

Note the asymmetry already present in that file: `isCallableDecl`
(`signatures.ts:29-40`) *does* list `ArrowFunction` and `FunctionExpression`;
`contributorName` (`signatures.ts:11-27`) has no case for either. That gap is
the entire change surface.

**2. Its call sites are attributed to the enclosing function.** `walkBody`
(`src/syntactic_analysis/builders.ts:344`) treats only *named* nested callables
as boundaries via `namedBoundary` (`builders.ts:330-335`), so `query()` is
recorded as a call site of `login`. Def-use over `login`'s single `return`
statement then runs `captureScan` (`src/dataflow/defuse.ts:305`), which by
design skips identifiers declared inside the nested node — and `req` is a
parameter of the arrow, so it is skipped.

The result is that no `req.body.email` fact exists anywhere on the native DDG.
The handler is not coarsely modelled; it is absent.

**3. The Jelly-side node is a plaque, not a callable.** When the flow analyzer
resolves an anonymous callback as an edge endpoint, `homeSynthesized`
(`src/schema/v2/emit.ts:317-333`) mints a node for it in a flat, application-scope
`synthesized_callables` map. That node is typed `V2Node`, not `V2Callable`: it
has no `body`, no `cfg`/`cdg`/`ddg`, no nested `callables`, and its span is
emitted as `bytes: [0, 0]`, so it cannot even slice its own source text. It also
receives an *ordinal* id, `<enclosing-id>@<line>:<col>`.

TypeScript therefore holds two contradictory positions at once: `walkBody`
attributes the arrow's calls to the enclosing function, while
`synthesized_callables` simultaneously mints a separate node for that same
arrow. The plaque was introduced by #13 to stop Jelly edges dangling. It was an
endpoint patch, never a modelled decision.

Measurements from the RULES.md experiment (EXP-001) on OWASP Juice Shop: 24
`req`-rooted `TS_DDG` edges application-wide, none on `routes/login.ts:34`; 883
anonymous Express handlers carrying empty `code` on the base graph.

## Contract-impact triage

**Does this change schema v2 output?** Yes, on three counts against the keystone:

- The keystone places the identity boundary at the callable leaf line — durable
  `can://` ids at callable depth and above. An anonymous arrow *is* a callable,
  so it is owed a durable id. `emit.ts:322` gives it an ordinal one.
- The keystone grammar is
  `can://<lang>/<app>/<file>/<type>/<callable-signature>`. No production exists
  for a callable with no signature.
- The keystone requires no dangling endpoints: every `src` and `dst` must
  resolve to a node **in the tree**. `synthesized_callables` is a flat sibling
  map at application scope, not tree containment. Issue #75 is that invariant
  failing in the Neo4j projection — `:TSAnonymousCallable` is reachable only by
  `TS_RESOLVES_TO`/`TS_CALLS`, so the snapshot wipe's containment traversal
  never reaches it and re-import leaves orphans.

**Repos touched.** Every language has unnameable callables, so canonical v2 is
affected in principle: `codeanalyzer-{typescript,python,java,clang}`,
`python-sdk`, and the keystone docs. This spec deliberately scopes to
TypeScript only — see *Scope boundary*.

## What the record already settles

`.claude/SCHEMA_DECISIONS.md:72` (L10, Closures) already rules that "nested
callables get their own graphs; their reads of outer state are *capture uses*
attributed to the declaring statement in the enclosing CFG". The implementation
honours that ruling for named nested callables only. Half of this change is
therefore a conformance gap against an existing decision, not new design. What
L10 never addressed — and what this spec decides — is identity and containment
for the unnamed ones.

## Prior art

Both mature reference analyzers take the *opposite* position, deliberately.

**Python.** `codeanalyzer-python/codeanalyzer/syntactic_analysis/symbol_table_builder.py:619`:
"Lambdas, comprehensions and inline conditionals don't get their own
`PyCallable` so their internals stay attributed to the enclosing function."

**Java.** No lambda materialization; `LambdaExpr` appears only in a native-image
reflection config. Java's one adjacent precedent is `JCallable.is_implicit`
(`python-sdk/cldk/models/java/models.py:327`, set at `:533`), which materializes
a callable the source never wrote — but only for *named* constructs such as
default constructors. This repo already mirrors that at
`.claude/SCHEMA_DECISIONS.md:36`.

**Why TypeScript diverges.** A Python lambda is a single expression: no
statements, no branches, no control flow worth building. Folding it into the
enclosing function loses almost nothing. A JavaScript arrow is a full function
body, and in the Express/Angular idioms it is the *dominant* form of the unit of
behaviour — the Juice Shop measurement above puts 883 of them in one
application. Folding those loses the application. The divergence is a genuine
language-structure difference, not a preference.

## Decisions

### D1 — An unnamed arrow or function expression is a callable node

It is materialized as a `V2Callable` and tree-contained in its enclosing
callable's `callables{}` map (`src/schema/v2/model.ts:116`, already present and
documented as "nested callables (closures) — syntactic containment"). It gets
its own `body{}`, `cfg`, `cdg`, `ddg`, `@entry`/`@exit`, and at L4 its
parameters become `@formal_in:N` vertices.

`V2Callable.kind` already admits `"arrow"` and `"function_expression"`
(`model.ts:113`), so no new node kind is introduced.

Consequence: `namedBoundary` (`builders.ts:330-335`) must treat unnamed
function-like nodes as boundaries, `indexCallableDecls` must index them, and
`captureScan`'s boundary follows automatically.

### D2 — Identity: `contributorName` contributes `<anon@L:C>`

TypeScript signatures are dot-joined member chains with no parameter lists
(`src/schema/schema.ts:419`), unlike the Python analyzer's `name(params)` form
(`codeanalyzer-python/codeanalyzer/schema/ids.py`). The change is therefore one
new segment contributed by `contributorName` (`signatures.ts:11-27`):

```
routes/login.login.<anon@34:10>

can://typescript/juice-shop/routes/login.ts/login.<anon@34:10>
```

Angle brackets mark the segment synthetic, following the JVM `<init>`/`<clinit>`
convention. Two properties make position the right discriminator:

- **Byte-identical from both providers with no coordination.** `signatures.ts:2-5`
  requires the caller-side and callee-side ids to be byte-identical. Both the
  compiler resolver and Jelly know source positions; neither counts declaration
  ordinals. Jelly's existing v1 signature is already `<enclosing-sig>:<line:col>`
  (`emit.ts:314`), so position is the de-facto interop key today.
- **Durable tier, no collision.** The segment joins the dotted containment chain,
  so it lives in the durable tier as the keystone requires, and it cannot
  collide with the `@line:col` ordinal namespace that statements and synthetic
  vertices use within a callable.

This decision changes the id **suffix**, under the enclosing callable. Issue #91
changes the id **prefix** (adding a `<service>` segment). The two are
orthogonal and do not conflict.

### D3 — Schema 2.1.0, MINOR, with both legacy names retained

`src/build/neo4j/schema.ts:19` defines the versioning rule: MAJOR on a renamed
or removed label, relationship or key; MINOR on additive change. That rule
governs **schema elements**, not instance data. Re-anchoring a `call_graph` edge
from `login` to the arrow moves instances; no label, relationship type or key is
renamed or removed. The change is MINOR.

Holding MINOR constrains the design in one specific way: `synthesized_callables`
and `:TSAnonymousCallable` must both survive. They do, with new meanings:

- **`:TSAnonymousCallable` becomes a second label on the real tree node.** The
  materialized arrow carries both `:TSCallable` and `:TSAnonymousCallable`, and
  is reached by a normal containment relationship from its enclosing callable.
  Existing `MATCH (:TSAnonymousCallable)` queries keep working. This mirrors the
  dual-label staging approach epic #64 already used for the TS-prefix migration,
  and it closes #75 directly: the wipe traversal now reaches these nodes,
  which is exactly the fix that issue proposes.
- **`synthesized_callables` becomes an id index, not a node registry** — a map
  from the provider-side signature to the `can://` id of the tree node:

  ```json
  "synthesized_callables": {
    "routes/login.login:34:10": "can://typescript/juice-shop/routes/login.ts/login.<anon@34:10>"
  }
  ```

Both `SCHEMA_VERSION` constants move in lockstep: `src/schema/v2/emit.ts:33`
(JSON envelope) and `src/build/neo4j/schema.ts:22` (Neo4j projection). The
regenerated `schema.neo4j.json` ships as part of the release artifact; the
release workflow already commits it (`.github/workflows/release.yml:65-70`).

### D4 — Call sites re-anchor to the arrow; no compensating edge

After D1, `query()` is a call site of `<anon@34:10>`, not of `login`. `login`'s
`body{}` loses that call node and the `call_graph` edge's `src` becomes the
arrow.

No compensating `login → query` edge is emitted. Such an edge was considered and
rejected: `login` does not call `query`, it returns a function that does. The
schema's over-approximate posture licenses imprecision, not facts of the wrong
kind, and a synthetic edge here would make every returned closure a false call
path for taint consumers.

Emitting the call node in both bodies was also rejected — the keystone makes
containment the single-parent relation, and that is what makes the structure a
tree.

## Scope boundary

This spec does **not**:

- **Fix #57 or #85.** `this.x = fn` inside a constructor function, and named
  object-literal methods, are the *named*-but-unmaterialized family. Same
  symptom (Jelly names an endpoint the symbol table never built), different root
  cause, untouched here.
- **Add argument-level DDG granularity.** Expressing "argument 0 of `query` is a
  template whose substitutions are `{p0.body.email, …}`" needs expression-level
  nodes and a typed `ddg` edge list; `V2Callable.ddg` is currently `unknown[]`
  (`model.ts:118`) and `V2BodyNode` has no argument slot. The keystone already
  reserves `[expression, opt]` in its node ladder and specifies `ddg.var` as a
  k-limited access path, so this is conformance work belonging to roadmap
  candidate 2 (unified body-node model), collision group A.
- **Coin canonical vocabulary.** The `<anon@L:C>` production is TypeScript-local
  and provisional. It is the anonymous-callable side of roadmap candidate 4
  (`can://` grammar conformance, group A) and is expected to be ratified,
  amended or replaced when that group convenes. Sibling analyzers should not
  adopt it before ratification.
- **Define entrypoints.** An escaping handler's `@formal_in:0` has no incoming
  `param_in` edge, because no in-project caller binds it — Express does. That
  unbound formal is the natural anchor for an entrypoint/taint-source
  definition, which is roadmap candidate 6, collision group B, and issue #72.

## Release plan

| Version | Change |
| --- | --- |
| schema 2.1.0 | this spec — `<anon@L:C>` segment, materialized anonymous callables |
| schema 2.2.0 | #91 — `<service>` segment, `<app>` collapsed |

This work takes 2.1.0 and #91 moves to 2.2.0. Rationale: EXP-001 and the Juice
Shop dataflow measurement are blocked behind this change, whereas #91's
`<service>` segment is a `cocoa`-facing identity concern with no analysis
blocked behind it. Issue #91 is updated to target 2.2.0.

Package version: 1.0.0 → 1.1.0.

## Definition of done

- `contributorName` returns an `<anon@L:C>` segment for unnamed `ArrowFunction`
  and `FunctionExpression` nodes; `computeSignatureForDecl` no longer returns
  `null` for them.
- `namedBoundary`, `indexCallableDecls` and `captureScan` treat unnamed
  function-like nodes as callable boundaries.
- Anonymous callables appear in the enclosing callable's `callables{}` with
  populated `body`/`cfg`/`cdg`/`ddg` at `-a 3` and `@formal_in:N` at `-a 4`.
- `synthesized_callables` emits an id index; no `bytes: [0, 0]` spans remain.
- Neo4j projection carries `:TSCallable:TSAnonymousCallable` on one node with a
  containment relationship from the enclosing callable; the snapshot wipe
  reaches it (closes #75).
- Both `SCHEMA_VERSION` constants read `2.1.0`; `schema.neo4j.json` regenerated.
- `test/schema-v2.test.ts` monotonicity gates hold at L1 ⊆ L2 ⊆ L3 ⊆ L4 with
  anonymous callables populated.
- Neo4j conformance and container suites pass.
- Juice Shop at `-a 4` yields at least one `req.body.email`-rooted DDG path
  reaching the `query` call in `routes/login.ts` — the EXP-001 acceptance check.

## Caveats and known risks

- **Callable count grows sharply.** Juice Shop gains on the order of 883
  callables, each with its own CFG/CDG/DDG at `-a 3`. L3/L4 runtime, cache size
  and `graph.cypher` size all grow; the per-callable parallel worker pool
  absorbs some of it but the artifact grows regardless. Measure before release.
- **Instance-level drift is real even though the version is MINOR.** Any
  consumer asking "what does `login` call" gets a different answer. The version
  rule classifies this as MINOR because no schema element is removed; the
  migration note must state the behavioural change plainly regardless.
- **Position-based ids are not stable across edits.** Inserting a line above the
  arrow changes its id. This matches the keystone's existing posture for ordinal
  ids (not promised across edits) but is a new property for a *durable*-tier id,
  and is the most likely thing Group A amends.
- **Deeply nested closures produce long dotted chains.** A callback inside a
  callback inside a handler yields three `<anon@L:C>` segments. Acceptable, but
  worth watching for id length in the Neo4j projection.
