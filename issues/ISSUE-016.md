# ISSUE-016 — artifacts: Docker ENV parsing loses valid assignments

State: Submitted
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: https://github.com/codellm-devkit/codeanalyzer-typescript/pull/134
Contribution-Priority: Medium
Root-Cause-Confidence: High
Finding-Category: Correctness
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: Docker ENV/ARG extraction parses physical lines and only one assignment per directive.

## Reach-and-Impact

Reach [S]: Every artifact scan of Dockerfiles containing modern multi-assignment or continued directives is affected.
Impact [O]: `ENV A=1 B=2` emits only `A` with the incorrect value `1 B=2`.

## Evidence

- [S] `src/artifacts/deployEnv.ts:36-58` — parsing splits physical lines and uses the first equals sign.
- [O] `parseDockerfileEnv("ENV A=1 B=2\n")` → one key named `A`; `B` is absent.
- [S] `https://docs.docker.com/reference/dockerfile/#env` — ENV permits multiple `key=value` pairs.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/103` — Related parser origin.
- `https://raw.githubusercontent.com/moby/buildkit/master/frontend/dockerfile/parser/line_parsers.go` — Parser prior art.

Contribution fit: New pull request for one Dockerfile directive parser.

## Proposed-Change

Fold escaped physical lines into logical instructions before directive-specific tokenization.
Support modern ENV pairs, legacy single ENV values, and bare or assigned ARG names without interpolation.

## Scope-and-Constraints

- Preserve: Static `$VAR` references, namespaces, IDs, and single-assignment behavior.
- Exclude: Full Dockerfile AST, build-time interpolation, and new dependencies.

## Verification

- Modern, legacy, quoted, escaped, and continued ENV/ARG forms → exact keys, values, references, and spans.

## Publication-Blockers

None.

## Next-Action

Summary: Await upstream review
Action: Await maintainer review and CI for pull request #134.
Done-When: The pull request receives feedback or reaches a final outcome.

## Pull-Request-Implementation

Branch: fix/issue-016
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Correct Docker ENV and ARG extraction for valid multi-line assignments.
Commit: `654f665`
Push: `origin/fix/issue-016`
Checks:

- `bun test test/config-keys.test.ts`: passed.
- `bun test`: passed with 239 tests and 6 opt-in skips.
- `bun run typecheck`: passed.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-016`
Title: `fix(artifacts): parse Docker ENV assignment lists`

Body:

## Summary

Parse Docker ENV and ARG directives as logical instructions rather than isolated physical lines.
Preserve every valid assignment without evaluating build-time variables.

## Evidence

- Current parsing stops at the first equals sign.
- Docker permits multiple assignment pairs and escaped continuations.

## Changes

- Fold continued Dockerfile instructions.
- Tokenize modern, legacy, and bare directive forms with quote and escape handling.

## Risks and boundaries

- Variable references remain symbolic and are not interpolated.
- A full Dockerfile parser and new dependency remain out of scope.

## Verification

- `bun test test/config-keys.test.ts`
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
