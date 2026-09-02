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
| [ISSUE-001](issues/ISSUE-001.md) | neo4j: Cypher snapshot materializes complete output string | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Implement lazy Cypher writer | Not published. |
| [ISSUE-002](issues/ISSUE-002.md) | neo4j: row sorting rebuilds composite keys per comparison | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Implement cached sort keys | Not published. |
| [ISSUE-003](issues/ISSUE-003.md) | call graph: both resolvers rebuild the same AST index | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Share resolver AST index | Not published. |
| [ISSUE-004](issues/ISSUE-004.md) | cache: warm level-one hits still construct compiler projects | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Implement warm cache fast path | Not published. |
| [ISSUE-005](issues/ISSUE-005.md) | dataflow: throwability scans each subtree up to four times | Implementing | Pull-Request-Implementation | New-pull-request | Low | Unify throwability scan | Not published. |
| [ISSUE-006](issues/ISSUE-006.md) | artifacts: unmatched text files decode twice | Implementing | Pull-Request-Implementation | New-pull-request | Low | Reuse artifact text decode | Not published. |
| [ISSUE-008](issues/ISSUE-008.md) | neo4j: removed artifacts remain in projected state | Implementing | Pull-Request-Implementation | New-pull-request | High | Reconcile removed artifacts | Not published. |
| [ISSUE-009](issues/ISSUE-009.md) | dataflow: nested programs use the root compiler context | Implementing | Pull-Request-Implementation | New-pull-request | High | Bound program dataflow | https://github.com/codellm-devkit/codeanalyzer-typescript/issues/111 |
| [ISSUE-010](issues/ISSUE-010.md) | dataflow: non-CFG selectors suppress requested graph output | Implementing | Pull-Request-Implementation | New-pull-request | High | Separate graph attachment | Not published. |
| [ISSUE-011](issues/ISSUE-011.md) | cfg: abrupt completions bypass finally blocks | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Route abrupt completions | Not published. |
| [ISSUE-012](issues/ISSUE-012.md) | cfg: empty try enters catch on normal flow | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Fix empty try entry | Not published. |
| [ISSUE-013](issues/ISSUE-013.md) | call graph: class property callables lose invocation edges | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Resolve property callables | Not published. |
| [ISSUE-014](issues/ISSUE-014.md) | cache: semantic modules outlive their compiler context | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Validate semantic cache | Not published. |
| [ISSUE-015](issues/ISSUE-015.md) | neo4j: lock edges lose dependency provenance | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Preserve lock provenance | Not published. |
| [ISSUE-016](issues/ISSUE-016.md) | artifacts: Docker ENV parsing loses valid assignments | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Parse Docker assignments | Not published. |
| [ISSUE-018](issues/ISSUE-018.md) | cfg: labeled statements lose break targets | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Restore labeled breaks | Not published. |

## Archived-Findings

| ID | Finding | Authorized-Work | Publication-Target | Contribution-Priority | Archive-Reason | External-Reference |
| --- | --- | --- | --- | --- | --- | --- |
| [ISSUE-007](issues/archive/ISSUE-007.md) | neo4j: Bolt reconciliation is not application-isolated | Pull-Request-Implementation | New-pull-request | High | Duplicate | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/117 |
| [ISSUE-017](issues/archive/ISSUE-017.md) | neo4j: projected modules omit incremental content hashes | Pull-Request-Implementation | New-pull-request | Medium | Duplicate | https://github.com/codellm-devkit/codeanalyzer-typescript/pull/119 |
