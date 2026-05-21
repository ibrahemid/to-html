'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');

function deriveTitle(markdown, override) {
  if (override && typeof override.title === 'string') return override.title;
  for (const line of markdown.split('\n')) {
    const m = line.match(/^#\s+(.*)$/);
    if (m) return m[1].trim();
  }
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('```')) {
      return trimmed.replace(/[#*_`]/g, '').slice(0, 80);
    }
  }
  return 'Note';
}

function deriveKicker(override, signals) {
  if (override && typeof override.kicker === 'string') return override.kicker;
  if (!signals) return 'Note';
  if (signals.codeBlockCount >= 3) return 'Technical note';
  if (signals.tableRowCount >= 4) return 'Reference';
  return 'Note';
}

function estimateReadingMinutes(text) {
  const words = text.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function render({ markdown, meta, override, signals, buildShell, readAsset }) {
  const title = deriveTitle(markdown, override);
  const kicker = deriveKicker(override, signals);
  const minutes = estimateReadingMinutes(markdown);

  const stripped = markdown.replace(/^#\s+.*$/m, '').trim();
  const bodyHtml = renderMarkdown(stripped);

  const stamp = (meta.turnIndex != null && meta.turnIndex !== 0)
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body = `<header class="prose-head">
  <p class="prose-kicker">${escapeHtml(kicker)} · ${minutes} min read</p>
  <h1 class="prose-title">${escapeHtml(title)}</h1>
</header>
<article class="prose">${bodyHtml}</article>
<div class="prose-end" aria-hidden="true">❦</div>`;

  return {
    title,
    html: buildShell({
      classname: 'tpl-prose',
      title,
      styles: readAsset('prose.css'),
      body,
      stamp: stamp || null
    })
  };
}

module.exports = { render };
