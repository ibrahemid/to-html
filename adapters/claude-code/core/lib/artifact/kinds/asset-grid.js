'use strict';

const { ArtifactSpecError, reqString, optString, normalizeLinks, normalizeHeader } = require('../util');
const { escapeHtml, escapeAttr, isSafeUrl } = require('../../sanitize');

const KIND = 'asset-grid';

function normalizePreview(preview, ctx) {
  if (preview === undefined) return undefined;
  if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
    throw new ArtifactSpecError(`${ctx} must be an object`);
  }
  if (typeof preview.src !== 'string' || !isSafeUrl(preview.src)) return undefined;
  const out = { src: preview.src.trim() };
  const alt = optString(preview.alt);
  if (alt) out.alt = alt;
  return out;
}

function normalizeAsset(asset, idx) {
  const ctx = `assets[${idx}]`;
  if (!asset || typeof asset !== 'object') throw new ArtifactSpecError(`${ctx} must be an object`);
  const out = { name: reqString(asset.name, `${ctx}.name`) };
  const caption = optString(asset.caption);
  if (caption) out.caption = caption;
  const preview = normalizePreview(asset.preview, `${ctx}.preview`);
  if (preview) out.preview = preview;
  const downloads = normalizeLinks(asset.downloads);
  if (downloads.length === 0) {
    throw new ArtifactSpecError(`${ctx}.downloads must include at least one valid link`);
  }
  out.downloads = downloads;
  return out;
}

function validate(spec) {
  const out = { kind: KIND, ...normalizeHeader(spec) };
  if (!Array.isArray(spec.assets) || spec.assets.length === 0) {
    throw new ArtifactSpecError('asset-grid.assets must be a non-empty array');
  }
  out.assets = spec.assets.map((a, i) => normalizeAsset(a, i));
  return out;
}

function renderPreview(preview, name) {
  if (!preview) {
    return `<div class="cc-ag-preview cc-ag-preview-empty" aria-hidden="true"><span>${escapeHtml(name.slice(0, 2).toUpperCase())}</span></div>`;
  }
  const alt = preview.alt ? escapeAttr(preview.alt) : escapeAttr(name);
  return `<div class="cc-ag-preview"><img src="${escapeAttr(preview.src)}" alt="${alt}" loading="lazy"></div>`;
}

function renderDownloads(downloads) {
  const items = downloads
    .map((l) => `<a class="cc-ag-dl" href="${escapeAttr(l.href)}" rel="noopener noreferrer" download>${escapeHtml(l.text)}</a>`)
    .join('');
  return `<div class="cc-ag-dls">${items}</div>`;
}

function renderAsset(asset) {
  const caption = asset.caption ? `<p class="cc-ag-caption">${escapeHtml(asset.caption)}</p>` : '';
  return `<article class="cc-ag-card">${renderPreview(asset.preview, asset.name)}<div class="cc-ag-body"><h2 class="cc-ag-name">${escapeHtml(asset.name)}</h2>${caption}${renderDownloads(asset.downloads)}</div></article>`;
}

function renderHeader(spec) {
  const subtitle = spec.subtitle ? `<p class="cc-ag-sub">${escapeHtml(spec.subtitle)}</p>` : '';
  const metaBits = [];
  if (spec.meta) {
    for (const k of ['project', 'generatedAt', 'note']) {
      if (spec.meta[k]) metaBits.push(escapeHtml(spec.meta[k]));
    }
  }
  const meta = metaBits.length ? `<p class="cc-ag-meta">${metaBits.join(' · ')}</p>` : '';
  return `<header class="cc-ag-header"><h1 class="cc-ag-h1">${escapeHtml(spec.title)}</h1>${subtitle}${meta}</header>`;
}

function render(spec) {
  const cards = spec.assets.map(renderAsset).join('');
  const body = `<div class="cc-ag">${renderHeader(spec)}<div class="cc-ag-grid">${cards}</div></div>`;
  return { classname: 'tpl-asset-grid', body, styleAssets: ['asset-grid.css'], scriptAssets: [] };
}

module.exports = { kind: KIND, validate, render };
