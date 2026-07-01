'use strict';

const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('../sanitize');

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const UI_KEYS = ['theme', 'size', 'width', 'family'];

function readAsset(name) {
  const file = path.join(ASSETS_DIR, name);
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function rootDataAttrs(uiDefaults) {
  if (!uiDefaults || typeof uiDefaults !== 'object') return '';
  return UI_KEYS
    .filter((k) => typeof uiDefaults[k] === 'string' && uiDefaults[k].length > 0)
    .map((k) => `data-${k}="${escapeHtml(uiDefaults[k])}"`)
    .join(' ');
}

function buildShell({
  classname,
  title,
  headExtras = '',
  styles = '',
  body,
  skipMainWrapper = false,
  scripts = '',
  autoRefreshSeconds = null,
  stamp = null,
  tldrHtml = '',
  mapHtml = '',
  chromeHtml = '',
  uiDefaults = null
}) {
  const refreshTag = autoRefreshSeconds
    ? `<meta http-equiv="refresh" content="${Number(autoRefreshSeconds)}">`
    : '';
  const stampHtml = stamp
    ? `<div class="cc-stamp">${escapeHtml(stamp)}</div>`
    : '';
  const rootAttrs = rootDataAttrs(uiDefaults);
  const hasMap = typeof mapHtml === 'string' && mapHtml.trim().length > 0;
  const hasChrome = typeof chromeHtml === 'string' && chromeHtml.trim().length > 0;
  const mapStyles = hasMap ? '\n' + readAsset('map.css') : '';
  const chromeStyles = hasChrome ? '\n' + readAsset('chrome.css') : '';
  const mapScripts = hasMap ? `<script>${readAsset('map-runtime.js')}</script>` : '';
  const chromeScripts = hasChrome ? `<script>${readAsset('chrome-runtime.js')}</script>` : '';
  const bodyContent = skipMainWrapper ? body : `<main class="cc-main">\n${body}\n</main>`;
  return `<!doctype html>
<html lang="en"${rootAttrs ? ' ' + rootAttrs : ''}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
${refreshTag}
${headExtras}
<title>${escapeHtml(title)}</title>
<style>${readAsset('base.css')}${mapStyles}${chromeStyles}\n${styles}</style>
</head>
<body class="${escapeHtml(classname)}">
${stampHtml}
${tldrHtml}
${mapHtml}
${bodyContent}
${chromeHtml}
${mapScripts}
${chromeScripts}
${scripts}
</body>
</html>
`;
}

module.exports = { CSP, buildShell, readAsset };
