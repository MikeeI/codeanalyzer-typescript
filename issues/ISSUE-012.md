# ISSUE-012 — cfg: empty try enters catch on normal flow

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

Root-Cause [S]: Empty-try entry fallback selects the catch binding as a normal-flow entry.

## Reach-and-Impact

Reach [S]: Any empty try with a catch clause reaches this fallback.
Impact [O]: The reproduced CFG contains an `@entry -> catch` fallthrough edge without an exception.

## Evidence

- [S] `src/dataflow/cfg.ts:392-402` — `catchEntry` precedes the finally entry in the fallback chain.
- [O] `try {} catch (e) { return 1; }` → normal entry targets the catch binding.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

No exact issue or active pull request was found.
Contribution fit: New pull request for one empty-region entry rule.

## Proposed-Change

Route normal flow from an empty try to its finally block or following continuation.
Keep catch reachable only through exception edges.

## Scope-and-Constraints

- Preserve: Catch binding nodes, finally execution, and the unique-EXIT CFG gate.
- Exclude: Abrupt-completion routing owned by ISSUE-011.

## Verification

- Empty try/catch variants → no normal edge enters catch and all represented nodes satisfy CFG gates.

## Publication-Blockers

- Implementation, focused checks, commit, push, and final draft approval remain pending.

## Next-Action

Summary: Fix empty try entry
Action: Correct empty-region entry lowering on `fix/issue-012`.
Done-When: Focused empty-try CFG tests pass.

## Pull-Request-Implementation

Branch: fix/issue-012
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Prevent normal control flow from entering an empty try's catch clause.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-012`
Title: `fix(cfg): keep empty try flow out of catch`

Body:

## Summary

Prevent an empty try block from selecting its catch binding as the normal CFG entry.
Preserve finally execution and exception-only catch reachability.

## Evidence

- The current fallback chooses `catchEntry` when the try body has no node.
- A minimal empty try/catch produces a normal fallthrough into catch.

## Changes

- Route empty normal flow to finally or the following continuation.
- Keep catch entry reserved for exceptional flow.

## Risks and boundaries

- Abrupt completion semantics remain a separate correction.
- Existing node identities and non-empty try behavior remain unchanged.

## Verification

- `bun test test/dataflow.test.ts`
- `bun run typecheck`

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
