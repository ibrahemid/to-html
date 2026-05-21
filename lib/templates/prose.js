'use strict';

const { renderMarkdown } = require('../markdown');

function deriveTitle(markdown, override) {
  if (override && typeof override.title === 'string') return override.title;
  for (const line of markdown.split('\n')) {
    const m = line.match(/^#\s+(.*)$/);
    if (m) return m[1].trim();
  }
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('```')) return trimmed.replace(/[#*_`]/g, '').slice(0, 80);
  }
  return 'Note';
}

function render({ markdown, meta, override, buildShell, readAsset }) {
  const title = deriveTitle(markdown, override);
  const bodyHtml = renderMarkdown(markdown);
  const stamp = meta.turnIndex
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body = `<article class="prose">${bodyHtml}</article>`;

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
