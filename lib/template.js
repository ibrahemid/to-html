'use strict';

const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('./sanitize');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

class TemplateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TemplateError';
  }
}

function readAsset(name) {
  const file = path.join(ASSETS_DIR, name);
  if (!fs.existsSync(file)) {
    throw new TemplateError(`Missing bundled asset: ${name}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function renderControls(specs) {
  if (!specs || specs.length === 0) return '';
  const blocks = specs
    .map((spec, idx) => renderSpecBlock(spec, idx))
    .filter(Boolean)
    .join('\n');
  if (!blocks) return '';
  return `<section class="controls" aria-label="Interactive controls">${blocks}</section>`;
}

function renderSpecBlock(spec, idx) {
  if (!spec || typeof spec !== 'object') return '';
  if (spec.__error) {
    return `<div class="spec-error">Invalid html-spec block: ${escapeHtml(spec.__error)}</div>`;
  }
  const title = spec.title ? `<h3 class="spec-title">${escapeHtml(spec.title)}</h3>` : '';
  const description = spec.description ? `<p class="spec-desc">${escapeHtml(spec.description)}</p>` : '';
  const controls = Array.isArray(spec.controls)
    ? spec.controls.map((c, i) => renderControl(c, `s${idx}-c${i}`)).filter(Boolean).join('\n')
    : '';
  return `<fieldset class="spec" data-spec-id="${escapeHtml(spec.id || `spec-${idx}`)}">${title}${description}${controls}</fieldset>`;
}

function renderControl(control, fallbackId) {
  if (!control || typeof control !== 'object') return '';
  const id = String(control.id || fallbackId);
  const label = control.label ? escapeHtml(control.label) : id;
  const help = control.help ? `<small class="help">${escapeHtml(control.help)}</small>` : '';
  switch (control.type) {
    case 'slider': {
      const min = Number.isFinite(control.min) ? control.min : 0;
      const max = Number.isFinite(control.max) ? control.max : 100;
      const step = Number.isFinite(control.step) ? control.step : 1;
      const value = Number.isFinite(control.value) ? control.value : min;
      return `<div class="control slider">
  <label for="${escapeHtml(id)}">${label}</label>
  <input type="range" id="${escapeHtml(id)}" name="${escapeHtml(id)}" min="${min}" max="${max}" step="${step}" value="${value}" data-kind="slider">
  <output for="${escapeHtml(id)}" data-output-for="${escapeHtml(id)}">${value}</output>
  ${help}
</div>`;
    }
    case 'dropdown': {
      const options = Array.isArray(control.options) ? control.options : [];
      const opts = options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? (o.label || o.value) : o;
        const selected = control.value !== undefined && String(control.value) === String(v) ? ' selected' : '';
        return `<option value="${escapeHtml(String(v))}"${selected}>${escapeHtml(String(l))}</option>`;
      }).join('');
      return `<div class="control dropdown">
  <label for="${escapeHtml(id)}">${label}</label>
  <select id="${escapeHtml(id)}" name="${escapeHtml(id)}" data-kind="dropdown">${opts}</select>
  ${help}
</div>`;
    }
    case 'checkbox': {
      const checked = control.value ? ' checked' : '';
      return `<div class="control checkbox">
  <label><input type="checkbox" id="${escapeHtml(id)}" name="${escapeHtml(id)}" data-kind="checkbox"${checked}> ${label}</label>
  ${help}
</div>`;
    }
    case 'choice': {
      const options = Array.isArray(control.options) ? control.options : [];
      const radios = options.map((o, i) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? (o.label || o.value) : o;
        const checked = control.value !== undefined && String(control.value) === String(v) ? ' checked' : '';
        return `<label class="radio"><input type="radio" name="${escapeHtml(id)}" value="${escapeHtml(String(v))}" data-kind="choice"${checked}> ${escapeHtml(String(l))}</label>`;
      }).join('');
      return `<div class="control choice">
  <div class="control-label">${label}</div>
  <div class="radio-group">${radios}</div>
  ${help}
</div>`;
    }
    case 'kanban': {
      const columns = Array.isArray(control.columns) ? control.columns : [];
      const cards = Array.isArray(control.cards) ? control.cards : [];
      const cols = columns.map((col) => {
        const colId = typeof col === 'object' ? col.id : col;
        const colLabel = typeof col === 'object' ? (col.label || col.id) : col;
        const colCards = cards
          .filter((c) => String(c.column) === String(colId))
          .map((c) => `<div class="kanban-card" draggable="true" data-card-id="${escapeHtml(String(c.id))}">${escapeHtml(String(c.label || c.id))}${c.note ? `<small>${escapeHtml(String(c.note))}</small>` : ''}</div>`)
          .join('');
        return `<div class="kanban-col" data-col-id="${escapeHtml(String(colId))}"><h4>${escapeHtml(String(colLabel))}</h4>${colCards}</div>`;
      }).join('');
      return `<div class="control kanban" data-kind="kanban" data-control-id="${escapeHtml(id)}">
  <div class="control-label">${label}</div>
  <div class="kanban-board">${cols}</div>
  ${help}
</div>`;
    }
    default:
      return '';
  }
}

function buildDocument({ title, bodyHtml, specs, meta }) {
  const styles = readAsset('styles.css');
  const runtime = readAsset('runtime.js');
  const controlsHtml = renderControls(specs);
  const safeTitle = escapeHtml(title || 'Claude Code Output');
  const generated = escapeHtml(new Date().toISOString());
  const turnIndex = Number.isFinite(meta?.turnIndex) ? meta.turnIndex : 0;
  const sessionId = escapeHtml(meta?.sessionId || '');
  const project = escapeHtml(meta?.project || '');
  const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="cc-to-html ${escapeHtml(process.env.npm_package_version || '0.1.0')}">
<meta name="cc-session" content="${sessionId}">
<meta name="cc-turn" content="${turnIndex}">
<title>${safeTitle}</title>
<style>${styles}</style>
</head>
<body>
<header class="doc-head">
  <div class="meta">
    <span class="badge">turn ${turnIndex}</span>
    <span class="meta-item">${generated}</span>
    ${project ? `<span class="meta-item">${project}</span>` : ''}
  </div>
  <h1>${safeTitle}</h1>
</header>
<main class="prose" aria-label="Assistant response">
${bodyHtml}
</main>
${controlsHtml}
<aside class="copy-bar">
  <button type="button" id="copy-prompt-btn" data-copy="prompt">Copy as prompt</button>
  <span id="copy-status" aria-live="polite"></span>
</aside>
<footer class="doc-foot">
  <small>Generated by <strong>cc-to-html</strong>. CSP locks this artifact: no network, no fetch, no remote assets. Inspect source freely.</small>
</footer>
<script>${runtime}</script>
</body>
</html>
`;
}

module.exports = {
  TemplateError,
  buildDocument,
  renderControls
};
