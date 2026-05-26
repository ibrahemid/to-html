'use strict';

const { extractMermaidBlocks, parseGraph } = require('./diagram-parser');
const { layout } = require('./diagram-layout');
const { salvageBareGraph } = require('./graph-salvage');

const MIN_NODES = 3;

function normalizeForMatch(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function mapNodesToSections(graphLayout, sections) {
  const out = new Map();
  if (!Array.isArray(sections) || sections.length === 0) return out;
  const slugByNorm = new Map();
  for (const s of sections) slugByNorm.set(normalizeForMatch(s.text), s.slug);
  for (const node of graphLayout.nodes) {
    const key = normalizeForMatch(node.label);
    if (!key) continue;
    if (slugByNorm.has(key)) {
      out.set(node.id, slugByNorm.get(key));
      continue;
    }
    for (const [normText, slug] of slugByNorm) {
      if (normText.includes(key) || key.includes(normText)) {
        out.set(node.id, slug);
        break;
      }
    }
  }
  return out;
}

function hasMeaningfulShape(graphLayout) {
  if (!graphLayout) return false;
  if (graphLayout.nodes.length < MIN_NODES) return false;
  if (graphLayout.edges.length === 0) return false;
  let maxRank = 0;
  for (const n of graphLayout.nodes) {
    if (typeof n.rank === 'number' && n.rank > maxRank) maxRank = n.rank;
  }
  return maxRank >= 1;
}

function resolveGraph(markdown, sections) {
  if (typeof markdown !== 'string' || !markdown.trim()) return null;
  const blocks = extractMermaidBlocks(markdown);
  for (const src of blocks) {
    try {
      const placed = layout(parseGraph(src));
      if (!hasMeaningfulShape(placed)) continue;
      return { graph: placed, sectionMap: mapNodesToSections(placed, sections || []), source: 'mermaid' };
    } catch (_) {
      continue;
    }
  }
  const salvaged = salvageBareGraph(markdown);
  if (salvaged) {
    try {
      const placed = layout(parseGraph(salvaged.source));
      if (hasMeaningfulShape(placed)) {
        return {
          graph: placed,
          sectionMap: mapNodesToSections(placed, sections || []),
          source: 'salvage',
          span: { startLine: salvaged.startLine, endLine: salvaged.endLine }
        };
      }
    } catch (_) { /* fall through */ }
  }
  return null;
}

function hasSalvageableGraph(markdown) {
  const salvaged = salvageBareGraph(markdown);
  if (!salvaged) return false;
  try {
    return hasMeaningfulShape(layout(parseGraph(salvaged.source)));
  } catch (_) {
    return false;
  }
}

module.exports = { resolveGraph, hasMeaningfulShape, mapNodesToSections, hasSalvageableGraph, MIN_NODES };
