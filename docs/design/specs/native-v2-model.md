# Native v2 model — retire the v1 compute model and the emit-time transform

- **Status:** accepted, not yet implemented
- **Scope:** `codeanalyzer-typescript` only — no wire change, no SDK change, no sibling change
- **Schema version:** 2.1.0, unchanged. This is an internal rewrite; `analysis.json` and the
  Neo4j projection stay semantically identical at every level.
- **Analyzer version:** 1.0.0 → 1.1.0 (one MINOR at completion)
- **Parity precedent:** codeanalyzer-python, whose staged v2 chain made its schema models the
  native compute model (`codeanalyzer/schema/py_schema.py`) with small per-run passes
  (`assign_ids.py`, `l1_body.py`, `l2_callees.py`, `call_graph_ids.py`) and strip-at-emit for
  internal fields (python d0084cb).

## Problem

The analyzer carries **two model families for one output**. Stages build the v1
`TSApplication` (`src/schema/schema.ts`, 445 lines, plus `graphs.ts`), and every emit reshapes
the whole tree into `V2Application` through a ~720-line transform (`src/schema/v2/emit.ts` 436 +
`src/schema/v2/dataflow.ts` 282). The transform re-buckets containers (`classes`/`interfaces`/
`enums`/`type_aliases`/`namespaces` → `types{}`; `methods`/`inner_callables` → `callables{}`;
`attributes`/`properties`/`members`/`variables` → `fields{}`), assigns `can://` ids
(`idFromSig`, emit.ts:97), converts `call_sites[]` to `body{}` call nodes (`toBody`,
emit.ts:139), filters attributes through a 30-key `DROP` set plus recursive null-pruning
(`carry`/`pruneNulls`, emit.ts:38–95), resolves heritage, homes external/synthesized endpoints,
and rewrites edge keys.

The cost is structural: **every schema feature lands twice** — once in the v1 model and builders,
once in the transform — and the `DROP`/`carry` indirection means the wire shape of any node is
defined nowhere; it is the residue of a filter. The migration playbook that produced this
architecture calls the wrap-don't-rewrite emitter "the compat shim the migration leans on *while
both schemas coexist*". Coexistence ended when the v1 wire was removed (`toV2` is unconditional
in `src/utils/serialize.ts`); python has since retired its shim. This spec retires ours.

## Decisions

| Decision | Choice |
| --- | --- |
| Architecture | **One model family + small per-run passes** (python parity), not inline-everything |
| Wire gate | **Deep-equal goldens** captured from pre-rewrite `main`, both fixtures, `-a 1..4` + `graph.cypher`; key order free, arrays order-sensitive |
| Tracking | **One issue, one PR**; stages are commits, each green on the goldens |
| Release | **1.1.0 at completion**; stages merge nothing individually; no SDK lockstep |
| Terminal naming | `V2*` → `TS*` at teardown; `src/schema/v2/model.ts` folds into `src/schema/schema.ts` |
| Goldens lifetime | Transition-scoped — harness and goldens deleted at teardown |
| L3/L4 tree-attach | Moves to `src/dataflow/attach.ts` (python parity: its dataflow emits onto the tree, python 5600542) |

**Why ids are a pass, not build-time.** Durable ids embed the app name
(`can://typescript/<app>/…`), and `--app-name` is per-invocation (`src/options/options.ts:15`),
while the symbol table round-trips through the analysis cache across runs
(`src/utils/cache.ts`). A tree with baked ids would go stale the moment the app name changes;
a tree without ids is cacheable forever. Python hit the same constraint — `assign_ids.py` stamps
ids fresh every run and returns the `signature → id` map the later passes join on.

**The join key stays the signature.** `signatureOf` (`src/schema/signatures.ts`) remains the one
canonicalizer; builders, call-graph providers, the cache, and the dataflow compute all keep
speaking signature strings. `can://` ids exist only downstream of the assign-ids pass, exactly
as in python.

## Target architecture

