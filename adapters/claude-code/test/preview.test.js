'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.XDG_CACHE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-preview-'));

const preview = require('../lib/preview');
const { manifestPath, chunkPath } = require('../lib/paths');

const SID = 'sess-preview';

test('writeChunk: emits JSONP that survives a </script> in the fragment', () => {
  preview.writeChunk(SID, 2, { i: 2, title: 'T', template: 'prose', rev: 1, fragment: '<p></script><b>x</b></p>' });
  const raw = fs.readFileSync(chunkPath(SID, 2), 'utf8');
  assert.ok(raw.startsWith('window.__tohtmlChunk('));
  assert.ok(!raw.includes('</script>'), 'must escape the closing script tag');
});

test('writeChunk: emits JSONP that escapes U+2028/U+2029 line separators', () => {
  preview.writeChunk(SID, 3, { i: 3, title: 'L', template: 'prose', rev: 1, fragment: 'A B C' });
  const raw = fs.readFileSync(chunkPath(SID, 3), 'utf8');
  assert.ok(!/[\u2028\u2029]/.test(raw), 'must escape line/paragraph separators');
});

test('readChunk: round-trips a written chunk (fragment with </script> survives)', () => {
  preview.writeChunk(SID, 5, { i: 5, title: 'Round', template: 'prose', rev: 1, enriched: false, fragment: '<p></script>ok</p>' });
  const back = preview.readChunk(SID, 5);
  assert.equal(back.i, 5);
  assert.equal(back.rev, 1);
  assert.equal(back.fragment, '<p></script>ok</p>');
});

test('readChunk: missing chunk -> null', () => {
  assert.equal(preview.readChunk(SID, 999), null);
});

test('updateManifest: monotonic version + upsert turn', () => {
  const a = preview.updateManifest(SID, { turnIndex: 1, pending: true, nowIso: '2026-05-28T00:00:00.000Z' });
  const b = preview.updateManifest(SID, { turnIndex: 2, pending: false, nowIso: '2026-05-28T00:00:01.000Z' });
  assert.ok(b.version > a.version);
  const raw = fs.readFileSync(manifestPath(SID), 'utf8');
  assert.ok(raw.startsWith('window.__tohtmlManifest('));
  assert.ok(raw.includes('"i":1'));
  assert.ok(raw.includes('"i":2'));
});

test('updateManifest: re-marking a turn updates pending without duplicating it', () => {
  preview.updateManifest(SID, { turnIndex: 1, pending: true, nowIso: '2026-05-28T00:00:02.000Z' });
  const c = preview.updateManifest(SID, { turnIndex: 1, pending: false, nowIso: '2026-05-28T00:00:03.000Z' });
  const ones = c.turns.filter((t) => t.i === 1);
  assert.equal(ones.length, 1);
  assert.equal(ones[0].pending, false);
});

test('ensurePreviewHtml: writes once, idempotent', () => {
  const sid2 = 'sess-ensure';
  const p1 = preview.ensurePreviewHtml(sid2, { theme: 'dark' });
  const m1 = fs.statSync(p1).mtimeMs;
  const p2 = preview.ensurePreviewHtml(sid2, { theme: 'dark' });
  assert.equal(p1, p2);
  assert.equal(fs.statSync(p2).mtimeMs, m1, 'must not rewrite if present');
});
