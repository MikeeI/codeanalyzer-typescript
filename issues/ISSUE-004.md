# ISSUE-004 — cache: warm level-one hits still construct compiler projects

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/123
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

- `bun test test/l1-body-cache-shape.test.ts test/multi-tsconfig.test.ts test/schema-v2.test.ts` → 52 pass.
- `bun run typecheck` → passed.
- Five warm baseline and candidate outputs matched byte for byte.

## Performance-Evidence

Workload: Five alternating warm Level-1 runs over one 57-module target under Bun 1.4.0 on Linux x86_64.
Baseline [O]: Current warm runs took 94.1–100.7 ms with a 98.7 ms median.
Candidate [O]: Project-free warm runs took 53.6–62.1 ms with a 56.7 ms median.
Guard [O]: Every baseline and candidate application output matched byte for byte.
Boundary: Source discovery, artifact inventory, cache reads, and finalization still execute.
End-to-end-Measurement: Median warm Level-1 time fell 42.6%, from 98.7 ms to 56.7 ms.

## Publication-Blockers

None.

## Next-Action

Summary: Await workflow approval
Action: Await maintainer approval for GitHub Actions run 33626535036 on pull request #123.
Done-When: The CI run starts or reaches a test conclusion.

## Pull-Request-Implementation

Branch: fix/issue-004
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Skip compiler-project construction only for complete warm Level-1 cache hits.
Commit: `989a90ea6fb40257da1bec2a19bbe691cb21fe7b`
Push: `origin/fix/issue-004`
Checks:

- `bun test test/l1-body-cache-shape.test.ts test/multi-tsconfig.test.ts test/schema-v2.test.ts` → 52 pass.
- `bun run typecheck` → passed.
- Five warm baseline and candidate outputs matched byte for byte.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-004`
Title: `perf(cache): skip projects on complete warm L1 hits`

Body:

## Summary

- Classify complete Level-1 cache reuse before constructing compiler projects.
- Preserve cold, partial, invalidated, and Levels 2–4 behavior.

## Evidence

- Five current warm Level-1 runs took 94.1–100.7 ms with a 98.7 ms median.
- Project-free runs took 53.6–62.1 ms with a 56.7 ms median and byte-identical output.

## Validation

- `bun test test/l1-body-cache-shape.test.ts test/multi-tsconfig.test.ts test/schema-v2.test.ts`
- `bun run typecheck`
- Five exact warm Level-1 application-output comparisons.

## Prior art

- #112 proposes broader incremental reuse and bounded Project residency but not this Level-1 fast path.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
