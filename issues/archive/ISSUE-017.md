# ISSUE-017 — neo4j: projected modules omit incremental content hashes

State: Archived
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/119
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: The wire strip removes module hashes before Neo4j projection while Bolt still reads them.

## Reach-and-Impact

Reach [S]: Every live Neo4j push performs the resulting hash comparison.
Impact [O]: Upstream measured 1,841 of 1,841 unchanged modules as changed before the active fix.

## Evidence

- [S] `src/schema/emit.ts:60-63` — finalization removes `content_hash` from the wire module.
- [S] `src/build/neo4j/project.ts:231-238` — module rows omit the hash.
- [O] `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/118` — no live module stored a hash.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/118` — Exact active issue owner.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/119` — Exact active implementation owner.

Contribution fit: No new pull request while #119 owns the correction.

## Proposed-Change

Carry module hashes to the Neo4j projection without duplicating the active implementation.

## Scope-and-Constraints

- Preserve: Incremental comparison, schema declaration, and JSON compatibility chosen by #119.
- Exclude: A competing implementation while #119 remains active.

## Verification

- Two unchanged live pushes → the second reports zero changed modules.

## Publication-Blockers

None.

## Next-Action

Summary: —
Action: None.
Done-When: None.

## Archive

Archive-Reason: Duplicate
Detail: None.
Evidence: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/119
Checked: 2026-09-02
