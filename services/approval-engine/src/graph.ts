/**
 * Pure dependency-graph utilities for the approval dependency graph.
 *
 * CONSTRAINT: this package must not import NestJS, any database client, any
 * HTTP client or any LLM SDK. These helpers are pure functions over the engine's
 * `Dependency` values so they can be reused anywhere (API, roadmap status
 * re-evaluation, tests) without reimplementing topological logic per call site.
 *
 * Semantics (per ADR-0001): only `depends_on` edges gate. `informational`,
 * `parallel_with` and `unknown` edges are never part of the gating graph.
 */

import type { Dependency } from './types.ts';

/** A deduplicated gating edge: `from` depends on (is gated by) `to`. */
export interface GatingEdge {
  from: string;
  to: string;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...values].sort();
}

/** Extracts the `depends_on` edges only — the other relationships never gate. */
export function gatingEdges(dependencies: readonly Dependency[]): GatingEdge[] {
  const seen = new Set<string>();
  const edges: GatingEdge[] = [];
  for (const d of dependencies) {
    if (d.relationship !== 'depends_on') continue;
    const key = `${d.from}\u0000${d.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from: d.from, to: d.to });
  }
  return edges;
}

/**
 * Direct gating prerequisites of `id`: the approvals that `id` depends on
 * (targets of `id → target` `depends_on` edges). Sorted for determinism.
 */
export function gatingPrerequisites(
  id: string,
  dependencies: readonly Dependency[],
): string[] {
  const prereqs = new Set<string>();
  for (const e of gatingEdges(dependencies)) {
    if (e.from === id) prereqs.add(e.to);
  }
  return sortedStrings(prereqs);
}

/** Direct gating dependents of `id`: approvals whose `depends_on` target is `id`. */
export function gatingDependents(
  id: string,
  dependencies: readonly Dependency[],
): string[] {
  const dependents = new Set<string>();
  for (const e of gatingEdges(dependencies)) {
    if (e.to === id) dependents.add(e.from);
  }
  return sortedStrings(dependents);
}

/**
 * Forward closure: `id` itself plus every approval that transitively depends on
 * it through `depends_on` edges. Cycles are handled (a reachable cycle member
 * is included); use `topologicalGatingOrder` to order the result.
 */
export function transitiveGatingDependents(
  id: string,
  dependencies: readonly Dependency[],
): string[] {
  const dependentsByNode = new Map<string, string[]>();
  for (const e of gatingEdges(dependencies)) {
    const list = dependentsByNode.get(e.to) ?? [];
    list.push(e.from);
    dependentsByNode.set(e.to, list);
  }
  const closure = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const node = queue.pop()!;
    for (const dependent of dependentsByNode.get(node) ?? []) {
      if (closure.has(dependent)) continue;
      closure.add(dependent);
      queue.push(dependent);
    }
  }
  return sortedStrings(closure);
}

export interface GatingOrderResult {
  /** Kahn-ordered ids, prerequisites before dependents. Cycles excluded. */
  ordered: readonly string[];
  /** Ids not orderable because they participate in a dependency cycle. */
  cyclicIds: readonly string[];
}

/**
 * Topological (Kahn) order of `ids` restricted to `depends_on` edges among
 * them. Deterministic: ties broken lexicographically, same ordering scheme as
 * the engine's `orderApplicable`. Cycle participants are reported separately
 * and excluded from `ordered` (they can never be "ready").
 */
export function topologicalGatingOrder(
  ids: readonly string[],
  dependencies: readonly Dependency[],
): GatingOrderResult {
  const idSet = new Set(ids);
  const prereqsOf = new Map<string, Set<string>>();
  const dependentsOf = new Map<string, Set<string>>();
  for (const e of gatingEdges(dependencies)) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    if (!prereqsOf.has(e.from)) prereqsOf.set(e.from, new Set());
    if (!dependentsOf.has(e.to)) dependentsOf.set(e.to, new Set());
    prereqsOf.get(e.from)!.add(e.to);
    dependentsOf.get(e.to)!.add(e.from);
  }

  const indegree = new Map<string, number>();
  for (const id of idSet) indegree.set(id, prereqsOf.get(id)?.size ?? 0);

  const ready: string[] = sortedStrings(
    [...idSet].filter((id) => indegree.get(id) === 0),
  );
  const ordered: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered.push(id);
    for (const dependent of dependentsOf.get(id) ?? []) {
      const left = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, left);
      if (left !== 0) continue;
      // Keep `ready` sorted so the walk order stays deterministic.
      const insertAt = ready.findIndex((x) => x > dependent);
      if (insertAt === -1) ready.push(dependent);
      else ready.splice(insertAt, 0, dependent);
    }
  }

  const cyclicIds = sortedStrings(idSet).filter((id) => !ordered.includes(id));
  return { ordered, cyclicIds };
}

/**
 * Finds one concrete `depends_on` cycle among `ids`: a path of approval ids
 * where every consecutive pair — plus the final id back to the first — is a
 * `depends_on` edge. Returns the cycle with its closing edge repeated (e.g.
 * `['a','b','a']`) so a caller can describe the offending cycle directly (not
 * just list the participants involved in any cycle). Returns `null` when the
 * restricted subgraph is acyclic. Deterministic: DFS seeds from the smallest id
 * and follows sorted adjacency, so identical inputs always yield the same cycle.
 */
export function findGatingCycle(
  ids: readonly string[],
  dependencies: readonly Dependency[],
): string[] | null {
  const idSet = new Set(ids);
  const adj = new Map<string, string[]>();
  for (const e of gatingEdges(dependencies)) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    list.sort();
    adj.set(e.from, list);
  }

  // DFS tri-color marking: 0 = unvisited, 1 = on the current stack, 2 = done.
  const color = new Map<string, number>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    color.set(node, 1);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const state = color.get(next) ?? 0;
      if (state === 1) {
        // Back edge onto the current DFS stack: closed a cycle.
        const start = stack.indexOf(next);
        return [...stack.slice(start), next];
      }
      if (state === 0) {
        const found = visit(next);
        if (found !== null) return found;
      }
    }
    stack.pop();
    color.set(node, 2);
    return null;
  };

  for (const id of sortedStrings(idSet)) {
    if ((color.get(id) ?? 0) === 0) {
      const found = visit(id);
      if (found !== null) return found;
    }
  }
  return null;
}

export interface GatingLayersResult {
  /** Parallel groups: layer 0 = no gating prerequisites, etc. */
  layers: readonly (readonly string[])[];
  cyclicIds: readonly string[];
}

/**
 * Groups `ids` into parallel layers: an approval's layer is one more than the
 * highest layer of its (in-set, non-cyclic) gating prerequisites. Approvals in
 * the same layer can run in parallel; later layers strictly follow earlier ones.
 */
export function gatingLayers(
  ids: readonly string[],
  dependencies: readonly Dependency[],
): GatingLayersResult {
  const { ordered, cyclicIds } = topologicalGatingOrder(ids, dependencies);
  const cyclic = new Set(cyclicIds);
  const layer = new Map<string, number>();
  for (const id of ordered) {
    let l = 0;
    for (const prereq of gatingPrerequisites(id, dependencies)) {
      if (cyclic.has(prereq)) continue;
      l = Math.max(l, (layer.get(prereq) ?? -1) + 1);
    }
    layer.set(id, l);
  }
  const distinct = [...new Set(ordered.map((id) => layer.get(id) ?? 0))].sort(
    (a, b) => a - b,
  );
  const layers = distinct.map((l) =>
    ordered.filter((id) => (layer.get(id) ?? 0) === l).sort(),
  );
  return { layers, cyclicIds };
}

