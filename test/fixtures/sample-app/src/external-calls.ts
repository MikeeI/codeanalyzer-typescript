// Exercises checker-known external targets (#53): calls the tsc resolver CAN map to a declaration,
// but that declaration lives outside the project (a node_modules package or the TS stdlib), so the
// resolver's `allSignatures` gate used to drop them. These are cases the import-index phantom
// fallback (phantoms.ts) can't reach on its own:
//   - a member call on a receiver that is itself external-typed but NOT an import binding
//     (`cmd` below is a local `const`, not an `import`, so the syntactic index has nothing
//     to key off of — only the checker knows its type comes from node_modules).
//   - a bare global from lib.*.d.ts with no import at all (`eval`).
import { readFileSync } from "node:fs";
import { Command } from "commander";

/** named-import bare call → phantom via the existing import-index fallback (unchanged by #53). */
export function readsConfig(): string {
  return readFileSync("config.json", "utf8");
}

/**
 * `new Command()` is a bare named-import identifier, so the pre-existing import-index fallback
 * already resolves it — unaffected by #53. The member calls below are the new case: `cmd` is a
 * local `const`, not an import binding, so the syntactic index has nothing to key off of and only
 * checker-based resolution (this fix) can classify `cmd.name`/`cmd.description`/`cmd.parse` as
 * external.
 */
export function makesCommand(): Command {
  const cmd = new Command();
  cmd.name("cli").description("demo");
  cmd.parse(["node", "cli.js"]);
  return cmd;
}

/** a lib.*.d.ts global with no import at all — only the checker can classify its home. */
export function unsafeEval(raw: string): unknown {
  return eval(raw);
}
