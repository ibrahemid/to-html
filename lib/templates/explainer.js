'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');

function render({ markdown, meta, override, buildShell, readAsset, tldrHtml, mapHtml, chromeHtml, uiDefaults }) {
  const title = (override && override.title)
    || (markdown.match(/^#\s+(.*)$/m) || [null, 'Explainer'])[1]
    || 'Explainer';
  const articleBody = renderMarkdown(markdown.replace(/^#\s+.*$/m, '').trim());

  const stamp = meta.turnIndex
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body = `<header class="exp-head"><h1>${escapeHtml(title)}</h1></header>
<article class="exp-body">${articleBody}</article>`;

  return {
    title,
    html: buildShell({
      classname: 'tpl-exp',
      title,
      styles: readAsset('explainer.css'),
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
