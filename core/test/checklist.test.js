'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'checklist-basic.html');

function baseSpec() {
  return {
    kind: 'checklist',
    title: 'Pre-release',
    groups: [{ title: 'Gates', items: [{ text: 'Tests pass' }, { text: 'Lint clean' }] }]
  };
}

test('validateSpec: rejects empty groups and empty items', () => {
  assert.throws(() => validateSpec({ kind: 'checklist', title: 't', groups: [] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'checklist', title: 't', groups: [{ title: 'g', items: [] }] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'checklist', title: 't', groups: [{ title: 'g', items: [{}] }] }), ArtifactSpecError);
});

test('render: deterministic checkbox ids tied to indices', () => {
  const out = assembleArtifact(baseSpec());
  assert.ok(out.html.includes('id="cc-ck-0-0"'));
  assert.ok(out.html.includes('for="cc-ck-0-0"'));
  assert.ok(out.html.includes('id="cc-ck-0-1"'));
});

test('render: includes the localStorage-only note and the runtime', () => {
  const out = assembleArtifact(baseSpec());
  assert.ok(out.html.includes('saved in this browser only'));
  assert.ok(out.html.includes('cc-checklist:'), 'inlines checklist runtime');
});

test('render: escapes content, drops unsafe links', () => {
  const out = assembleArtifact({
    kind: 'checklist',
    title: 'T',
    groups: [{ title: '<b>g</b>', items: [{ text: '<script>alert(1)</script>', links: [{ href: 'javascript:alert(1)', text: 'x' }] }] }]
  });
  assert.ok(out.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!out.html.includes('<script>alert(1)</script>'));
  assert.ok(!out.html.includes('javascript:alert(1)'));
});

test('assembleArtifact: self-contained, deterministic', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'checklist');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html));
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'checklist',
    title: 'Release checklist',
    subtitle: 'run before tagging',
    meta: { project: 'to-html' },
    groups: [
      { title: 'Quality gates', summary: 'All must pass.', items: [
        { text: 'npm test', detail: 'Zero failures across workspaces.' },
        { text: 'npm run lint', detail: 'Zero warnings.', links: [{ href: 'https://example.com/lint', text: 'Rules' }] }
      ] },
      { title: 'Publish', items: [
        { text: 'Sync adapter copies' },
        { text: 'Tag and push' }
      ] }
    ]
  };
  const html = assembleArtifact(spec, { stamp: 'to-html' }).html;
  if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, html);
  }
  assert.strictEqual(html, fs.readFileSync(GOLDEN, 'utf8'));
});
