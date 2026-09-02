# ISSUE-011 — cfg: abrupt completions bypass finally blocks

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

Root-Cause [S]: CFG lowering routes only normal region exits through `finally`.

## Reach-and-Impact

Reach [S]: Return, throw, break, or continue inside a protected try/catch region reaches this lowering path.
Impact [O]: A reproduced return-in-try CFG connected return directly to EXIT without visiting cleanup.

## Evidence

- [S] `src/dataflow/cfg.ts:218-240` — abrupt leaves immediately target EXIT, an exception target, or a loop sink.
- [S] `src/dataflow/cfg.ts:360-413` — `routeThroughFinally` receives only normal dangling exits.
- [O] `try { return 1; } finally { cleanup(); }` → no CFG edge from return to cleanup.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

No exact issue or active pull request was found.
Contribution fit: New pull request for one abrupt-completion lowering contract.

## Proposed-Change

Represent abrupt exits as targeted completions until every enclosing `finally` has run.
Preserve catch-before-finally ordering and finally completion override semantics.

## Scope-and-Constraints

- Preserve: Existing node identities, normal CFG edges, and conservative exception edges.
- Exclude: General exception precision, async disposal, and unrelated CFG restructuring.

## Verification

- Return, throw, break, and continue through finally → cleanup precedes the preserved completion target.

## Publication-Blockers

- Implementation, focused checks, commit, push, and final draft approval remain pending.

## Next-Action

Summary: Route abrupt completions
Action: Implement completion-aware finally lowering on `fix/issue-011`.
Done-When: Focused CFG cases and reachability gates pass.

## Pull-Request-Implementation

Branch: fix/issue-011
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Route abrupt CFG completions through enclosing finally blocks.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-011`
Title: `fix(cfg): route abrupt completions through finally`

Body:

## Summary

Model abrupt control-flow completions until all enclosing finally blocks execute.
Preserve the original target unless the finally block replaces the completion.

## Evidence

- Current return lowering emits a direct EXIT edge inside protected try regions.
- Finally routing processes only normal exits.

## Changes

- Carry return, throw, break, and continue completions through finally lowering.
- Preserve catch ordering and JavaScript completion replacement semantics.

## Risks and boundaries

- Node identity and ordinary control flow remain unchanged.
- Broader exception precision remains out of scope.

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
