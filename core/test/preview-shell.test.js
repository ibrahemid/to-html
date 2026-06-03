'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPreviewShell } = require('../lib/preview-shell');

test('buildPreviewShell: self-contained doc with feed mount + inlined poller', () => {
  const html = buildPreviewShell({ uiDefaults: null, title: 'Session preview' });
  assert.ok(/<!doctype html>/i.test(html));
  assert.ok(html.includes('id="cc-feed"'));
  assert.ok(html.includes('preview-runtime') || html.includes('__tohtmlManifest'), 'poller must be inlined');
  assert.ok(!/<script\s+src=/i.test(html), 'shell is self-contained: no external script tags; the poller injects the manifest at runtime');
});

test('buildPreviewShell: applies uiDefaults as root data attributes', () => {
  const html = buildPreviewShell({ uiDefaults: { theme: 'dark', size: 'l' }, title: 'x' });
  assert.ok(html.includes('data-theme="dark"'));
  assert.ok(html.includes('data-size="l"'));
});

test('buildPreviewShell: deterministic for fixed inputs', () => {
  const a = buildPreviewShell({ uiDefaults: { theme: 'sepia' }, title: 'S' });
  const b = buildPreviewShell({ uiDefaults: { theme: 'sepia' }, title: 'S' });
  assert.equal(a, b);
});

test('buildPreviewShell: escapes title (XSS)', () => {
  const html = buildPreviewShell({ uiDefaults: null, title: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('buildPreviewShell: omits unknown uiDefaults keys', () => {
  const html = buildPreviewShell({ uiDefaults: { unknown: 'x', theme: 'light' }, title: 'T' });
  assert.ok(html.includes('data-theme="light"'));
  assert.ok(!html.includes('data-unknown'));
});
