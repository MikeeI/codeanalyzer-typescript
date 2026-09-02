# ISSUE-004 — cache: warm level-one hits still construct compiler projects

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: `buildSymbolTable` constructs and populates every compiler `Project` before checking Level-1 cache reuse.

## Reach-and-Impact

Reach [S]: Every complete warm Level-1 cache hit pays compiler-project setup for every discovered program.
Impact [O]: Warm self-analysis took 105–116 ms, while cached-file validation alone took about 1 ms for 57 files.

## Evidence

- [S] `src/syntactic_analysis/symbolTable.ts:55-72` — every program constructs a `Project` and adds source files first.
- [S] `src/syntactic_analysis/symbolTable.ts:74-109` — cache reuse is decided only after project construction.
- [S] `src/core.ts:101-110` — Level 1 returns before semantic and dataflow phases can need compiler projects.
- [O] Same-process warm Level-1 self-analysis took 105 ms and 116 ms; environment=Bun 1.4.0, Linux 6.8.0-107-generic x86_64.
- [O] Warm `buildSymbolTable` took 41 ms, while cache validation over 57 unchanged files took about 1 ms.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/112` — Related; it proposes incremental reuse and bounded Project residency at broader scope.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111` — Related; it documents Project-dominated memory during correct multi-program analysis.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/86` — Distinct; it changes JavaScript discovery and symbol modeling.

Contribution fit: New pull request — the Level-1-only complete-hit boundary permits a small cache fast path.

## Proposed-Change

Classify reusable files before project construction and return cached modules on a complete Level-1 hit.
Reuse that classification on partial and cold paths so file metadata is not checked twice.

## Scope-and-Constraints

- Preserve: Discovery, target-file subsets, diagnostics, module order, cold and partial cache behavior, and Levels 2–4.
- Exclude: Cross-run Project reuse, partial project construction, cache format changes, and incremental compiler state.
- Cost: The symbol-table result must represent the intentional absence of compiler projects on the fast path.

## Verification

- Existing Level-1 cache and schema tests → cold, warm, partial, and invalidated behavior pass.
- Before and after warm self-analysis → emitted Level-1 application JSON is byte-identical.
- Warm self-analysis measurement → elapsed time and peak RSS recorded.

## Performance-Evidence

Workload: Same-process Level-1 analysis of this repository with 57 unchanged source files.
Baseline [O]: Warm end-to-end runs took 105 ms and 116 ms; warm symbol-table construction took 41 ms.
Candidate [O]: Project-free cache validation took about 1 ms; full candidate remains pending.
Guard [O]: Pending exact application-output comparison and Levels 2–4 regression checks.
Boundary: Source discovery, artifact inventory, cache reads, and final serialization still execute.
End-to-end-Measurement: Not measured

## Publication-Blockers

- Implementation, focused checks, exact pull-request draft, and final approval of that draft and target remain pending.

## Next-Action

Summary: Implement warm cache fast path
Action: Add the complete-hit Level-1 fast path on `fix/issue-004` without changing other levels.
Done-When: Cache tests, exact output comparison, and warm candidate measurement pass.

## Pull-Request-Implementation

Branch: fix/issue-004
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Skip compiler-project construction only for complete warm Level-1 cache hits.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-004`
Title: `perf(cache): skip projects on complete warm L1 hits`

Body:

## Summary

- Classify complete Level-1 cache reuse before constructing compiler projects.
- Preserve cold, partial, invalidated, and Levels 2–4 behavior.

## Evidence

- Same-process warm Level-1 self-analysis took 105–116 ms.
- Cache validation for the same 57 unchanged source files took about 1 ms.

## Validation

- Existing Level-1 cache and schema tests.
- `bun run typecheck`
- Exact application-output comparison across cold and warm Level-1 runs.

## Prior art

- #112 proposes broader incremental reuse and bounded Project residency but not this Level-1 fast path.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
