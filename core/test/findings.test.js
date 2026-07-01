'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'findings-basic.html');

function baseSpec() {
  return {
    kind: 'findings',
    title: 'Audit',
    findings: [
      { title: 'Open redirect', severity: 'high', category: 'security', description: 'Unvalidated `next` param.' },
      { title: 'Slow query', severity: 'medium', category: 'perf' }
    ]
  };
}

test('validateSpec: accepts flat findings and grouped findings', () => {
  assert.strictEqual(validateSpec(baseSpec()).groups.length, 1);
  const grouped = validateSpec({
    kind: 'findings', title: 't',
    groups: [{ title: 'Auth', findings: [{ title: 'x' }] }, { title: 'Data', findings: [{ title: 'y' }] }]
  });
  assert.strictEqual(grouped.groups.length, 2);
});

test('validateSpec: rejects missing findings, drops unknown severity', () => {
  assert.throws(() => validateSpec({ kind: 'findings', title: 't' }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'findings', title: 't', findings: [] }), ArtifactSpecError);
  const norm = validateSpec({ kind: 'findings', title: 't', findings: [{ title: 'x', severity: 'banana' }] });
  assert.strictEqual(norm.groups[0].findings[0].severity, undefined);
});

test('render: severity rollup, markdown description, escaped category', () => {
  const out = assembleArtifact({
    kind: 'findings', title: 'T',
    findings: [
      { title: '<script>alert(1)</script>', severity: 'critical', category: '<b>cat</b>', description: 'a **bug**' },
      { title: 'b', severity: 'critical' }
    ]
  });
  assert.ok(out.html.includes('cc-fd-rollup'));
  assert.ok(out.html.includes('2 Critical'));
  assert.ok(out.html.includes('<strong>bug</strong>'));
  assert.ok(out.html.includes('&lt;b&gt;cat&lt;/b&gt;'));
  assert.ok(out.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(out.html.includes('.cc-fd {'), 'inlines findings.css');
});

test('assembleArtifact: self-contained, deterministic', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'findings');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html));
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'findings',
    title: 'Security review',
    subtitle: 'pre-release pass',
    meta: { project: 'to-html', generatedAt: '2026-07-01' },
    groups: [
      { title: 'Input handling', findings: [
        { title: 'Reflected XSS in search', severity: 'critical', category: 'xss', description: 'Query echoed without escaping.', links: [{ href: 'https://example.com/issue/1', text: 'Issue #1' }] },
        { title: 'Missing CSRF token', severity: 'high', category: 'csrf' }
      ] },
      { title: 'Dependencies', findings: [
        { title: 'Outdated marked', severity: 'low', category: 'supply-chain', description: 'Bump to latest.' },
        { title: 'Unused dev dep', severity: 'info', category: 'hygiene' }
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
