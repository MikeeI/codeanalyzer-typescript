/**
 * Twin-label vocabulary (graph schema 2.0.0, issue #65): every specific and marker label has a
 * TS-prefixed twin; the shared merge label `Symbol` deliberately has none (epic #64).
 */
import { describe, expect, test } from "bun:test";
import {
  MARKER_LABELS,
  NODE_LABELS,
  SCHEMA_VERSION,
  TS_PREFIX,
  buildSchemaDocument,
  twinOf,
  withTwins,
} from "../src/build/neo4j";

describe("TS twin-label vocabulary", () => {
  test("twinOf prefixes with TS", () => {
    expect(TS_PREFIX).toBe("TS");
    expect(twinOf("Callable")).toBe("TSCallable");
    expect(twinOf("Entrypoint")).toBe("TSEntrypoint");
  });

  test("withTwins appends a twin per label, keeps order, and skips Symbol", () => {
    expect(withTwins(["Module"])).toEqual(["Module", "TSModule"]);
    expect(withTwins(["Symbol", "Class"])).toEqual(["Symbol", "Class", "TSClass"]);
    expect(withTwins(["Symbol", "Callable", "Entrypoint"])).toEqual([
      "Symbol", "Callable", "Entrypoint", "TSCallable", "TSEntrypoint",
    ]);
    // idempotent: an already-expanded set gains nothing
    expect(withTwins(["Module", "TSModule"])).toEqual(["Module", "TSModule"]);
  });

  test("schema version is 2.0.0 (additive MINOR)", () => {
    expect(SCHEMA_VERSION).toBe("2.0.0");
  });

  test("schema document maps every specific + marker label to its twin", () => {
    const doc = buildSchemaDocument();
    for (const n of NODE_LABELS) expect(doc.label_twins[n.label]).toEqual([twinOf(n.label, "TS"), twinOf(n.label, "JS")]);
    for (const m of MARKER_LABELS) expect(doc.label_twins[m]).toEqual([twinOf(m, "TS"), twinOf(m, "JS")]);
    expect(doc.label_twins["Symbol"]).toBeUndefined();
    expect(Object.keys(doc.label_twins).length).toBe(NODE_LABELS.length + MARKER_LABELS.length);
  });
});
