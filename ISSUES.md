# Issue and Pull Request Tracking

Read this index at the start of every agent session before repository work.
`FORMAT.md` owns research, lifecycle, drafting, implementation, and publication rules.
Each linked `issues/ISSUE-NNN.md` is the complete authoritative record for one root cause.
This file owns `Next-Finding-ID` and projects current issue-file state.
`Next-Action` is the 2–6 word `Next-Action/Summary` projection from the issue record.
When a row disagrees with its issue file, correct the row from the issue file in the same task.

Next finding ID: ISSUE-019

## Open-Findings

| ID | Finding | State | Authorized-Work | Publication-Target | Contribution-Priority | Next-Action | External-Reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ISSUE-002](issues/ISSUE-002.md) | neo4j: row sorting rebuilds composite keys per comparison | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await workflow approval | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/121 |
| [ISSUE-003](issues/ISSUE-003.md) | call graph: both resolvers rebuild the same AST index | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await workflow approval | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/122 |
| [ISSUE-004](issues/ISSUE-004.md) | cache: warm level-one hits still construct compiler projects | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await workflow approval | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/123 |
| [ISSUE-005](issues/ISSUE-005.md) | dataflow: throwability scans each subtree up to four times | Submitted | Pull-Request-Implementation | New-pull-request | Low | Await workflow approval | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/124 |
| [ISSUE-006](issues/ISSUE-006.md) | artifacts: unmatched text files decode twice | Submitted | Pull-Request-Implementation | New-pull-request | Low | Await workflow approval | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/125 |
| [ISSUE-008](issues/ISSUE-008.md) | neo4j: removed artifacts remain in projected state | Submitted | Pull-Request-Implementation | New-pull-request | High | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/126 |
| [ISSUE-009](issues/ISSUE-009.md) | dataflow: nested programs use the root compiler context | Submitted | Pull-Request-Implementation | New-pull-request | High | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/127 |
| [ISSUE-010](issues/ISSUE-010.md) | dataflow: non-CFG selectors suppress requested graph output | Submitted | Pull-Request-Implementation | New-pull-request | High | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/128 |
| [ISSUE-011](issues/ISSUE-011.md) | cfg: abrupt completions bypass finally blocks | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/129 |
| [ISSUE-012](issues/ISSUE-012.md) | cfg: empty try enters catch on normal flow | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/130 |
| [ISSUE-013](issues/ISSUE-013.md) | call graph: class property callables lose invocation edges | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/131 |
| [ISSUE-014](issues/ISSUE-014.md) | cache: semantic modules outlive their compiler context | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/132 |
| [ISSUE-015](issues/ISSUE-015.md) | neo4j: lock edges lose dependency provenance | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/133 |
| [ISSUE-016](issues/ISSUE-016.md) | artifacts: Docker ENV parsing loses valid assignments | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/134 |
| [ISSUE-018](issues/ISSUE-018.md) | cfg: labeled statements lose break targets | Submitted | Pull-Request-Implementation | New-pull-request | Medium | Await upstream review | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/135 |

## Archived-Findings

| ID | Finding | Authorized-Work | Publication-Target | Contribution-Priority | Archive-Reason | External-Reference |
| --- | --- | --- | --- | --- | --- | --- |
| [ISSUE-001](issues/archive/ISSUE-001.md) | neo4j: Cypher snapshot materializes complete output string | Pull-Request-Implementation | New-pull-request | Medium | Merged | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/120 |
| [ISSUE-007](issues/archive/ISSUE-007.md) | neo4j: Bolt reconciliation is not application-isolated | Pull-Request-Implementation | New-pull-request | High | Duplicate | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/117 |
| [ISSUE-017](issues/archive/ISSUE-017.md) | neo4j: projected modules omit incremental content hashes | Pull-Request-Implementation | New-pull-request | Medium | Duplicate | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/119 |
