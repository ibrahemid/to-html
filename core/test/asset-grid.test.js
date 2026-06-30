'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { assembleArtifact, validateSpec, ArtifactSpecError } = require('../lib/artifact');

const GOLDEN = path.join(__dirname, 'snapshots', '__golden__', 'asset-grid-basic.html');
const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

function baseSpec() {
  return {
    kind: 'asset-grid',
    title: 'Brand assets',
    assets: [
      { name: 'Logo', downloads: [{ href: 'https://example.com/logo.svg', text: 'SVG' }] },
      { name: 'Icon', preview: { src: PIXEL, alt: 'app icon' }, downloads: [{ href: 'https://example.com/icon.png', text: 'PNG' }] }
    ]
  };
}

test('validateSpec: rejects empty assets and assets without valid downloads', () => {
  assert.throws(() => validateSpec({ kind: 'asset-grid', title: 't', assets: [] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'asset-grid', title: 't', assets: [{ name: 'a' }] }), ArtifactSpecError);
  assert.throws(() => validateSpec({ kind: 'asset-grid', title: 't', assets: [{ name: 'a', downloads: [{ href: 'javascript:alert(1)' }] }] }), ArtifactSpecError);
});

test('validateSpec: keeps safe preview src, drops unsafe one', () => {
  const norm = validateSpec({
    kind: 'asset-grid', title: 't',
    assets: [
      { name: 'a', preview: { src: PIXEL }, downloads: [{ href: 'https://x.test/a', text: 'd' }] },
      { name: 'b', preview: { src: 'javascript:alert(1)' }, downloads: [{ href: 'https://x.test/b', text: 'd' }] }
    ]
  });
  assert.strictEqual(norm.assets[0].preview.src, PIXEL);
  assert.strictEqual(norm.assets[1].preview, undefined);
});

test('render: escapes content, renders preview image, drops unsafe download', () => {
  const out = assembleArtifact({
    kind: 'asset-grid', title: 'T',
    assets: [{ name: '<script>alert(1)</script>', preview: { src: PIXEL, alt: '"x"' }, downloads: [{ href: 'https://x.test/a', text: 'ok' }, { href: 'javascript:alert(1)', text: 'bad' }] }]
  });
  assert.ok(out.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(out.html.includes(`src="${PIXEL}"`));
  assert.ok(out.html.includes('alt="&quot;x&quot;"'));
  assert.ok(!out.html.includes('javascript:alert(1)'));
  assert.ok(out.html.includes('.cc-ag {'), 'inlines asset-grid.css');
});

test('assembleArtifact: self-contained, deterministic', () => {
  const out = assembleArtifact(baseSpec());
  assert.strictEqual(out.kind, 'asset-grid');
  assert.ok(out.html.startsWith('<!doctype html>'));
  assert.ok(!/<(?:link|script)[^>]+(?:src|href)=["']https?:/.test(out.html));
  const a = assembleArtifact(baseSpec(), { stamp: 'x' });
  const b = assembleArtifact(baseSpec(), { stamp: 'x' });
  assert.strictEqual(a.html, b.html);
});

test('assembleArtifact: matches golden snapshot', () => {
  const spec = {
    kind: 'asset-grid',
    title: 'Press kit',
    subtitle: 'logos and screenshots',
    meta: { project: 'to-html' },
    assets: [
      { name: 'Wordmark', caption: 'SVG and PNG', downloads: [{ href: 'https://example.com/wordmark.svg', text: 'SVG' }, { href: 'https://example.com/wordmark.png', text: 'PNG' }] },
      { name: 'App icon', caption: '512px', preview: { src: PIXEL, alt: 'app icon' }, downloads: [{ href: 'https://example.com/icon.png', text: 'PNG' }] },
      { name: 'Screenshot', downloads: [{ href: 'https://example.com/shot.png', text: 'Download' }] }
    ]
  };
  const html = assembleArtifact(spec, { stamp: 'to-html' }).html;
  if (process.env.UPDATE_GOLDEN === '1' || !fs.existsSync(GOLDEN)) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, html);
  }
  assert.strictEqual(html, fs.readFileSync(GOLDEN, 'utf8'));
});
