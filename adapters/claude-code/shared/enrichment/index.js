'use strict';

const ENRICHMENT_PROMPT = [
  'You convert an assistant reply into two artifacts.',
  '',
  'tldr: one to two plain sentences summarizing the reply, neutral register, no markdown headings.',
  '',
  'mermaid: a single Mermaid block beginning with "graph TD" or "graph LR" that helps the reader',
  'orient. Hard rules for the mermaid block:',
  '- Use 3 to 6 nodes. Fewer is better. Never more than 6.',
  '- Node labels: 1 to 3 words, plain text only. NEVER use HTML tags like <br> or <br/>.',
  '  Use the form ID[Short label] with double quotes only if the label contains punctuation.',
  '- Edges: prefer arrows with NO labels. Add an edge label only when it is essential to the meaning,',
  '  and keep it to one or two words. Never repeat the same label across edges.',
  '- Prefer graph TD when the reply describes a process or flow. Prefer graph LR for short comparisons.',
  '- When the reply is a stable mental model or definition rather than a flow, you may still produce a',
  '  diagram, but keep it minimal (3-4 nodes) and use no edge labels.',
  '- If the reply has no structure worth visualizing (a yes/no answer, a single fact, a code snippet,',
  '  a list of unrelated items), return an empty string for mermaid.',
  '- Output ONLY the structured object. No commentary, no markdown fences inside the JSON.'
].join('\n');

const ENRICHMENT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    tldr: { type: 'string' },
    mermaid: { type: 'string' }
  },
  required: ['tldr', 'mermaid']
});

function parseEnrichment(stdout) {
  if (typeof stdout !== 'string' || !stdout.trim()) return null;
  let env;
  try { env = JSON.parse(stdout); } catch { return null; }
  if (!env || typeof env !== 'object') return null;
  if (env.type !== 'result' || env.is_error !== false) return null;
  const so = env.structured_output;
  if (!so || typeof so !== 'object') return null;
  if (typeof so.tldr !== 'string' || typeof so.mermaid !== 'string') return null;
  const tldr = so.tldr.trim();
  if (!tldr) return null;
  return { tldr, mermaid: so.mermaid.trim() };
}

module.exports = { ENRICHMENT_PROMPT, ENRICHMENT_SCHEMA, parseEnrichment };
