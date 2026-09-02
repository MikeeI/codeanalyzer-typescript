# Issue and Pull Request Tracking

Read this index at the start of every agent session before repository work.
`FORMAT.md` owns research, lifecycle, drafting, implementation, and publication rules.
Each linked `issues/ISSUE-NNN.md` is the complete authoritative record for one root cause.
This file owns `Next-Finding-ID` and projects current issue-file state.
`Next-Action` is the 2–6 word `Next-Action/Summary` projection from the issue record.
When a row disagrees with its issue file, correct the row from the issue file in the same task.

Next finding ID: ISSUE-007

## Open-Findings

| ID | Finding | State | Authorized-Work | Publication-Target | Contribution-Priority | Next-Action | External-Reference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [ISSUE-001](issues/ISSUE-001.md) | neo4j: Cypher snapshot materializes complete output string | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Implement lazy Cypher writer | Not published. |
| [ISSUE-002](issues/ISSUE-002.md) | neo4j: row sorting rebuilds composite keys per comparison | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Implement cached sort keys | Not published. |
| [ISSUE-003](issues/ISSUE-003.md) | call graph: both resolvers rebuild the same AST index | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Share resolver AST index | Not published. |
| [ISSUE-004](issues/ISSUE-004.md) | cache: warm level-one hits still construct compiler projects | Implementing | Pull-Request-Implementation | New-pull-request | Medium | Implement warm cache fast path | Not published. |
| [ISSUE-005](issues/ISSUE-005.md) | dataflow: throwability scans each subtree up to four times | Implementing | Pull-Request-Implementation | New-pull-request | Low | Unify throwability scan | Not published. |
| [ISSUE-006](issues/ISSUE-006.md) | artifacts: unmatched text files decode twice | Implementing | Pull-Request-Implementation | New-pull-request | Low | Reuse artifact text decode | Not published. |

## Archived-Findings

| ID | Finding | Authorized-Work | Publication-Target | Contribution-Priority | Archive-Reason | External-Reference |
| --- | --- | --- | --- | --- | --- | --- |
