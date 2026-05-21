'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');
const { extractMermaidBlocks, parseGraph } = require('../diagram-parser');
const { layout } = require('../diagram-layout');

function svgEdgePath(edge, isHorizontal) {
  const fromCx = edge.from.x + edge.from.w / 2;
  const fromCy = edge.from.y + edge.from.h / 2;
  const toCx = edge.to.x + edge.to.w / 2;
  const toCy = edge.to.y + edge.to.h / 2;

  let x1, y1, x2, y2;
  if (isHorizontal) {
    x1 = edge.from.x + edge.from.w;
    y1 = fromCy;
    x2 = edge.to.x;
    y2 = toCy;
  } else {
    x1 = fromCx;
    y1 = edge.from.y + edge.from.h;
    x2 = toCx;
    y2 = edge.to.y;
  }

  if (isHorizontal) {
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

function renderSvg(graphLayout) {
  const { width, height, nodes, edges, direction } = graphLayout;
  const isHorizontal = direction === 'LR';

  const edgeMarkup = edges.map((edge, idx) => {
    const path = svgEdgePath(edge, isHorizontal);
    const labelMidX = (edge.from.x + edge.from.w / 2 + edge.to.x + edge.to.w / 2) / 2;
    const labelMidY = (edge.from.y + edge.from.h / 2 + edge.to.y + edge.to.h / 2) / 2;
    const labelEl = edge.label
      ? `<text x="${labelMidX}" y="${labelMidY - 4}" class="edge-label" text-anchor="middle">${escapeHtml(edge.label)}</text>`
      : '';
    return `<g class="edge" data-edge-id="e${idx}" data-from="${escapeHtml(edge.fromId)}" data-to="${escapeHtml(edge.toId)}">
      <path d="${path}" class="edge-line" marker-end="url(#arrow)" fill="none" />
      ${labelEl}
    </g>`;
  }).join('\n');

  const nodeMarkup = nodes.map((node) => {
    const x = node.x;
    const y = node.y;
    const w = node.w;
    const h = node.h;
    const cx = x + w / 2;
    const cy = y + h / 2 + 5;
    return `<g class="node" data-node-id="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="${escapeHtml(node.label)}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ry="10" class="node-shape" />
      <text x="${cx}" y="${cy}" class="node-label" text-anchor="middle">${escapeHtml(node.label)}</text>
    </g>`;
  }).join('\n');

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="diagram-svg" role="img" aria-label="Module map">
  <defs>
    <marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11 z" class="arrow-head" />
    </marker>
  </defs>
  <g class="edges">${edgeMarkup}</g>
  <g class="nodes">${nodeMarkup}</g>
</svg>`;
}

function render({ markdown, meta, override, buildShell, readAsset }) {
  const blocks = extractMermaidBlocks(markdown);
  if (blocks.length === 0) {
    throw new Error('No mermaid blocks found for diagram template');
  }

  const graphs = blocks.map((src) => layout(parseGraph(src)));
  const proseWithoutMermaid = markdown
    .replace(/```mermaid\s*\n[\s\S]*?\n```/g, '')
    .trim();

  const title = (override && override.title)
    || (markdown.match(/^#\s+(.*)$/m) || [null, 'Module map'])[1]
    || 'Module map';

  const bodyHtml = proseWithoutMermaid
    ? renderMarkdown(proseWithoutMermaid.replace(/^#\s+.*$/m, '').trim())
    : '';

  const stamp = (meta.turnIndex != null && meta.turnIndex !== 0)
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const diagramsHtml = graphs.map((g, idx) => {
    const totalNodes = g.nodes.length;
    const totalEdges = g.edges.length;
    return `<figure class="diagram" data-diagram-index="${idx}">
      <div class="diagram-canvas">${renderSvg(g)}</div>
      <figcaption class="diagram-meta">
        <span class="diagram-stat"><span class="num">${totalNodes}</span><span class="lbl">nodes</span></span>
        <span class="diagram-stat"><span class="num">${totalEdges}</span><span class="lbl">edges</span></span>
        <span class="diagram-hint">Hover a node to trace connections. Click to focus its path. Click outside to clear.</span>
      </figcaption>
    </figure>`;
  }).join('\n');

  const body = `<header class="dgm-head">
  <p class="dgm-kicker">Module map</p>
  <h1>${escapeHtml(title)}</h1>
</header>
${bodyHtml ? `<section class="dgm-body">${bodyHtml}</section>` : ''}
<section class="dgm-figures">${diagramsHtml}</section>`;

  return {
    title,
    html: buildShell({
      classname: 'tpl-dgm',
      title,
      styles: readAsset('diagram.css'),
      body,
      scripts: `<script>${readAsset('diagram-runtime.js')}</script>`,
      stamp: stamp || null
    })
  };
}

module.exports = { render };
