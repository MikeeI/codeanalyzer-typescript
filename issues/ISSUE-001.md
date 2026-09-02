# ISSUE-001 — neo4j: Cypher snapshot materializes complete output string

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

Root-Cause [S]: `renderCypher` retains every rendered statement block and then joins the complete snapshot into another string.

## Reach-and-Impact

Reach [S]: Every file-backed `--emit neo4j` run reaches this writer after full graph projection.
Impact [O]: Self-analysis rendered 58,454 rows into 13.8 MB of Cypher in 154 ms.
Impact [S]: Snapshot-size memory remains duplicated until the joined string is written; peak RSS is not yet measured.

## Evidence

- [S] `src/build/neo4j/cypher.ts:16-33` — `out` retains every block before `join` creates the final string.
- [S] `src/build/neo4j/cypher.ts:50-107` — node and edge helpers return complete block arrays.
- [S] `src/utils/serialize.ts:65-67` — the production path renders the full string before `writeFileSync`.
- [O] `analyze(self, level=4) -> project() -> renderCypher()` → 14,622 nodes, 43,832 edges, 13,831,356 bytes, 154 ms; environment=Bun 1.4.0, Linux 6.8.0-107-generic x86_64.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/112` — Related; it owns JSON streaming and broader memory sequencing, not Cypher snapshot buffering.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/3` — Distinct; it introduced Neo4j output without this performance correction.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/69` — Distinct; it changes Neo4j labeling and preserves writer behavior.

Contribution fit: New pull request — one bounded writer change removes duplicate serialized snapshot retention.

## Proposed-Change

Add one lazy Cypher block iterator shared by string rendering and a production file writer.
Generate batches by offset so the streaming path never materializes all batch slices or blocks.

## Scope-and-Constraints

- Preserve: Exact snapshot bytes, statement order, batching, public `renderCypher`, and synchronous error propagation.
- Exclude: JSON streaming, graph projection, Bolt behavior, query changes, and new dependencies.
- Cost: The file writer adds explicit open, write, and close lifecycle ownership.

## Verification

- `bun test test/neo4j-edge-identity.test.ts` → existing Cypher identity contracts pass.
- Byte comparison of legacy and streamed self-analysis snapshots → exact match.
- Self-analysis snapshot measurement → elapsed time and peak RSS recorded.

## Performance-Evidence

Workload: This repository analyzed at Level 4, projected to 58,454 Neo4j rows; Bun 1.4.0 on Linux x86_64.
Baseline [O]: `renderCypher` produced 13,831,356 bytes in 154 ms; peak RSS not measured.
Candidate [O]: Pending implementation measurement.
Guard [O]: Pending byte comparison against the current renderer.
Boundary: `GraphRows` and grouping maps remain resident; only rendered block and joined-string duplication is removed.
End-to-end-Measurement: Not measured

## Publication-Blockers

- Implementation, focused checks, exact pull-request draft, and final approval of that draft and target remain pending.

## Next-Action

Summary: Implement lazy Cypher writer
Action: Implement the scoped writer on `fix/issue-001` and preserve exact snapshot bytes.
Done-When: Focused tests and byte comparison pass on the contribution branch.

## Pull-Request-Implementation

Branch: fix/issue-001
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Lazy Cypher blocks and a lifecycle-safe file writer with no JSON or Bolt changes.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-001`
Title: `perf(neo4j): stream Cypher snapshots to disk`

Body:

## Summary

- Stream Cypher statement blocks directly to file instead of joining the complete snapshot in memory.
- Keep `renderCypher` as a compatibility API backed by the same ordered block iterator.

## Evidence

- Self-analysis projected 58,454 rows into 13,831,356 bytes of Cypher.
- The current renderer took 154 ms and retained both statement blocks and the joined output string.

## Validation

- `bun test test/neo4j-edge-identity.test.ts`
- `bun run typecheck`
- Exact byte comparison between compatibility rendering and streamed file output.

## Prior art

- #112 covers JSON streaming and broader memory ceilings, not the Cypher snapshot writer.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
