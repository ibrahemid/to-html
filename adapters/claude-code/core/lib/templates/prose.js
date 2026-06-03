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

function render({ markdown, meta, override, _signals, buildShell, readAsset, tldrHtml, mapHtml, chromeHtml, uiDefaults }) {
  const title = deriveTitle(markdown, override);

  const stripped = markdown.replace(/^#\s+.*$/m, '').trim();
  const bodyHtml = renderMarkdown(stripped);

  const stamp = (meta.turnIndex != null && meta.turnIndex !== 0)
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body = `<header class="prose-head">
  <h1 class="prose-title">${escapeHtml(title)}</h1>
</header>
<article class="prose">${bodyHtml}</article>`;

  return {
    title,
    body,
    html: buildShell({
      classname: 'tpl-prose',
      title,
      styles: readAsset('prose.css'),
      body,
      stamp: stamp || null,
      tldrHtml,
      mapHtml,
      chromeHtml,
      uiDefaults
    })
  };
}

module.exports = { render };
