/**
 * #53 — checker-known external/library calls resolve to `:External` phantoms instead of being
 * dropped. `resolveCalleeSignature` (src/schema/signatures.ts) already asks the ts-morph checker
 * for the callee's declaration; before this fix it only kept the result when the declaration lived
 * in-project (gated by `allSignatures`), silently discarding anything the checker resolved into
 * node_modules or the TS stdlib. The fixture (`external-calls.ts`) exercises the two cases the
 * pre-existing import-index phantom fallback (phantoms.ts) can't reach on its own: a member call on
 * a receiver that is itself external-typed but not an import binding (`cmd.name()`/`cmd.parse()` —
 * `cmd` is a local `const`, not an `import`), and a bare stdlib global with no import at all (`eval`).
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { analyze } from "../src/core";
import type { AnalysisOptions } from "../src/options";
import type { TSApplication, TSCallsite } from "../src/schema";

const FIXTURE = path.resolve(import.meta.dir, "fixtures/sample-app");

function options(): AnalysisOptions {
  return {
    input: FIXTURE,
    output: null,
    emit: "json",
    appName: null,
    neo4jUri: null,
    neo4jUser: "neo4j",
    neo4jPassword: "",
    neo4jDatabase: null,
    analysisLevel: 2,
    graphs: [],
    graphFieldDepth: 3,
    jobs: 1,
    targetFiles: null,
    skipTests: true,
    eager: true,
    noBuild: true,
    phantoms: true,
    callGraphProvider: "tsc",
    cacheDir: null,
    verbosity: 0,
  };
}

async function run(): Promise<TSApplication> {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "cants-ext-test-"));
  try {
    return await analyze({ ...options(), cacheDir });
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

/** Every call site recorded on every top-level function of one module file. */
function callsIn(app: TSApplication, fileKey: string): TSCallsite[] {
  const mod = app.symbol_table[fileKey];
  const out: TSCallsite[] = [];
  for (const fn of Object.values(mod.functions)) out.push(...fn.call_sites);
  return out;
}

describe("external call resolution (#53)", () => {
  test("checker-resolved external targets become external_symbols with callee backfilled", async () => {
    const app = await run();

    const ext = Object.keys(app.external_symbols ?? {});
    // node:fs.readFileSync — a bare named-import call, already reachable via the pre-existing
    // import-index fallback (unaffected by #53; asserted here for shape parity).
    expect(ext.some((s) => s.includes("node:fs") && s.includes("readFileSync"))).toBe(true);
    // `new Command()` — also a bare named-import identifier, so the import-index fallback already
    // catches it too. The genuinely new case is `cmd.name()/.description()/.parse()`: member calls
    // on `cmd`, a local `const`, not an import binding — the syntactic index has nothing to key off
    // of, so only checker-based resolution (this fix) reaches them.
    expect(ext.some((s) => s.startsWith("commander"))).toBe(true);
    expect(ext.some((s) => /^commander\.(name|description|parse)$/.test(s))).toBe(true);
    // a TS-stdlib global (eval, from lib.*.d.ts) with no import at all — checker-resolved, new in #53.
    expect(ext.some((s) => s.endsWith(".eval"))).toBe(true);

    const calls = callsIn(app, "src/external-calls.ts");
    expect(calls.length).toBeGreaterThan(0);
    const resolved = calls.filter((c) => c.callee_signature != null);
    expect(resolved.length / calls.length).toBeGreaterThanOrEqual(0.75);
  });
});
