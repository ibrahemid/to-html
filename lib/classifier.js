'use strict';

const OVERRIDE_FENCE = /```to-html\s*\n([\s\S]*?)\n```/;
const CODE_FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`]+`/g;

const MAX_OVERRIDE_BYTES = 64 * 1024;

const KNOWN_TEMPLATES = new Set([
  'skip',
  'prose',
  'plan',
  'comparison',
  'explainer',
  'diagram'
]);

const MERMAID_FENCE_RE = /```mermaid\s*\n/;

function extractOverride(markdown) {
  const match = markdown.match(OVERRIDE_FENCE);
  if (!match) return { override: null, stripped: markdown };
  const body = match[1];
  if (Buffer.byteLength(body, 'utf8') > MAX_OVERRIDE_BYTES) {
    return { override: null, stripped: markdown.replace(OVERRIDE_FENCE, '').trim() };
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (_) {
    return { override: null, stripped: markdown.replace(OVERRIDE_FENCE, '').trim() };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { override: null, stripped: markdown.replace(OVERRIDE_FENCE, '').trim() };
  }
  const template = typeof parsed.template === 'string' ? parsed.template : null;
  if (!template || !KNOWN_TEMPLATES.has(template) || template === 'skip') {
    return { override: null, stripped: markdown.replace(OVERRIDE_FENCE, '').trim() };
  }
  return {
    override: { template, ...parsed },
    stripped: markdown.replace(OVERRIDE_FENCE, '').trim()
  };
}

function countSignals(markdown) {
  const noCode = markdown.replace(CODE_FENCE, '').replace(INLINE_CODE, '');
  const lines = noCode.split('\n');
  const proseChars = noCode.replace(/\s+/g, ' ').trim().length;

  const headings = { h1: 0, h2: 0, h3: 0, h4: 0 };
  const headingTexts = { h1: [], h2: [], h3: [] };
  let bulletCount = 0;
  let checkboxCount = 0;
  let tableRowCount = 0;
  const codeBlockCount = Math.floor((markdown.match(/^```/gm) || []).length / 2);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 1) { headings.h1++; headingTexts.h1.push(text); }
      else if (level === 2) { headings.h2++; headingTexts.h2.push(text); }
      else if (level === 3) { headings.h3++; headingTexts.h3.push(text); }
      else { headings.h4++; }
      continue;
    }
    if (/^[-*+]\s+\[[ xX!~/]\]\s+/.test(line)) checkboxCount++;
    else if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) bulletCount++;
    if (/^\|.+\|$/.test(line)) tableRowCount++;
  }

  return {
    proseChars,
    headings,
    headingTexts,
    bulletCount,
    checkboxCount,
    tableRowCount,
    codeBlockCount,
    totalLines: lines.length
  };
}

function looksLikePlan(signals, markdown) {
  const phaseHeadings = signals.headingTexts.h2.filter((t) =>
    /\bphase\s*\d/i.test(t) ||
    /\bstep\s*\d/i.test(t) ||
    /\bmilestone\s*\d/i.test(t)
  );
  if (phaseHeadings.length >= 2) return true;
  if (signals.checkboxCount >= 3) return true;
  if (/^# .*\bplan\b/im.test(markdown) && phaseHeadings.length >= 1) return true;
  return false;
}

function looksLikeComparison(signals) {
  const optionHeadings = signals.headingTexts.h2.filter((t) =>
    /\b(option|approach|alternative|variant|path)\s*[a-z\d]/i.test(t)
  );
  if (optionHeadings.length >= 2) return true;
  const h3Options = signals.headingTexts.h3.filter((t) =>
    /\b(option|approach|alternative|variant)\s*[a-z\d]/i.test(t)
  );
  if (h3Options.length >= 2) return true;
  return false;
}

function looksLikeExplainer(signals, markdown) {
  if (/\btl;?dr\b/i.test(markdown)) return true;
  if (signals.headings.h2 >= 3 && signals.headings.h3 >= 2 && signals.bulletCount < 10) return true;
  if (signals.headings.h2 >= 2 && signals.bulletCount === 0 && signals.proseChars > 600) return true;
  return false;
}

function shouldSkip(signals) {
  return signals.proseChars < 240
    && signals.headings.h1 + signals.headings.h2 + signals.headings.h3 === 0
    && signals.codeBlockCount === 0
    && signals.tableRowCount === 0
    && signals.bulletCount < 3
    && signals.checkboxCount === 0;
}

const DEFAULT_RENDER_THRESHOLD = Object.freeze({
  minChars: 600,
  minHeadings: 2,
  minTableRows: 3,
  minCheckboxes: 3
});

const EXPLICIT_GRAPH_RE = /```(?:mermaid|to-html(?:-graph)?)\s*\n/;

function shouldRender(signals, markdown, thresholds) {
  if (!signals) return { render: false, reason: 'no-signals' };
  const t = { ...DEFAULT_RENDER_THRESHOLD, ...(thresholds || {}) };
  const totalHeadings = signals.headings.h1 + signals.headings.h2 + signals.headings.h3;
  if (signals.proseChars >= t.minChars) return { render: true, reason: 'length' };
  if (totalHeadings >= t.minHeadings) return { render: true, reason: 'headings' };
  if (signals.codeBlockCount >= 1) return { render: true, reason: 'code' };
  if (signals.tableRowCount >= t.minTableRows) return { render: true, reason: 'table' };
  if (signals.checkboxCount >= t.minCheckboxes) return { render: true, reason: 'checkboxes' };
  if (typeof markdown === 'string' && EXPLICIT_GRAPH_RE.test(markdown)) {
    return { render: true, reason: 'graph-block' };
  }
  return { render: false, reason: 'gate:short-flat' };
}

function classify(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { template: 'skip', reason: 'empty', signals: null, override: null };
  }
  const { override, stripped } = extractOverride(markdown);
  if (override) {
    return { template: override.template, reason: 'override', signals: null, override, source: stripped };
  }

  const signals = countSignals(stripped);

  if (shouldSkip(signals)) {
    return { template: 'skip', reason: 'trivial', signals, override: null, source: stripped };
  }
  if (looksLikeComparison(signals)) {
    return { template: 'comparison', reason: 'option-headings', signals, override: null, source: stripped };
  }
  if (looksLikePlan(signals, stripped)) {
    return { template: 'plan', reason: 'phase-structure', signals, override: null, source: stripped };
  }
  if (MERMAID_FENCE_RE.test(stripped)) {
    return { template: 'diagram', reason: 'mermaid-block', signals, override: null, source: stripped };
  }
  if (looksLikeExplainer(signals, stripped)) {
    return { template: 'explainer', reason: 'explainer-structure', signals, override: null, source: stripped };
  }
  return { template: 'prose', reason: 'default', signals, override: null, source: stripped };
}

module.exports = {
  KNOWN_TEMPLATES,
  MAX_OVERRIDE_BYTES,
  DEFAULT_RENDER_THRESHOLD,
  classify,
  extractOverride,
  countSignals,
  shouldSkip,
  shouldRender
};
