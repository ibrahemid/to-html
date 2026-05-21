'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeHtmlFragment, isSafeUrl, escapeHtml } = require('../lib/sanitize');

test('strips script tags', () => {
  const out = sanitizeHtmlFragment('<p>hi</p><script>alert(1)</script>');
  assert.ok(!out.includes('<script'));
  assert.ok(out.includes('<p>'));
});

test('strips mixed-case SCRIPT', () => {
  const out = sanitizeHtmlFragment('<SCRIPT>x</SCRIPT>');
  assert.ok(!/script/i.test(out));
});

test('strips on* event handlers', () => {
  const out = sanitizeHtmlFragment('<a href="https://x" onclick="evil()">x</a>');
  assert.ok(!out.includes('onclick'));
  assert.ok(out.includes('href="https://x"'));
});

test('rejects javascript: URLs', () => {
  const out = sanitizeHtmlFragment('<a href="javascript:alert(1)">x</a>');
  assert.ok(!out.includes('javascript:'));
});

test('rejects javascript: with whitespace and mixed case', () => {
  assert.equal(isSafeUrl('  JaVaScRiPt:foo'), false);
  assert.equal(isSafeUrl('\t javascript:alert(1)'), false);
});

test('allows safe URL schemes', () => {
  assert.equal(isSafeUrl('https://example.com'), true);
  assert.equal(isSafeUrl('http://example.com'), true);
  assert.equal(isSafeUrl('mailto:a@b.c'), true);
  assert.equal(isSafeUrl('#anchor'), true);
  assert.equal(isSafeUrl('/relative'), true);
  assert.equal(isSafeUrl('data:image/png;base64,aaa'), true);
});

test('rejects data:text/html', () => {
  assert.equal(isSafeUrl('data:text/html,<script>'), false);
});

test('drops unknown tags', () => {
  const out = sanitizeHtmlFragment('<custom-tag>x</custom-tag><iframe></iframe>');
  assert.ok(!out.includes('<custom-tag'));
  assert.ok(!out.includes('<iframe'));
});

test('adds rel=noopener to anchors', () => {
  const out = sanitizeHtmlFragment('<a href="https://x">x</a>');
  assert.ok(out.includes('rel="noopener noreferrer"'));
});

test('strips comments', () => {
  const out = sanitizeHtmlFragment('hi<!-- evil -->bye');
  assert.equal(out, 'hibye');
});

test('escapeHtml handles all dangerous chars', () => {
  assert.equal(escapeHtml('<script>"&\'</script>'), '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
});
