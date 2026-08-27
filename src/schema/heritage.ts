/**
 * Heritage projection pass (TS-specific): resolve each type's heritage SIGNATURES
 * (`base_classes`/`implements_types`, which stay on the wire as the human-readable spine) into
 * `can://` ids for the Neo4j EXTENDS/IMPLEMENTS overlay. Resolved-only: an external/library
 * supertype that never maps to a first-party id is dropped, never nulled. Runs at every level
 * (types are homed by the unconditional L1 walk) and is overwrite-idempotent (stale ids from a
 * previous run under another app name are recomputed; unresolvable sets are deleted).
 */

import type { AnalysisInternal, TSModule, TSType } from "./schema";
import { forEachType } from "./schema";

function resolve(sigs: string[], idBySig: Map<string, string>): string[] {
  return sigs.map((s) => idBySig.get(s)).filter((x): x is string => x !== undefined);
}

function doType(t: TSType, idBySig: Map<string, string>): void {
  delete t.extends_ids;
  delete t.implements_ids;
  const base = t.base_classes ?? [];
  if (!base.length) return;
  const impl = t.implements_types ?? [];
  // A class's `base_classes` is the union of extends + implements; subtract `implements_types`
  // to recover just the extended base class (0 or 1 — TS classes extend at most one class).
  // Interfaces carry no `implements_types`, so their whole heritage is extends.
  const extendsSigs = t.kind === "class" ? base.filter((s) => !impl.includes(s)) : base;
  const extendsIds = resolve(extendsSigs, idBySig);
  const implementsIds = resolve(impl, idBySig);
  if (extendsIds.length) t.extends_ids = extendsIds;
  if (implementsIds.length) t.implements_ids = implementsIds;
}

export function resolveHeritageIds(app: AnalysisInternal, idBySig: Map<string, string>): void {
  for (const mod of Object.values(app.symbol_table) as TSModule[]) {
    forEachType(mod, (t) => doType(t, idBySig));
  }
}
