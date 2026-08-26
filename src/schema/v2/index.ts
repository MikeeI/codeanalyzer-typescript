// Transition shim (#96): the emitter moved to src/schema/emit.ts (finalizeAnalysis, run by
// analyze()) and the L3/L4 attach to src/dataflow/attach.ts. These re-exports keep the historical
// v2 import paths and names alive until the Stage-4 teardown retires them.
export * from "./model";
export { finalizeAnalysis, type AnalysisResult, type AnalysisResult as ToV2Result } from "../emit";
import type { AnalysisOptions } from "../../options";
import type { TSApplication } from "../schema";
import { finalizeAnalysis } from "../emit";
import type { V2Application } from "./model";

/** Historical name for the pass-runner (idempotent — safe to re-run on an analyzed tree). */
export function toV2Detailed(app: TSApplication, opts: AnalysisOptions): ReturnType<typeof finalizeAnalysis> {
  return finalizeAnalysis(app, opts);
}

/** Historical name: native app + options → schema-v2 Application (the wire). */
export function toV2(app: TSApplication, opts: AnalysisOptions): V2Application {
  return finalizeAnalysis(app, opts).application;
}
