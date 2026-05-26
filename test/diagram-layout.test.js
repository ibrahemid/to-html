'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { layout } = require('../lib/diagram-layout');
const { parseGraph } = require('../lib/diagram-parser');

test('layout: cycle reachable from a DAG root keeps downstream nodes off rank 0', () => {
  const placed = layout(parseGraph('graph TD\nA --> B\nB --> C\nC --> B'));
  const rankById = Object.fromEntries(placed.nodes.map(n => [n.id, n.rank]));
  assert.ok(rankById.B >= 1, 'B is downstream of A');
  assert.ok(rankById.C >= 1, 'C is downstream of B and must not be parked at rank 0');
  assert.ok(placed.nodes.every(n => Number.isFinite(n.rank)));
});

test('layout: pure cycle terminates with finite ranks (no hang)', () => {
  const placed = layout(parseGraph('graph TD\nA --> B\nB --> C\nC --> A'));
  assert.ok(placed.nodes.every(n => Number.isFinite(n.rank)));
});

test('layout: plain DAG ranks unchanged', () => {
  const placed = layout(parseGraph('graph TD\nA --> B\nA --> C\nB --> D'));
  const r = Object.fromEntries(placed.nodes.map(n => [n.id, n.rank]));
  assert.equal(r.A, 0);
  assert.equal(r.B, 1);
  assert.equal(r.D, 2);
});
