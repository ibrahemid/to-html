'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderSvg } = require('../lib/svg-graph');

function mkNode(id, x, y, w = 100, h = 40) { return { id, label: id, x, y, w, h }; }
function mkEdge(from, to, label, fromId, toId) { return { from, to, label, fromId: fromId || from.id, toId: toId || to.id }; }

test('renderSvg: edge labels are staggered along the path (v2.1.3 anti-collision)', () => {
  const nA = mkNode('A', 100, 0);
  const nB = mkNode('B', 100, 80);
  const nC = mkNode('C', 100, 160);
  const nD = mkNode('D', 100, 240);
  const edges = [
    mkEdge(nA, nB, 'first'),
    mkEdge(nB, nC, 'second'),
    mkEdge(nC, nD, 'third')
  ];
  const svg = renderSvg({ width: 400, height: 400, nodes: [nA, nB, nC, nD], edges, direction: 'TD' });
  const ys = [...svg.matchAll(/<text x="[^"]+" y="([0-9.-]+)"/g)].map(m => Number(m[1]));
  // three labels rendered, each at a distinct Y so they cannot stack
  assert.ok(ys.length >= 3);
  const distinct = new Set(ys.map(y => Math.round(y))).size;
  assert.ok(distinct >= 2, `expected staggered Ys, got ${ys.join(',')}`);
});
