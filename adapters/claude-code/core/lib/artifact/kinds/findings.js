'use strict';

const { ArtifactSpecError, reqString, optString, normalizeLinks, normalizeHeader } = require('../util');
const { escapeHtml, escapeAttr } = require('../../sanitize');
const { renderMarkdown } = require('../../markdown');

const KIND = 'findings';
const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info'
};
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function normalizeFinding(finding, ctx) {
  if (!finding || typeof finding !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { title: reqString(finding.title, `${ctx}.title`) };
  if (typeof finding.severity === 'string' && SEVERITIES.has(finding.severity)) out.severity = finding.severity;
  const category = optString(finding.category);
  if (category) out.category = category;
  const description = optString(finding.description);
  if (description) out.description = description;
  const links = normalizeLinks(finding.links);
  if (links.length) out.links = links;
  return out;
}

function normalizeGroup(group, idx) {
  const ctx = `groups[${idx}]`;
  if (!group || typeof group !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = {};
  const title = optString(group.title);
  if (title) out.title = title;
  if (!Array.isArray(group.findings) || group.findings.length === 0) {
    throw new ArtifactSpecError(`${ctx}.findings must be a non-empty array`);
  }
  out.findings = group.findings.map((f, i) => normalizeFinding(f, `${ctx}.findings[${i}]`));
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeader(spec) };
  if (Array.isArray(spec.groups)) {
    if (spec.groups.length === 0) throw new ArtifactSpecError('findings.groups must be a non-empty array');
    out.groups = spec.groups.map((g, i) => normalizeGroup(g, i));
  } else if (Array.isArray(spec.findings)) {
    if (spec.findings.length === 0) throw new ArtifactSpecError('findings.findings must be a non-empty array');
    out.groups = [{ findings: spec.findings.map((f, i) => normalizeFinding(f, `findings[${i}]`)) }];
  } else {
    throw new ArtifactSpecError('findings requires a non-empty findings array or groups array');
  }
  return out;
}

function renderSeverity(severity) {
  if (!severity) return '';
  return `<span class="cc-fd-sev cc-fd-sev-${escapeAttr(severity)}">${escapeHtml(SEVERITY_LABELS[severity])}</span>`;
}

function renderTags(finding) {
  const sev = renderSeverity(finding.severity);
  const cat = finding.category ? `<span class="cc-fd-cat">${escapeHtml(finding.category)}</span>` : '';
  return (sev || cat) ? `<div class="cc-fd-tags">${sev}${cat}</div>` : '';
}

function renderLinks(links) {
  if (!links || !links.length) return '';
  const items = links
    .map((l) => `<a class="cc-fd-link" href="${escapeAttr(l.href)}" rel="noopener noreferrer">${escapeHtml(l.text)}</a>`)
    .join('');
  return `<div class="cc-fd-links">${items}</div>`;
}

function renderFinding(finding) {
  const sevAttr = finding.severity ? ` data-severity="${escapeAttr(finding.severity)}"` : '';
  const description = finding.description ? `<div class="cc-fd-desc">${renderMarkdown(finding.description)}</div>` : '';
  return `<li class="cc-fd-item"${sevAttr}>${renderTags(finding)}<div class="cc-fd-body"><p class="cc-fd-title">${escapeHtml(finding.title)}</p>${description}${renderLinks(finding.links)}</div></li>`;
}

function renderGroup(group) {
  const heading = group.title ? `<h2 class="cc-fd-h">${escapeHtml(group.title)}</h2>` : '';
  const items = group.findings.map(renderFinding).join('');
  return `<section class="cc-fd-group">${heading}<ul class="cc-fd-items">${items}</ul></section>`;
}

function renderRollup(groups) {
  const counts = {};
  for (const group of groups) {
    for (const finding of group.findings) {
      if (finding.severity) counts[finding.severity] = (counts[finding.severity] || 0) + 1;
    }
  }
  const chips = SEVERITY_ORDER
    .filter((k) => counts[k])
    .map((k) => `<span class="cc-fd-roll cc-fd-sev-${k}">${counts[k]} ${escapeHtml(SEVERITY_LABELS[k])}</span>`)
    .join('');
  return chips ? `<div class="cc-fd-rollup">${chips}</div>` : '';
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-fd-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-fd-meta">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-fd-header"><h1 class="cc-fd-h1">${escapeHtml(spec.title)}</h1>${subtitle}${meta}${renderRollup(spec.groups)}</header>`;
}

function render(spec) {
  const body = `<div class="cc-fd">${renderHeader(spec)}${spec.groups.map(renderGroup).join('')}</div>`;
  return { classname: 'tpl-findings', body, styleAssets: ['findings.css'], scriptAssets: [] };
}

module.exports = { kind: KIND, validate, render, SEVERITY_LABELS };
