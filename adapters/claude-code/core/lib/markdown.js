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

function renderMarkdown(markdown) {
  const lib = loadMarked();
  const raw = lib.parse(markdown, { async: false });
  return sanitizeHtmlFragment(raw);
}

module.exports = {
  loadMarked,
  renderMarkdown,
  escapeHtml
};
