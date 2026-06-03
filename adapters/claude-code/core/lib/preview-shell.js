'use strict';

const path = require('path');
const fs = require('fs');
const { escapeHtml } = require('./sanitize');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const UI_KEYS = ['theme', 'size', 'width', 'family'];

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline' file:; base-uri 'none'; form-action 'none'";

function readAsset(name) {
  const file = path.join(ASSETS_DIR, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function rootDataAttrs(uiDefaults) {
  if (!uiDefaults || typeof uiDefaults !== 'object') return '';
  return UI_KEYS
    .filter((k) => typeof uiDefaults[k] === 'string' && uiDefaults[k].length > 0)
    .map((k) => `data-${k}="${escapeHtml(uiDefaults[k])}"`)
    .join(' ');
}

function buildPreviewShell({ uiDefaults = null, title = 'Session preview' } = {}) {
  const rootAttrs = rootDataAttrs(uiDefaults);
  const styles = `${readAsset('base.css')}\n${readAsset('map.css')}\n${readAsset('chrome.css')}\n${readAsset('prose.css')}\n${readAsset('comparison.css')}\n${readAsset('explainer.css')}\n${readAsset('diagram.css')}\n${readAsset('plan.css')}\n${readAsset('preview.css')}`;
  return `<!doctype html>
<html lang="en"${rootAttrs ? ' ' + rootAttrs : ''}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body class="tpl-preview">
<main id="cc-feed" class="cc-feed"></main>
<script>${readAsset('preview-runtime.js')}</script>
</body>
</html>
`;
}

module.exports = { buildPreviewShell, CSP };
