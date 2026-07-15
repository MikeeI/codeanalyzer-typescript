import { describe, expect, test } from "bun:test";
import { shouldForceFullUpsert } from "../src/build/neo4j/bolt";

describe("bolt version gate (#68)", () => {
  test("mismatch or absent stored version forces a full upsert", () => {
    expect(shouldForceFullUpsert("1.1.0", "2.0.0")).toBe(true);
    expect(shouldForceFullUpsert(null, "2.0.0")).toBe(true);
    expect(shouldForceFullUpsert("2.0.0", "2.0.0")).toBe(false);
  });
});
