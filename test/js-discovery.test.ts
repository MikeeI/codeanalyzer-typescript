/**
 * Discovery must see JavaScript, not just TypeScript (issue #84). Before this, `SOURCE_EXTS`
 * held only the four TS extensions, so a JS-only project produced an empty symbol table and
 * `cants` exited 0 with no warning.
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AnalysisOptions } from "../src/options";
import { analyze } from "../src/core";
import { discoverSourceFiles } from "../src/syntactic_analysis/discovery";
import { buildSymbolTable } from "../src/syntactic_analysis/symbolTable";
import { Logger } from "../src/utils/logging";

const JS_APP = path.resolve(import.meta.dir, "fixtures/js-app");

const keysOf = (skipTests: boolean): string[] => discoverSourceFiles(JS_APP, skipTests).map((f) => f.fileKey);

describe("discoverSourceFiles on a JavaScript project", () => {
  test("discovers .js, .jsx, .mjs and .cjs sources", () => {
    expect(keysOf(false)).toEqual([
      "src/helpers.mjs",
      "src/index.js",
      "src/legacy.cjs",
      "src/util.js",
      "src/util.test.js",
      "src/widget.jsx",
    ]);
  });

  test("treats .test.js as a test file when skipTests is on", () => {
    expect(keysOf(true)).toEqual([
      "src/helpers.mjs",
      "src/index.js",
      "src/legacy.cjs",
      "src/util.js",
      "src/widget.jsx",
    ]);
  });
});

const optionsFor = (input: string): AnalysisOptions => ({
  input,
  output: null,
  emit: "json",
  appName: null,
  neo4jUri: null,
  neo4jUser: "neo4j",
  neo4jPassword: "neo4j",
  neo4jDatabase: null,
  analysisLevel: 1,
  targetFiles: null,
  skipTests: true,
  eager: false,
  noBuild: true,
  phantoms: true,
  callGraphProvider: "union",
  cacheDir: null,
  verbosity: 0,
});

describe("analyze() on a JavaScript project", () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cants-js-app-"));
  const app = (() => {
    try {
      return analyze({ ...optionsFor(JS_APP), appName: "js-app", eager: true, cacheDir });
    } finally {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }
  })();

  test("builds a module for every discovered JavaScript source", () => {
    expect(Object.keys(app.symbol_table).sort()).toEqual([
      "src/helpers.mjs",
      "src/index.js",
      "src/legacy.cjs",
      "src/util.js",
      "src/widget.jsx",
    ]);
  });

  test("resolves calls across a relative require()", () => {
    // index.js calls both helpers it destructured off `require("./util")`. Signatures carry no
    // file extension — `stripTsExtension` (src/schema/schema.ts) strips .js/.jsx/.mjs/.cjs too.
    const edges = app.call_graph.filter((e) => e.source === "src/index.makeHandle");

    expect(edges.map((e) => e.target).sort()).toEqual(["src/util.slugify", "src/util.truncate"]);
  });

  test("both call-graph providers see the JavaScript sources", () => {
    const provenance = new Set(app.call_graph.flatMap((e) => e.provenance));

    expect(provenance.has("tsc")).toBe(true);
    expect(provenance.has("jelly")).toBe(true);
  });
});

/** A real Logger that records warnings instead of writing them, so the test can assert on them. */
class RecordingLogger extends Logger {
  readonly warnings: string[] = [];
  override warn(msg: string): void {
    this.warnings.push(msg);
  }
}

describe("buildSymbolTable on a project with no analyzable sources", () => {
  test("warns instead of succeeding silently", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "cants-empty-"));
    fs.writeFileSync(path.join(empty, "README.md"), "no sources here\n");
    const log = new RecordingLogger(0);

    try {
      const result = buildSymbolTable(
        optionsFor(empty),
        { tsConfigFilePath: null, degraded: false, notes: [] },
        null,
        log,
      );
      expect(Object.keys(result.symbol_table)).toEqual([]);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }

    expect(log.warnings.join("\n")).toContain("no source files");
  });
});
