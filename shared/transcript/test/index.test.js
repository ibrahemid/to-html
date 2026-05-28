'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { getAdapter } = require('..');

test('getAdapter("claude-code") returns the CC parser module', () => {
  const a = getAdapter('claude-code');
  assert.strictEqual(typeof a.extractTextFromContent, 'function');
  assert.strictEqual(typeof a.collectAssistantTexts, 'function');
  assert.strictEqual(typeof a.stripControlLines, 'function');
  assert.strictEqual(typeof a.hashText, 'function');
  assert.strictEqual(typeof a.isStale, 'function');
});

test('getAdapter throws on unknown adapter name', () => {
  assert.throws(() => getAdapter('codex'), /unknown/);
});
