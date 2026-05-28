#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { composeArtifact } = require('../../lib/compose');
const { classify } = require('../../lib/classifier');

const FIXED_OPTS = Object.freeze({
  meta: { turnIndex: 1, sessionId: 'test', project: '' },
  uiDefaults: null,
  nowIso: '2026-05-28T00:00:00.000Z'
});

function renderFixture(markdown) {
  const cls = classify(markdown);
  if (cls.template === 'skip') return { html: `<!--skip:${cls.reason}-->`, template: 'skip', skipped: true, reason: cls.reason };
  return composeArtifact({
    markdown,
    classification: cls,
    meta: FIXED_OPTS.meta,
    uiDefaults: FIXED_OPTS.uiDefaults,
    nowIso: FIXED_OPTS.nowIso
  });
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
    const artifact = renderFixture(body);
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
