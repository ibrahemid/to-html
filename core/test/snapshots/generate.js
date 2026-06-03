#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { renderMarkdown } = require('../../lib/index');

const FIXED_OPTS = Object.freeze({
  meta: { turnIndex: 1, sessionId: 'test', project: '' },
  uiDefaults: null,
  nowIso: '2026-05-28T00:00:00.000Z'
});

const FIXED_ENRICHMENT = Object.freeze({
  'enriched': { tldr: 'A fixed deterministic summary for the snapshot.', graph: 'graph TD\n  A[Input] --> B[Process]\n  B --> C[Output]' }
});

function renderFixture(name, markdown) {
  const r = renderMarkdown(markdown, {
    trigger: 'manual',
    meta: FIXED_OPTS.meta,
    uiDefaults: FIXED_OPTS.uiDefaults,
    nowIso: FIXED_OPTS.nowIso,
    enrichment: FIXED_ENRICHMENT[name] || null
  });
  if (r.skipped) return { html: `<!--skip:${r.reason}-->`, template: r.template, skipped: true, reason: r.reason };
  return r;
}

function listFixtures(fixturesDir) {
  const onDisk = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.md'));
  const all = new Map();
  for (const f of onDisk) all.set(f, fs.readFileSync(path.join(fixturesDir, f), 'utf8'));
  return all;
}

function main() {
  const update = process.argv.includes('--update');
  const dir = __dirname;
  const fixturesDir = path.join(dir, 'fixtures');
  const goldenDir = path.join(dir, '__golden__');
  fs.mkdirSync(goldenDir, { recursive: true });

  const out = [];
  for (const [name, body] of listFixtures(fixturesDir)) {
    const artifact = renderFixture(name.replace(/\.md$/, ''), body);
    const html = artifact.skipped ? `<!--skip:${artifact.reason}-->` : artifact.html;
    const target = path.join(goldenDir, name.replace(/\.md$/, '.html'));
    if (update || !fs.existsSync(target)) {
      fs.writeFileSync(target, html);
      out.push(`wrote ${name}`);
    } else {
      out.push(`exists ${name}`);
    }
  }
  process.stdout.write(out.join('\n') + '\n');
}

if (require.main === module) main();

module.exports = { renderFixture, listFixtures, FIXED_OPTS };
