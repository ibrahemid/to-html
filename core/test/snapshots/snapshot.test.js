'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderFixture, listFixtures } = require('./generate');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const GOLDEN_DIR = path.join(__dirname, '__golden__');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

for (const [name, body] of listFixtures(FIXTURES_DIR)) {
  test(`snapshot: ${name}`, () => {
    const artifact = renderFixture(name.replace(/\.md$/, ''), body);
    const html = artifact.skipped ? `<!--skip:${artifact.reason}-->` : artifact.html;
    const golden = fs.readFileSync(path.join(GOLDEN_DIR, name.replace(/\.md$/, '.html')), 'utf8');
    assert.strictEqual(sha256(html), sha256(golden), `snapshot diverged for ${name}: regenerate with: node core/test/snapshots/generate.js --update`);
  });
}
