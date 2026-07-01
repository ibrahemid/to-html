'use strict';

const { ArtifactSpecError, reqString, optString, normalizeLinks, normalizeHeader } = require('../util');
const { escapeHtml, escapeAttr } = require('../../sanitize');
const { renderMarkdown } = require('../../markdown');

const KIND = 'checklist';

function normalizeItem(item, ctx) {
  if (!item || typeof item !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { text: reqString(item.text, `${ctx}.text`) };
  const detail = optString(item.detail);
  if (detail) out.detail = detail;
  const links = normalizeLinks(item.links);
  if (links.length) out.links = links;
  return out;
}

function normalizeGroup(group, idx) {
  const ctx = `groups[${idx}]`;
  if (!group || typeof group !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { title: reqString(group.title, `${ctx}.title`) };
  const summary = optString(group.summary);
  if (summary) out.summary = summary;
  if (!Array.isArray(group.items) || group.items.length === 0) {
    throw new ArtifactSpecError(`${ctx}.items must be a non-empty array`);
  }
  out.items = group.items.map((it, i) => normalizeItem(it, `${ctx}.items[${i}]`));
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeader(spec) };
  if (!Array.isArray(spec.groups) || spec.groups.length === 0) {
    throw new ArtifactSpecError('checklist.groups must be a non-empty array');
  }
  out.groups = spec.groups.map((g, i) => normalizeGroup(g, i));
  return out;
}

function renderLinks(links) {
  if (!links || !links.length) return '';
  const items = links
    .map((l) => `<a class="cc-ck-link" href="${escapeAttr(l.href)}" rel="noopener noreferrer">${escapeHtml(l.text)}</a>`)
    .join('');
  return `<div class="cc-ck-links">${items}</div>`;
}

function renderItem(item, gIdx, iIdx) {
  const id = `cc-ck-${gIdx}-${iIdx}`;
  const detail = item.detail ? `<div class="cc-ck-detail">${renderMarkdown(item.detail)}</div>` : '';
  return `<li class="cc-ck-item"><input type="checkbox" id="${id}" class="cc-ck-box"><label for="${id}" class="cc-ck-text">${escapeHtml(item.text)}</label>${detail}${renderLinks(item.links)}</li>`;
}

function renderGroup(group, gIdx) {
  const summary = group.summary ? `<div class="cc-ck-summary">${renderMarkdown(group.summary)}</div>` : '';
  const items = group.items.map((it, i) => renderItem(it, gIdx, i)).join('');
  const total = group.items.length;
  return `<section class="cc-ck-group" data-ck-total="${total}"><div class="cc-ck-group-head"><h2 class="cc-ck-h">${escapeHtml(group.title)}</h2><span class="cc-ck-count" data-ck-count>0 / ${total}</span></div>${summary}<ul class="cc-ck-items">${items}</ul></section>`;
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-ck-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-ck-meta">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-ck-header"><p class="cc-eyebrow cc-ck-kind">Checklist</p><h1 class="cc-ck-h1">${escapeHtml(spec.title)}</h1>${subtitle}${meta}<p class="cc-ck-note">Checked state is saved in this browser only.</p></header>`;
}

function render(spec) {
  const groups = spec.groups.map(renderGroup).join('');
  const body = `<div class="cc-ck">${renderHeader(spec)}${groups}</div>`;
  return { classname: 'tpl-checklist', body, styleAssets: ['checklist.css'], scriptAssets: ['checklist-runtime.js'] };
}

module.exports = { kind: KIND, validate, render };
