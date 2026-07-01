'use strict';

const { ArtifactSpecError, reqString, optString, normalizeLinks, normalizeHeader } = require('../util');
const { escapeHtml, escapeAttr } = require('../../sanitize');
const { renderMarkdown } = require('../../markdown');

const KIND = 'dashboard';
const STATUSES = new Set(['done', 'in_progress', 'pending', 'blocked', 'decision']);
const STATUS_LABELS = {
  done: 'Done',
  in_progress: 'In progress',
  pending: 'Pending',
  blocked: 'Blocked',
  decision: 'Needs you'
};
const ROLLUP_ORDER = ['decision', 'blocked', 'in_progress', 'pending', 'done'];
const STATUS_TONE = {
  done: 'tone-pos',
  in_progress: 'tone-accent',
  pending: 'tone-muted',
  blocked: 'tone-neg',
  decision: 'tone-warn'
};

function normalizeItem(item, ctx) {
  if (!item || typeof item !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { label: reqString(item.label, `${ctx}.label`) };
  if (typeof item.status === 'string' && STATUSES.has(item.status)) out.status = item.status;
  const detail = optString(item.detail);
  if (detail) out.detail = detail;
  if (typeof item.copyPrompt === 'string' && item.copyPrompt !== '') out.copyPrompt = item.copyPrompt;
  const links = normalizeLinks(item.links);
  if (links.length) out.links = links;
  return out;
}

function normalizeSection(section, idx) {
  const ctx = `sections[${idx}]`;
  if (!section || typeof section !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { title: reqString(section.title, `${ctx}.title`) };
  const summary = optString(section.summary);
  if (summary) out.summary = summary;
  const items = Array.isArray(section.items) ? section.items : [];
  out.items = items.map((it, i) => normalizeItem(it, `${ctx}.items[${i}]`));
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeader(spec) };
  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    throw new ArtifactSpecError('dashboard.sections must be a non-empty array');
  }
  out.sections = spec.sections.map((s, i) => normalizeSection(s, i));
  return out;
}

function renderBadge(status) {
  if (!status) return '';
  const label = STATUS_LABELS[status] || status;
  const tone = STATUS_TONE[status] || 'tone-muted';
  return `<span class="cc-status cc-pill ${tone} cc-status-${escapeAttr(status)}">${escapeHtml(label)}</span>`;
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
  return `<li class="cc-dash-item"${statusAttr}><div class="cc-item-body"><div class="cc-item-head">${renderBadge(item.status)}<p class="cc-item-label">${escapeHtml(item.label)}</p></div>${detail}${renderLinks(item.links)}${renderCopy(item.copyPrompt)}</div></li>`;
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
    .map((k) => `<span class="cc-roll cc-pill ${STATUS_TONE[k] || 'tone-muted'}">${counts[k]} ${escapeHtml(STATUS_LABELS[k])}</span>`)
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
  return `<header class="cc-dash-header"><p class="cc-eyebrow cc-dash-kind">Dashboard</p><h1 class="cc-dash-title">${escapeHtml(spec.title)}</h1>${subtitle}${meta}${renderRollup(spec.sections)}</header>`;
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

module.exports = { kind: KIND, validate, render, STATUS_LABELS };
