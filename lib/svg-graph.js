'use strict';

const { escapeHtml } = require('./sanitize');

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

function renderSvg(graphLayout, options = {}) {
  const { width, height, nodes, edges, direction } = graphLayout;
  const isHorizontal = direction === 'LR';
  const sectionMap = (options.sectionMap instanceof Map) ? options.sectionMap : null;

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
    const target = sectionMap && sectionMap.get(node.id);
    const targetAttr = target ? ` data-target-section="${escapeHtml(target)}"` : '';
    const cls = `node${target ? ' node-linked' : ''}`;
    return `<g class="${cls}" data-node-id="${escapeHtml(node.id)}"${targetAttr} tabindex="0" role="button" aria-label="${escapeHtml(node.label)}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ry="10" class="node-shape" />
      <text x="${cx}" y="${cy}" class="node-label" text-anchor="middle">${escapeHtml(node.label)}</text>
    </g>`;
  }).join('\n');

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" class="diagram-svg" role="img" aria-label="Concept map">
  <defs>
    <marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M 1 1 L 11 6 L 1 11 z" class="arrow-head" />
    </marker>
  </defs>
  <g class="edges">${edgeMarkup}</g>
  <g class="nodes">${nodeMarkup}</g>
</svg>`;
}

module.exports = { renderSvg, svgEdgePath };
