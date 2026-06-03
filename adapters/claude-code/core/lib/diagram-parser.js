'use strict';

const MERMAID_FENCE = /```mermaid\s*\n([\s\S]*?)\n```/g;

class DiagramParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DiagramParseError';
  }
}

function extractMermaidBlocks(markdown) {
  const blocks = [];
  for (const match of String(markdown).matchAll(MERMAID_FENCE)) {
    const body = match[1];
    if (body && body.trim()) blocks.push(body);
  }
  return blocks;
}

function sanitizeLabel(raw) {
  // Mermaid labels routinely arrive with <br/>, <br>, and other HTML the model adds for
  // visual line breaks. The SVG renderer escapes them, so they render as literal text.
  // Strip the tag, replace with a space, collapse whitespace.
  return String(raw)
    .replace(/^"|"$/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeEdgeLabel(raw) {
  return sanitizeLabel(raw);
}

function parseTokens(segment, tokenPattern) {
  const matches = [...segment.matchAll(tokenPattern)];
  const out = [];
  for (const m of matches) {
    const id = m[1];
    const label = m[2] || m[3] || m[4] || null;
    out.push({ id, label: label ? sanitizeLabel(label) : null });
  }
  return out;
}

function parseGraph(source) {
  const lines = source.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new DiagramParseError('Empty diagram source');

  let direction = 'TD';
  const dirLine = lines[0].match(/^(?:graph|flowchart)\s+(TD|TB|BT|LR|RL)\b(?:.*)?$/i);
  if (dirLine) {
    direction = dirLine[1].toUpperCase();
    lines.shift();
  }
  if (direction === 'TB') direction = 'TD';
  if (direction === 'BT') direction = 'TD';
  if (direction === 'RL') direction = 'LR';

  const nodes = new Map();
  const edges = [];

  function ensureNode(id, label) {
    const trimmedId = id.trim();
    if (!trimmedId) return null;
    if (!nodes.has(trimmedId)) {
      nodes.set(trimmedId, { id: trimmedId, label: label || trimmedId });
    } else if (label && nodes.get(trimmedId).label === trimmedId) {
      nodes.get(trimmedId).label = label;
    }
    return nodes.get(trimmedId);
  }

  const tokenPattern = /([A-Za-z_][\w-]*)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?/g;
  const arrowOnly = /^\s*(-->|---|==>|-\.->|-\.-)\s*(?:\|([^|]+)\|\s*)?$/;

  for (const rawLine of lines) {
    if (rawLine.startsWith('%%')) continue;
    if (/^subgraph\b/i.test(rawLine) || rawLine.toLowerCase() === 'end') continue;
    if (rawLine.toLowerCase().startsWith('classdef')) continue;
    if (rawLine.toLowerCase().startsWith('class ')) continue;
    if (rawLine.toLowerCase().startsWith('style ')) continue;

    const parts = rawLine.split(/(\s*(?:-->|---|==>|-\.->|-\.-)\s*(?:\|[^|]+\|\s*)?)/);
    if (parts.length <= 1) {
      const tokens = parseTokens(rawLine, tokenPattern);
      for (const t of tokens) ensureNode(t.id, t.label);
      continue;
    }

    let lastNodeId = null;
    let pendingArrow = null;
    for (const part of parts) {
      if (!part) continue;
      const arrowMatch = part.match(arrowOnly);
      if (arrowMatch) {
        pendingArrow = { kind: arrowMatch[1], label: arrowMatch[2] ? sanitizeEdgeLabel(arrowMatch[2]) : '' };
        continue;
      }
      const tokens = parseTokens(part, tokenPattern);
      if (tokens.length === 0) continue;
      for (let i = 0; i < tokens.length; i++) {
        const node = ensureNode(tokens[i].id, tokens[i].label);
        if (i === 0 && lastNodeId && pendingArrow) {
          edges.push({ from: lastNodeId, to: node.id, label: pendingArrow.label, kind: pendingArrow.kind });
          pendingArrow = null;
        }
        lastNodeId = node.id;
      }
    }
  }

  return {
    direction,
    nodes: [...nodes.values()],
    edges
  };
}

module.exports = {
  DiagramParseError,
  MERMAID_FENCE,
  extractMermaidBlocks,
  parseGraph,
  parseTokens,
  sanitizeLabel
};
