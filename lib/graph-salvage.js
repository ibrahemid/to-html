'use strict';

const GRAPH_HEADER_RE = /^graph\s+(TD|TB|BT|LR|RL)\b/i;
const FENCE_RE = /^(```|~~~)/;
const ARROW_RE = /(-->|---|==>|-\.->|-\.-)/;
const NODE_DECL_RE = /^[A-Za-z_][\w-]*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\})?\s*$/;
const DIRECTIVE_RE = /^(subgraph\b|end$|style\b|class\b|classDef\b|%%)/i;

function isGraphStatement(line) {
  const t = line.trim();
  if (!t) return false;
  if (DIRECTIVE_RE.test(t)) return true;
  if (ARROW_RE.test(t)) return true;
  return NODE_DECL_RE.test(t);
}

function salvageBareGraph(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return null;
  const lines = markdown.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (FENCE_RE.test(trimmed)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (!GRAPH_HEADER_RE.test(trimmed)) continue;

    const collected = [];
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === '' || FENCE_RE.test(t) || !isGraphStatement(lines[j])) break;
      collected.push(t);
      end = j;
    }
    if (collected.length === 0) continue;
    return { source: [trimmed, ...collected].join('\n'), startLine: i, endLine: end };
  }
  return null;
}

module.exports = { salvageBareGraph, isGraphStatement };
