# ISSUE-006 — artifacts: unmatched text files decode twice

State: Implementing
Authorized-Work: Pull-Request-Implementation
Publication-Target: New-pull-request
External-Reference: Not published.
Contribution-Priority: Low
Root-Cause-Confidence: High
Finding-Category: Performance
Created: 2026-09-02
Updated: 2026-09-02
Source: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`

## Root-Cause

Root-Cause [S]: An unmatched non-binary artifact is decoded for classification and then decoded again for storage.

## Reach-and-Impact

Reach [S]: Every artifact file with no matching rule enters the probing path before its `unknown` record is emitted.
Impact [O]: A synthetic 16 MiB ASCII artifact spent 22–30 ms in repeated decoding versus 16–17 ms in one decode.

## Evidence

- [S] `src/artifacts/index.ts:49-70` — unmatched files assign `probe = decodeLossy(raw)` for format classification.
- [S] `src/artifacts/index.ts:76` — every non-binary file then assigns `text = decodeLossy(raw)` again.
- [S] `src/artifacts/index.ts:194-202` — `decodeLossy` decodes the entire buffer before source-text truncation.
- [O] Five 16 MiB ASCII trials took 30, 24, 23, 22, and 23 ms with the repeated decode.
- [O] One-decode trials took 17, 16, 16, 17, and 16 ms and produced identical stored text.

## Prior-Art

Coverage: issues and PRs open, closed, and merged; discussions and releases; checked=2026-09-02.
Gaps: No `CONTRIBUTING.md` or pull-request template exists on canonical `main`.

- `https://github.com/codellm-devkit/codeanalyzer-typescript/pull/103` — Related; it introduced unmatched-artifact retention and text capture without this reuse.
- `https://github.com/codellm-devkit/codeanalyzer-typescript/issues/112` — Distinct; it addresses analyzer-scale memory ceilings, not per-artifact decode duplication.

Contribution fit: New pull request — one function-local value can own text decoding without changing artifact policy.

## Proposed-Change

Decode a non-binary artifact once and reuse that string for unmatched classification, storage, and parsing.

## Scope-and-Constraints

- Preserve: Binary detection, unknown-format classification, full-file hashes and sizes, source truncation, and parsers.
- Exclude: Streaming decode, new encodings, size caps before decoding, rule changes, and artifact schema changes.
- Cost: The decoded string is created slightly earlier for matched files, where the same value is already required.

## Verification

- `bun test test/artifacts.test.ts` → existing artifact inventory, unknown, binary, hash, and truncation contracts pass.
- Before and after fixture analysis → artifact records are byte-identical.
- Synthetic 16 MiB artifact measurement → repeated baseline and candidate timings recorded.

## Performance-Evidence

Workload: One synthetic unmatched 16 MiB ASCII artifact under Bun 1.4.0 on Linux x86_64.
Baseline [O]: Repeated decode samples were 30, 24, 23, 22, and 23 ms.
Candidate [O]: One-decode prototype samples were 17, 16, 16, 17, and 16 ms.
Guard [O]: Stored and truncated text matched exactly.
Boundary: The benchmark isolates decode work; filesystem read, hash, classification, and parsing costs are excluded.
End-to-end-Measurement: Not measured

## Publication-Blockers

- Implementation, focused checks, exact pull-request draft, and final approval of that draft and target remain pending.

## Next-Action

Summary: Reuse artifact text decode
Action: Reuse one decoded value on `fix/issue-006` without changing artifact semantics.
Done-When: Focused tests, exact record comparison, and candidate measurement pass.

## Pull-Request-Implementation

Branch: fix/issue-006
Base: `upstream/main@234895e3fc7834256b8962a2a5293222d6e0b3f0`
Scope: Decode each non-binary artifact once within inventory collection.
Commit: Pending.
Push: Pending.
Checks:

- Pending.

## Publication-Draft

Target: `codellm-devkit/codeanalyzer-typescript:main` ← `MikeeI:fix/issue-006`
Title: `perf(artifacts): decode text once per file`

Body:

## Summary

- Decode each non-binary artifact once and reuse the string for classification, storage, and parsing.
- Preserve binary detection, source truncation, hashes, sizes, and artifact records.

## Evidence

- Repeated 16 MiB decode samples took 22–30 ms.
- One-decode samples took 16–17 ms and produced identical stored text.

## Validation

- `bun test test/artifacts.test.ts`
- `bun run typecheck`
- Exact artifact-record comparison and repeated 16 MiB timing samples.

## Prior art

- #103 introduced unmatched-artifact retention and text capture without this local decode reuse.

### Disclosure

Investigated thoroughly with GPT-5.6 (extra high reasoning effort), using [Oh My Pi](https://github.com/can1357/oh-my-pi) as the agent framework.
This report is not generic or unreviewed AI-generated output.
Its claims were checked against the cited evidence, and it includes the relevant detail intended to help maintainers resolve the issue.
If reports like this are not useful to the project, please let me know and I will refrain from submitting similar ones.
My intent is to help without wasting maintainer time or energy or discouraging their work.
Thank you for your work.
