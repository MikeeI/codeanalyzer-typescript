# ISSUE-010 — dataflow: non-CFG selectors suppress requested graph output

State: Implementing
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

Root-Cause [S]: Attachment requires an emitted CFG even when another selector owns the requested output.

## Reach-and-Impact

Reach [S]: Level-3 and Level-4 runs selecting only `pdg`, `dfg`, or `sdg` reach this gate.
Impact [O]: A reproduced `--graphs sdg` run returned success without attaching requested SDG data.

## Evidence

- [S] `src/dataflow/index.ts:207-238` — `FunctionGraphs.cfg` exists only when `cfg` is selected.
- [S] `src/dataflow/attach.ts:238-252` — every function without `fg.cfg` is skipped before L3 or L4 attachment.
- [O] `--graphs sdg` → program IR contained SDG edges while the wire tree contained no SDG projection.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/25` — Related selector contract, not this attachment bug.

Contribution fit: New pull request for one selector-to-attachment contract.

## Proposed-Change

Retain CFG nodes as internal attachment substrate independently of visible selector output.
Apply selectors only when writing the callable's public graph fields.

## Scope-and-Constraints

- Preserve: Existing graph selector names, DFG-as-DDG representation, and full default output.
- Exclude: New schema fields, selector renaming, and graph algorithm changes.

## Verification

- Each selector alone → only its requested public projection appears and contains expected data.

## Publication-Blockers

- Implementation, focused checks, commit, push, and final draft approval remain pending.

## Next-Action

Summary: Separate graph attachment
Action: Implement selector-independent attachment substrate on `fix/issue-010`.
Done-When: Individual selector regressions and typecheck pass.

## Pull-Request-Implementation

Branch: fix/issue-010
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Attach selected dataflow projections without requiring visible CFG output.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-010`
Title: `fix(dataflow): attach non-CFG graph selections`

Body:

## Summary

Keep internal CFG node identity available when callers select only PDG, DFG, or SDG output.
Apply graph selectors at the public attachment boundary.

## Evidence

- `applyDataflow` currently skips every function whose selected IR omits `cfg`.
- A successful SDG-only run consequently emits no SDG data in the wire tree.

## Changes

- Separate internal attachment substrate from visible graph fields.
- Preserve existing selector and schema behavior.

## Risks and boundaries

- Unselected CFG edges remain absent from public output.
- Graph computation algorithms remain unchanged.

## Verification

- `bun test test/dataflow.test.ts test/cli-options.test.ts`
- `bun run typecheck`

I checked the relevant issues, comments, pull requests, and discussions; this pull request is not a duplicate.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
