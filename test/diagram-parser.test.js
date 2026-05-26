'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGraph } = require('../lib/diagram-parser');

test('parseGraph: recognizes flowchart header without ghost nodes', () => {
  const g = parseGraph('flowchart TD\nA[Start] --> B[Process]\nB --> C[End]');
  assert.deepEqual(g.nodes.map(n => n.id).sort(), ['A', 'B', 'C']);
  assert.equal(g.edges.length, 2);
  assert.equal(g.direction, 'TD');
});

test('parseGraph: recognizes flowchart LR direction', () => {
  const g = parseGraph('flowchart LR\nA --> B\nB --> C');
  assert.equal(g.direction, 'LR');
  assert.equal(g.nodes.length, 3);
  assert.ok(!g.nodes.find(n => n.id === 'flowchart'));
  assert.ok(!g.nodes.find(n => n.id === 'LR'));
});

test('parseGraph: still recognizes the classic graph header', () => {
  const g = parseGraph('graph TD\nA --> B');
  assert.equal(g.direction, 'TD');
  assert.ok(g.nodes.find(n => n.id === 'A'));
  assert.ok(!g.nodes.find(n => n.id === 'graph'));
});
