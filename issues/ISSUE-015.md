# ISSUE-015 — neo4j: lock edges lose dependency provenance

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: Neo4j projects each locked dependency from every lock artifact in the application.

## Reach-and-Impact

Reach [S]: Every workspace containing multiple recognized lockfiles reaches this global fan-out.
Impact [O]: The artifact fixture projects root and workspace packages from unrelated lockfiles.

## Evidence

- [S] `src/artifacts/index.ts:145-164` — JSON dependency records retain manifest or lockfile ownership.
- [S] `src/build/neo4j/project.ts:96-114` — projection discards that ownership and loops over all lock IDs.
- [O] `express` was projected from four lockfiles although only the root package lock owns its pin.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/103` — Related origin with intentional coarse fan-out.
- `https://github.com/codellm-devkit/codeanalyzer-python/pull/160` — Related sibling parity, not correct workspace provenance.

Contribution fit: New pull request for one projection-level provenance correction.

## Proposed-Change

Use the sibling lock of a direct record's manifest and the existing lock artifact of a lock-only record.
Emit no LOCKS edge when no owning lock artifact exists.

## Scope-and-Constraints

- Preserve: Dependency schema, PURL package identity, versions, and JSON records.
- Exclude: Multiple sibling lockfile precedence and dependency-record schema changes.

## Verification

- Two manifests with separate locks and lock-only packages → each LOCKS edge has the owning source artifact.

## Publication-Blockers

- Implementation, focused checks, commit, push, and final draft approval remain pending.

## Next-Action

Summary: Preserve lock provenance
Action: Correct LOCKS source selection on `fix/issue-015`.
Done-When: Exact workspace provenance assertions pass.

## Pull-Request-Implementation

Branch: fix/issue-015
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Project LOCKS edges only from each dependency record's owning lockfile.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-015`
Title: `fix(neo4j): preserve lockfile dependency provenance`

Body:

## Summary

Project dependency pins only from the lock artifact that owns each dependency record.
Remove false cross-workspace LOCKS relationships.

## Evidence

- JSON records already preserve manifest or lockfile ownership.
- Neo4j currently fans every locked dependency out from every application lockfile.

## Changes

- Resolve direct records through their manifest's sibling lock.
- Use the recorded lock artifact directly for lock-only records.

## Risks and boundaries

- Package identity and relationship schema remain unchanged.
- Multiple sibling lockfile precedence remains out of scope.

## Verification

- `bun test test/artifacts.test.ts test/neo4j-schema.test.ts`
- `bun run typecheck`

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
