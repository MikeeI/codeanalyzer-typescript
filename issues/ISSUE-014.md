# ISSUE-014 — cache: semantic modules outlive their compiler context

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

Root-Cause [S]: Per-file cache reuse stores checker-derived modules without validating their complete program context.

## Reach-and-Impact

Reach [S]: Every non-eager analysis may reuse callable, field, heritage, decorator, and callsite semantics.
Impact [O]: After a path-alias change, a warm run retained an old body callee while its call graph became empty.

## Evidence

- [S] `src/utils/cache.ts:16-27,51-63` — cache validity covers analyzer version and one file's metadata or hash.
- [S] `src/core.ts:103-105` — the cache is saved after call-graph mutation of `callee_signature`.
- [S] `src/syntactic_analysis/builders.ts:60-83` — cached module fields include checker-derived types.
- [O] Removing a path alias before a warm run preserved the prior body callee.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/109` — Related version-only cache invalidation.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/56` — Related compiler-context ownership, not cache.

Contribution fit: New pull request for one program-level semantic cache validity contract.

## Proposed-Change

Strip per-run resolver provenance before persistence and validate cached semantics per `BuiltProgram` context.
Rebuild every module in a program when its source or effective compiler input changes.

## Scope-and-Constraints

- Preserve: ID-free cache data, eager behavior, output determinism, and Level-1 cache support.
- Exclude: Persistent ts-morph Projects, summary-cache consumption, and speculative incremental compilation.

## Verification

- Source, imported declaration, and tsconfig changes → warm and eager outputs remain identical.

## Publication-Blockers

- Implementation, focused checks, commit, push, and final draft approval remain pending.

## Next-Action

Summary: Validate semantic cache
Action: Implement program-context cache validity on `fix/issue-014`.
Done-When: Warm-cache semantic regressions and typecheck pass.

## Pull-Request-Implementation

Branch: fix/issue-014
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Prevent cached checker semantics and resolver provenance from surviving context changes.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-014`
Title: `fix(cache): invalidate semantic modules by program context`

Body:

## Summary

Make semantic module reuse depend on the compiler program context that produced it.
Prevent resolver provenance from being serialized as reusable source structure.

## Evidence

- Current validity checks only one source file and analyzer version.
- A warm run can retain an old callee after its path alias stops resolving.

## Changes

- Remove per-run callee provenance from persisted modules.
- Invalidate a program's cached modules when its semantic inputs change.

## Risks and boundaries

- Correctness takes precedence over partial per-file reuse within a changed program.
- Persistent compiler state and summary reuse remain out of scope.

## Verification

- `bun test test/l1-body-cache-shape.test.ts test/external-resolution.test.ts`
- `bun run typecheck`
- Warm-versus-eager comparisons after source and compiler-context changes.

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
