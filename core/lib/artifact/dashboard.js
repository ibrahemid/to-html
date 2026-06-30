'use strict';

const { escapeHtml, escapeAttr } = require('../sanitize');
const { renderMarkdown } = require('../markdown');

const STATUS_LABELS = {
  done: 'Done',
  in_progress: 'In progress',
  pending: 'Pending',
  blocked: 'Blocked',
  decision: 'Needs you'
};

const ROLLUP_ORDER = ['decision', 'blocked', 'in_progress', 'pending', 'done'];

function renderBadge(status) {
  if (!status) return '';
  const label = STATUS_LABELS[status] || status;
  return `<span class="cc-status cc-status-${escapeAttr(status)}">${escapeHtml(label)}</span>`;
}

function renderLinks(links) {
  if (!links || !links.length) return '';
  const items = links
    .map((l) => `<a class="cc-dash-link" href="${escapeAttr(l.href)}" rel="noopener noreferrer">${escapeHtml(l.text)}</a>`)
    .join('');
  return `<div class="cc-dash-links">${items}</div>`;
}

function renderCopy(copyPrompt) {
  if (!copyPrompt) return '';
  return `<div class="cc-copy"><textarea class="cc-copy-text" readonly rows="3">${escapeHtml(copyPrompt)}</textarea><button class="cc-copy-btn" type="button">Copy</button></div>`;
}

function renderItem(item) {
  const statusAttr = item.status ? ` data-status="${escapeAttr(item.status)}"` : '';
  const detail = item.detail ? `<div class="cc-item-detail">${renderMarkdown(item.detail)}</div>` : '';
  return `<li class="cc-dash-item"${statusAttr}>${renderBadge(item.status)}<div class="cc-item-body"><p class="cc-item-label">${escapeHtml(item.label)}</p>${detail}${renderLinks(item.links)}${renderCopy(item.copyPrompt)}</div></li>`;
}

function renderSection(section) {
  const summary = section.summary ? `<div class="cc-dash-summary">${renderMarkdown(section.summary)}</div>` : '';
  const items = section.items.length
    ? `<ul class="cc-dash-items">${section.items.map(renderItem).join('')}</ul>`
    : '';
  return `<section class="cc-dash-section"><h2 class="cc-dash-h">${escapeHtml(section.title)}</h2>${summary}${items}</section>`;
}

function renderRollup(sections) {
  const counts = {};
  for (const section of sections) {
    for (const item of section.items) {
      if (item.status) counts[item.status] = (counts[item.status] || 0) + 1;
    }
  }
  const chips = ROLLUP_ORDER
    .filter((k) => counts[k])
    .map((k) => `<span class="cc-roll cc-status-${k}">${counts[k]} ${escapeHtml(STATUS_LABELS[k])}</span>`)
    .join('');
  return chips ? `<div class="cc-dash-rollup">${chips}</div>` : '';
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-dash-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-dash-meta">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-dash-header"><h1 class="cc-dash-title">${escapeHtml(spec.title)}</h1>${subtitle}${meta}${renderRollup(spec.sections)}</header>`;
}

function render(spec) {
  const body = `<div class="cc-dash">${renderHeader(spec)}${spec.sections.map(renderSection).join('')}</div>`;
  return {
    classname: 'tpl-dashboard',
    body,
    styleAssets: ['dashboard.css'],
    scriptAssets: ['dashboard-runtime.js']
  };
}

module.exports = { render, STATUS_LABELS };
