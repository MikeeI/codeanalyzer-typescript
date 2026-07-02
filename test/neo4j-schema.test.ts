/**
 * Schema conformance test (no container needed). Projects the sample fixture and asserts that the
 * real emitter only ever produces node labels, relationship types and properties that the schema
 * (src/build/neo4j/schema.ts) declares. This is the anti-drift guard: if project.ts grows a label
 * or property that schema.ts doesn't declare, this fails — keeping the published schema.json
 * honest. It also checks the checked-in schema.neo4j.json is regenerated (run `bun gen:schema`).
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  MARKER_LABELS,
  NODE_LABELS,
  REL_TYPES,
  buildSchemaDocument,
  project,
  twinOf,
  withTwins,
} from "../src/build/neo4j";
import { analyze } from "../src/core";
import type { AnalysisOptions } from "../src/options";

const FIXTURE = path.resolve(import.meta.dir, "fixtures/sample-app");

async function fixtureRows() {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cants-schema-test-"));
  const opts: AnalysisOptions = {
    input: FIXTURE, output: null, emit: "json", appName: "sample-app",
    neo4jUri: null, neo4jUser: "neo4j", neo4jPassword: "", neo4jDatabase: null,
    analysisLevel: 1, graphs: ["cfg", "dfg", "pdg", "sdg"], graphFieldDepth: 3, jobs: 1,
    targetFiles: null, skipTests: true, eager: true,
    noBuild: true, phantoms: true, callGraphProvider: "tsc", cacheDir, verbosity: 0,
  };
  try {
    return project(await analyze(opts), "sample-app");
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

const byLabel = new Map(NODE_LABELS.map((n) => [n.label, n]));
const mergeOf = new Map(NODE_LABELS.map((n) => [n.label, n.mergeLabel]));
const relByType = new Map(REL_TYPES.map((r) => [r.type, r]));
const markers = new Set<string>(MARKER_LABELS);
const twins = new Set<string>([
  ...NODE_LABELS.map((n) => twinOf(n.label)),
  ...MARKER_LABELS.map((m) => twinOf(m)),
]);
const mergeLabelsFor = (specifics: string[]) => new Set(specifics.map((s) => mergeOf.get(s)));

/** The specific (schema) label for a node row: the non-merge, non-marker, non-twin label. */
function specificLabel(labels: string[]): string {
  const merge = labels[0];
  if (merge !== "Symbol") return merge;
  return labels.find((l) => l !== "Symbol" && !markers.has(l) && !twins.has(l)) ?? "Symbol";
}

const rows = await fixtureRows();

describe("neo4j schema conformance", () => {

  test("every emitted node label + property is declared in the schema", () => {
    for (const node of rows.nodes) {
      const specific = specificLabel(node.labels);
      const decl = byLabel.get(specific);
      expect(decl, `undeclared node label: ${node.labels.join(":")}`).toBeDefined();
      expect(node.labels[0]).toBe(decl!.mergeLabel);

      for (const label of node.labels) {
        const ok = label === decl!.mergeLabel || label === specific || markers.has(label) || twins.has(label);
        expect(ok, `unexpected label '${label}' on ${specific}`).toBe(true);
      }
      for (const key of Object.keys(node.props)) {
        expect(decl!.properties[key], `undeclared property '${specific}.${key}'`).toBeDefined();
      }
    }
  });

  test("every emitted relationship type + property + endpoint is declared", () => {
    for (const edge of rows.edges) {
      const decl = relByType.get(edge.type);
      expect(decl, `undeclared relationship type: ${edge.type}`).toBeDefined();
      expect(mergeLabelsFor(decl!.from).has(edge.from.label), `bad source ${edge.from.label} for ${edge.type}`).toBe(true);
      expect(mergeLabelsFor(decl!.to).has(edge.to.label), `bad target ${edge.to.label} for ${edge.type}`).toBe(true);
      for (const key of Object.keys(edge.props)) {
        expect(decl!.properties[key], `undeclared property on ${edge.type}.${key}`).toBeDefined();
      }
    }
  });

  test("checked-in schema.neo4j.json matches the schema (run `bun gen:schema` if this fails)", () => {
    const onDisk = fs.readFileSync(path.resolve(import.meta.dir, "..", "schema.neo4j.json"), "utf8").trim();
    const fresh = JSON.stringify(buildSchemaDocument(), null, 2).trim();
    expect(onDisk).toBe(fresh);
  });

  test("every node carries exactly the TS twins of its base labels (1.1.0 dual-labeling)", () => {
    for (const node of rows.nodes) {
      const base = node.labels.filter((l) => !twins.has(l));
      expect(new Set(node.labels), `bad twin set on ${node.labels.join(":")} ${node.value}`).toEqual(
        new Set(withTwins(base)),
      );
      expect(twins.has(node.labels[0]), `merge label must stay bare: ${node.labels[0]}`).toBe(false);
    }
  });

  test(":Application is stamped with the 1.1.0 contract version", () => {
    const app = rows.nodes.find((n) => n.labels[0] === "Application");
    expect(app).toBeDefined();
    expect(app!.props.schema_version).toBe("1.1.0");
  });
});
