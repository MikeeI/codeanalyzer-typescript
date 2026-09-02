import * as fs from "node:fs";
import * as path from "node:path";
import { boltWriter, buildSchemaDocument, project, writeCypherFile } from "../build/neo4j";
import type { AnalysisOptions } from "../options";
import type { TSAnalysis } from "../schema";
import { Logger } from "./logging";

/**
 * The only facade-visible artifact. Two output targets:
 *  - json (default): with no -o, print compact JSON to stdout (the SDK reads stdout); with -o,
 *    write `<output>/analysis.json`.
 *  - neo4j: project the IR to a graph. With --neo4j-uri, push incrementally to a live DB over
 *    Bolt; otherwise write a self-contained `<output>/graph.cypher` snapshot.
 */
export async function emit(application: TSAnalysis, opts: AnalysisOptions): Promise<void> {
  if (opts.emit === "neo4j") {
    await emitNeo4j(application, opts);
    return;
  }
  // The envelope IS the wire (finalizeAnalysis already stripped the internal fields) — write it.
  if (opts.output === null) {
    process.stdout.write(JSON.stringify(application));
    return;
  }
  fs.mkdirSync(opts.output, { recursive: true });
  fs.writeFileSync(path.join(opts.output, "analysis.json"), JSON.stringify(application));
}

/**
 * Emit the Neo4j schema contract (schema.json) — a static artifact derived from the in-repo
 * schema, independent of any analyzed project. With no -o it prints to stdout.
 */
export function emitSchema(opts: AnalysisOptions): void {
  const doc = `${JSON.stringify(buildSchemaDocument(), null, 2)}\n`;
  if (opts.output === null) {
    process.stdout.write(doc);
    return;
  }
  fs.mkdirSync(opts.output, { recursive: true });
  fs.writeFileSync(path.join(opts.output, "schema.json"), doc);
}

async function emitNeo4j(application: TSAnalysis, opts: AnalysisOptions): Promise<void> {
  // Second projection of the SAME v2 envelope the JSON path emits. --emit neo4j forces full depth
  // (cli.ts), so the envelope carries the L4 dataflow and the projected graph is the complete CPG.
  const appId = application.application.id;
  const rows = project(application, appId);

  if (opts.neo4jUri) {
    const log = new Logger(opts.verbosity);
    await boltWriter(
      rows,
      {
        uri: opts.neo4jUri,
        user: opts.neo4jUser,
        password: opts.neo4jPassword,
        database: opts.neo4jDatabase,
      },
      log,
      opts.targetFiles === null, // full run ⇒ orphan pruning is safe
    );
    return;
  }

  const dir = opts.output ?? process.cwd();
  fs.mkdirSync(dir, { recursive: true });
  writeCypherFile(path.join(dir, "graph.cypher"), rows, appId);
}
