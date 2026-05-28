#!/usr/bin/env node
'use strict';

const path = require('path');
const { sessionArtifactsDir, safeSessionSegment } = require('../lib/paths');
const { openInBrowser, clickableUrl } = require('../lib/open');
const { readJsonStdin, writeFileAtomic } = require('../lib/io');
const { renderMarkdown } = require('../core/lib/index');

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

  const result = renderMarkdown(input.markdown, {
    trigger,
    meta: { turnIndex, sessionId, project },
    uiDefaults: input.uiDefaults || null,
    renderThreshold: input.renderThreshold || null
  });

  if (result.skipped) {
    return { ok: true, skipped: true, reason: result.reason, template: result.template };
  }

  const dir = sessionArtifactsDir(sessionId);
  const filename = `${String(turnIndex).padStart(4, '0')}-${result.template}-${slugify(result.title, 'turn')}.html`;
  const fullPath = path.join(dir, filename);
  writeFileAtomic(fullPath, result.html);

  let openError = null;
  if (autoOpen) {
    try { openInBrowser(fullPath); } catch (err) { openError = err.message; }
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

if (require.main === module) main();

module.exports = { render };
