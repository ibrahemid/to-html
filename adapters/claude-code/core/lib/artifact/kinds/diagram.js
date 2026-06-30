'use strict';

const { ArtifactSpecError, reqString, optString, normalizeHeader } = require('../util');
const { escapeHtml } = require('../../sanitize');
const { layout } = require('../../diagram-layout');
const { renderSvg } = require('../../svg-graph');

const KIND = 'diagram';
const DIRECTIONS = new Set(['TD', 'LR']);

function normalizeNode(node, idx, seen) {
  const ctx = `nodes[${idx}]`;
  if (!node || typeof node !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const id = reqString(node.id, `${ctx}.id`);
  if (seen.has(id)) throw new ArtifactSpecError(`${ctx}.id duplicates "${id}"`);
  seen.add(id);
  return { id, label: reqString(node.label, `${ctx}.label`) };
}

function normalizeEdge(edge, idx, ids) {
  const ctx = `edges[${idx}]`;
  if (!edge || typeof edge !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const from = reqString(edge.from, `${ctx}.from`);
  const to = reqString(edge.to, `${ctx}.to`);
  if (!ids.has(from)) throw new ArtifactSpecError(`${ctx}.from references unknown node "${from}"`);
  if (!ids.has(to)) throw new ArtifactSpecError(`${ctx}.to references unknown node "${to}"`);
  const out = { from, to };
  const label = optString(edge.label);
  out.label = label || '';
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeader(spec) };
  out.direction = (typeof spec.direction === 'string' && DIRECTIONS.has(spec.direction.toUpperCase()))
    ? spec.direction.toUpperCase()
    : 'TD';
  if (!Array.isArray(spec.nodes) || spec.nodes.length < 2) {
    throw new ArtifactSpecError('diagram.nodes must have at least 2 entries');
  }
  const seen = new Set();
  out.nodes = spec.nodes.map((n, i) => normalizeNode(n, i, seen));
  if (!Array.isArray(spec.edges) || spec.edges.length < 1) {
    throw new ArtifactSpecError('diagram.edges must have at least 1 entry');
  }
  out.edges = spec.edges.map((e, i) => normalizeEdge(e, i, seen));
  return out;
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-flow-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-flow-meta-line">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-flow-header"><h1 class="cc-flow-h1">${escapeHtml(spec.title)}</h1>${subtitle}${meta}</header>`;
}

function renderStats(spec) {
  return `<dl class="cc-map-meta">
    <div class="cc-map-stat"><dd class="num">${spec.nodes.length}</dd><dt class="lbl">nodes</dt></div>
    <div class="cc-map-stat"><dd class="num">${spec.edges.length}</dd><dt class="lbl">edges</dt></div>
  </dl>`;
}

function render(spec) {
  // renderSvg escapes labels/ids itself: feed raw (unescaped) strings through layout.
  const placed = layout({ direction: spec.direction, nodes: spec.nodes, edges: spec.edges });
  const svg = renderSvg(placed);
  const body = `<div class="cc-flow">${renderHeader(spec)}<div class="cc-map"><figure class="cc-flow-figure"><div class="cc-flow-canvas">${svg}</div></figure>${renderStats(spec)}</div></div>`;
  return { classname: 'tpl-flow', body, styleAssets: ['map.css', 'flow.css'], scriptAssets: [] };
}

module.exports = { kind: KIND, validate, render };
