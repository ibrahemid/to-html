'use strict';

const { ArtifactSpecError, reqString, optString, normalizeLinks } = require('../util');
const { escapeHtml } = require('../../sanitize');
const { renderMarkdown } = require('../../markdown');

const KIND = 'report';

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeTable(table, ctx) {
  if (table === undefined) return undefined;
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new ArtifactSpecError(`${ctx} must be an object`);
  }
  if (!Array.isArray(table.columns) || table.columns.length === 0) {
    throw new ArtifactSpecError(`${ctx}.columns must be a non-empty array`);
  }
  const columns = table.columns.map((c, i) => reqString(c, `${ctx}.columns[${i}]`));
  if (!Array.isArray(table.rows)) {
    throw new ArtifactSpecError(`${ctx}.rows must be an array`);
  }
  const rows = table.rows.map((row, i) => {
    if (!Array.isArray(row)) throw new ArtifactSpecError(`${ctx}.rows[${i}] must be an array`);
    const cells = row.map(normalizeCell);
    while (cells.length < columns.length) cells.push('');
    cells.length = columns.length;
    return cells;
  });
  return { columns, rows };
}

function normalizeSection(section, idx) {
  const ctx = `sections[${idx}]`;
  if (!section || typeof section !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { title: reqString(section.title, `${ctx}.title`) };
  const summary = optString(section.summary);
  if (summary) out.summary = summary;
  const table = normalizeTable(section.table, `${ctx}.table`);
  if (table) out.table = table;
  const links = normalizeLinks(section.links);
  if (links.length) out.links = links;
  return out;
}

function normalizeHeaderFields(spec) {
  const out = { title: reqString(spec.title, 'title') };
  const subtitle = optString(spec.subtitle);
  if (subtitle) out.subtitle = subtitle;
  if (spec.meta && typeof spec.meta === 'object' && !Array.isArray(spec.meta)) {
    const meta = {};
    for (const k of ['project', 'generatedAt', 'note']) {
      const v = optString(spec.meta[k]);
      if (v) meta[k] = v;
    }
    if (Object.keys(meta).length) out.meta = meta;
  }
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeaderFields(spec) };
  out.plain = spec.plain === true;
  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    throw new ArtifactSpecError('report.sections must be a non-empty array');
  }
  out.sections = spec.sections.map((s, i) => normalizeSection(s, i));
  return out;
}

function renderTable(table) {
  if (!table) return '';
  const head = table.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderLinks(links, plain) {
  if (!links || !links.length) return '';
  const items = links
    .map((l) => `<li><a href="${escapeHtml(l.href)}" rel="noopener noreferrer">${escapeHtml(l.text)}</a></li>`)
    .join('');
  return plain ? `<ul>${items}</ul>` : `<ul class="cc-rep-links">${items}</ul>`;
}

function renderPlain(spec) {
  const subtitle = spec.subtitle ? `<p>${escapeHtml(spec.subtitle)}</p>` : '';
  const sections = spec.sections.map((s) => {
    const summary = s.summary ? renderMarkdown(s.summary) : '';
    return `<h2>${escapeHtml(s.title)}</h2>${summary}${renderTable(s.table)}${renderLinks(s.links, true)}`;
  }).join('\n');
  return `<h1>${escapeHtml(spec.title)}</h1>${subtitle}${sections}`;
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-rep-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-rep-meta">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-rep-header"><h1 class="cc-rep-title">${escapeHtml(spec.title)}</h1>${subtitle}${meta}</header>`;
}

function renderSection(section) {
  const summary = section.summary ? `<div class="cc-rep-summary">${renderMarkdown(section.summary)}</div>` : '';
  const table = section.table ? `<div class="cc-rep-tablewrap">${renderTable(section.table)}</div>` : '';
  return `<section class="cc-rep-section"><h2 class="cc-rep-h">${escapeHtml(section.title)}</h2>${summary}${table}${renderLinks(section.links, false)}</section>`;
}

function render(spec) {
  if (spec.plain) {
    return { classname: 'tpl-report-plain', body: renderPlain(spec), styleAssets: [], scriptAssets: [] };
  }
  const body = `<div class="cc-rep">${renderHeader(spec)}${spec.sections.map(renderSection).join('')}</div>`;
  return { classname: 'tpl-report', body, styleAssets: ['report.css'], scriptAssets: [] };
}

module.exports = { kind: KIND, validate, render };
