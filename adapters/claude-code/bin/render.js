#!/usr/bin/env node
'use strict';

const path = require('path');
const { sessionArtifactsDir, safeSessionSegment } = require('../lib/paths');
const openLib = require('../lib/open');
const { clickableUrl } = openLib;
const { readJsonStdin, writeFileAtomic } = require('../lib/io');
const { renderMarkdown } = require('../core/lib/index');
const preview = require('../lib/preview');

class RenderError extends Error {
  constructor(message) { super(message); this.name = 'RenderError'; }
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

async function render(input) {
  if (!input || typeof input !== 'object') {
    throw new RenderError('render() requires an input object');
  }
  const sessionId = safeSessionSegment(input.sessionId);
  const turnIndex = clampTurnIndex(input.turnIndex);
  const project = typeof input.project === 'string' ? input.project : '';
  const autoOpen = input.autoOpen === true;
  const trigger = input.trigger === 'manual' ? 'manual' : 'auto';

  const enrichment = (input.enrichment && typeof input.enrichment === 'object') ? input.enrichment : null;
  const result = renderMarkdown(input.markdown, {
    trigger,
    meta: { turnIndex, sessionId, project },
    uiDefaults: input.uiDefaults || null,
    renderThreshold: input.renderThreshold || null,
    enrichment
  });

  if (result.skipped) {
    return { ok: true, skipped: true, reason: result.reason, template: result.template };
  }

  const dir = sessionArtifactsDir(sessionId);
  const filename = `${String(turnIndex).padStart(4, '0')}-${result.template}-${slugify(result.title, 'turn')}.html`;
  const fullPath = path.join(dir, filename);
  writeFileAtomic(fullPath, result.html);

  const enriched = !!(enrichment && (enrichment.tldr || enrichment.graph));
  try {
    preview.writeChunk(sessionId, turnIndex, {
      i: turnIndex,
      title: result.title,
      template: result.template,
      rev: enriched ? 2 : 1,
      enriched,
      final: enriched,
      fragment: result.fragment || ''
    });
  } catch (_err) {
    // archive already on disk; chunk write failure degrades the live preview only.
  }

  let openError = null;
  if (autoOpen) {
    try {
      const previewFile = preview.ensurePreviewHtml(sessionId, input.uiDefaults || null);
      openLib.openInBrowser(previewFile);
    } catch (err) { openError = err.message; }
  }

  return {
    ok: true,
    skipped: false,
    template: result.template,
    reason: result.reason,
    title: result.title,
    path: fullPath,
    url: clickableUrl(fullPath),
    opened: !!autoOpen && !openError,
    openError,
    turnIndex,
    sessionId,
    enriched
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

if (require.main === module) main();

module.exports = { render };
