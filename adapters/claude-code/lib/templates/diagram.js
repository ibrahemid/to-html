'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');

function render({ markdown, meta, override, buildShell, readAsset, tldrHtml, mapHtml, chromeHtml, uiDefaults }) {
  const proseWithoutMermaid = String(markdown || '')
    .replace(/```mermaid\s*\n[\s\S]*?\n```/g, '')
    .trim();

  const title = (override && override.title)
    || (proseWithoutMermaid.match(/^#\s+(.*)$/m) || [null, 'Map'])[1]
    || 'Map';

  const bodyHtml = proseWithoutMermaid
    ? renderMarkdown(proseWithoutMermaid.replace(/^#\s+.*$/m, '').trim())
    : '';

  const stamp = (meta.turnIndex != null && meta.turnIndex !== 0)
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body = `<header class="dgm-head">
  <h1>${escapeHtml(title)}</h1>
</header>
${bodyHtml ? `<section class="dgm-body">${bodyHtml}</section>` : ''}`;

  return {
    title,
    html: buildShell({
      classname: 'tpl-dgm',
      title,
      styles: readAsset('diagram.css'),
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
