'use strict';

const { isSafeUrl } = require('../sanitize');

const KNOWN_KINDS = new Set(['dashboard']);
const STATUSES = new Set(['done', 'in_progress', 'pending', 'blocked', 'decision']);

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

function normalizeLink(link) {
  if (!link || typeof link !== 'object') return null;
  if (typeof link.href !== 'string' || !isSafeUrl(link.href)) return null;
  const href = link.href.trim();
  const text = (typeof link.text === 'string' && link.text.trim() !== '') ? link.text.trim() : href;
  return { href, text };
}

function normalizeItem(item, ctx) {
  if (!item || typeof item !== 'object') {
    throw new ArtifactSpecError(`${ctx} must be an object`);
  }
  const out = { label: reqString(item.label, `${ctx}.label`) };
  if (typeof item.status === 'string' && STATUSES.has(item.status)) out.status = item.status;
  if (typeof item.detail === 'string' && item.detail.trim() !== '') out.detail = item.detail;
  if (typeof item.copyPrompt === 'string' && item.copyPrompt !== '') out.copyPrompt = item.copyPrompt;
  const links = Array.isArray(item.links) ? item.links.map(normalizeLink).filter(Boolean) : [];
  if (links.length) out.links = links;
  return out;
}

function normalizeSection(section, idx) {
  const ctx = `sections[${idx}]`;
  if (!section || typeof section !== 'object') {
    throw new ArtifactSpecError(`${ctx} must be an object`);
  }
  const out = { title: reqString(section.title, `${ctx}.title`) };
  if (typeof section.summary === 'string' && section.summary.trim() !== '') out.summary = section.summary;
  const items = Array.isArray(section.items) ? section.items : [];
  out.items = items.map((it, i) => normalizeItem(it, `${ctx}.items[${i}]`));
  return out;
}

// Validate at the boundary: a structurally unusable spec throws ArtifactSpecError;
// soft-bad values (unknown status, unsafe link url) are dropped, never crash.
function validateSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new ArtifactSpecError('spec must be an object');
  }
  const kind = typeof spec.kind === 'string' ? spec.kind : '';
  if (!KNOWN_KINDS.has(kind)) {
    throw new ArtifactSpecError(`unknown artifact kind: ${kind || '(missing)'}`);
  }
  const out = { kind, title: reqString(spec.title, 'title') };
  if (typeof spec.subtitle === 'string' && spec.subtitle.trim() !== '') out.subtitle = spec.subtitle.trim();
  if (spec.meta && typeof spec.meta === 'object' && !Array.isArray(spec.meta)) {
    const meta = {};
    for (const k of ['project', 'generatedAt', 'note']) {
      if (typeof spec.meta[k] === 'string' && spec.meta[k].trim() !== '') meta[k] = spec.meta[k].trim();
    }
    if (Object.keys(meta).length) out.meta = meta;
  }
  if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
    throw new ArtifactSpecError('spec.sections must be a non-empty array');
  }
  out.sections = spec.sections.map((s, i) => normalizeSection(s, i));
  return out;
}

module.exports = { validateSpec, ArtifactSpecError, KNOWN_KINDS, STATUSES };
