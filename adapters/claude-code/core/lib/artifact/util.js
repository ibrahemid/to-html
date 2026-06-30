'use strict';

const { isSafeUrl } = require('../sanitize');

class ArtifactSpecError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArtifactSpecError';
  }
}

function reqString(value, ctx) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ArtifactSpecError(`${ctx} must be a non-empty string`);
  }
  return value.trim();
}

function optString(value) {
  return (typeof value === 'string' && value.trim() !== '') ? value.trim() : undefined;
}

function normalizeLink(link) {
  if (!link || typeof link !== 'object') return null;
  if (typeof link.href !== 'string' || !isSafeUrl(link.href)) return null;
  const href = link.href.trim();
  const text = (typeof link.text === 'string' && link.text.trim() !== '') ? link.text.trim() : href;
  return { href, text };
}

function normalizeLinks(arr) {
  return Array.isArray(arr) ? arr.map(normalizeLink).filter(Boolean) : [];
}

// Shared header fields every kind may carry: title (required), subtitle, meta.
function normalizeHeader(spec) {
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

module.exports = { ArtifactSpecError, reqString, optString, normalizeLink, normalizeLinks, normalizeHeader };
