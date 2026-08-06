/**
 * Node labels and relationship types are namespaced per source language: TS for TypeScript, JS for
 * JavaScript. Without this, a database holding more than one analyzer's output mingles them —
 * codeanalyzer-python already namespaces every edge (PY_CALLS, PY_DECLARES, …) while this analyzer
 * emitted bare CALLS/DECLARES.
 *
 * Nodes with no language of their own — the application root, npm packages, external library
 * symbols — carry the analyzer's own TS namespace, since a sibling analyzer emits its own.
 */
import { describe, expect, test } from "bun:test";
import { project } from "../src/build/neo4j";
import { CALL_DEP, type TSApplication, type TSCallable, type TSModule } from "../src/schema";

const callable = (signature: string, name: string, path: string): TSCallable =>
  ({ signature, name, path }) as unknown as TSCallable;

const mod = (fns: Record<string, TSCallable>): TSModule =>
  ({ functions: fns, classes: {}, interfaces: {}, enums: {}, type_aliases: {}, namespaces: {}, variables: [], imports: [], exports: [], comments: [] }) as unknown as TSModule;

const app: TSApplication = {
  symbol_table: {
    "src/a.js": mod({ aj: callable("src/a.aj", "aj", "/p/src/a.js") }),
    "src/b.ts": mod({ bt: callable("src/b.bt", "bt", "/p/src/b.ts") }),
  },
  call_graph: [{ source: "src/a.aj", target: "src/b.bt", type: CALL_DEP, weight: 1, provenance: ["tsc"], tags: {} }],
  external_symbols: {},
  synthesized_callables: {},
} as unknown as TSApplication;

const rows = project(app, "mixed");
const labelsOf = (value: string): string[] => rows.nodes.find((n) => n.value === value)?.labels ?? [];

describe("per-language namespacing in the neo4j projection", () => {
  test("a JavaScript module is labelled JSModule, not TSModule", () => {
    expect(labelsOf("src/a.js")).toContain("JSModule");
    expect(labelsOf("src/a.js")).not.toContain("TSModule");
  });

  test("a TypeScript module is labelled TSModule", () => {
    expect(labelsOf("src/b.ts")).toContain("TSModule");
  });

  test("every relationship type is namespaced", () => {
    const bare = rows.edges.filter((e) => !/^(TS|JS)_/.test(e.type)).map((e) => e.type);
    expect(bare).toEqual([]);
  });

  test("an edge takes its source module's language", () => {
    const call = rows.edges.find((e) => e.type.endsWith("_CALLS"));
    expect(call?.type).toBe("JS_CALLS");
  });

  test("the application root keeps the analyzer's own TS namespace", () => {
    expect(labelsOf("mixed")).toContain("TSApplication");
  });
});
