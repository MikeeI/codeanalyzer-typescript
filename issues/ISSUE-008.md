# ISSUE-008 — neo4j: removed artifacts remain in projected state

State: PR-Ready
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: High
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: Both Neo4j writers reconcile modules but never remove absent application artifacts.

## Reach-and-Impact

Reach [S]: Snapshot and live Bolt output both project artifacts as direct application children.
Impact [S]: Removed artifacts and configuration keys remain orphaned or visibly attached after a later full run.

## Evidence

- [S] `src/build/neo4j/project.ts:79-94` — artifacts and configuration keys form an application-owned subtree.
- [S] `src/build/neo4j/cypher.ts:36-43` — snapshot wipe traverses only module descendants.
- [S] `src/build/neo4j/bolt.ts:150-190` — live reconciliation has no artifact deletion path.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/103` — Related artifact projection origin.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/117` — Related source projection, not cleanup.

Contribution fit: New pull request for one application-owned artifact reconciliation boundary.

## Proposed-Change

Delete absent application artifact edges and owned artifact/config-key nodes during full reconciliation.
Preserve shared package nodes while deleting their stale application-owned relationships.

## Scope-and-Constraints

- Preserve: Shared PURL package identity and data owned by other applications.
- Exclude: Artifact text policy, schema redesign, and module reconciliation.

## Verification

- Snapshot and Bolt rerun after artifact removal → stale app data disappears and shared packages survive.

## Publication-Blockers

- Final approval of the exact current pull request draft remains pending.

## Next-Action

Summary: Approve pull request
Action: Approve the exact current Publication-Draft for upstream submission.
Done-When: The pull request is authorized for publication.

## Pull-Request-Implementation

Branch: fix/issue-008
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Reconcile absent application artifacts without deleting shared package state.
Commit: `73d8dd2`
Push: `origin/fix/issue-008`
Checks:

- `bun test test/artifacts.test.ts`: passed.
- `RUN_CONTAINER_TESTS=1 bun test test/neo4j-bolt.test.ts`: passed.
- `bun test`: passed with 238 tests and 7 opt-in skips.
- `bun run typecheck`: passed.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-008`
Title: `fix(neo4j): reconcile removed application artifacts`

Body:

## Summary

Remove artifact subtrees that disappeared from a full application analysis.
Keep neutral artifacts owned by sibling analyzers and shared package nodes intact.

## Evidence

- Snapshot cleanup traverses modules but not the `HAS_ARTIFACT` subtree.
- Bolt full runs never remove absent artifact relationships.

## Changes

- Reconcile the current application's artifact subtree on full runs.
- Preserve globally shared PURL package nodes.

## Risks and boundaries

- Targeted runs retain their existing non-pruning behavior.
- Artifact text and schema contracts remain unchanged.

## Verification

- `bun test test/artifacts.test.ts`
- `RUN_CONTAINER_TESTS=1 bun test test/neo4j-bolt.test.ts`
- `bun test`
- `bun run typecheck`

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with GPT-5.6 at extra-high reasoning effort.
I used [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence.
It includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know.
I will refrain from submitting similar reports.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
