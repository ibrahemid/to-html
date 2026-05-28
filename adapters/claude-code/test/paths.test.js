'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  safeSessionSegment,
  sessionArtifactsDir,
  artifactsDir,
  SAFE_SESSION_ID_RE
} = require('../lib/paths');

test('safeSessionSegment: passes through safe ids', () => {
  assert.equal(safeSessionSegment('abc-123_xyz'), 'abc-123_xyz');
  assert.equal(safeSessionSegment('a'), 'a');
});

test('safeSessionSegment: hashes unsafe ids', () => {
  const out = safeSessionSegment('../../../etc/passwd');
  assert.ok(out.startsWith('s-'));
  assert.ok(SAFE_SESSION_ID_RE.test(out));
});

test('safeSessionSegment: hashes null/undefined safely', () => {
  assert.ok(safeSessionSegment(null).startsWith('s-'));
  assert.ok(safeSessionSegment(undefined).startsWith('s-'));
});

test('safeSessionSegment: numeric coerced via regex check', () => {
  assert.equal(safeSessionSegment(123), '123');
});

test('safeSessionSegment: rejects ids over 64 chars', () => {
  const long = 'a'.repeat(65);
  assert.ok(safeSessionSegment(long).startsWith('s-'));
});

test('sessionArtifactsDir: stays inside cache root for traversal attempts', () => {
  const dir = sessionArtifactsDir('../../../tmp/evil');
  const root = path.resolve(artifactsDir());
  assert.ok(dir.startsWith(root + path.sep) || dir === root, `dir=${dir} root=${root}`);
});

test('sessionArtifactsDir: stays inside cache root for absolute-path attempt', () => {
  const dir = sessionArtifactsDir('/etc/shadow');
  const root = path.resolve(artifactsDir());
  assert.ok(dir.startsWith(root + path.sep) || dir === root);
});
