# ISSUE-005 — dataflow: throwability scans each subtree up to four times

State: PR-Ready
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Low
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: `mayThrow` traverses one statement subtree separately for call, new, await, and tagged-template kinds.

## Reach-and-Impact

Reach [S]: CFG extraction invokes `mayThrow` for statement nodes while attaching exception-control edges.
Impact [O]: Isolated self-analysis statements took 74 ms with four scans and 39 ms with one equivalent scan.

## Evidence

- [S] `src/dataflow/cfg.ts:475-480` — four sequential `containsKind` calls traverse the same root.
- [S] `src/dataflow/cfg.ts:463-473` — traversal stops at nested function and class boundaries.
- [O] 5,308 self-analysis statements took 74 ms with current logic and 39 ms with one combined scan.
- [O] Both implementations returned identical booleans for all 5,308 statements.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111` — Distinct; it addresses multi-program dataflow correctness and Project memory.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/112` — Distinct; its scaling roadmap does not identify CFG throwability traversal.

Contribution fit: New pull request — one local traversal can preserve the established boundary and kind set.

## Proposed-Change

Replace the four `containsKind` calls in `mayThrow` with one root-aware traversal over the same four syntax kinds.

## Scope-and-Constraints

- Preserve: Root inspection, nested function and class boundaries, throw-kind membership, and CFG edge semantics.
- Exclude: Separate await and yield detection, exception modeling policy, worker behavior, and other CFG traversals.
- Cost: One small owner-local throw-kind set replaces four one-kind traversals.

## Verification

- `bun test test/dataflow.test.ts` → 39 pass and 0 fail.
- `bun run typecheck` → passed.
- Baseline and candidate returned identical booleans for all 5,965 statements.

## Performance-Evidence

Workload: 5,965 statements from this repository's parsed source tree.
Baseline [O]: Four-scan samples took 79.5–116.7 ms with a 102.2 ms median.
Candidate [O]: One-scan samples took 43.5–57.0 ms with a 52.1 ms median.
Guard [O]: All 5,965 booleans matched exactly.
Boundary: The measurement isolates the predicate; end-to-end CFG improvement remains unmeasured.
End-to-end-Measurement: Not measured

## Publication-Blockers

- Final user approval of the exact pull-request draft and target remains pending.

## Next-Action

Summary: Approve exact PR draft
Action: Approve the exact draft and target for publication.
Done-When: The user approves this exact pull-request draft and target.

## Pull-Request-Implementation

Branch: fix/issue-005
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Combine only the four syntax-kind traversals inside `mayThrow`.
Commit: `5bc3e865c892096633ee4fb633f690f28af05786`
Push: `origin/fix/issue-005`
Checks:

- `bun test test/dataflow.test.ts` → 39 pass and 0 fail.
- `bun run typecheck` → passed.
- Baseline and candidate returned identical booleans for all 5,965 statements.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-005`
Title: `perf(dataflow): scan throwability once per statement`

Body:

## Summary

- Detect the existing four throw-capable syntax kinds in one subtree traversal.
- Preserve root inspection and nested function and class boundaries.

## Evidence

- Four-scan samples took 79.5–116.7 ms with a 102.2 ms median.
- One-scan samples took 43.5–57.0 ms with a 52.1 ms median and identical booleans.

## Validation

- `bun test test/dataflow.test.ts`
- `bun run typecheck`
- Exact `mayThrow` comparison for all 5,965 self-analysis statements.

## Prior art

- #111 and #112 cover broader dataflow scaling but do not identify this local repeated traversal.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
