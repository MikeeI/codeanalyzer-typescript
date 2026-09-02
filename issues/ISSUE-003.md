# ISSUE-003 — call graph: both resolvers rebuild the same AST index

State: Implementing
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

Root-Cause [S]: The TSC provider and def-use linker independently index the same call-like AST nodes for one program.

## Reach-and-Impact

Reach [S]: Every analysis at Level 2, 3, or 4 invokes both resolver legs serially for every built program.
Impact [O]: Duplicate indexing took 103 ms and 101 ms across eight self-analysis programs and 3,023 indexed nodes.

## Evidence

- [S] `src/core.ts:57-72` — one `CallGraphContext` reaches the TSC provider and then the def-use linker.
- [S] `src/semantic_analysis/callGraph.ts:88-89` — the TSC provider builds `indexCallExpressions(project)`.
- [S] `src/semantic_analysis/defuseLinker.ts:64-72` — the linker builds the same index from the same project.
- [O] Two self-analysis index passes took 103 ms and 101 ms; environment=Bun 1.4.0, Linux 6.8.0-107-generic x86_64.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/103` — Related; it introduced the current resolver pairing without shared index ownership.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/53` — Distinct; it owns external-target correctness, not duplicate AST work.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111` — Distinct; it owns multi-program dataflow correctness and Project residency.

Contribution fit: New pull request — one per-program context can own the immutable index used by both resolver legs.

## Proposed-Change

Build the call-expression index once per `CallGraphContext` and let both resolver legs read the same map.
Keep signature-set construction local because its measured cost is negligible.

## Scope-and-Constraints

- Preserve: Provider order, `callee_signature` backfills, phantom behavior, resolutions, weights, tags, and determinism.
- Exclude: Global caches, signature-index consolidation, resolver parallelism, and call-graph policy changes.
- Cost: The context gains one internal immutable AST-node map scoped to one `Project`.

## Verification

- `bun test test/external-resolution.test.ts test/dataflow.test.ts` → resolver and graph contracts pass.
- Before and after self-analysis → call edges, weights, tags, phantoms, and resolutions are byte-identical.
- Self-analysis Level-2 measurement → resolver and end-to-end times recorded.

## Performance-Evidence

Workload: Eight self-analysis programs containing 3,023 call-like AST nodes.
Baseline [O]: First and second index construction took 103 ms and 101 ms.
Candidate [O]: Pending implementation measurement.
Guard [O]: Pending exact resolver-output comparison.
Boundary: Only the duplicate AST traversal is removed; checker and linker work remain unchanged.
End-to-end-Measurement: Not measured

## Publication-Blockers

- Implementation, focused checks, exact pull-request draft, and final approval of that draft and target remain pending.

## Next-Action

Summary: Share resolver AST index
Action: Implement per-context index reuse on `fix/issue-003` without changing resolver behavior.
Done-When: Focused tests, exact output comparison, and candidate measurement pass.

## Pull-Request-Implementation

Branch: fix/issue-003
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Share one per-program call-expression index across both existing resolver legs.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-003`
Title: `perf(callgraph): share the per-program call index`

Body:

## Summary

- Build the call-expression index once for each semantic-analysis program.
- Share the immutable map between the TSC provider and def-use linker.

## Evidence

- The two self-analysis index passes covered the same 3,023 call-like AST nodes.
- Those duplicate passes took 103 ms and 101 ms.

## Validation

- `bun test test/external-resolution.test.ts test/dataflow.test.ts`
- `bun run typecheck`
- Exact comparison of call edges, weights, tags, resolutions, and phantoms.

## Prior art

- #103 introduced the current resolver pairing without shared index ownership.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