### The model (`src/schema/schema.ts`, terminal state)

The v2 shapes currently in `src/schema/v2/model.ts` become the model the stages build:

- **Containers** (`TSModule`, `TSType`, `TSCallable`, `TSField` — today `V2Module` etc.) are
  v2-bucketed (`types{}`/`functions{}`/`fields{}`/`callables{}`/`body{}`), carry `id` (stamped
  per-run), `kind`, `span` only — the flat `start_line`/`end_line`/`start_column`/`end_column`
  quartet disappears from container types (it is `DROP`ped from the wire today).
- **Leaf models** (`TSImport`, `TSExport`, `TSComment`, `TSCallableParameter`, `TSDecorator`,
  `TSTypeParameter`, enum members, …) keep their current wire shapes, flat ints included — but
  nullable fields become **optional**: the wire's "present or absent, never null" convention
  (today enforced by `pruneNulls`) becomes the model's own convention, and builders omit instead
  of writing `null`. The one sanctioned `null` stays: a `call` body node's `callee` at L1.
- **Internal fields** ride the model but never the wire, python-style (strip at emit, not a
  field-by-field copy): `call_sites[]` and `callee_signature` (cache round-trip + the l1/l2
  passes; see python's l2_callees.py docstring for why the linker's resolutions are never
  persisted), `module_name` (signature prefix), `path`/`file_path`, and the cache trio
  `content_hash`/`last_modified`/`file_size`.

### The spine (`src/core.ts`, terminal order)

```
materialize → buildSymbolTable (v2 buckets, no ids)
  → assignIds(app, appName)            # stamps can:// ids; returns sigToId + collisions
  → populateL1Body                     # call_sites[] → body{} call nodes, callee: null
  → resolveHeritage                    # extends_ids / implements_ids (TS-specific pass)
  → [L2] provider.build per program    # unchanged, signature-keyed
  → [L2] homeEndpoints                 # externals + synthesized (2.1.0 compat index) → sigToId
  → [L2] backfillCallees + reidentifyCallGraph   # callee null→id; edge sig→id, source/target→src/dst
  → [L3/4] buildProgramGraphs → attach # attach writes body/cfg/cdg/ddg/summary/param_* onto the tree
  → envelope                           # schema_version / language / max_level / k_limit / analyzer
  → saveCache (tree without ids, with internal fields)
```

`analyze()` returns the enveloped application. `src/utils/serialize.ts` shrinks to: JSON path =
strip internal fields + write; Neo4j path = `project(application)` directly — the projection
(`src/build/neo4j`) already consumes the v2 tree and does not change.

### Module layout (terminal)

| Path | Responsibility |
| --- | --- |
| `src/schema/schema.ts` | **The** model (v2 shapes, `TS*` names) + envelope types |
| `src/schema/ids.ts` | `can://` construction + `idFromSig`/`memberKey` (moved from emit.ts) |
| `src/schema/assignIds.ts` | id stamping pass → `sigToId`, collision gate |
| `src/schema/l1Body.ts` | `call_sites[]` → `body{}` call nodes |
| `src/schema/l2Callees.ts` | callee `null→id` + call-graph re-identification, dangling gate |
| `src/schema/homing.ts` | externals + synthesized-callable compat index (from emit.ts:298–360) |
| `src/schema/heritage.ts` | `extends_ids`/`implements_ids` resolution |
| `src/schema/signatures.ts` | unchanged |
| `src/schema/graphs.ts` | unchanged — the dataflow **compute IR**, no longer serialized on the app |
| `src/dataflow/attach.ts` | `applyDataflow` re-homed: program-graph IR → tree |
| *(deleted)* | `src/schema/v2/emit.ts`, `src/schema/v2/dataflow.ts`, `src/schema/v2/model.ts`, v1 container types, `DROP`/`carry`/`pruneNulls` |

(Exact pass-file granularity may collapse siblings into one file at implementation time; the
pass *boundaries* above are the contract.)

## Wire-stability gate

