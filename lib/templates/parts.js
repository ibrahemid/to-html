'use strict';

const { renderMarkdown } = require('../markdown');
const { escapeHtml } = require('../sanitize');
const { renderSvg } = require('../svg-graph');

const THEMES = ['auto', 'light', 'dark', 'sepia'];
const SIZES = ['s', 'm', 'l', 'xl'];
const WIDTHS = ['narrow', 'comfortable', 'wide'];
const FAMILIES = ['sans', 'serif'];

const THEME_LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark', sepia: 'Sepia' };
const SIZE_LABELS = { s: 'S', m: 'M', l: 'L', xl: 'XL' };
const WIDTH_LABELS = { narrow: 'Narrow', comfortable: 'Comfortable', wide: 'Wide' };
const FAMILY_LABELS = { sans: 'Sans', serif: 'Serif' };

function renderTldrBand(tldr) {
  if (!tldr || typeof tldr !== 'string' || !tldr.trim()) return '';
  const inner = renderMarkdown(tldr.trim());
  return `<aside class="cc-tldr" role="note" aria-label="TL;DR">
  <span class="cc-tldr-label">TL;DR</span>
  <div class="cc-tldr-body">${inner}</div>
</aside>`;
}

function renderTocRail(sections) {
  if (!Array.isArray(sections) || sections.length < 2) return '';
  const items = sections.map((s) => {
    const cls = `cc-toc-item cc-toc-l${s.level}`;
    return `<li class="${cls}"><a href="#${escapeHtml(s.slug)}" data-section="${escapeHtml(s.slug)}">${escapeHtml(s.text)}</a></li>`;
  }).join('');
  return `<nav class="cc-toc-rail" aria-label="On this page">
  <ol class="cc-toc-list">${items}</ol>
</nav>`;
}

function renderGraphMap(resolved) {
  if (!resolved || !resolved.graph) return '';
  const totalNodes = resolved.graph.nodes.length;
  const totalEdges = resolved.graph.edges.length;
  const svg = renderSvg(resolved.graph, { sectionMap: resolved.sectionMap });
  return `<figure class="cc-map-figure">
  <div class="cc-map-canvas" data-zoomable="1">${svg}</div>
  <div class="cc-map-controls" role="toolbar" aria-label="Map controls">
    <button type="button" class="cc-map-btn" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" class="cc-map-btn" data-action="zoom-out" aria-label="Zoom out">−</button>
    <button type="button" class="cc-map-btn" data-action="zoom-reset" aria-label="Reset view">⟲</button>
  </div>
  <figcaption class="cc-map-meta">
    <span class="cc-map-stat"><span class="num">${totalNodes}</span><span class="lbl">nodes</span></span>
    <span class="cc-map-stat"><span class="num">${totalEdges}</span><span class="lbl">edges</span></span>
    <span class="cc-map-hint">drag · scroll · click</span>
  </figcaption>
  <aside class="cc-detail-panel" id="cc-detail-panel" hidden aria-live="polite">
    <button type="button" class="cc-detail-close" aria-label="Close detail panel">×</button>
    <div class="cc-detail-body"></div>
  </aside>
</figure>`;
}

function renderMapSection({ graph = null, sections = [] } = {}) {
  if (graph) {
    return `<section class="cc-map cc-map-graph">${renderGraphMap(graph)}</section>`;
  }
  const rail = renderTocRail(sections);
  if (!rail) return '';
  return `<section class="cc-map cc-map-toc">${rail}</section>`;
}

function radioGroup(name, values, labels, current) {
  return values.map((v) => {
    const checked = v === current ? ' checked' : '';
    const id = `cc-${name}-${v}`;
    return `<label class="cc-opt" for="${id}"><input id="${id}" type="radio" name="cc-${name}" value="${v}"${checked}><span>${escapeHtml(labels[v])}</span></label>`;
  }).join('');
}

function renderGearPanel(uiDefaults) {
  const ui = uiDefaults || {};
  const theme = THEMES.includes(ui.theme) ? ui.theme : 'auto';
  const size = SIZES.includes(ui.size) ? ui.size : 'm';
  const width = WIDTHS.includes(ui.width) ? ui.width : 'comfortable';
  const family = FAMILIES.includes(ui.family) ? ui.family : 'sans';

  return `<button type="button" class="cc-gear-toggle" aria-label="Display settings" aria-expanded="false" aria-controls="cc-gear-panel">⚙</button>
<div class="cc-gear-panel" id="cc-gear-panel" hidden role="dialog" aria-label="Display settings">
  <fieldset class="cc-fieldset">
    <legend>Theme</legend>
    <div class="cc-opts">${radioGroup('theme', THEMES, THEME_LABELS, theme)}</div>
  </fieldset>
  <fieldset class="cc-fieldset">
    <legend>Text size</legend>
    <div class="cc-opts">${radioGroup('size', SIZES, SIZE_LABELS, size)}</div>
  </fieldset>
  <fieldset class="cc-fieldset">
    <legend>Width</legend>
    <div class="cc-opts">${radioGroup('width', WIDTHS, WIDTH_LABELS, width)}</div>
  </fieldset>
  <fieldset class="cc-fieldset">
    <legend>Font</legend>
    <div class="cc-opts">${radioGroup('family', FAMILIES, FAMILY_LABELS, family)}</div>
  </fieldset>
  <fieldset class="cc-fieldset">
    <legend>Sections</legend>
    <label class="cc-opt"><input type="checkbox" name="cc-show-tldr" checked><span>TL;DR</span></label>
    <label class="cc-opt"><input type="checkbox" name="cc-show-map" checked><span>Map</span></label>
    <label class="cc-opt"><input type="checkbox" name="cc-show-stepper" checked><span>Stepper</span></label>
  </fieldset>
</div>`;
}

function renderSearch() {
  return `<div class="cc-search" role="search">
  <input type="search" class="cc-search-input" placeholder="Filter sections  ( / )" aria-label="Filter sections">
</div>`;
}

function renderStepper(sections) {
  if (!Array.isArray(sections) || sections.length < 2) return '';
  return `<nav class="cc-stepper" aria-label="Reading order">
  <button type="button" class="cc-step-btn cc-step-prev" aria-label="Previous section">‹</button>
  <span class="cc-step-status">
    <span class="cc-step-pos">1 / ${sections.length}</span>
    <span class="cc-step-title">${escapeHtml(sections[0].text)}</span>
  </span>
  <button type="button" class="cc-step-btn cc-step-next" aria-label="Next section">›</button>
</nav>`;
}

const U2028 = String.fromCharCode(0x2028);
const U2029 = String.fromCharCode(0x2029);

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .split(U2028).join('\\u2028')
    .split(U2029).join('\\u2029');
}

const DECISION_BAR_TEMPLATES = new Set(['plan', 'comparison']);

function renderChrome({ uiDefaults = null, sections = [], template = null } = {}) {
  const decision = DECISION_BAR_TEMPLATES.has(template);
  const list = (!decision && Array.isArray(sections)) ? sections.map((s) => ({ slug: s.slug, text: s.text, level: s.level })) : [];
  const sectionsJson = safeJson(list);
  const search = decision ? '' : renderSearch();
  const stepper = decision ? '' : renderStepper(sections);
  return `<script type="application/json" id="cc-sections">${sectionsJson}</script>
${search}
${renderGearPanel(uiDefaults)}
${stepper}`;
}

module.exports = {
  renderTldrBand,
  renderTocRail,
  renderGraphMap,
  renderMapSection,
  renderGearPanel,
  renderSearch,
  renderStepper,
  renderChrome
};
