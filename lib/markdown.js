'use strict';

const path = require('path');
const { sanitizeHtmlFragment, escapeHtml } = require('./sanitize');

let markedInstance = null;

function loadMarked() {
  if (markedInstance) return markedInstance;
  const vendorPath = path.join(__dirname, '..', 'vendor', 'marked.min.js');
  const mod = require(vendorPath);
  const lib = mod.marked || mod.default || mod;
  if (!lib || typeof lib.parse !== 'function') {
    throw new Error('Vendored marked.min.js did not expose parse()');
  }
  lib.use({
    gfm: true,
    breaks: false,
    pedantic: false,
    renderer: {
      html() { return ''; }
    }
  });
  markedInstance = lib;
  return lib;
}

function extractHtmlSpec(markdown) {
  const re = /```html-spec\n([\s\S]*?)\n```/g;
  const specs = [];
  const stripped = markdown.replace(re, (_, body) => {
    try {
      specs.push(JSON.parse(body));
    } catch (err) {
      specs.push({ __error: `Invalid html-spec JSON: ${err.message}` });
    }
    return '';
  });
  return { stripped, specs };
}

function renderMarkdown(markdown) {
  const lib = loadMarked();
  const raw = lib.parse(markdown, { async: false });
  return sanitizeHtmlFragment(raw);
}

module.exports = {
  loadMarked,
  extractHtmlSpec,
  renderMarkdown,
  escapeHtml
};
