# ISSUE-002 — neo4j: row sorting rebuilds composite keys per comparison

State: PR-Ready
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: `RowBuilder.finish` allocates two complete composite sort-key strings during every comparison.

## Reach-and-Impact

Reach [S]: Every Neo4j snapshot and Bolt projection sorts all emitted nodes and edges through this method.
Impact [O]: Actual self-analysis insertion order took 165 ms with current comparators and 49 ms with exact cached keys.

## Evidence

- [S] `src/build/neo4j/rows.ts:110-120` — both comparators rebuild combined NUL-separated keys for each comparison.
- [O] Instrumented `RowBuilder.finish` → 14,622 nodes and 43,832 edges sorted in 165 ms; environment=Bun 1.4.0, Linux 6.8.0-107-generic x86_64.
- [O] Exact precomputed combined keys sorted the same rows in 49 ms and preserved identity order exactly.
- [O] Field-by-field comparison changed edge order, so it is rejected as incompatible.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/69` — Related; it establishes `RowBuilder` as the Neo4j injection seam but does not optimize sorting.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/112` — Distinct; it tracks process memory ceilings rather than comparator allocation.

Contribution fit: New pull request — the exact existing order can be retained with one local sort-key owner.

## Proposed-Change

Compute each final row's current composite sort key once, sort decorated rows by that key, and discard decorations.

## Scope-and-Constraints

- Preserve: Combined-key `localeCompare` semantics, stable equal-key order, row contents, and both writer outputs.
- Exclude: Tuple ordering, schema changes, projection restructuring, and writer changes.
- Cost: O(N) transient decorations replace O(N log N) transient composite strings.

## Verification

- `bun test test/neo4j-edge-identity.test.ts test/neo4j-schema.test.ts` → 13 pass and 0 fail.
- `bun run typecheck` → passed.
- Baseline and candidate projections produced byte-identical row JSON.

## Performance-Evidence

Workload: One Level-4 application projected to 58,447 Neo4j rows in five alternating runs.
Baseline [O]: Current `project()` samples took 201.6–237.5 ms.
Candidate [O]: Cached-key `project()` samples took 86.5–89.5 ms.
Guard [O]: Every node and edge retained identical content and order.
Boundary: The measurement covers projection but excludes analysis and output writing.
End-to-end-Measurement: Not measured

## Publication-Blockers

- Final user approval of the exact pull-request draft and target remains pending.

## Next-Action

Summary: Approve exact PR draft
Action: Approve the exact draft and target for publication.
Done-When: The user approves this exact pull-request draft and target.

## Pull-Request-Implementation

Branch: fix/issue-002
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Precompute current Neo4j row sort keys once per final row.
Commit: `b9fb298cae45bcbb9c7dc2681d2c14db6630039e`
Push: `origin/fix/issue-002`
Checks:

- `bun test test/neo4j-edge-identity.test.ts test/neo4j-schema.test.ts` → 13 pass and 0 fail.
- `bun run typecheck` → passed.
- Baseline and candidate projections produced byte-identical row JSON.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-002`
Title: `perf(neo4j): precompute row sort keys`

Body:

## Summary

- Compute each final Neo4j row's existing composite sort key once.
- Preserve the exact current `localeCompare` ordering and stable equal-key order.

## Evidence

- Five baseline projections took 201.6–237.5 ms.
- Cached-key projections took 86.5–89.5 ms with byte-identical row JSON.

## Validation

- `bun test test/neo4j-edge-identity.test.ts test/neo4j-schema.test.ts`
- `bun run typecheck`
- Exact node and edge content-order comparison on the self-analysis projection.

## Prior art

- #69 established `RowBuilder` as the injection seam but did not optimize sorting.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