Before any model change, capture goldens from `main`: `analysis.json` at `-a 1|2|3|4` and
`graph.cypher`, for `test/fixtures/sample-app` and `test/fixtures/dataflow-app`, committed under
`test/goldens/`. A transition test then asserts on every commit of the branch:

- `analysis.json`: **deep-equal** after parsing — object key order free (JSON objects are
  unordered; the SDK parses, never diffs bytes), arrays order-sensitive. If an array's order
  proves nondeterministic, the comparator sorts that one list and says so in a comment.
- `graph.cypher`: compared as **sorted line sets** (row emission order follows object iteration
  order, which the re-bucketing legitimately changes; the graph is the set of rows).
- `analyzer.version` is excluded from comparison.

The existing standing gates — schema conformance, `L1 ⊆ L2 ⊆ L3 ⊆ L4` monotonicity
(`test/schema-v2.test.ts`), Neo4j conformance — run unchanged throughout and remain after the
goldens are deleted at teardown.

## Stages (commits within the one PR; each green on goldens + full suite)

1. **Stage 0 — harness.** Goldens captured from the branch base + the deep-equal test.
2. **Stage 1 — L1 native.** Containers in `schema.ts` become v2-bucketed and span-only;
   `builders.ts`/`symbolTable.ts` fill them; leaf nullables go optional; `assignIds`, `l1Body`,
   `heritage` passes; every symbol-table reader (semantic_analysis, dataflow/extract, cache)
   moves to the new buckets; `emit.ts` loses its tree walk and shrinks to L2 homing + dataflow
   + envelope. The largest stage — it retires `carry`/`DROP` for containers.
3. **Stage 2 — L2 native.** Homing/backfill/re-identification become core-spine passes;
   `emit.ts` loses its L2 block. Collision and dangling gates surface from the passes (today
   `ToV2Result.collisions`/`dangling`; tests re-point).
4. **Stage 3 — L3/L4 native.** `src/schema/v2/dataflow.ts` → `src/dataflow/attach.ts`;
   `program_graphs` leaves the application model (stays the internal return of
   `buildProgramGraphs`); envelope moves to core; `emit.ts` is deleted.
5. **Stage 4 — teardown.** Delete v1 types and `src/schema/v2/`; rename `V2*` → `TS*`; delete
   goldens + harness; update `CLAUDE.md`/`README`/`.claude/SCHEMA_DECISIONS.md`; CHANGELOG under
   *Changed* (internal, no wire impact); bump 1.1.0.

## What does not change

- The wire: `analysis.json` all levels, `graph.cypher`, `schema.neo4j.json`, schema_version 2.1.0.
- `signatureOf` and signature strings as the internal join currency.
- Call-graph providers' interface (signature-keyed edges + externals + synthesized), the union
  merge, and Jelly.
- The dataflow compute (`src/dataflow/*` stages 1–7, `graphs.ts` IR, worker pool).
- The Neo4j projection (`src/build/neo4j`) — it already consumes the v2 tree.
- The SDK: no model change, no version lockstep, no release ordering constraint.

## Caveats and risks

- **Cache compatibility:** old caches store v1 shapes; the existing `analyzer_version`
  invalidation (`cache.ts`, loadCache) drops them wholesale on first post-rewrite run. No
  migration code — by design.
- **Stage 1 blast radius:** semantic_analysis (950 lines) and dataflow (2,527 lines) read
  symbol-table containers; how much of each actually touches the re-bucketed fields is
  discovered in Stage 1, not before. The goldens bound the risk: any misread shows up as a
  fixture diff, not a silent drift.
- **L3 worker boundary:** `src/dataflow/worker.ts` builds its own Project per file; if workers
  consume serialized v1 module shapes across the process boundary, that surface migrates in
  Stage 1 with the other readers.
- **Deep-equal is weaker than byte-equal** on object key order by construction; that is the
  accepted trade (no consumer is order-sensitive), recorded here so nobody "fixes" it later.
