'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');

function extractTldr(markdown) {
  const lines = markdown.split('\n');
  const tldrMatch = markdown.match(/^(?:#{1,3}\s+)?\bTL;?DR\b[:\-—]?\s*(.*)$/im);
  if (!tldrMatch) return { tldr: null, body: markdown };
  const idx = markdown.indexOf(tldrMatch[0]);
  let bodyTldr = tldrMatch[1] || '';
  const startAfter = idx + tldrMatch[0].length;
  const trailing = markdown.slice(startAfter).split('\n');
  const tldrLines = [];
  for (const line of trailing) {
    if (/^#{1,3}\s+/.test(line.trim()) && tldrLines.length > 0) break;
    if (!line.trim() && tldrLines.length > 0 && tldrLines[tldrLines.length - 1] === '') break;
    tldrLines.push(line);
  }
  const tldrFull = (bodyTldr + '\n' + tldrLines.join('\n')).trim();
  const newBody = markdown.replace(tldrMatch[0] + (tldrLines.length ? '\n' + tldrLines.join('\n') : ''), '').trim();
  return { tldr: tldrFull, body: newBody };
}

function buildToc(markdown) {
  const headings = [];
  let idx = 0;
  for (const line of markdown.split('\n')) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      const text = m[1].trim();
      const slug = `s-${++idx}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)}`;
      headings.push({ slug, text });
    }
  }
  return headings;
}

function injectSectionIds(markdown, headings) {
  let i = 0;
  return markdown.replace(/^##\s+(.*)$/gm, (full, text) => {
    const h = headings[i++];
    if (!h) return full;
    return `## ${text}\n<a id="${h.slug}"></a>`;
  });
}

function render({ markdown, meta, override, buildShell, readAsset }) {
  const { tldr, body } = extractTldr(markdown);
  const headings = buildToc(body);
  const annotatedBody = headings.length > 0 ? injectSectionIds(body, headings) : body;
  const title = (override && override.title)
    || (body.match(/^#\s+(.*)$/m) || [null, 'Explainer'])[1]
    || 'Explainer';
  const articleBody = renderMarkdown(annotatedBody.replace(/^#\s+.*$/m, '').trim());
  const tldrBlock = tldr
    ? `<aside class="tldr"><span class="tldr-label">TL;DR</span><div class="tldr-body">${renderMarkdown(tldr)}</div></aside>`
    : '';
  const tocBlock = headings.length >= 2
    ? `<nav class="exp-toc" aria-label="On this page">
  <h2>On this page</h2>
  <ol>${headings.map((h) => `<li><a href="#${escapeHtml(h.slug)}">${escapeHtml(h.text)}</a></li>`).join('')}</ol>
</nav>`
    : '';

  const stamp = meta.turnIndex
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const body2 = `<header class="exp-head"><h1>${escapeHtml(title)}</h1></header>
${tldrBlock}
<div class="exp-shell">
  ${tocBlock}
  <article class="exp-body">${articleBody}</article>
</div>`;

  return {
    title,
    html: buildShell({
      classname: 'tpl-exp',
      title,
      styles: readAsset('explainer.css'),
      body: body2,
      stamp: stamp || null
    })
  };
}

module.exports = { render };
