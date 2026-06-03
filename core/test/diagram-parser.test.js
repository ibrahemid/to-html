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

test('parseGraph: strips <br/> and other HTML from node labels (v2.1.3 regression)', () => {
  const g = parseGraph('graph TD\nA[Discord<br/>(gateway connection)] --> B[Bot API<br/>always-on]\nB --> C[Amanda<br />AI processor]');
  const labels = g.nodes.map(n => n.label).sort();
  for (const l of labels) {
    if (!l.includes('br') || /<br/.test(l)) {
      assert.ok(!/<br\s*\/?>/i.test(l), `label still contains <br> tag: ${l}`);
    }
    assert.ok(!/<[^>]+>/.test(l), `label still contains an HTML tag: ${l}`);
  }
  assert.ok(labels.some(l => /Discord/.test(l) && /gateway connection/.test(l)));
  assert.ok(labels.some(l => /Amanda/.test(l) && /AI processor/.test(l)));
});

test('parseGraph: strips HTML from edge labels too', () => {
  const g = parseGraph('graph TD\nA --> |push<br/>messages| B');
  assert.equal(g.edges.length, 1);
  assert.ok(!/<br/i.test(g.edges[0].label), `edge label contains br: ${g.edges[0].label}`);
});
