# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-08-05

### Added
- **JavaScript is analyzed** (#84). Discovery was restricted to `.ts/.tsx/.mts/.cts`,
  so a JavaScript-only project produced an empty symbol table and exited 0 with no
  warning — on OWASP NodeGoat, 0 modules and an 84-byte `analysis.json`. `.js`,
  `.jsx`, `.mjs` and `.cjs` are now discovered, and `.test.js` / `.spec.js` are
  skipped like their TypeScript counterparts. Nothing downstream needed changing:
  the compiler already ran with `allowJs`, and Jelly already accepted `.js` — both
  were simply never handed a file.
- **Methods declared through dynamic idioms are materialized** (#85):
  `this.<name> = fn` inside a constructor function, and object-literal members
  (`{ foo(){} }`, `{ foo: function(){} }`). Previously the first landed in
  `local_variables` and the second was dropped entirely, so no call could resolve
  to either — call-graph edges are gated to signatures present in the symbol table.
  This is language-neutral: both were missed in TypeScript too.

### Changed
- **BREAKING: Neo4j labels and relationship types are namespaced per source language** (#88).
  Node labels gain a language twin — a `.js` module is `:Module:JSModule`, a `.ts` module is
  `:Module:TSModule` — and every relationship type is prefixed: `JS_CALLS`, `TS_DECLARES`,
  `JS_HAS_MODULE`, and so on. This matches `codeanalyzer-python`, which already namespaces every
  edge (`PY_CALLS`, `PY_DECLARES`, …), so a database holding output from more than one analyzer no
  longer mingles them.

  An edge takes its **source** module's language, falling back to its target's — so the
  application-to-module edge on a JavaScript project is `JS_HAS_MODULE`. Nodes with no language of
  their own (the application root, packages, external library symbols) keep the analyzer's own `TS`
  namespace, since a sibling analyzer emits its own.

  **Migration:** every stored query against a graph produced by 0.5.0 or earlier must be updated —
  `MATCH ()-[:CALLS]->()` becomes `MATCH ()-[:TS_CALLS|JS_CALLS]->()`. The Neo4j schema version
  moves 1.1.0 → 2.0.0, which forces a full re-upsert on the next incremental push.

- **A failed Jelly leg is now reported at error level on JavaScript-majority
  projects.** The union provider degrades to tsc-only when Jelly throws, and
  reported that at `info`, which is not printed at default verbosity. On JavaScript
  that is a ~81% edge loss with no signal (Jelly supplies 156 of 161 union edges on
  NodeGoat). TypeScript projects keep the quieter `info` line. The default provider
  is unchanged: `union` is a strict superset of `jelly` on JavaScript, measured both
  with and without dependencies installed.
- **Caches from 0.5.0 and earlier are invalidated.** Extraction now produces more
  callables from unchanged sources, so `ANALYZER_VERSION` moves with the release and
  every cached `analysis_cache.json` is rebuilt on first run.

### Measured on OWASP NodeGoat (dependencies installed, `-a 2`)

| | 0.5.0 | 0.6.0 |
| --- | --- | --- |
| modules | 0 | 27 |
| callables | 0 | 59 |
| call-graph edges | 0 | 184 |
| resolved call sites | 0 | 51 |

59 callables matches the parser-derived count of nameable functions in the source
exactly. The discovered module set equals the set of `.js` files outside
`node_modules`, `vendor` and test trees.

### Known gaps
- CommonJS `require` / `module.exports` are not modelled at module level, so
  `imports` and `exports` stay empty on CommonJS input. Relative `require()` **call
  targets** do resolve.
- Method calls on an untyped receiver (e.g. `db.collection(...)` where `db` is an
  untyped parameter) produce no edge into the library — tracked in #87. The call is
  still attributable: it is recorded on the enclosing callable with its receiver
  expression, and that callable is reachable from its route.
