'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'report-basic.html');

function baseSpec() {
  return {
    kind: 'report',
    title: 'Report',
    sections: [{ title: 'A', table: { columns: ['Name', 'Value'], rows: [['x', '1']] } }]
  };
}

test('validateSpec: rejects empty sections', () => {
  assert.throws(() => validateSpec({ kind: 'report', title: 't', sections: [] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'report', title: 't' }), ArtifactSpecError);
});

test('validateSpec: rejects table without columns and pads short rows', () => {
  assert.throws(() => validateSpec({ kind: 'report', title: 't', sections: [{ title: 's', table: { columns: [], rows: [] } }] }), ArtifactSpecError);
  const norm = validateSpec({ kind: 'report', title: 't', sections: [{ title: 's', table: { columns: ['a', 'b', 'c'], rows: [['1'], [1, 2, 3, 4]] } }] });
  assert.deepStrictEqual(norm.sections[0].table.rows[0], ['1', '', '']);
  assert.deepStrictEqual(norm.sections[0].table.rows[1], ['1', '2', '3']);
});

test('validateSpec: drops unsafe links, keeps safe', () => {
  const norm = validateSpec({
    kind: 'report',
    title: 't',
    sections: [{ title: 's', links: [{ href: 'javascript:alert(1)' }, { href: 'https://x.test', text: 'ok' }] }]
  });
  assert.strictEqual(norm.sections[0].links.length, 1);
  assert.strictEqual(norm.sections[0].links[0].href, 'https://x.test');
});

test('render: escapes cells and drops unsafe urls', () => {
  const out = assembleArtifact({
    kind: 'report',
    title: 'T',
    sections: [{ title: 'S', table: { columns: ['<th>'], rows: [['<script>alert(1)</script>']] }, links: [{ href: 'javascript:alert(1)', text: 'x' }] }]
  });
  assert.ok(out.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(out.html.includes('&lt;th&gt;'));
  assert.ok(!out.html.includes('<script>alert(1)</script>'));
  assert.ok(!out.html.includes('javascript:alert(1)'));
});

test('render: styled variant inlines report.css', () => {
  const out = assembleArtifact(baseSpec());
  assert.ok(out.html.includes('.cc-rep {'));
  assert.ok(out.html.includes('cc-rep-tablewrap'));
});

test('render: plain variant drops report.css and emits a bare table', () => {
  const out = assembleArtifact({ ...baseSpec(), plain: true });
  assert.ok(!out.html.includes('.cc-rep {'), 'no report.css inlined');
  assert.ok(!out.html.includes('cc-rep-tablewrap'), 'no styled wrapper classes');
  assert.ok(out.html.includes('<table><thead>'), 'bare html table present');
  assert.ok(out.html.includes('<h1>Report</h1>'));
});

test('assembleArtifact: self-contained, no external assets', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'report');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html));
});

test('assembleArtifact: deterministic', () => {
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'report',
    title: 'Dependency report',
    subtitle: 'three packages flagged',
    meta: { project: 'to-html', generatedAt: '2026-07-01', note: 'weekly sweep' },
    sections: [
      {
        title: 'Outdated',
        summary: 'Bumps available this week.',
        table: { columns: ['Package', 'Current', 'Latest'], rows: [['marked', '9.1.0', '12.0.0'], ['node', '18', '22']] },
        links: [{ href: 'https://example.com/changelog', text: 'Changelog' }]
      },
      { title: 'References', links: [{ href: 'https://example.com/policy', text: 'Update policy' }] }
    ]
  };
  const html = assembleArtifact(spec, { stamp: 'to-html' }).html;
  if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, html);
  }
  assert.strictEqual(html, fs.readFileSync(GOLDEN, 'utf8'));
});
