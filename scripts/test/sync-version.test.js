'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncVersion } = require('../sync-version');

function makeTempRoot(version) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'to-html-sv-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'to-html-monorepo', version }, null, 2));
  return root;
}

function writePkg(root, rel, body) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(body, null, 2));
}

test('sync-version: writes root version into every target package.json and plugin.json', () => {
  const root = makeTempRoot('2.1.0');
  writePkg(root, 'adapters/claude-code/package.json', { name: 'to-html', version: '0.0.0' });
  writePkg(root, 'adapters/claude-code/.claude-plugin/plugin.json', { name: 'to-html', version: '0.0.0', description: 'x' });
  writePkg(root, 'core/package.json', { name: '@ibrahemid/to-html-core', version: '0.0.0' });
  writePkg(root, 'cli/package.json', { name: '@ibrahemid/to-html', version: '0.0.0' });
  writePkg(root, 'shared/transcript/package.json', { name: '@ibrahemid/to-html-shared-transcript', version: '0.0.0' });

  syncVersion({ root });

  const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
  assert.strictEqual(read('adapters/claude-code/package.json').version, '2.1.0');
  assert.strictEqual(read('adapters/claude-code/.claude-plugin/plugin.json').version, '2.1.0');
  assert.strictEqual(read('core/package.json').version, '2.1.0');
  assert.strictEqual(read('cli/package.json').version, '2.1.0');
  assert.strictEqual(read('shared/transcript/package.json').version, '2.1.0');
});

test('sync-version: is idempotent', () => {
  const root = makeTempRoot('2.1.0');
  writePkg(root, 'adapters/claude-code/package.json', { name: 'to-html', version: '0.0.0' });
  writePkg(root, 'adapters/claude-code/.claude-plugin/plugin.json', { name: 'to-html', version: '0.0.0' });
  writePkg(root, 'core/package.json', { name: 'c', version: '0.0.0' });

  syncVersion({ root });
  const snap1 = fs.readFileSync(path.join(root, 'adapters/claude-code/package.json'), 'utf8');
  syncVersion({ root });
  const snap2 = fs.readFileSync(path.join(root, 'adapters/claude-code/package.json'), 'utf8');
  assert.strictEqual(snap2, snap1);
});

test('sync-version: throws on missing root version', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'to-html-sv-'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x' }));
  assert.throws(() => syncVersion({ root }), /version/);
});
