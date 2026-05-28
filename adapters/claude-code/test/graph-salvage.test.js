'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { salvageBareGraph, isGraphStatement } = require('../lib/graph-salvage');

test('salvageBareGraph: finds an unfenced graph block and its span', () => {
  const md = 'Intro line.\n\ngraph TD\nA --> B\nB --> C\nA --> C\n\nAfter text.';
  const out = salvageBareGraph(md);
  assert.ok(out);
  assert.equal(out.startLine, 2);
  assert.equal(out.endLine, 5);
  assert.equal(out.source, 'graph TD\nA --> B\nB --> C\nA --> C');
});

test('salvageBareGraph: returns null when there is no graph header', () => {
  assert.equal(salvageBareGraph('# Title\n\nJust prose, no diagram.'), null);
});

test('salvageBareGraph: ignores a graph header inside a code fence', () => {
  const md = '```js\ngraph TD\nA --> B\n```';
  assert.equal(salvageBareGraph(md), null);
});

test('salvageBareGraph: stops at a blank line', () => {
  const md = 'graph LR\nA --> B\n\nC --> D';
  const out = salvageBareGraph(md);
  assert.equal(out.endLine, 1);
  assert.equal(out.source, 'graph LR\nA --> B');
});

test('salvageBareGraph: stops at a prose line', () => {
  const md = 'graph TD\nA --> B\nthis is regular prose.';
  const out = salvageBareGraph(md);
  assert.equal(out.endLine, 1);
});

test('salvageBareGraph: keeps node decls with labels and directives', () => {
  const md = 'graph LR\nA[Start] --> B[Mid]\nB --> C[End]';
  const out = salvageBareGraph(md);
  assert.equal(out.endLine, 2);
  assert.ok(out.source.includes('A[Start] --> B[Mid]'));
});

test('salvageBareGraph: ignores a graph header inside a ~~~ fence', () => {
  const md = '~~~js\ngraph TD\nA --> B\n~~~';
  assert.equal(salvageBareGraph(md), null);
});

test('isGraphStatement: true for arrow, node decl, and directive lines', () => {
  assert.equal(isGraphStatement('A --> B'), true);
  assert.equal(isGraphStatement('A[Start]'), true);
  assert.equal(isGraphStatement('subgraph one'), true);
  assert.equal(isGraphStatement('end'), true);
});

test('isGraphStatement: false for prose and blank lines', () => {
  assert.equal(isGraphStatement('this is regular prose.'), false);
  assert.equal(isGraphStatement(''), false);
  assert.equal(isGraphStatement('   '), false);
});

test('salvageBareGraph: a mismatched ~~~ inside a ``` block does not expose a graph', () => {
  const md = '```\ncode line\n~~~\ngraph TD\nA --> B\nB --> C\nA --> C\n```';
  assert.equal(salvageBareGraph(md), null);
});

test('salvageBareGraph: recognizes a bare flowchart header', () => {
  const out = salvageBareGraph('flowchart TD\nA --> B\nB --> C\nA --> C');
  assert.ok(out);
  assert.ok(out.source.startsWith('flowchart TD'));
});
