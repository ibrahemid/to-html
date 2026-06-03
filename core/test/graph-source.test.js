'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveGraph, hasMeaningfulShape, mapNodesToSections, hasSalvageableGraph } = require('../lib/graph-source');

test('resolveGraph: returns null when no mermaid block exists', () => {
  const md = '# Title\n\nNo graph here.\n\n## Section';
  assert.equal(resolveGraph(md, []), null);
});

test('resolveGraph: returns null for too-small graphs', () => {
  const md = '```mermaid\ngraph TD\nA --> B\n```';
  assert.equal(resolveGraph(md, []), null);
});

test('resolveGraph: returns null when no edges (just nodes)', () => {
  const md = '```mermaid\ngraph TD\nA\nB\nC\nD\n```';
  assert.equal(resolveGraph(md, []), null);
});

test('resolveGraph: returns layout-ready graph for a real graph', () => {
  const md = '```mermaid\ngraph TD\nA --> B\nA --> C\nB --> D\n```';
  const out = resolveGraph(md, []);
  assert.ok(out);
  assert.ok(out.graph);
  assert.ok(out.graph.nodes.length >= 3);
  assert.ok(out.graph.edges.length >= 2);
  assert.equal(out.source, 'mermaid');
});

test('resolveGraph: maps node labels to matching section slugs', () => {
  const md = '```mermaid\ngraph TD\nA[First Section] --> B[Second Section]\nA --> C[Third Section]\n```';
  const sections = [
    { slug: 's-1-first-section', text: 'First Section', level: 2 },
    { slug: 's-2-second-section', text: 'Second Section', level: 2 },
    { slug: 's-3-third-section', text: 'Third Section', level: 2 }
  ];
  const out = resolveGraph(md, sections);
  assert.ok(out.sectionMap.get('A'));
  assert.equal(out.sectionMap.get('A'), 's-1-first-section');
  assert.equal(out.sectionMap.get('B'), 's-2-second-section');
  assert.equal(out.sectionMap.get('C'), 's-3-third-section');
});

test('resolveGraph: skips malformed mermaid blocks gracefully', () => {
  const md = '```mermaid\nnot a real graph\n```';
  const out = resolveGraph(md, []);
  assert.ok(out === null || out.graph);
});

test('hasMeaningfulShape: requires nodes >= 3 and an edge with rank >= 1', () => {
  assert.equal(hasMeaningfulShape({ nodes: [], edges: [] }), false);
  assert.equal(hasMeaningfulShape({ nodes: [{rank:0}, {rank:0}, {rank:0}], edges: [] }), false);
  assert.equal(hasMeaningfulShape({ nodes: [{rank:0}, {rank:0}, {rank:0}], edges: [{}] }), false);
  assert.equal(hasMeaningfulShape({ nodes: [{rank:0}, {rank:1}, {rank:0}], edges: [{}] }), true);
});

test('mapNodesToSections: handles fuzzy contains match', () => {
  const graph = { nodes: [{ id: 'X', label: 'Auth' }] };
  const sections = [{ slug: 's-1', text: 'Authentication layer', level: 2 }];
  const out = mapNodesToSections(graph, sections);
  assert.equal(out.get('X'), 's-1');
});

test('resolveGraph: salvages an unfenced graph with source=salvage and a span', () => {
  const md = 'Here is the flow:\n\ngraph TD\nA --> B\nA --> C\nB --> D\n\nThat is it.';
  const out = resolveGraph(md, []);
  assert.ok(out);
  assert.equal(out.source, 'salvage');
  assert.ok(out.graph.nodes.length >= 3);
  assert.equal(out.span.startLine, 2);
  assert.equal(out.span.endLine, 5);
});

test('resolveGraph: unfenced graph too small to be meaningful returns null', () => {
  assert.equal(resolveGraph('graph TD\nA --> B', []), null);
});

test('resolveGraph: fenced mermaid still wins with source=mermaid', () => {
  const md = '```mermaid\ngraph TD\nA --> B\nA --> C\nB --> D\n```';
  const out = resolveGraph(md, []);
  assert.equal(out.source, 'mermaid');
});

test('hasSalvageableGraph: true for a meaningful unfenced graph', () => {
  assert.equal(hasSalvageableGraph('graph TD\nA --> B\nB --> C\nA --> C'), true);
});

test('hasSalvageableGraph: false for prose merely mentioning a graph', () => {
  assert.equal(hasSalvageableGraph('We considered the graph TD approach but dropped it.'), false);
});

test('resolveGraph: salvages a bare graph when the fenced block is too small', () => {
  const md = '```mermaid\ngraph TD\nA --> B\n```\n\ngraph LR\nX --> Y\nY --> Z\nX --> Z';
  const out = resolveGraph(md, []);
  assert.ok(out);
  assert.equal(out.source, 'salvage');
  assert.ok(out.graph.nodes.length >= 3);
});

test('resolveGraph: preferMermaid wins and reports source enrichment', () => {
  const r = resolveGraph('Some prose with no graph.', [], { preferMermaid: 'graph TD\n  A[Start] --> B[End]' });
  assert.ok(r, 'should resolve from preferMermaid');
  assert.equal(r.source, 'enrichment');
  assert.ok(r.graph && Array.isArray(r.graph.nodes) && r.graph.nodes.length >= 2);
});

test('resolveGraph: invalid preferMermaid falls through to null (no body graph)', () => {
  const r = resolveGraph('Plain prose, no graph here at all.', [], { preferMermaid: 'not a diagram' });
  assert.equal(r, null);
});

test('resolveGraph: empty preferMermaid is ignored', () => {
  const r = resolveGraph('Plain prose.', [], { preferMermaid: '' });
  assert.equal(r, null);
});
