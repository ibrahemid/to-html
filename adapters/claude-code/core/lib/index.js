'use strict';

const { classify, shouldRender } = require('./classifier');
const { composeArtifact } = require('./compose');

const DEFAULT_MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

class RenderMarkdownError extends Error {
  constructor(message) { super(message); this.name = 'RenderMarkdownError'; }
}

function cappedMarkdown(raw, maxBytes) {
  const value = typeof raw === 'string' ? raw : '';
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) return value;
  return value.slice(0, maxBytes) + '\n\n*(content truncated — exceeded markdown size cap)*';
}

function renderMarkdown(markdown, opts = {}) {
  const trigger = opts.trigger === 'manual' ? 'manual' : 'auto';
  const meta = (opts.meta && typeof opts.meta === 'object') ? opts.meta : {};
  const uiDefaults = (opts.uiDefaults && typeof opts.uiDefaults === 'object') ? opts.uiDefaults : null;
  const renderThreshold = (opts.renderThreshold && typeof opts.renderThreshold === 'object') ? opts.renderThreshold : null;
  const maxMarkdownBytes = Number.isFinite(opts.maxMarkdownBytes) ? opts.maxMarkdownBytes : DEFAULT_MAX_MARKDOWN_BYTES;
  const nowIso = typeof opts.nowIso === 'string' ? opts.nowIso : null;
  const titleOverride = typeof opts.titleOverride === 'string' && opts.titleOverride.length > 0 ? opts.titleOverride : null;
  const enrichment = (opts.enrichment && typeof opts.enrichment === 'object') ? opts.enrichment : null;

  const capped = cappedMarkdown(markdown, maxMarkdownBytes);

  if (!capped || !capped.trim()) {
    return {
      html: '', template: 'skip', title: '', reason: 'empty-markdown',
      skipped: true, hasTldr: false, hasGraph: false, sectionCount: 0, fragment: ''
    };
  }

  const classification = classify(capped);
  if (classification.template === 'skip') {
    return {
      html: '', template: 'skip', title: '', reason: classification.reason,
      skipped: true, hasTldr: false, hasGraph: false, sectionCount: 0, fragment: ''
    };
  }

  const sourceMarkdown = classification.source || capped;
  if (trigger !== 'manual') {
    const gate = shouldRender(classification.signals, sourceMarkdown, renderThreshold);
    if (!gate.render) {
      return {
        html: '', template: classification.template, title: '', reason: gate.reason,
        skipped: true, hasTldr: false, hasGraph: false, sectionCount: 0, fragment: ''
      };
    }
  }

  const artifact = composeArtifact({
    markdown: capped,
    classification,
    meta,
    uiDefaults,
    nowIso,
    enrichment
  });

  if (artifact.skipped) {
    return {
      html: '', template: artifact.template || 'skip', title: '', reason: artifact.reason,
      skipped: true, hasTldr: false, hasGraph: false, sectionCount: 0, fragment: ''
    };
  }

  const title = titleOverride != null ? titleOverride : artifact.title;

  return {
    html: artifact.html,
    template: artifact.template,
    title,
    reason: artifact.reason,
    skipped: false,
    hasTldr: artifact.hasTldr,
    hasGraph: artifact.hasGraph,
    sectionCount: artifact.sectionCount,
    fragment: artifact.fragment
  };
}

module.exports = { renderMarkdown, DEFAULT_MAX_MARKDOWN_BYTES, RenderMarkdownError };
