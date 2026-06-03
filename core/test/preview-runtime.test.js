'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const P = require(path.join(__dirname, '..', 'assets', 'preview-runtime.js'));

test('nextInterval: tight when pending or version advanced', () => {
  assert.equal(P.nextInterval({ pending: true, advanced: false, current: 3000 }), P.MIN_INTERVAL);
  assert.equal(P.nextInterval({ pending: false, advanced: true, current: 3000 }), P.MIN_INTERVAL);
});

test('nextInterval: backs off when idle, capped at MAX_INTERVAL', () => {
  const a = P.nextInterval({ pending: false, advanced: false, current: P.MIN_INTERVAL });
  assert.ok(a > P.MIN_INTERVAL);
  const b = P.nextInterval({ pending: false, advanced: false, current: P.MAX_INTERVAL });
  assert.equal(b, P.MAX_INTERVAL);
});

test('isTurnPending: false when turn is not pending', () => {
  assert.equal(P.isTurnPending({ i: 1, pending: false }, { knownFinal: {} }), false);
});

test('isTurnPending: true when pending and not known final', () => {
  assert.equal(P.isTurnPending({ i: 2, pending: true }, { knownFinal: {} }), true);
});

test('isTurnPending: false when pending but locally known final (enricher finished)', () => {
  assert.equal(P.isTurnPending({ i: 2, pending: true }, { knownFinal: { 2: true } }), false);
});

test('selectChunksToLoad: new turns + pending turns whose rev not yet rendered', () => {
  const manifest = { version: 5, turns: [{ i: 1, pending: false }, { i: 2, pending: true }, { i: 3, pending: false }] };
  const local = { renderedRev: { 1: 1, 3: 1 }, knownFinal: {} };
  const sel = P.selectChunksToLoad(manifest, local);
  assert.deepEqual(sel.sort(), [2]);
});

test('selectChunksToLoad: loads a brand new turn not seen before', () => {
  const manifest = { version: 6, turns: [{ i: 1, pending: false }, { i: 2, pending: false }] };
  const local = { renderedRev: { 1: 1 }, knownFinal: {} };
  assert.deepEqual(P.selectChunksToLoad(manifest, local), [2]);
});

test('selectChunksToLoad: locally-final turn is NOT re-fetched even if manifest still pending', () => {
  const manifest = { version: 7, turns: [{ i: 2, pending: true }] };
  const local = { renderedRev: { 2: 2 }, knownFinal: { 2: true } };
  assert.deepEqual(P.selectChunksToLoad(manifest, local), []);
});

test('shouldBackstopReload: true only after BACKSTOP_MS pending locally', () => {
  assert.equal(P.shouldBackstopReload({ pendingSince: 1000 }, 1000 + P.BACKSTOP_MS - 1), false);
  assert.equal(P.shouldBackstopReload({ pendingSince: 1000 }, 1000 + P.BACKSTOP_MS + 1), true);
  assert.equal(P.shouldBackstopReload({ pendingSince: null }, 9e9), false);
});

test('scrollStashKey: stable per session path', () => {
  assert.equal(P.scrollStashKey('/x/preview.html'), P.scrollStashKey('/x/preview.html'));
});
