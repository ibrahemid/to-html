'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'options-basic.html');

function baseSpec() {
  return {
    kind: 'options',
    title: 'Pick one',
    options: [
      { title: 'A', summary: 'first', pros: ['fast'], cons: ['rough'] },
      { title: 'B', summary: 'second', recommended: true, bullets: ['stable'] }
    ]
  };
}

test('validateSpec: rejects fewer than 2 or more than 4 options', () => {
  assert.throws(() => validateSpec({ kind: 'options', title: 't', options: [{ title: 'a' }] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'options', title: 't', options: Array.from({ length: 5 }, (_, i) => ({ title: `o${i}` })) }), ArtifactSpecError);
});

test('validateSpec: requires option title, normalizes flags and lists', () => {
  assert.throws(() => validateSpec({ kind: 'options', title: 't', options: [{ summary: 'x' }, { title: 'b' }] }), ArtifactSpecError);
  const norm = validateSpec({ kind: 'options', title: 't', options: [{ title: 'a', recommended: 'yes', pros: ['p'] }, { title: 'b' }] });
  assert.strictEqual(norm.options[0].recommended, false);
  assert.deepStrictEqual(norm.options[0].pros, ['p']);
});

test('render: escapes content, marks recommended', () => {
  const out = assembleArtifact({
    kind: 'options',
    title: 'T',
    options: [
      { title: '<script>alert(1)</script>', recommended: true },
      { title: 'B' }
    ]
  });
  assert.ok(out.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!out.html.includes('<script>alert(1)</script>'));
  assert.ok(out.html.includes('cc-opt-rec'));
  assert.ok(out.html.includes('.cc-opt {'), 'inlines options.css');
});

test('assembleArtifact: self-contained, deterministic', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'options');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html));
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'options',
    title: 'Storage approach',
    subtitle: 'pick the path for v1',
    meta: { project: 'to-html' },
    options: [
      { title: 'localStorage', summary: 'Client-only.', pros: ['no backend', 'instant'], cons: ['per-browser'], links: [{ href: 'https://example.com/ls', text: 'Docs' }] },
      { title: 'SQLite file', summary: 'Single file db.', recommended: true, pros: ['durable', 'queryable'], cons: ['needs sync'] },
      { title: 'Remote API', summary: 'Hosted store.', bullets: ['shared state', 'auth required', 'ops cost'] }
    ]
  };
  const html = assembleArtifact(spec, { stamp: 'to-html' }).html;
  if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, html);
  }
  assert.strictEqual(html, fs.readFileSync(GOLDEN, 'utf8'));
});
