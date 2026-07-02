import * as path from "node:path";
import { Command, Option } from "commander";
import type { AnalysisOptions, CallGraphProviderName, EmitTarget } from "./options";
import { ALL_GRAPHS, type GraphSelector } from "./schema";

/**
 * Build the commander program. Shared by parseArgs and by the README generator
 * (scripts/update-readme.ts), which reads `program.helpInformation()` so the documented
 * `cants --help` block can never drift from the actual CLI.
 */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name("cants")
    .description("CLDK TypeScript analyzer — emits the canonical analysis.json (symbol table + resolver call graph), or a Neo4j graph.")
    .option("-i, --input <path>", "project root to analyze (not required for --emit schema)")
    .option("-o, --output <dir>", "output directory (omit ⇒ compact output to stdout)")
    .option("--emit <target>", "output target: json (analysis.json, default) | neo4j (graph.cypher or live push) | schema (the Neo4j schema.json contract)", "json")
    .option("--app-name <name>", "logical application name for the graph :Application anchor (default: input dir name)")
    // The four Neo4j connection options also read the standard NEO4J_* environment variables when
    // the flag is omitted (an explicit flag wins). Prefer NEO4J_PASSWORD over the flag — a flag
    // value is visible in shell history / the process list. Commander renders the `(env: …)` hint.
    .addOption(
      new Option(
        "--neo4j-uri <uri>",
        "push the graph to a live Neo4j over Bolt (incremental); omit to write graph.cypher",
      ).env("NEO4J_URI"),
    )
    .addOption(new Option("--neo4j-user <user>", "Neo4j username").env("NEO4J_USERNAME").default("neo4j"))
    .addOption(
      new Option(
        "--neo4j-password <password>",
        "Neo4j password (prefer the env var; a flag is visible in shell history / process list)",
      )
        .env("NEO4J_PASSWORD")
        .default("neo4j"),
    )
    .addOption(new Option("--neo4j-database <db>", "Neo4j database name").env("NEO4J_DATABASE"))
    .option(
      "-a, --analysis-level <n>",
      "analysis depth: 1 = symbol table + tsc resolver call graph + RTA (default); 2 = call graph; 3 = + program graphs (CFG/PDG/SDG)",
      "1",
    )
    .option(
      "--graphs <list>",
      "level-3 graph sections to emit, comma-separated: cfg | dfg | pdg | sdg (default: all; requires -a 3)",
    )
    .option("--graph-field-depth <k>", "access-path depth bound (k-limit) for level-3 dataflow", "3")
    .option("-t, --target-files <paths...>", "restrict analysis to specific files (incremental)")
    .option("--skip-tests", "skip test trees (default)")
    .option("--include-tests", "include test trees")
    .option("--eager", "force a clean rebuild instead of reusing the cache")
    .option("--lazy", "reuse the cache (default)")
    .option("--no-build", "skip dependency materialization (use a prepared node_modules)")
    .option("--no-phantoms", "disable phantom (external) nodes for imported/required library calls")
    .option(
      "--call-graph-provider <name>",
      "call-graph backend: union (default, tsc ∪ jelly) | tsc | jelly | both (deprecated alias of union)",
      "union",
    )
    .option("--tsc-only", "use the tsc resolver only — opt out of Jelly edges (overrides --call-graph-provider)")
    .option("-c, --cache-dir <dir>", "cache/intermediate directory")
    .option("-v, --verbose", "increase verbosity (repeatable)", (_v: string, prev: number) => prev + 1, 0)
    .allowExcessArguments(true);
  return program;
}

/** Parse argv (without node/script prefix) into normalized AnalysisOptions. See cli-contract.md. */
export function parseArgs(argv: string[]): AnalysisOptions {
  const program = buildProgram();
  program.parse(argv, { from: "user" });
  const o = program.opts();

  const levelStr = String(o.analysisLevel);
  if (!["1", "2", "3"].includes(levelStr)) {
    program.error(`error: invalid --analysis-level '${levelStr}' (expected 1, 2, or 3)`);
  }
  const level = Number(levelStr) as 1 | 2 | 3;

  // --graphs: strict validation (never a silent fallback), and only meaningful at -a 3.
  let graphs: GraphSelector[] = [...ALL_GRAPHS];
  if (o.graphs !== undefined) {
    if (level !== 3) program.error("error: --graphs requires --analysis-level 3");
    const requested = String(o.graphs)
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    if (!requested.length) program.error("error: --graphs requires at least one of: cfg, dfg, pdg, sdg");
    for (const g of requested) {
      if (!(ALL_GRAPHS as string[]).includes(g)) {
        program.error(`error: unknown --graphs value '${g}' (expected: cfg, dfg, pdg, sdg)`);
      }
    }
    graphs = [...new Set(requested)] as GraphSelector[];
  }

  const kStr = String(o.graphFieldDepth);
  const k = Number(kStr);
  if (!Number.isInteger(k) || k < 1) {
    program.error(`error: invalid --graph-field-depth '${kStr}' (expected a positive integer)`);
  }
  const emit: EmitTarget = o.emit === "neo4j" ? "neo4j" : o.emit === "schema" ? "schema" : "json";
  // --emit schema is a static artifact and needs no project; every other target requires -i.
  if (emit !== "schema" && !o.input) program.error("required option '-i, --input <path>' not specified");
  const targets: string[] | null =
    Array.isArray(o.targetFiles) && o.targetFiles.length ? o.targetFiles.map(String) : null;
  // --tsc-only is the forced opt-out: it wins over --call-graph-provider. Otherwise `both` is a
  // deprecated alias of `union` (warn, but honor it); unknown values fall back to the union default.
  let cgProvider: CallGraphProviderName;
  if (o.tscOnly) {
    cgProvider = "tsc";
  } else if (o.callGraphProvider === "tsc") {
    cgProvider = "tsc";
  } else if (o.callGraphProvider === "jelly") {
    cgProvider = "jelly";
  } else {
    if (o.callGraphProvider === "both") {
      // stderr only — stdout may carry compact JSON when -o is omitted.
      console.error("warning: --call-graph-provider both is deprecated; it now behaves as 'union' (tsc ∪ jelly).");
    }
    cgProvider = "union";
  }

  return {
    input: o.input ? path.resolve(String(o.input)) : "",
    output: o.output ? path.resolve(String(o.output)) : null,
    emit,
    appName: o.appName ? String(o.appName) : null,
    neo4jUri: o.neo4jUri ? String(o.neo4jUri) : null,
    neo4jUser: String(o.neo4jUser),
    neo4jPassword: String(o.neo4jPassword),
    neo4jDatabase: o.neo4jDatabase ? String(o.neo4jDatabase) : null,
    analysisLevel: level,
    graphs,
    graphFieldDepth: k,
    targetFiles: targets,
    skipTests: o.includeTests ? false : true,
    eager: Boolean(o.eager),
    // commander maps --no-build / --no-phantoms to opts.build/phantoms === false
    noBuild: o.build === false,
    phantoms: o.phantoms !== false,
    callGraphProvider: cgProvider,
    cacheDir: o.cacheDir ? path.resolve(String(o.cacheDir)) : null,
    verbosity: typeof o.verbose === "number" ? o.verbose : 0,
  };
}
