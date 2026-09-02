# ISSUE-018 — cfg: labeled statements lose break targets

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/135
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: CFG lowering registers labels only when the inner statement is a loop.

## Reach-and-Impact

Reach [S]: A labeled block, switch, if, or try containing `break label` reaches this missing sink.
Impact [O]: A reproduced labeled-block break had no outgoing CFG edge to the following statement.

## Evidence

- [S] `src/dataflow/cfg.ts:206-215` — labels are forwarded to every inner statement.
- [S] `src/dataflow/cfg.ts:280-323` — only loop lowering registers the label in `ctx.labels`.
- [O] `outer: { break outer; }` → the break node has no target edge.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

No exact issue or active pull request was found.
Contribution fit: New pull request for one label-scope lowering contract.

## Proposed-Change

Register a break sink around every labeled statement.
Retain continue targets only for labeled iteration statements.

## Scope-and-Constraints

- Preserve: Existing loop continue behavior, node IDs, and unlabeled break semantics.
- Exclude: Goto-like behavior, parser changes, and unrelated switch lowering.

## Verification

- Labeled block, switch, if, try, and loop cases → break reaches the continuation and continue remains loop-only.

## Publication-Blockers

None.

## Next-Action

Summary: Await upstream review
Action: Await maintainer review and CI for pull request #135.
Done-When: The pull request receives feedback or reaches a final outcome.

## Pull-Request-Implementation

Branch: fix/issue-018
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Preserve break targets for all valid labeled statements.
Commit: `358acbb`
Push: `origin/fix/issue-018`
Checks:

- `bun test test/dataflow.test.ts`: passed.
- `bun test`: passed with 238 tests and 6 opt-in skips.
- `bun run typecheck`: passed.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-018`
Title: `fix(cfg): preserve labeled statement break targets`

Body:

## Summary

Register CFG break sinks for every valid labeled statement.
Keep labeled continue behavior restricted to iteration statements.

## Evidence

- Current label registration exists only in loop lowering.
- A labeled block break consequently has no edge to its continuation.

## Changes

- Scope a general label break sink around each inner statement.
- Keep labeled continue targets restricted to iteration statements.

## Risks and boundaries

- Existing unlabeled and loop continue behavior remains unchanged.
- Parser and node-identity contracts remain out of scope.

## Verification

- `bun test test/dataflow.test.ts`
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
