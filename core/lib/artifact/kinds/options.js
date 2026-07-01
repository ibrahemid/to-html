'use strict';

const { ArtifactSpecError, reqString, optString, normalizeLinks, normalizeHeader } = require('../util');
const { escapeHtml } = require('../../sanitize');
const { renderMarkdown } = require('../../markdown');

const KIND = 'options';
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

function stringList(arr, ctx) {
  if (arr === undefined) return [];
  if (!Array.isArray(arr)) throw new ArtifactSpecError(`${ctx} must be an array`);
  return arr.map((v, i) => reqString(v, `${ctx}[${i}]`));
}

function normalizeOption(option, idx) {
  const ctx = `options[${idx}]`;
  if (!option || typeof option !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { title: reqString(option.title, `${ctx}.title`) };
  const summary = optString(option.summary);
  if (summary) out.summary = summary;
  out.recommended = option.recommended === true;
  const pros = stringList(option.pros, `${ctx}.pros`);
  const cons = stringList(option.cons, `${ctx}.cons`);
  const bullets = stringList(option.bullets, `${ctx}.bullets`);
  if (pros.length) out.pros = pros;
  if (cons.length) out.cons = cons;
  if (bullets.length) out.bullets = bullets;
  const links = normalizeLinks(option.links);
  if (links.length) out.links = links;
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeader(spec) };
  if (!Array.isArray(spec.options) || spec.options.length < MIN_OPTIONS || spec.options.length > MAX_OPTIONS) {
    throw new ArtifactSpecError(`options.options must have ${MIN_OPTIONS} to ${MAX_OPTIONS} entries`);
  }
  out.options = spec.options.map((o, i) => normalizeOption(o, i));
  return out;
}

function renderList(items, cls) {
  return `<ul class="${cls}">${items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
}

function renderProsCons(option) {
  const blocks = [];
  if (option.pros) {
    blocks.push(`<div class="cc-opt-pane cc-opt-pros"><span class="cc-opt-pane-label">Pros</span>${renderList(option.pros, 'cc-opt-pts')}</div>`);
  }
  if (option.cons) {
    blocks.push(`<div class="cc-opt-pane cc-opt-cons"><span class="cc-opt-pane-label">Cons</span>${renderList(option.cons, 'cc-opt-pts')}</div>`);
  }
  return blocks.length ? `<div class="cc-opt-panes">${blocks.join('')}</div>` : '';
}

function renderLinks(links) {
  if (!links || !links.length) return '';
  const items = links
    .map((l) => `<a class="cc-opt-link" href="${escapeHtml(l.href)}" rel="noopener noreferrer">${escapeHtml(l.text)}</a>`)
    .join('');
  return `<div class="cc-opt-links">${items}</div>`;
}

function renderOption(option, idx) {
  const badge = option.recommended ? '<span class="cc-opt-rec">Recommended</span>' : '';
  const summary = option.summary ? `<div class="cc-opt-summary">${renderMarkdown(option.summary)}</div>` : '';
  const bullets = option.bullets ? renderList(option.bullets, 'cc-opt-bullets') : '';
  const index = String(idx + 1);
  return `<label class="cc-opt"${option.recommended ? ' data-recommended="1"' : ''}>
    <span class="cc-opt-head"><span class="cc-opt-pick"><input type="radio" name="cc-opt-choice" value="${idx}"><span class="cc-opt-index">${index}</span></span><span class="cc-opt-title"><span class="cc-opt-name">${escapeHtml(option.title)}</span>${badge}</span></span>
    ${summary}${renderProsCons(option)}${bullets}${renderLinks(option.links)}
  </label>`;
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-opt-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-opt-meta">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-opt-header"><p class="cc-eyebrow cc-opt-kind">Options</p><h1 class="cc-opt-h1">${escapeHtml(spec.title)}</h1>${subtitle}${meta}</header>`;
}

function render(spec) {
  const cards = spec.options.map(renderOption).join('');
  const body = `<div class="cc-opts">${renderHeader(spec)}<div class="cc-opt-grid" data-count="${spec.options.length}">${cards}</div></div>`;
  return { classname: 'tpl-options', body, styleAssets: ['options.css'], scriptAssets: [] };
}

module.exports = { kind: KIND, validate, render, MIN_OPTIONS, MAX_OPTIONS };
