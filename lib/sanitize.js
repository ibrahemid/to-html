'use strict';

const ALLOWED_TAGS = new Set([
  'a', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
  'em', 'strong', 'i', 'b', 'u', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
  'span', 'div',
  'details', 'summary',
  'dl', 'dt', 'dd'
]);

const ALLOWED_ATTRS = {
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  th: new Set(['align', 'colspan', 'rowspan']),
  td: new Set(['align', 'colspan', 'rowspan']),
  code: new Set(['class']),
  pre: new Set(['class']),
  span: new Set(['class']),
  div: new Set(['class']),
  details: new Set(['open'])
};

const SAFE_URL_RE = /^(https?:|mailto:|#|\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);)/i;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  return SAFE_URL_RE.test(trimmed);
}

function parseAttributes(attrSegment, allowedSet) {
  if (!attrSegment) return '';
  const attrPattern = /([a-zA-Z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  const matches = [...attrSegment.matchAll(attrPattern)];
  let safe = '';
  for (const m of matches) {
    const name = m[1].toLowerCase();
    if (!allowedSet.has(name)) continue;
    if (name.startsWith('on')) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? '';
    if ((name === 'href' || name === 'src') && !isSafeUrl(value)) continue;
    safe += ` ${name}="${escapeAttr(value)}"`;
  }
  return safe;
}

function sanitizeHtmlFragment(input) {
  if (typeof input !== 'string') return '';
  const tokenizer = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|<!--[\s\S]*?-->|[^<]+/g;
  const tokens = [...input.matchAll(tokenizer)];
  let out = '';
  for (const match of tokens) {
    const piece = match[0];
    if (piece.startsWith('<!--')) continue;
    if (piece[0] !== '<') {
      out += piece;
      continue;
    }
    const tagName = match[1].toLowerCase();
    const isClose = piece[1] === '/';
    if (!ALLOWED_TAGS.has(tagName)) continue;
    if (isClose) {
      out += `</${tagName}>`;
      continue;
    }
    const allowed = ALLOWED_ATTRS[tagName] || new Set();
    let safeAttrs = parseAttributes(match[2] || '', allowed);
    if (tagName === 'a' && !/ rel="/.test(safeAttrs)) {
      safeAttrs += ' rel="noopener noreferrer"';
    }
    out += `<${tagName}${safeAttrs}>`;
  }
  return out;
}

module.exports = {
  ALLOWED_TAGS,
  ALLOWED_ATTRS,
  escapeHtml,
  escapeAttr,
  isSafeUrl,
  sanitizeHtmlFragment
};
