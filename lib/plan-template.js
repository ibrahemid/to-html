'use strict';

const fs = require('fs');
const path = require('path');
const { escapeHtml } = require('./sanitize');
const { renderMarkdown } = require('./markdown');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const STATUS_META = {
  pending: { glyph: '◯', label: 'Pending', className: 'st-pending' },
  in_progress: { glyph: '◐', label: 'In progress', className: 'st-in-progress' },
  completed: { glyph: '●', label: 'Done', className: 'st-completed' },
  failed: { glyph: '✕', label: 'Failed', className: 'st-failed' }
};

function readAsset(name) {
  return fs.readFileSync(path.join(ASSETS_DIR, name), 'utf8');
}

function renderStatusLegend() {
  const items = Object.values(STATUS_META)
    .map((m) => `<span class="legend-item ${m.className}"><span class="glyph">${m.glyph}</span> ${escapeHtml(m.label)}</span>`)
    .join('');
  return `<div class="status-legend" aria-label="Status legend">${items}</div>`;
}

function renderPhaseToc(phases) {
  const items = phases.map((phase, idx) => {
    const total = phase.tasks.length;
    const done = phase.tasks.filter((t) => t.status === 'completed').length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    return `
    <li>
      <a href="#${escapeHtml(phase.id)}">
        <span class="phase-index">${idx + 1}</span>
        <span class="phase-name">${escapeHtml(phase.title)}</span>
        <span class="phase-progress" data-phase-id="${escapeHtml(phase.id)}">
          <span class="bar"><span class="fill" style="width:${progress}%"></span></span>
          <span class="ratio">${done}/${total}</span>
        </span>
      </a>
    </li>`;
  }).join('');
  return `<nav class="phase-toc" aria-label="Phases">
    <h2>Phases</h2>
    <ol>${items}</ol>
  </nav>`;
}

function renderTask(task) {
  const meta = STATUS_META[task.status] || STATUS_META.pending;
  return `<li class="task ${meta.className}" data-task-id="${escapeHtml(task.id)}" data-status="${escapeHtml(task.status)}">
    <span class="status-glyph" aria-label="${escapeHtml(meta.label)}">${meta.glyph}</span>
    <span class="task-text">${escapeHtml(task.text)}</span>
  </li>`;
}

function renderPhase(phase, idx) {
  const tasks = phase.tasks.map(renderTask).join('');
  const notes = (phase.notes || []).map((n) => `<div class="phase-note">${renderMarkdown(n)}</div>`).join('');
  const total = phase.tasks.length;
  const done = phase.tasks.filter((t) => t.status === 'completed').length;
  return `<section class="phase" id="${escapeHtml(phase.id)}" data-phase-id="${escapeHtml(phase.id)}">
    <header class="phase-head">
      <div class="phase-marker">${idx + 1}</div>
      <h2>${escapeHtml(phase.title)}</h2>
      <span class="phase-stats" data-phase-stats="${escapeHtml(phase.id)}">${done}/${total} done</span>
    </header>
    ${notes ? `<div class="phase-notes">${notes}</div>` : ''}
    <ul class="task-list">${tasks}</ul>
  </section>`;
}

function buildPlanDocument(plan, meta = {}) {
  const styles = readAsset('styles.css');
  const planStyles = readAsset('plan.css');
  const runtime = readAsset('plan-runtime.js');
  const title = escapeHtml(plan.title || 'Plan');
  const sessionId = escapeHtml(meta.sessionId || '');
  const generated = escapeHtml(new Date().toISOString());
  const project = escapeHtml(meta.project || '');
  const totalTasks = plan.phases.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = plan.phases.reduce((acc, p) => acc + p.tasks.filter((t) => t.status === 'completed').length, 0);
  const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
  const sourceLabel = escapeHtml(plan.source || 'plan');

  const phasesHtml = plan.phases.map((p, idx) => renderPhase(p, idx)).join('\n');
  const tocHtml = renderPhaseToc(plan.phases);
  const legend = renderStatusLegend();

  const planJsonForRuntime = JSON.stringify(plan).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="3">
<meta name="generator" content="cc-to-html plan 0.1.0">
<meta name="cc-plan-id" content="${escapeHtml(plan.planId)}">
<meta name="cc-session" content="${sessionId}">
<title>${title} · Plan</title>
<style>${styles}\n${planStyles}</style>
</head>
<body class="plan-doc">
<header class="plan-head">
  <div class="meta">
    <span class="badge">plan</span>
    <span class="meta-item">${sourceLabel}</span>
    <span class="meta-item">${generated}</span>
    ${project ? `<span class="meta-item">${project}</span>` : ''}
  </div>
  <h1>${title}</h1>
  <div class="plan-summary">
    <div class="summary-stat">
      <span class="num" data-overall-done>${completedTasks}</span> <span class="lbl">done</span>
    </div>
    <div class="summary-stat">
      <span class="num" data-overall-total>${totalTasks}</span> <span class="lbl">tasks</span>
    </div>
    <div class="summary-bar"><span class="fill" data-overall-fill style="width:${totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)}%"></span></div>
  </div>
  ${legend}
</header>
<div class="plan-shell">
  <aside class="plan-side">${tocHtml}</aside>
  <main class="plan-main">${phasesHtml}</main>
</div>
<aside class="copy-bar">
  <button type="button" id="copy-plan-md-btn" data-copy="markdown">Copy as markdown</button>
  <span id="copy-status" aria-live="polite"></span>
</aside>
<footer class="doc-foot">
  <small>Live view — page auto-reloads every 3 seconds. Generated by <strong>cc-to-html</strong> · CSP locked, no network.</small>
</footer>
<script type="application/json" id="plan-data">${planJsonForRuntime}</script>
<script>${runtime}</script>
</body>
</html>
`;
}

module.exports = {
  STATUS_META,
  buildPlanDocument
};
