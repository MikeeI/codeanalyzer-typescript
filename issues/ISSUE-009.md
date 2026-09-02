# ISSUE-009 — dataflow: nested programs use the root compiler context

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: L3 extraction receives one root `Project` and `tsconfig` instead of each owning `BuiltProgram`.

## Reach-and-Impact

Reach [S]: Every Level-3 or Level-4 analysis of a multi-program repository reaches this path.
Impact [O]: The upstream vscode run populated CFG data for only 1,204 of 174,767 callables.

## Evidence

- [S] `src/core.ts:38-46` — extraction receives only the root program context.
- [S] `src/syntactic_analysis/symbolTable.ts:12-27` — each `BuiltProgram` already owns its project and files.
- [O] `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111` — measured 0.7% callable coverage.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111` — Exact issue owner with failed OOM prototype.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/112` — Required lifecycle and memory boundary.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/94` — Distinct worker file-set divergence.

Contribution fit: New pull request resolving #111 without restoring unbounded Project residency.

## Proposed-Change

Sequence call-graph and extraction use per `BuiltProgram`, then release each project before processing the next.
Merge extracted callable data before summary and SDG composition.

## Scope-and-Constraints

- Preserve: Cross-program call edges, byte-identical worker output, and bounded Project residency.
- Exclude: JSON sharding, subprocess workers, summary-cache reuse, and issue #94.

## Verification

- Multi-tsconfig fixture at `jobs=1` and `jobs=2` → identical output with nested CFG data.
- vscode Level 4 → broad callable coverage without the rejected prototype's OOM.

## Publication-Blockers

- Implementation, focused checks, vscode measurement, commit, push, and final draft approval remain pending.

## Next-Action

Summary: Bound program dataflow
Action: Implement sequenced per-program extraction on `fix/issue-009`.
Done-When: Fixture and vscode coverage/memory checks pass.

## Pull-Request-Implementation

Branch: fix/issue-009
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Resolve #111 with correct per-program extraction and bounded Project residency.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-009`
Title: `fix(dataflow): extract nested programs in their compiler context`

Body:

## Summary

Extract each program's callables with its owning compiler context while bounding live Project state.
Resolve the missing L3/L4 coverage reported in #111.

## Evidence

- Current extraction receives only the root compiler context.
- #111 measured CFG data on 0.7% of vscode callables and rejected an unbounded prototype after OOM.

## Changes

- Sequence per-program semantic and extraction work.
- Merge callable graph data before whole-application summary composition.

## Risks and boundaries

- The deliberate call-graph/extraction overlap is traded for bounded correctness on multi-program repositories.
- JSON sharding and unrelated worker issue #94 remain out of scope.

## Verification

- `bun test test/multi-tsconfig.test.ts test/dataflow.test.ts`
- `bun run typecheck`
- vscode Level-4 callable coverage and peak-memory comparison.

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
