/**
 * Transition gate for the native-v2-model rewrite (#96, docs/design/specs/native-v2-model.md).
 *
 * Captured from the branch base (pre-rewrite `main` behavior), these goldens pin the wire —
 * `analysis.json` at every level plus the Neo4j cypher projection — so each rewrite stage can
 * prove itself wire-stable. Comparison is DEEP-EQUAL after parsing (JSON object key order is
 * meaningless to consumers; the SDK parses, never diffs bytes); cypher is compared as a sorted
 * line set (row emission order follows object iteration order, which re-bucketing legitimately
 * changes; the graph is the set of rows). `analyzer.version` is normalized out.
 *
 * Regenerate (Stage 0 only): GOLDEN_REGEN=1 bun test test/native-rewrite-goldens.test.ts
 *
 * This file and test/goldens/ are TRANSITION-SCOPED: deleted at Stage 4 teardown, when the
 * standing conformance + monotonicity gates take back over.
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { analyze } from "../src/core";
import type { AnalysisOptions } from "../src/options";
import { renderCypher, project } from "../src/build/neo4j";
import { toV2Detailed } from "../src/schema/v2";

const GOLDEN_DIR = path.resolve(import.meta.dir, "goldens");
const REGEN = !!process.env["GOLDEN_REGEN"];
const FIXTURES = ["sample-app", "dataflow-app", "anon-app"] as const;
const LEVELS = [1, 2, 3, 4] as const;

function options(fixture: string, level: number): AnalysisOptions {
  return {
    input: path.resolve(import.meta.dir, "fixtures", fixture),
    output: null,
    emit: "json",
    appName: null,
    neo4jUri: null,
    neo4jUser: "neo4j",
    neo4jPassword: "",
    neo4jDatabase: null,
    analysisLevel: level,
    graphs: ["cfg", "dfg", "pdg", "sdg"],
    graphFieldDepth: 3,
    jobs: 1,
    targetFiles: null,
    skipTests: true,
    eager: true,
    noBuild: true,
    phantoms: true,
    callGraphProvider: "union", // the default provider — exercises tsc, jelly, and the merge
    cacheDir: null,
    verbosity: 0,
  };
}

/** Parse-roundtrip (drops undefined exactly like the real emit) and pin the analyzer version. */
function normalize(v2: unknown): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(v2)) as Record<string, unknown>;
  (out["analyzer"] as Record<string, unknown>)["version"] = "GOLDEN";
  return out;
}

interface Captured {
  json: Record<string, unknown>;
  cypher: string[] | null; // sorted rows, level-4 runs only (--emit neo4j is always full-depth)
}

async function capture(fixture: string, level: number): Promise<Captured> {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cants-golden-"));
  try {
    const opts = { ...options(fixture, level), cacheDir };
    const app = await analyze(opts);
    const { application } = toV2Detailed(app, opts);
    const cypher =
      level === 4
        ? renderCypher(project(application, application.application.id), application.application.id).split("\n").sort()
        : null;
    return { json: normalize(application), cypher };
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

for (const fixture of FIXTURES) {
  describe(`goldens: ${fixture}`, () => {
    for (const level of LEVELS) {
      test(`analysis.json -a ${level}${level === 4 ? " + graph.cypher" : ""} matches the pre-rewrite wire`, async () => {
        const got = await capture(fixture, level);
        const jsonPath = path.join(GOLDEN_DIR, `${fixture}-a${level}.json`);
        const cypherPath = path.join(GOLDEN_DIR, `${fixture}.cypher`);
        if (REGEN) {
          fs.mkdirSync(GOLDEN_DIR, { recursive: true });
          fs.writeFileSync(jsonPath, JSON.stringify(got.json));
          if (got.cypher) fs.writeFileSync(cypherPath, got.cypher.join("\n"));
          return;
        }
        expect(got.json).toEqual(JSON.parse(fs.readFileSync(jsonPath, "utf-8")));
        if (got.cypher) expect(got.cypher).toEqual(fs.readFileSync(cypherPath, "utf-8").split("\n"));
      }, 240_000);
    }
  });
}
