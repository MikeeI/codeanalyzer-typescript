/**
 * Twin-label vocabulary (transient dual-labeling on graph schema 2.0.0, issue #65): every specific
 * and marker label has a TS-prefixed twin; the shared merge labels (`Symbol`, `CanNode`)
 * deliberately have none (epic #64). The v2 catalog merges on `CanNode`, so it is the merge label
 * that must stay bare here.
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
  });

  test("withTwins appends a twin per label, keeps order, and skips shared merge labels", () => {
    expect(withTwins(["Module"])).toEqual(["Module", "TSModule"]);
    // both shared merge labels are skipped (v2 merges on CanNode)
    expect(withTwins(["CanNode", "Callable"])).toEqual(["CanNode", "Callable", "TSCallable"]);
    expect(withTwins(["Symbol", "Class"])).toEqual(["Symbol", "Class", "TSClass"]);
    // idempotent: an already-expanded set gains nothing
    expect(withTwins(["Module", "TSModule"])).toEqual(["Module", "TSModule"]);
  });

  test("schema version is 2.0.0 (v2 catalog)", () => {
    expect(SCHEMA_VERSION).toBe("2.0.0");
  });

  test("schema document maps every specific + marker label to its twin", () => {
    const doc = buildSchemaDocument();
    for (const n of NODE_LABELS) expect(doc.label_twins[n.label]).toBe(twinOf(n.label));
    for (const m of MARKER_LABELS) expect(doc.label_twins[m]).toBe(twinOf(m));
    // shared merge labels are never specific/marker labels, so they map to nothing
    expect(doc.label_twins["CanNode"]).toBeUndefined();
    expect(doc.label_twins["Symbol"]).toBeUndefined();
    // 12 node labels + 0 markers (none currently) = 12 twins
    expect(Object.keys(doc.label_twins).length).toBe(12);
    expect(Object.keys(doc.label_twins).length).toBe(NODE_LABELS.length + MARKER_LABELS.length);
  });
});
