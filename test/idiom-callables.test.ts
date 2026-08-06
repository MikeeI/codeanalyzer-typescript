/**
 * Issue #85: two ways of declaring a method were never materialized as callables, so calls to
 * them could not resolve — edges are gated to `allSignatures`, which is built from the symbol
 * table. Both are missed identically in TypeScript, so this is a language-neutral gap:
 *
 *   • `this.<name> = fn` inside a constructor function — landed in `local_variables`
 *   • object-literal methods (`{ foo(){} }`, `{ foo: function(){} }`) — not emitted at all
 *
 * On OWASP NodeGoat this left 24 callables against 115 function-like nodes in source, and the
 * whole DAO method layer absent from the call graph.
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { analyze } from "../src/core";
import type { AnalysisOptions } from "../src/options";
import type { TSApplication, TSCallable, TSClass, TSModule } from "../src/schema";

const FIXTURE = path.resolve(import.meta.dir, "fixtures/idiom-app");

function analyzeFixture(): TSApplication {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cants-idiom-"));
  const opts: AnalysisOptions = {
    input: FIXTURE, output: null, emit: "json", appName: "idiom-app",
    neo4jUri: null, neo4jUser: "neo4j", neo4jPassword: "", neo4jDatabase: null,
    analysisLevel: 2, targetFiles: null, skipTests: true, eager: true,
    noBuild: true, phantoms: true, callGraphProvider: "tsc", cacheDir, verbosity: 0,
  };
  try {
    return analyze(opts);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

/** Every callable signature in the symbol table, including nested ones. */
function callableSignatures(app: TSApplication): Set<string> {
  const out = new Set<string>();
  const walkCallable = (c: TSCallable): void => {
    out.add(c.signature);
    for (const inner of Object.values(c.inner_callables ?? {})) walkCallable(inner);
    for (const cls of Object.values(c.inner_classes ?? {})) walkClass(cls);
  };
  const walkClass = (k: TSClass): void => {
    for (const m of Object.values(k.methods ?? {})) walkCallable(m);
    for (const inner of Object.values(k.inner_classes ?? {})) walkClass(inner);
  };
  for (const m of Object.values(app.symbol_table) as TSModule[]) {
    for (const c of Object.values(m.functions ?? {})) walkCallable(c);
    for (const k of Object.values(m.classes ?? {})) walkClass(k);
  }
  return out;
}

describe("callables declared through dynamic idioms", () => {
  const app = analyzeFixture();
  const sigs = callableSignatures(app);

  test("materializes `this.<name> = fn` inside a constructor function", () => {
    expect(sigs).toContain("src/ctorfn.Dao.getById");
    expect(sigs).toContain("src/ctorfn.Dao.save");
  });

  test("materializes the same idiom in TypeScript", () => {
    expect(sigs).toContain("src/ctorfn_ts.Dao2.getById");
  });

  test("materializes object-literal methods", () => {
    expect(sigs).toContain("src/objlit.api.getById");
    expect(sigs).toContain("src/objlit.api.save");
  });

  test("materializes object-literal methods in TypeScript", () => {
    expect(sigs).toContain("src/objlit_ts.api2.getById");
  });

  test("still materializes plain nested callables (no regression)", () => {
    expect(sigs).toContain("src/ctorfn.Dao.helper");
  });
});

describe("edges into callables declared through dynamic idioms", () => {
  const app = analyzeFixture();
  const targets = app.call_graph.filter((e) => e.source === "src/caller.run").map((e) => e.target).sort();

  test("a call through a constructor-function instance resolves", () => {
    expect(targets).toContain("src/ctorfn.Dao.getById");
  });

  test("a call on an object literal resolves", () => {
    expect(targets).toContain("src/objlit.api.getById");
  });
});

describe("names of callables declared through dynamic idioms", () => {
  const app = analyzeFixture();
  const named = new Map<string, string>();
  const walk = (c: TSCallable): void => {
    named.set(c.signature, c.name);
    for (const inner of Object.values(c.inner_callables ?? {})) walk(inner);
  };
  for (const m of Object.values(app.symbol_table) as TSModule[]) {
    for (const c of Object.values(m.functions ?? {})) walk(c);
  }

  test("a `this.<name> = fn` callable is named, not (anonymous)", () => {
    expect(named.get("src/ctorfn.Dao.getById")).toBe("getById");
    expect(named.get("src/ctorfn.Dao.save")).toBe("save");
  });

  test("an object-literal member is named", () => {
    expect(named.get("src/objlit.api.save")).toBe("save");
  });
});

describe("security-scoped attribution: a sink call is homed on a named, reachable callable", () => {
  const app = analyzeFixture();
  const dao = Object.values(app.symbol_table as Record<string, TSModule>)
    .flatMap((m) => Object.values(m.functions ?? {}))
    .flatMap((f) => Object.values(f.inner_callables ?? {}))
    .find((c) => c.signature === "src/ctorfn.Dao.getById");

  test("the DAO method exists and carries its sink call site", () => {
    expect(dao).toBeDefined();
    const sinks = (dao?.call_sites ?? []).filter((s) => s.method_name === "find");
    expect(sinks.length).toBeGreaterThan(0);
    // Attribution without a fabricated edge: the receiver expression is recorded, so a consumer
    // can chain it to the enclosing callable's parameters/locals.
    expect(sinks[0]?.receiver_expr).toBeTruthy();
  });

  test("the enclosing constructor records the parameter the receiver derives from", () => {
    const ctor = Object.values(app.symbol_table as Record<string, TSModule>)
      .flatMap((m) => Object.values(m.functions ?? {}))
      .find((c) => c.signature === "src/ctorfn.Dao");
    expect(ctor?.parameters.map((p) => p.name)).toContain("db");
  });
});
