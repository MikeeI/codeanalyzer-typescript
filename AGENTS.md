# Repository Guidelines

<essential-rule>
AGENTS.md is the sole authoritative project context file.
Read and edit AGENTS.md directly.
</essential-rule>

## Project Overview

`cants` is a TypeScript/JavaScript static analyzer built on the TypeScript compiler via ts-morph.
It is the CLDK TypeScript backend and emits canonical schema-v2 Code Property Graph output.
The output projections are `analysis.json` and a Neo4j property graph.
The analyzer mirrors the CLDK Python and Java backends, so output-shape parity is a project contract.

## Fork & Upstream Contribution Intent

- Official upstream: [codellm-devkit/codeanalyzer-typescript](https://github.com/codellm-devkit/codeanalyzer-typescript).
- This checkout is the [MikeeI/codeanalyzer-typescript](https://github.com/MikeeI/codeanalyzer-typescript) fork.
- The local checkout directory is `project-cants-fork`.
- `origin` is the personal fork and `upstream` is the canonical repository.
- The canonical upstream branch is `main`.
- The `personal` branch owns fork context and contribution tracking.
- Upstream-ready source work uses separate `feat/issue-XXX`, `fix/issue-XXX`, or `chore/issue-XXX` branches.
- Fork-only context, ledgers, configuration, and commits stay out of upstream contribution diffs.
- The goal is evidence-backed, high-value upstream issues, comments, and pull requests.
- Search existing upstream work before drafting a contribution and avoid duplicates or speculative cleanup.
- Never choose `Authorized-Work` on the user's behalf.
- Research-and-Reporting permits research, issues, and comments but no source implementation.
- Pull-Request-Implementation permits only the scoped source change recorded for a finding.
- Publish externally only after the user approves the exact current publication target and draft.

## Finding and Contribution Ledger

- Read `ISSUES.md` before repository work in every agent session.
- `ISSUES.md` owns the global `Next finding ID` and compact finding projection.
- Each `issues/ISSUE-NNN.md` owns one finding's complete current state and evidence.
- `FORMAT.md` owns research, lifecycle, drafting, implementation, and publication rules.
- Finding IDs use `ISSUE-NNN`, start at `ISSUE-001`, and remain permanent.
- Search the index and every plausible issue record before allocating a new finding.
- Create a finding record, index row, and allocator update in one change.
- Run the read-only ledger validator after every ledger mutation.
- Keep `AGENTS.md`, `FORMAT.md`, `ISSUES.md`, and `issues/` out of upstream contribution diffs.

## Schema-v2 Contract

Output is one additive structure with a containment tree and typed edge overlays.
Analysis levels add information monotonically: `L1 ⊆ L2 ⊆ L3 ⊆ L4`.
L1 emits the symbol tree and call nodes, L2 resolves the call graph, L3 emits intraprocedural graphs, and L4 emits SDG data.
The provider emits graph substrate only; slicing and taint remain frontend SDK reachability queries.
Durable callable IDs use `can://` identifiers, while local body and edge IDs use the documented ordinal forms.
The TypeScript resolver and deterministic defuse linker jointly own call-graph edges and provenance tags.
The JSON and Neo4j projections must remain in lockstep with the versioned schema contract.

## Architecture and Data Flow

- `analyze()` in `src/core.ts` owns orchestration of the analysis pipeline.
- `src/build` materializes target-project dependencies.
- `src/syntactic_analysis` builds the symbol table through ts-morph traversal.
- `src/semantic_analysis` resolves calls, phantom nodes, and defuse-linker edges.
- `src/dataflow` computes CFG, CDG, DDG, summaries, and SDG graphs for levels 3 and 4.
- `src/schema` owns the native schema-v2 model, per-run passes, emission, and graph IR.
- `src/build/neo4j` projects the same schema envelope to Cypher snapshots or Bolt.
- `src/utils` owns filesystem access, caching, logging, serialization, and version data.
- `test` owns Bun tests, fixtures, schema conformance, and monotonicity gates.
- `src/artifacts` owns repository-artifact inventory, dependencies, configuration keys, and config-use edges.
- `.claude/SCHEMA_DECISIONS.md` records schema decisions and their rationale.

## Key Directories

- `src/main.ts` and `src/cli.ts` own the entry point and Commander CLI.
- `src/options` owns parsed CLI options and `AnalysisOptions`.
- `src/schema` owns `TSAnalysis`, `TSApplication`, callable nodes, and graph contracts.
- `src/semantic_analysis` owns resolver and defuse-linker call-graph behavior.
- `src/dataflow` owns level-3 and level-4 graph computation and attachment.
- `src/build/neo4j` owns Neo4j rows, Cypher, Bolt, and schema projection.
- `packaging` owns standalone installers, Homebrew packaging, and Python wheels.
- `scripts` owns schema and README generation helpers.

## Development Commands

- `bun install --frozen-lockfile` installs the locked dependency graph.
- `bun run start -- --input /path/to/project` runs the analyzer from source.
- `bun run typecheck` runs TypeScript checking without emitting files.
- `bun test` runs unit and schema-conformance tests.
- `bun run build` builds the standalone `dist/cants` binary.
- `bun run gen:schema` regenerates `schema.neo4j.json`.
- `bun run gen:readme` regenerates the README CLI-help block.
- `RUN_CONTAINER_TESTS=1 bun test test/neo4j-bolt.test.ts` runs the Docker-backed Neo4j tests.

## Code Conventions

- Preserve the Bun, TypeScript, ts-morph, Commander, Neo4j, and YAML toolchain.
- Keep public exports in the existing entry points and implementation details under their owning modules.
- Keep schema stages, graph computation, and output projection under separate owners.
- Preserve rationale comments for schema identity, monotonicity, cache boundaries, and provider/client separation.
- Do not add taint-flow output to this provider.
- Generated schema and README sections remain owned by their generator commands.
- Avoid broad cleanup, speculative abstractions, and changes unrelated to one evidenced root cause.

## Testing and QA

- Run the narrowest repository-owned check that proves each changed observable contract.
- Run `bun run typecheck` for TypeScript type or API changes.
- Run `bun test` for schema, parser, graph, cache, or CLI behavior changes.
- Run `bun run build` when standalone packaging or build inputs change.
- Run the container test only when Neo4j Bolt behavior is in scope and Docker is available.
- Keep JSON and Neo4j schema conformance aligned when either projection changes.

## Development Rules

Before launching agents, apply skill-xray, skill-expert, and skill-brutal to the task.
Surface expert-level issues, non-obvious issues, blindspots, stale assumptions, and hidden dependencies.
Also surface missed constraints, edge cases, false positives, verification gaps, overclaims, and weak assumptions.
Identify improvement potential, inefficiencies, and what is wrong without softening.
Use these findings to design safe slices, sequencing, checks, and boundaries for complete agent results.

Every agent prompt must require skill-xray, skill-expert, and skill-brutal for the assigned scope before acting.
It must surface non-obvious issues, blindspots, stale assumptions, hidden dependencies, and edge cases.
It must also surface verification gaps, overclaims, failure modes, weak assumptions, and what is wrong.
The agent must adjust its approach, challenge its assumptions, and flag misleading or incomplete output risks.

Implementation assignments must cover existing patterns, callers, exported-symbol consumers, and failure modes.
They must also cover concurrency safety and lifecycle cleanup.
Each assignment must state `Test decision: none` or `Test decision: update`.
`update` must name the exact existing test that follows an intentional contract change.
Never request new tests.
Prohibit broad edits, unrelated cleanup, and unassigned files.

No vague agents.
Each assignment needs exact targets, non-goals, evidence anchors, acceptance criteria, and an output contract.

Commit completed units continuously.
Before each commit, use skill-git-commit-format to determine whether staged effects are one coherent unit.
The skill owns commit-message format and evidence.
After the boundary is valid, run the repository-owned commit and push workflow.
Do not commit every trivial edit immediately or defer unrelated work into one end-of-session commit.

Every project-level quality command is quiet by default and verbose on demand.
This policy applies to Make targets, package scripts, shell quality gates, and test runners.
Successful checks print only compact status such as `format: ok`, `lint: ok`, `test: ok`, or `check: ok`.
On failure, exit non-zero and print the failing step, exit code, and enough output to act without rerunning.
Full raw output must remain available through `--verbose`, `VERBOSE=1`, or the underlying tool's verbose mode.
New quality commands and future language setup must follow this policy instead of inventing another logging contract.
