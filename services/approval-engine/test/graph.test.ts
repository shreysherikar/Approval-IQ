import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findGatingCycle,
  gatingDependents,
  gatingLayers,
  gatingPrerequisites,
  topologicalGatingOrder,
  transitiveGatingDependents,
} from '../src/index.ts';
import type { Dependency } from '../src/index.ts';

function dep(from: string, to: string, relationship: Dependency['relationship']): Dependency {
  return { from, to, relationship };
}

test('gatingPrerequisites/Dependents follow depends_on edges only', () => {
  const deps: Dependency[] = [
    dep('a', 'b', 'depends_on'),
    dep('a', 'c', 'informational'),
    dep('d', 'a', 'parallel_with'),
    dep('e', 'a', 'unknown'),
    dep('a', 'b', 'depends_on'), // duplicate row is deduped
  ];
  assert.deepEqual(gatingPrerequisites('a', deps), ['b']);
  assert.deepEqual(gatingDependents('b', deps), ['a']);
  assert.deepEqual(gatingPrerequisites('c', deps), []);
});

test('transitiveGatingDependents walks forward across a chain', () => {
  const deps: Dependency[] = [
    dep('c', 'b', 'depends_on'),
    dep('b', 'a', 'depends_on'),
    dep('x', 'y', 'depends_on'),
  ];
  assert.deepEqual(transitiveGatingDependents('a', deps), ['a', 'b', 'c']);
  assert.deepEqual(transitiveGatingDependents('b', deps), ['b', 'c']);
});

test('topologicalGatingOrder puts prerequisites first and detects cycles', () => {
  const deps: Dependency[] = [dep('c', 'b', 'depends_on'), dep('b', 'a', 'depends_on')];
  assert.deepEqual(topologicalGatingOrder(['a', 'b', 'c'], deps).ordered, ['a', 'b', 'c']);
  const cyclic = topologicalGatingOrder(
    ['p', 'q'],
    [dep('p', 'q', 'depends_on'), dep('q', 'p', 'depends_on')],
  );
  assert.deepEqual(cyclic.ordered, []);
  assert.deepEqual(cyclic.cyclicIds, ['p', 'q']);
});

test('gatingLayers groups non-gated approvals together', () => {
  const deps: Dependency[] = [
    dep('b', 'a', 'depends_on'),
    dep('b2', 'a', 'depends_on'),
    dep('c', 'b', 'depends_on'),
  ];
  const r = gatingLayers(['a', 'b', 'b2', 'c', 'z'], deps);
  assert.deepEqual(r.layers, [['a', 'z'], ['b', 'b2'], ['c']]);
  assert.deepEqual(r.cyclicIds, []);
});

test('findGatingCycle returns null for an acyclic subgraph', () => {
  const deps: Dependency[] = [dep('c', 'b', 'depends_on'), dep('b', 'a', 'depends_on')];
  assert.equal(findGatingCycle(['a', 'b', 'c'], deps), null);
  // An informational edge that does not gate must not close a cycle.
  assert.equal(
    findGatingCycle(['p', 'q'], [dep('p', 'q', 'informational'), dep('q', 'p', 'informational')]),
    null,
  );
});

test('findGatingCycle returns one concrete cycle with its closing edge repeated', () => {
  const two = findGatingCycle(
    ['p', 'q'],
    [dep('p', 'q', 'depends_on'), dep('q', 'p', 'depends_on')],
  );
  assert.ok(two !== null, 'two-node cycle is found');
  // A 2-cycle must close back on itself regardless of DFS entry point.
  assert.ok(
    (two.length === 3 && two[0] === two[2] && two[0] !== two[1]) ||
      (two.length === 3 && two[0] !== two[1] && two[1] === two[2]),
    `2-cycle path looks like a cycle: ${JSON.stringify(two)}`,
  );

  const three = findGatingCycle(
    ['x', 'y', 'z'],
    [dep('x', 'y', 'depends_on'), dep('y', 'z', 'depends_on'), dep('z', 'x', 'depends_on')],
  );
  assert.ok(three !== null, 'three-node cycle is found');
  assert.equal(three[0], three[three.length - 1], 'cycle closes back on its start');
  assert.equal(three.length, 4, `three-node cycle has 4 entries, got ${three.length}`);
});

test('findGatingCycle ignores edges to nodes outside the requested subset', () => {
  // A cycle in the full graph involving an out-of-subset node must NOT be
  // reported when that node is excluded from `ids`.
  const deps: Dependency[] = [
    dep('a', 'b', 'depends_on'),
    dep('b', 'a', 'depends_on'),
    dep('b', 'c', 'depends_on'),
  ];
  // {a, b} alone is still a 2-cycle.
  assert.ok(findGatingCycle(['a', 'b', 'c'], deps) !== null);
  // Restrict to {a, c}: no gating edges among them → acyclic.
  assert.equal(findGatingCycle(['a', 'c'], deps), null);
});
