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
import neo4j from "neo4j-driver";

/** named-import bare call → phantom via the existing import-index fallback (unchanged by #53). */
export function readsConfig(): string {
  return readFileSync("config.json", "utf8");
}

/**
 * `new Command()` resolves through the checker path (#53): commander self-types, so the checker
 * lands on its ClassDeclaration in node_modules → external constructor `commander.Command`. The
 * import-index fallback would name it identically (named import of `Command` from `commander`),
 * so both paths agree — the checker path just wins by running first. The member calls below are
 * the case ONLY the checker can reach: `cmd` is a local `const`, not an import binding, so the
 * syntactic index has nothing to key off of for `cmd.name`/`cmd.description`/`cmd.parse`.
 */
export function makesCommand(): Command {
  const cmd = new Command();
  cmd.name("cli").description("demo");
  cmd.parse(["node", "cli.js"]);
  return cmd;
}

/**
 * default-import member call → external `neo4j-driver.driver`. (No direct dependency of this repo
 * has a *callable* default export — neo4j-driver's default is an object — so a default-import
 * member call stands in for the `express()`-style bare default call.)
 */
export function makesDriver(): unknown {
  return neo4j.driver("bolt://localhost");
}

/**
 * Member calls on a LOCAL receiver of external type — the fallback has no binding for `d`, so only
 * the checker can attribute these. Each line pins a different declaration kind in the framework's
 * .d.ts, the Express/RxJS pattern from #53 (`res.json(...)`, `observable.subscribe(...)`):
 *   - `d.session()`   → MethodDeclaration (in neo4j-driver-core, where the decl actually lives)
 *   - `d.rxSession()` → function-typed PropertyDeclaration (`rxSession: (cfg?) => RxSession`)
 *   - `neo4j.auth.basic()` → PropertySignature on a nested receiver (`neo4j.auth` is a property
 *     access, not an import binding, so the fallback can't reach it either)
 */
export function makesSession(): unknown {
  const d = neo4j.driver("bolt://localhost", neo4j.auth.basic("user", "pass"));
  const s = d.session();
  d.rxSession();
  return s;
}

/** a lib.*.d.ts global with no import at all — only the checker can classify its home. */
export function unsafeEval(raw: string): unknown {
  return eval(raw);
}
