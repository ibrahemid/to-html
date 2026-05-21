#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { sessionArtifactsDir } = require('../lib/paths');
const { extractHtmlSpec, renderMarkdown } = require('../lib/markdown');
const { buildDocument } = require('../lib/template');
const { openInBrowser, clickableUrl } = require('../lib/open');

class RenderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RenderError';
  }
}

function slugify(input, fallback) {
  const base = String(input || fallback || 'turn')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || fallback || 'turn';
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function deriveTitle(markdown) {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) return trimmed.slice(2).trim();
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !trimmed.startsWith('```')) {
      return trimmed.slice(0, 80);
    }
  }
  return 'Claude Code Response';
}

async function render(input) {
  if (!input || typeof input !== 'object') {
    throw new RenderError('render() requires an input object');
  }
  const {
    markdown = '',
    sessionId = 'unknown',
    turnIndex = 0,
    project = '',
    autoOpen = false,
    titleOverride = null
  } = input;

  const { stripped, specs } = extractHtmlSpec(markdown);
  const bodyHtml = renderMarkdown(stripped);
  const title = titleOverride || deriveTitle(stripped);
  const html = buildDocument({
    title,
    bodyHtml,
    specs,
    meta: { turnIndex, sessionId, project }
  });

  const dir = sessionArtifactsDir(sessionId);
  const filename = `${String(turnIndex).padStart(4, '0')}-${slugify(title, 'turn')}.html`;
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, html, 'utf8');

  if (autoOpen) {
    try { openInBrowser(fullPath); } catch (_) {}
  }

  return {
    ok: true,
    path: fullPath,
    url: clickableUrl(fullPath),
    title,
    turnIndex,
    sessionId,
    opened: !!autoOpen
  };
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw.trim()) {
      throw new RenderError('Empty stdin; expected JSON payload');
    }
    const input = JSON.parse(raw);
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

module.exports = { render };
