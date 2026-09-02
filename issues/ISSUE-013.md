# ISSUE-013 — call graph: class property callables lose invocation edges

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/131
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: T4c field-source collection omits class property initializers materialized as callables.

## Reach-and-Impact

Reach [S]: Calls through `this.field()` reach this fallback when the field stores an in-project callable.
Impact [O]: A reproduced method call had no edge to its class-property arrow callable.

## Evidence

- [S] `src/syntactic_analysis/builders.ts:705-727` — property arrows become class-scoped callables.
- [S] `src/semantic_analysis/defuseLinker.ts:359-440` — field sources come only from constructor parameters and assignments.
- [O] A class with `f = x => target(x)` and `run() { this.f(x); }` emitted no `run -> f` edge.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/103` — Related partial T4c implementation.

Contribution fit: New pull request completing one existing T4c source category.

## Proposed-Change

Collect supported property initializers and constructor writes as conservative field-callable candidates.
Backfill a body callee only when one candidate remains.

## Scope-and-Constraints

- Preserve: Multiple possible field targets, deterministic bounds, and existing T4c provenance.
- Exclude: Whole-program points-to analysis, arbitrary method writes, and factory-return inference.

## Verification

- Property initializer and later constructor assignment → all possible call edges and singleton-only body refinement.

## Publication-Blockers

None.

## Next-Action

Summary: Await upstream review
Action: Await maintainer review and CI for pull request #131.
Done-When: The pull request receives feedback or reaches a final outcome.

## Pull-Request-Implementation

Branch: fix/issue-013
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Resolve class-property callable sources without introducing a global fixpoint.
Commit: `0a47a7b`
Push: `origin/fix/issue-013`
Checks:

- `bun test test/anonymous-callables.test.ts`: passed.
- `bun test`: passed with 239 tests and 6 opt-in skips.
- `bun run typecheck`: passed.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-013`
Title: `fix(callgraph): resolve class property callables`

Body:

## Summary

Include callable class-property initializers in the existing T4c field-source resolution.
Keep multi-source field calls conservative and deterministic.

## Evidence

- Property arrows are materialized as callables but omitted from field-source collection.
- A direct `this.field()` call consequently loses its edge to the initializer callable.

## Changes

- Collect supported property and constructor callable sources.
- Refine body callees only for singleton targets.

## Risks and boundaries

- Dynamic method writes and whole-program points-to remain out of scope.
- Existing fallback bounds and provenance remain unchanged.

## Verification

- `bun test test/anonymous-callables.test.ts`
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
