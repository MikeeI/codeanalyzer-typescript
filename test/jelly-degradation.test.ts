/**
 * Issue #84: jelly supplies the large majority of a JavaScript project's call graph — on OWASP
 * NodeGoat with dependencies installed, 156 of 161 union edges. When the jelly leg fails, the
 * union provider degrades to tsc only, a ~81% edge loss on JS, reported at `info` level: not
 * printed at all at default verbosity. That silent cliff must be loud.
 */
import { describe, expect, spyOn, test } from "bun:test";
import { Project } from "ts-morph";
import type { CallGraphContext, CallGraphResult } from "../src/semantic_analysis";
import { jellyProvider, tscProvider, unionProvider } from "../src/semantic_analysis";
import type { TSModule } from "../src/schema";
import { Logger } from "../src/utils/logging";

class RecordingLogger extends Logger {
  readonly infos: string[] = [];
  readonly errors: string[] = [];
  override info(msg: string): void {
    this.infos.push(msg);
  }
  override warn(msg: string): void {
    this.errors.push(msg);
  }
  override error(msg: string): void {
    this.errors.push(msg);
  }
}

const EMPTY: CallGraphResult = { edges: [], external_symbols: {}, synthesized_callables: {} };

function contextOver(files: string[], log: Logger): CallGraphContext {
  const symbol_table: Record<string, TSModule> = {};
  for (const f of files) symbol_table[f] = {} as TSModule;
  return {
    project: new Project({ useInMemoryFileSystem: true }),
    symbol_table,
    root: "/tmp/project",
    log,
    phantoms: true,
  };
}

/** Run the union provider with a failing jelly leg and a stubbed tsc leg. */
function unionWithFailingJelly(files: string[], reason = "jelly exited 1"): RecordingLogger {
  const log = new RecordingLogger(0);
  const tsc = spyOn(tscProvider, "build").mockImplementation(() => EMPTY);
  const jelly = spyOn(jellyProvider, "build").mockImplementation(() => {
    throw new Error(reason);
  });
  try {
    unionProvider.build(contextOver(files, log));
  } finally {
    tsc.mockRestore();
    jelly.mockRestore();
  }
  return log;
}

describe("union provider when the jelly leg fails", () => {
  test("escalates on a JavaScript-majority project", () => {
    const log = unionWithFailingJelly(["src/a.js", "src/b.js", "src/c.cjs", "src/d.ts"]);

    expect(log.errors.join("\n")).toContain("jelly");
    expect(log.errors.join("\n")).toContain("JavaScript");
  });

  test("does not inline execFileSync's whole command line into the message", () => {
    // execFileSync sets `Command failed: node …/jelly.js <every entry file>`, which on NodeGoat is
    // 27 paths — unreadable in an error the user is meant to act on.
    const reason = `Command failed: node /x/jelly.js -j /tmp/out.json ${"app/routes/thing.js ".repeat(60)}`;

    const log = unionWithFailingJelly(["src/a.js", "src/b.js", "src/c.js"], reason);

    const msg = log.errors.join("\n");
    expect(msg).toContain("Command failed");
    expect(msg.length).toBeLessThan(300);
  });

  test("stays at info level on a TypeScript-majority project", () => {
    const log = unionWithFailingJelly(["src/a.ts", "src/b.ts", "src/c.tsx", "src/d.js"]);

    expect(log.errors).toEqual([]);
    expect(log.infos.join("\n")).toContain("jelly failed");
  });
});
