'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');
const { parsePlanMarkdown } = require('../plan-extractor');

const STATUS_META = {
  pending: { glyph: '◯', label: 'Pending', className: 'st-pending' },
  in_progress: { glyph: '◐', label: 'In progress', className: 'st-in-progress' },
  completed: { glyph: '●', label: 'Done', className: 'st-completed' },
  failed: { glyph: '✕', label: 'Failed', className: 'st-failed' }
};

function renderStatusLegend() {
  const items = Object.values(STATUS_META)
    .map((m) => `<span class="legend-item ${m.className}"><span class="glyph">${m.glyph}</span> ${escapeHtml(m.label)}</span>`)
    .join('');
  return `<div class="status-legend">${items}</div>`;
}

function renderToc(phases) {
  const items = phases.map((phase, idx) => {
    const total = phase.tasks.length;
    const done = phase.tasks.filter((t) => t.status === 'completed').length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    return `<li>
      <a href="#${escapeHtml(phase.id)}">
        <span class="phase-index">${idx + 1}</span>
        <span class="phase-name">${escapeHtml(phase.title)}</span>
        <span class="phase-progress">
          <span class="bar"><span class="fill" style="width:${progress}%"></span></span>
          <span class="ratio">${done}/${total}</span>
        </span>
      </a>
    </li>`;
  }).join('');
  return `<nav class="phase-toc">
    <h2>Phases</h2>
    <ol>${items}</ol>
  </nav>`;
}

function renderTask(task, phaseTitle) {
  const meta = STATUS_META[task.status] || STATUS_META.pending;
  const id = escapeHtml(task.id);
  const phaseAttr = escapeHtml(phaseTitle || '');
  return `<li class="task ${meta.className}" data-task-id="${id}" data-status="${escapeHtml(task.status)}" data-phase="${phaseAttr}">
    <label class="task-focus" title="Focus on this task in the next prompt">
      <input type="checkbox" class="task-focus-input" data-task-id="${id}" data-task-text="${escapeHtml(task.text)}" data-phase-title="${phaseAttr}">
    </label>
    <span class="status-glyph">${meta.glyph}</span>
    <span class="task-text">${escapeHtml(task.text)}</span>
    <button type="button" class="task-note-btn" data-task-id="${id}" aria-label="Add note" title="Add note">+</button>
    <input type="text" class="task-note-input" data-task-id="${id}" placeholder="note (optional)" hidden>
  </li>`;
}

function renderPhase(phase, idx) {
  const tasks = phase.tasks.map((t) => renderTask(t, phase.title)).join('');
  const notes = (phase.notes || []).map((n) => `<div class="phase-note">${renderMarkdown(n)}</div>`).join('');
  const total = phase.tasks.length;
  const done = phase.tasks.filter((t) => t.status === 'completed').length;
  return `<section class="phase" id="${escapeHtml(phase.id)}">
    <header class="phase-head">
      <div class="phase-marker">${idx + 1}</div>
      <h2>${escapeHtml(phase.title)}</h2>
      <span class="phase-stats">${done}/${total}</span>
    </header>
    ${notes ? `<div class="phase-notes">${notes}</div>` : ''}
    <ul class="task-list">${tasks}</ul>
  </section>`;
}

function buildBody(plan) {
  const totalTasks = plan.phases.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = plan.phases.reduce((acc, p) => acc + p.tasks.filter((t) => t.status === 'completed').length, 0);
  const pct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const phasesHtml = plan.phases.map(renderPhase).join('\n');
  const tocHtml = renderToc(plan.phases);
  const legend = renderStatusLegend();

  return `<header class="plan-head">
  <h1>${escapeHtml(plan.title || 'Plan')}</h1>
  <div class="plan-summary">
    <div class="summary-stat"><span class="num">${completedTasks}</span><span class="lbl">done</span></div>
    <div class="summary-stat"><span class="num">${totalTasks}</span><span class="lbl">tasks</span></div>
    <div class="summary-bar"><span class="fill" style="width:${pct}%"></span></div>
  </div>
  ${legend}
</header>
<div class="plan-shell">
  <aside class="plan-side">${tocHtml}</aside>
  <main class="plan-main">${phasesHtml}</main>
</div>
<aside class="decision-bar" data-decision="plan">
  <div class="decision-info">
    <span class="decision-count" id="focus-count">0 selected</span>
    <span class="decision-hint">tick the tasks to focus on next, then copy a prompt for Claude</span>
  </div>
  <button type="button" id="copy-decision-btn" disabled>Copy as prompt</button>
  <span id="copy-status" aria-live="polite"></span>
</aside>`;
}

function renderFromPlan({ plan, meta, override, buildShell, readAsset }) {
  const title = (override && override.title) || plan.title || 'Plan';
  const stamp = (meta.turnIndex != null && meta.turnIndex !== 0)
    ? `turn ${meta.turnIndex}${meta.project ? ` · ${meta.project}` : ''}`
    : (meta.project || '');

  const planJson = JSON.stringify(plan)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/[\u2028]/g, '\\u2028')
    .replace(/[\u2029]/g, '\\u2029');
  const extras = `<meta name="cc-plan-id" content="${escapeHtml(plan.planId || '')}">
<script type="application/json" id="plan-data">${planJson}</script>`;

  return {
    title,
    html: buildShell({
      classname: 'tpl-plan',
      title,
      styles: readAsset('plan.css'),
      headExtras: extras,
      body: buildBody(plan),
      scripts: `<script>${readAsset('plan-runtime.js')}</script>`,
      autoRefreshSeconds: 3,
      stamp: stamp || null
    })
  };
}

function render({ markdown, meta, override, buildShell, readAsset }) {
  const plan = parsePlanMarkdown(markdown, {
    titleOverride: override && override.title,
    source: 'classifier'
  });
  return renderFromPlan({ plan, meta, override, buildShell, readAsset });
}

module.exports = { render, renderFromPlan, STATUS_META };
