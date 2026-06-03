'use strict';

const ENRICHMENT_PROMPT = [
  'You convert an assistant reply into two artifacts.',
  'tldr: one to two plain sentences summarizing the reply, neutral register, no markdown headings.',
  'mermaid: a single Mermaid block beginning with "graph TD" or "graph LR" whose node labels map the',
  'reply\'s key ideas or steps. If the reply has no meaningful structure to diagram, return an empty string.',
  'Do not add commentary. Output only the structured object.'
].join(' ');

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
