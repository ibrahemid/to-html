'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');

function splitByOptionHeadings(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  const optionRe = /^##\s+.*\b(option|approach|alternative|variant|path)\s*([a-z\d][a-z\d]*)\s*[:\--]?\s*(.*)$/i;
  const preamble = [];
  const slugCounts = new Map();
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      (current ? current.lines : preamble).push(line);
      continue;
    }
    if (inFence) {
      (current ? current.lines : preamble).push(line);
      continue;
    }
    const m = line.match(optionRe);
    if (m) {
      if (current) sections.push(current);
      let slug = String(m[2]).toLowerCase().replace(/[^a-z0-9]/g, '') || 'x';
      const used = slugCounts.get(slug) || 0;
      slugCounts.set(slug, used + 1);
      if (used > 0) slug = `${slug}-${used + 1}`;
      const label = m[3].trim() || `Option ${m[2].toUpperCase()}`;
      current = { id: `opt-${slug}`, label, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) sections.push(current);

  return { preamble: preamble.join('\n').trim(), options: sections };
}

function classifyHints(body) {
  const hints = { pros: [], cons: [], effort: null, recommended: false };
  const lines = body.split('\n');
  let mode = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^[*_]*\bpros?\b[:*_]*\s*$/i.test(line)) { mode = 'pros'; continue; }
    if (/^[*_]*\bcons?\b[:*_]*\s*$/i.test(line)) { mode = 'cons'; continue; }
    if (/^[*_]*\bdrawbacks?\b[:*_]*\s*$/i.test(line)) { mode = 'cons'; continue; }
    if (/^[*_]*\beffort\b[:*_]*\s*(.*)$/i.test(line)) {
      const v = line.replace(/^[*_]*effort[:*_]*\s*/i, '').trim();
      if (v) hints.effort = v;
      mode = null;
      continue;
    }
    if (/recommend(ed)?/i.test(line)) hints.recommended = true;
    if (mode && /^[-*+]\s+(.*)$/.test(line)) {
      const m = line.match(/^[-*+]\s+(.*)$/);
      if (m) hints[mode].push(m[1].trim());
    } else if (mode && !line) {
      mode = null;
    }
  }
  return hints;
}

function renderOptionCard(opt, idx) {
  const body = opt.lines.join('\n').trim();
  const hints = classifyHints(body);
  const restMarkdown = stripHintBlocks(body);
  const rendered = renderMarkdown(restMarkdown);
  const prosHtml = hints.pros.length
    ? `<div class="hint hint-pros"><span class="hint-label">Pros</span><ul>${hints.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>`
    : '';
  const consHtml = hints.cons.length
    ? `<div class="hint hint-cons"><span class="hint-label">Cons</span><ul>${hints.cons.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>`
    : '';
  const effortHtml = hints.effort
    ? `<div class="effort"><span class="hint-label">Effort</span><span class="effort-value">${escapeHtml(hints.effort)}</span></div>`
    : '';
  const recBadge = hints.recommended ? '<span class="rec-badge">Recommended</span>' : '';
  const id = escapeHtml(opt.id);
  const label = escapeHtml(opt.label);

  return `<article class="opt" data-option-id="${id}" data-option-label="${label}">
  <header class="opt-head">
    <label class="opt-pick" title="Pick this option">
      <input type="radio" name="pick-option" value="${id}" aria-label="Select: ${label}" data-option-label="${label}">
      <span class="opt-index">${String.fromCharCode(65 + idx)}</span>
    </label>
    <div class="opt-title">
      <h2>${label}${recBadge}</h2>
    </div>
  </header>
  <div class="opt-body">${rendered}</div>
  ${(prosHtml || consHtml) ? `<div class="hints">${prosHtml}${consHtml}</div>` : ''}
  ${effortHtml}
</article>`;
}

function stripHintBlocks(body) {
  return body
    .replace(/^[*_]*\bpros?\b[:*_]*\s*$[\s\S]*?(?=^[*_]*\b(cons?|drawbacks?|effort)\b|\n##|\n#|$)/gim, '')
    .replace(/^[*_]*\bcons?\b[:*_]*\s*$[\s\S]*?(?=^[*_]*\b(pros?|effort)\b|\n##|\n#|$)/gim, '')
    .replace(/^[*_]*\bdrawbacks?\b[:*_]*\s*$[\s\S]*?(?=^[*_]*\b(pros?|effort)\b|\n##|\n#|$)/gim, '')
    .replace(/^[*_]*\beffort\b[:*_]*\s*.*$/gim, '')
    .trim();
}

function render({ markdown, meta, override, buildShell, readAsset, tldrHtml, mapHtml, chromeHtml, uiDefaults }) {
  const { preamble, options } = splitByOptionHeadings(markdown);
  const title = (override && override.title)
    || (preamble.match(/^#\s+(.*)$/m) || [null, 'Approaches'])[1]
    || 'Approaches';

  const preambleHtml = preamble
    ? `<div class="preamble">${renderMarkdown(preamble.replace(/^#\s+.*$/m, '').trim())}</div>`
    : '';
  const cards = options.map(renderOptionCard).join('\n');
  const stamp = meta.turnIndex
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body = `<main class="cc-main">
<header class="cmp-head"><h1>${escapeHtml(title)}</h1>${preambleHtml}</header>
<section class="cmp-grid" data-options="${options.length}">${cards}</section>
</main>
<aside class="decision-bar" data-decision="comparison">
  <div class="decision-info">
    <span class="decision-pick" id="pick-label">Pick an option</span>
    <input type="text" id="pick-reason" aria-label="Decision reason (optional)" placeholder="Reason (optional)" maxlength="240">
  </div>
  <button type="button" id="copy-decision-btn" disabled>Copy as prompt</button>
  <span id="copy-status" aria-live="polite"></span>
</aside>`;

  return {
    title,
    body,
    html: buildShell({
      classname: 'tpl-cmp',
      title,
      styles: readAsset('comparison.css'),
      body,
      skipMainWrapper: true,
      scripts: `<script>${readAsset('comparison-runtime.js')}</script>`,
      stamp: stamp || null,
      tldrHtml,
      mapHtml,
      chromeHtml,
      uiDefaults
    })
  };
}

module.exports = { render };
