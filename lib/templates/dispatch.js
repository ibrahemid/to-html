'use strict';

const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('../sanitize');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const TEMPLATE_MODULES = {
  prose: () => require('./prose'),
  plan: () => require('./plan'),
  comparison: () => require('./comparison'),
  explainer: () => require('./explainer'),
  diagram: () => require('./diagram')
};

class DispatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DispatchError';
  }
}

function readAsset(name) {
  const file = path.join(ASSETS_DIR, name);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function templateModule(name) {
  const loader = TEMPLATE_MODULES[name];
  if (!loader) throw new DispatchError(`Unknown template: ${name}`);
  return loader();
}

function buildShell({ classname, title, headExtras = '', styles = '', body, scripts = '', autoRefreshSeconds = null, stamp = null }) {
  const refreshTag = autoRefreshSeconds
    ? `<meta http-equiv="refresh" content="${Number(autoRefreshSeconds)}">`
    : '';
  const stampHtml = stamp
    ? `<div class="cc-stamp">${escapeHtml(stamp)}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
${refreshTag}
${headExtras}
<title>${escapeHtml(title)}</title>
<style>${readAsset('base.css')}\n${styles}</style>
</head>
<body class="${escapeHtml(classname)}">
${stampHtml}
${body}
${scripts}
</body>
</html>
`;
}

function dispatchRender(input) {
  const { template, markdown, meta = {}, signals = null, override = null } = input;
  const args = { markdown, meta, signals, override, buildShell, readAsset };
  try {
    const mod = templateModule(template);
    return mod.render(args);
  } catch (err) {
    if (template === 'prose') throw err;
    process.stderr.write(`[to-html] template '${template}' failed (${err.message}); falling back to prose\n`);
    const proseMod = templateModule('prose');
    return proseMod.render(args);
  }
}

module.exports = {
  DispatchError,
  CSP,
  buildShell,
  readAsset,
  dispatchRender,
  TEMPLATE_MODULES
};
