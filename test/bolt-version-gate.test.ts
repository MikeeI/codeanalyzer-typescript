import { describe, expect, test } from "bun:test";
import { LEGACY_WIPE_STATEMENTS, shouldForceFullUpsert } from "../src/build/neo4j/bolt";

describe("bolt version gate (#68)", () => {
  test("mismatch or absent stored version forces a full upsert", () => {
    expect(shouldForceFullUpsert("1.1.0", "2.0.0")).toBe(true);
    expect(shouldForceFullUpsert(null, "2.0.0")).toBe(true);
    expect(shouldForceFullUpsert("2.0.0", "2.0.0")).toBe(false);
  });
});

describe("legacy (pre-2.0.0) wipe (#46)", () => {
  test("wipes the three legacy node classes, in order, unanchored but CanNode-guarded", () => {
    expect(LEGACY_WIPE_STATEMENTS).toHaveLength(3);

    // (1) project-owned twin-label nodes: matched by `_module`, spared iff :CanNode.
    expect(LEGACY_WIPE_STATEMENTS[0]).toBe(
      "MATCH (n) WHERE n._module IS NOT NULL AND NOT n:CanNode DETACH DELETE n RETURN count(n) AS wiped",
    );
    // (2) 1.x shared nodes (no `_module`): externals / packages / decorators, spared iff :CanNode.
    expect(LEGACY_WIPE_STATEMENTS[1]).toBe(
      "MATCH (n) WHERE (n:External OR n:Package OR n:Decorator) AND NOT n:CanNode DETACH DELETE n RETURN count(n) AS wiped",
    );
    // (3) the 1.x :Application node, keyed on name → no `id`.
    expect(LEGACY_WIPE_STATEMENTS[2]).toBe(
      "MATCH (a:Application) WHERE a.id IS NULL DETACH DELETE a RETURN count(a) AS wiped",
    );

    // Each is intentionally UNANCHORED on the MATCH (no :CanNode label) — it must reach legacy nodes —
    // yet every one guards current v2 data with an explicit `NOT n:CanNode` / `a.id IS NULL` predicate.
    for (const stmt of LEGACY_WIPE_STATEMENTS) {
      expect(stmt).not.toContain("MATCH (n:CanNode");
      expect(stmt).toContain("DETACH DELETE");
      expect(stmt).toContain("RETURN count(");
    }
  });
});
