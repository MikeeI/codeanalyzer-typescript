# ISSUE-007 — neo4j: Bolt reconciliation is not application-isolated

State: Archived
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/117
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: Bolt reads, purges, and prunes modules by `_module` without application ownership.

## Reach-and-Impact

Reach [S]: Every live Neo4j push reaches the global module-hash query and changed-module reconciliation.
Impact [S]: Applications sharing relative paths can influence or delete each other's module state.

## Evidence

- [S] `src/build/neo4j/bolt.ts:134-143` — the module-hash lookup is global and keyed only by `_module`.
- [S] `src/build/neo4j/bolt.ts:162-165` — changed-module deletion is keyed only by `_module`.
- [S] `src/build/neo4j/bolt.ts:179-190` — full-run orphan pruning is not anchored to the current application.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/116` — Exact active issue owner.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/117` — Active implementation owner.

Contribution fit: No new pull request while #117 owns the correction.

## Proposed-Change

Scope every module-state query and deletion through the current `Application` ownership graph.

## Scope-and-Constraints

- Preserve: Multiple applications and sibling analyzers in one Neo4j database.
- Exclude: A competing implementation while #117 remains active.

## Verification

- Two applications with the same relative module path → updating either preserves the other application.

## Publication-Blockers

None.

## Next-Action

Summary: —
Action: None.
Done-When: None.

## Archive

Archive-Reason: Duplicate
Detail: None.
Evidence: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/117
Checked: 2026-09-02
