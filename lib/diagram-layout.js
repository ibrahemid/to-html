'use strict';

const NODE_PADDING_X = 18;
const NODE_PADDING_Y = 14;
const NODE_MIN_WIDTH = 110;
const NODE_HEIGHT = 56;
const GAP_X = 80;
const GAP_Y = 80;
const CHAR_WIDTH = 7.4;

function estimateWidth(label) {
  const lines = String(label || '').split('\n');
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return Math.max(NODE_MIN_WIDTH, Math.ceil(longest * CHAR_WIDTH) + NODE_PADDING_X * 2);
}

function computeRanks(nodes, edges) {
  const inDegree = new Map();
  const outAdj = new Map();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outAdj.set(n.id, []);
  }
  for (const e of edges) {
    if (!inDegree.has(e.from) || !inDegree.has(e.to)) continue;
    if (e.from === e.to) continue;
    inDegree.set(e.to, inDegree.get(e.to) + 1);
    outAdj.get(e.from).push(e.to);
  }

  const rank = new Map();
  const queue = [];
  for (const n of nodes) {
    if (inDegree.get(n.id) === 0) {
      rank.set(n.id, 0);
      queue.push(n.id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift();
    const cur = rank.get(id);
    for (const next of outAdj.get(id) || []) {
      const candidate = cur + 1;
      if (!rank.has(next) || rank.get(next) < candidate) {
        rank.set(next, candidate);
      }
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  // Second pass: a cycle can leave nodes unvisited by Kahn's BFS (in-degree
  // never hits 0). Rank them from predecessors so downstream nodes don't park
  // at rank 0. Bounded by node count to stay terminating on cycles.
  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, 0);
  }
  let changed = true;
  let guard = 0;
  while (changed && guard++ < nodes.length) {
    changed = false;
    for (const e of edges) {
      if (e.from === e.to) continue;
      if (!rank.has(e.from)) continue;
      const candidate = rank.get(e.from) + 1;
      if (candidate > rank.get(e.to)) {
        rank.set(e.to, candidate);
        changed = true;
      }
    }
  }

  let maxRank = 0;
  for (const n of nodes) {
    if (rank.get(n.id) > maxRank) maxRank = rank.get(n.id);
  }
  return { rank, maxRank };
}

function layout(graph) {
  const { direction, nodes, edges } = graph;
  const isHorizontal = direction === 'LR';
  const { rank, maxRank } = computeRanks(nodes, edges);

  const byRank = new Map();
  for (let r = 0; r <= maxRank; r++) byRank.set(r, []);
  for (const n of nodes) byRank.get(rank.get(n.id)).push(n);

  const positions = new Map();
  let canvasWidth = 0;
  let canvasHeight = 0;

  if (isHorizontal) {
    let x = GAP_X;
    let maxColHeight = 0;
    for (let r = 0; r <= maxRank; r++) {
      const col = byRank.get(r);
      const colWidth = col.reduce((m, n) => Math.max(m, estimateWidth(n.label)), NODE_MIN_WIDTH);
      const colHeight = col.length * NODE_HEIGHT + (col.length - 1) * GAP_Y;
      const startY = GAP_Y + Math.max(0, (maxColHeight - colHeight) / 2);
      col.forEach((n, i) => {
        positions.set(n.id, {
          x,
          y: startY + i * (NODE_HEIGHT + GAP_Y),
          w: colWidth,
          h: NODE_HEIGHT
        });
      });
      x += colWidth + GAP_X;
      if (colHeight > maxColHeight) maxColHeight = colHeight;
    }
    canvasWidth = x;
    canvasHeight = maxColHeight + GAP_Y * 2;
  } else {
    let y = GAP_Y;
    let maxRowWidth = 0;
    for (let r = 0; r <= maxRank; r++) {
      const row = byRank.get(r);
      const totalW = row.reduce((sum, n) => sum + estimateWidth(n.label), 0) + (row.length - 1) * GAP_X;
      if (totalW > maxRowWidth) maxRowWidth = totalW;
    }
    for (let r = 0; r <= maxRank; r++) {
      const row = byRank.get(r);
      const totalW = row.reduce((sum, n) => sum + estimateWidth(n.label), 0) + (row.length - 1) * GAP_X;
      let x = GAP_X + Math.max(0, (maxRowWidth - totalW) / 2);
      row.forEach((n) => {
        const w = estimateWidth(n.label);
        positions.set(n.id, { x, y, w, h: NODE_HEIGHT });
        x += w + GAP_X;
      });
      y += NODE_HEIGHT + GAP_Y;
    }
    canvasWidth = maxRowWidth + GAP_X * 2;
    canvasHeight = y;
  }

  const placedNodes = nodes.map((n) => ({ ...n, ...positions.get(n.id), rank: rank.get(n.id) }));
  const placedEdges = edges.map((e) => {
    const from = positions.get(e.from);
    const to = positions.get(e.to);
    if (!from || !to) return null;
    return { ...e, from, to, fromId: e.from, toId: e.to };
  }).filter(Boolean);

  return {
    direction,
    width: Math.ceil(canvasWidth),
    height: Math.ceil(canvasHeight),
    nodes: placedNodes,
    edges: placedEdges
  };
}

module.exports = { layout };
