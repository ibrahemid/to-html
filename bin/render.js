#!/usr/bin/env node
'use strict';

const path = require('path');
const { sessionArtifactsDir, safeSessionSegment } = require('../lib/paths');
const { classify, shouldRender } = require('../lib/classifier');
const { dispatchRender } = require('../lib/templates/dispatch');
const { extractSummary } = require('../lib/summary');
const { buildSectionIndex } = require('../lib/section-index');
const { resolveGraph } = require('../lib/graph-source');
const { renderTldrBand, renderMapSection, renderChrome } = require('../lib/templates/parts');
const { openInBrowser, clickableUrl } = require('../lib/open');
const { readJsonStdin, writeFileAtomic } = require('../lib/io');

const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

class RenderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RenderError';
  }
}

function slugify(input, fallback) {
  const base = String(input == null ? '' : input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || fallback || 'turn';
}

function clampTurnIndex(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function cappedMarkdown(raw) {
  const value = typeof raw === 'string' ? raw : '';
  if (Buffer.byteLength(value, 'utf8') <= MAX_MARKDOWN_BYTES) return value;
  return value.slice(0, MAX_MARKDOWN_BYTES) + '\n\n*(content truncated — exceeded markdown size cap)*';
}

async function render(input) {
  if (!input || typeof input !== 'object') {
    throw new RenderError('render() requires an input object');
  }

  const markdown = cappedMarkdown(input.markdown);
  const sessionId = safeSessionSegment(input.sessionId);
  const turnIndex = clampTurnIndex(input.turnIndex);
  const project = typeof input.project === 'string' ? input.project : '';
  const autoOpen = input.autoOpen === true;
  const trigger = input.trigger === 'manual' ? 'manual' : 'auto';
  const renderThreshold = (input.renderThreshold && typeof input.renderThreshold === 'object')
    ? input.renderThreshold
    : null;

  if (!markdown || !markdown.trim()) {
    return { ok: true, skipped: true, reason: 'empty-markdown' };
  }

  const classification = classify(markdown);

  if (classification.template === 'skip') {
    return { ok: true, skipped: true, reason: classification.reason };
  }

  const sourceMarkdown = classification.source || markdown;

  if (trigger !== 'manual') {
    const gate = shouldRender(classification.signals, sourceMarkdown, renderThreshold);
    if (!gate.render) {
      return { ok: true, skipped: true, reason: gate.reason, template: classification.template };
    }
  }

  const { tldr, body: bodyAfterTldr } = extractSummary(sourceMarkdown);
  const { sections, annotatedMarkdown } = buildSectionIndex(bodyAfterTldr);
  const resolvedGraph = resolveGraph(annotatedMarkdown, sections);
  const tldrHtml = renderTldrBand(tldr);
  const mapHtml = renderMapSection({ graph: resolvedGraph, sections });
  const uiDefaults = (input.uiDefaults && typeof input.uiDefaults === 'object') ? input.uiDefaults : null;
  const chromeHtml = renderChrome({ uiDefaults, sections });

  const rendered = dispatchRender({
    template: classification.template,
    markdown: annotatedMarkdown,
    meta: { turnIndex, sessionId, project },
    signals: classification.signals,
    override: classification.override,
    tldrHtml,
    mapHtml,
    chromeHtml,
    uiDefaults
  });

  const dir = sessionArtifactsDir(sessionId);
  const filename = `${String(turnIndex).padStart(4, '0')}-${classification.template}-${slugify(rendered.title, 'turn')}.html`;
  const fullPath = path.join(dir, filename);
  writeFileAtomic(fullPath, rendered.html);

  let openError = null;
  if (autoOpen) {
    try { openInBrowser(fullPath); } catch (err) { openError = err.message; }
  }

  return {
    ok: true,
    skipped: false,
    template: classification.template,
    reason: classification.reason,
    title: rendered.title,
    path: fullPath,
    url: clickableUrl(fullPath),
    opened: !!autoOpen && !openError,
    openError,
    turnIndex,
    sessionId
  };
}

async function main() {
  try {
    const input = await readJsonStdin();
    if (!input || Object.keys(input).length === 0) {
      throw new RenderError('Empty stdin; expected JSON payload');
    }
    const result = await render(input);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ ok: false, error: `${err.name || 'Error'}: ${err.message}` }, null, 2) + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { render, MAX_MARKDOWN_BYTES };
