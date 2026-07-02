# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.4.3] - 2026-06-27

### Changed

- **Releases now announce themselves on GitHub Discussions.** Each new release auto-posts a discussion seeded from its release notes — both in this repo's `Announcements` category (linked to the release) and at the org level in `codellm-devkit/.github` — so you can follow and discuss new `codeanalyzer-typescript` versions without watching the Releases page (PR #18).
- **Generated release notes no longer silently drop PRs.** The label-driven changelog config gained a `Maintenance` bucket for `ci`/`chore` work plus a catch-all `Other` category, so every merged PR is now accounted for in the published notes (PR #18).

### Fixed

- **Release-linked Discussions now actually attach.** Granted the workflow `discussions:write` permission so the announcement discussion is created and linked to the release instead of failing.

## [v0.4.2] - 2026-06-27

### Added

- **`--tsc-only` flag for call-graph construction.** Pass `--tsc-only` to pin the
  call graph to the TypeScript resolver path only, opting out of the new union
  default when you want resolver-derived edges exclusively. (closes #11, PR #12)

### Changed

- **The call graph now defaults to the `tsc`-union-Jelly union.** Edges from the
  TypeScript resolver and Jelly are combined by default for fuller coverage; use
  the new `--tsc-only` flag to revert to the resolver-only path. (closes #11, PR #12)
- **Single source of truth for the Neo4j graph schema.** The schema behind the
  emitted Neo4j graph is consolidated so node and relationship definitions stay
  consistent across the analyzer. (closes #15, PR #16)
- **Label-driven, emoji-annotated release changelogs.** Release notes are now
  generated from PR labels with emoji categorization for easier scanning. (PR #17)

### Fixed

- **Anonymous callback edges no longer dangle.** Jelly's anonymous-callback nodes
  are now materialized, so call-graph edges into anonymous callbacks resolve to
  real targets instead of pointing at missing nodes. (closes #13, PR #14)

## [v0.4.1] - 2026-06-20

### Changed

- **Clearer `--neo4j-database` help text.** Tightened the usage/help text for the `--neo4j-database` flag so it is easier to understand what the option expects.
- **Richer release notes.** Releases now publish cargo-dist-style notes, including install one-liners, a download table, and an auto-generated changelog.

### Security

- **Neo4j credentials now come from the environment, not the command line.** `cants` reads Neo4j connection options and credentials from environment variables instead of CLI arguments, keeping secrets out of shell history and process listings (PR #5).

## [v0.4.0] - 2026-06-19

### Added

- **Neo4j graph output.** A new `--emit neo4j` mode emits the analysis as a Neo4j property graph alongside the standard CLDK `analysis.json`, so you can load `cants` results directly into a graph database. (PR #4)
- **`--emit schema` and a versioned Neo4j schema contract.** A new `--emit schema` mode prints the Neo4j graph schema, which is now pinned by a versioned contract and exercised end-to-end by Neo4j integration tests (run via testcontainers).

### Changed

- **Rewritten README and a new install script.** The documentation has been overhauled and an install script added, and the generated docs (the README `--help` block and the schema) are now synced automatically at release time so they stay in step with the CLI.
- **The Neo4j bolt (testcontainers) integration suite is now opt-in**, so the default test run no longer requires a running Neo4j container.
- **Wheel extraction now selects the binary by name**, making the CI step that pulls the `cants` binary out of built wheels more robust.

## [v0.3.0] - 2026-06-18

### Added

- **Jelly-based call-graph backend with a selectable provider.** A new Jelly-powered call-graph
  source is available, and the `--call-graph-provider` flag lets you choose which backend `cants`
  uses to build the call graph.

### Changed

- **Documentation for the new call-graph options.** The docs now cover the `--call-graph-provider`
  flag and the Jelly backend so you can pick and configure a call-graph source.
- **More reliable releases.** The release workflow is now re-runnable, and the Homebrew formula push
  runs as its own isolated job so `brew` installs of `cants` stay in sync with each release.

### Fixed

- **Corrected `analysis.json` output shape.** The emitted `analysis.json` now has the right structure,
  so downstream CLDK consumers parse it as expected.

## [v0.2.1] - 2026-06-08

### Added

- **`cants` console-script entry point.** Installing the `codeanalyzer-typescript` package now drops a
  `cants` command onto your `PATH`, so you can run the analyzer directly from the shell instead of
  invoking the module by hand.

### Changed

- **Installation docs for the `cants` CLI.** The documentation now covers installing the `cants` command
  via both `pip` and Homebrew.

### Removed

- **CodeQL level-2 enrichment pass.** The analyzer no longer runs the CodeQL-based level-2 enrichment
  step, so analysis runs no longer depend on CodeQL.

## [v0.2.0] - 2026-06-08

### Changed

- **The CLI command is now `cants`.** The compiled binary you invoke has been renamed from its previous name to `cants` (CodeANalyzer TypeScript), so update any scripts, aliases, or CI steps that called the old command. The PyPI package and Python import stay `codeanalyzer-typescript` / `codeanalyzer_typescript`, so only the executable name changes.

## [v0.1.1] - 2026-06-07

### Changed

- **Reworked the PyPI long description to mirror the main project README**, so the
  `codeanalyzer-typescript` package page leads with the project intro, usage, and output
  details instead of build internals.

## [v0.1.0] - 2026-06-07

### Added

- **Initial public release of `codeanalyzer-typescript`.** A self-contained `cants` CLI that analyzes a TypeScript codebase with no external services required.
- **TypeScript analysis support.** `cants` walks a TypeScript project via `ts-morph` and emits the canonical CLDK `analysis.json`, containing a full symbol table plus a resolver-based call graph.
- **Python packaging.** Install `codeanalyzer-typescript` from PyPI as a platform-tagged wheel that vendors the prebuilt analyzer binary, so no separate Node toolchain is needed; the wheel version is kept in sync with the release git tag.

### Changed

- Wired the `hatchling` build backend into release CI to produce the platform-tagged wheels.
