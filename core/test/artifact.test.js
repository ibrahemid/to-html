'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'dashboard-basic.html');

function baseSpec() {
  return { kind: 'dashboard', title: 'Status', sections: [{ title: 'A', items: [{ label: 'one' }] }] };
}

test('validateSpec: rejects unknown / missing kind', () => {
  assert.throws(() => validateSpec({ kind: 'nope', title: 't', sections: [{ title: 's', items: [] }] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ title: 't', sections: [{ title: 's', items: [] }] }), ArtifactSpecError);
});

test('validateSpec: rejects missing/empty title', () => {
  assert.throws(() => validateSpec({ kind: 'dashboard', sections: [{ title: 's', items: [] }] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'dashboard', title: '   ', sections: [{ title: 's', items: [] }] }), ArtifactSpecError);
});

test('validateSpec: rejects empty/absent sections', () => {
  assert.throws(() => validateSpec({ kind: 'dashboard', title: 't', sections: [] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'dashboard', title: 't' }), ArtifactSpecError);
});

test('validateSpec: rejects section without title and item without label', () => {
  assert.throws(() => validateSpec({ kind: 'dashboard', title: 't', sections: [{ items: [] }] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'dashboard', title: 't', sections: [{ title: 's', items: [{ status: 'done' }] }] }), ArtifactSpecError);
});

test('validateSpec: drops unsafe link, unknown status; keeps safe link', () => {
  const norm = validateSpec({
    kind: 'dashboard',
    title: 't',
    sections: [{ title: 's', items: [{
      label: 'x',
      status: 'banana',
      links: [{ href: 'javascript:alert(1)' }, { href: 'https://example.com', text: 'ok' }]
    }] }]
  });
  const item = norm.sections[0].items[0];
  assert.strictEqual(item.status, undefined);
  assert.strictEqual(item.links.length, 1);
  assert.strictEqual(item.links[0].href, 'https://example.com');
  assert.strictEqual(item.links[0].text, 'ok');
});

test('assembleArtifact: returns a self-contained document', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'dashboard');
  assert.strictEqual(out.title, 'Status');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(out.html.includes('<title>Status</title>'));
  assert.ok(out.html.includes('.cc-dash {'), 'inlines dashboard.css');
  assert.ok(out.html.includes('.cc-copy-btn'), 'inlines runtime');
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html), 'no external http assets');
});

test('assembleArtifact: escapes untrusted content and drops unsafe urls', () => {
  const out = assembleArtifact({
    kind: 'dashboard',
    title: 'T',
    sections: [{ title: 'S', items: [
      { label: '<script>alert(1)</script>', links: [{ href: 'javascript:alert(1)', text: 'x' }] }
    ] }]
  });
  assert.ok(out.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!out.html.includes('<script>alert(1)</script>'));
  assert.ok(!out.html.includes('javascript:alert(1)'));
});

test('assembleArtifact: renders a status rollup from item statuses', () => {
  const out = assembleArtifact({
    kind: 'dashboard',
    title: 'T',
    sections: [{ title: 'S', items: [
      { label: 'a', status: 'done' }, { label: 'b', status: 'decision' }
    ] }]
  });
  assert.ok(out.html.includes('cc-dash-rollup'));
  assert.ok(out.html.includes('1 Needs you'));
  assert.ok(out.html.includes('1 Done'));
});

test('assembleArtifact: deterministic for identical input', () => {
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'dashboard',
    title: 'Writ: session status',
    subtitle: 'two need you',
    meta: { project: 'writ', generatedAt: '2026-06-30', note: 'swept' },
    sections: [
      { title: 'In flight', summary: 'live work', items: [
        { label: 'Port command system', status: 'in_progress', detail: 'on a branch', links: [{ href: 'https://example.com/pr/3', text: 'PR #3' }] }
      ] },
      { title: 'Next', items: [
        { label: 'Run release', status: 'decision', copyPrompt: '/release patch' },
        { label: 'Shipped', status: 'done' }
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
