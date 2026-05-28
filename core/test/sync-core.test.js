'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncCore } = require('../../scripts/sync-core');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'to-html-sync-'));
}

function touch(p, body = '') {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

test('sync-core: mirrors core/{lib,vendor,assets} preserving the sibling tree', () => {
  const root = makeTempRoot();
  touch(path.join(root, 'core/lib/a.js'), 'A');
  touch(path.join(root, 'core/lib/templates/dispatch.js'), 'D');
  touch(path.join(root, 'core/vendor/marked.min.js'), 'M');
  touch(path.join(root, 'core/assets/base.css'), 'CSS');
  touch(path.join(root, 'shared/transcript/index.js'), 'I');
  touch(path.join(root, 'shared/transcript/claude-code.js'), 'CC');
  fs.mkdirSync(path.join(root, 'adapters/claude-code'), { recursive: true });

  syncCore({ root, adapter: 'adapters/claude-code' });

  assert.strictEqual(fs.readFileSync(path.join(root, 'adapters/claude-code/core/lib/a.js'), 'utf8'), 'A');
  assert.strictEqual(fs.readFileSync(path.join(root, 'adapters/claude-code/core/lib/templates/dispatch.js'), 'utf8'), 'D');
  assert.strictEqual(fs.readFileSync(path.join(root, 'adapters/claude-code/core/vendor/marked.min.js'), 'utf8'), 'M');
  assert.strictEqual(fs.readFileSync(path.join(root, 'adapters/claude-code/core/assets/base.css'), 'utf8'), 'CSS');
  assert.strictEqual(fs.readFileSync(path.join(root, 'adapters/claude-code/shared/transcript/index.js'), 'utf8'), 'I');
  assert.strictEqual(fs.readFileSync(path.join(root, 'adapters/claude-code/shared/transcript/claude-code.js'), 'utf8'), 'CC');
});

test('sync-core: deletes stale files in destination (mirror semantics)', () => {
  const root = makeTempRoot();
  touch(path.join(root, 'core/lib/keep.js'), 'KEEP');
  touch(path.join(root, 'adapters/claude-code/core/lib/keep.js'), 'KEEP');
  touch(path.join(root, 'adapters/claude-code/core/lib/stale.js'), 'STALE');
  touch(path.join(root, 'adapters/claude-code/core/lib/templates/stale-template.js'), 'STALE');
  touch(path.join(root, 'shared/transcript/index.js'), 'I');
  touch(path.join(root, 'adapters/claude-code/shared/transcript/stale.js'), 'STALE');

  syncCore({ root, adapter: 'adapters/claude-code' });

  assert.ok(fs.existsSync(path.join(root, 'adapters/claude-code/core/lib/keep.js')));
  assert.ok(!fs.existsSync(path.join(root, 'adapters/claude-code/core/lib/stale.js')));
  assert.ok(!fs.existsSync(path.join(root, 'adapters/claude-code/core/lib/templates/stale-template.js')));
  assert.ok(!fs.existsSync(path.join(root, 'adapters/claude-code/shared/transcript/stale.js')));
});

test('sync-core: sibling-tree invariant - lib, vendor, assets are siblings under dest/core', () => {
  const root = makeTempRoot();
  touch(path.join(root, 'core/lib/templates/dispatch.js'), 'D');
  touch(path.join(root, 'core/assets/base.css'), 'CSS');
  touch(path.join(root, 'core/vendor/marked.min.js'), 'M');
  touch(path.join(root, 'shared/transcript/index.js'), 'I');

  syncCore({ root, adapter: 'adapters/claude-code' });

  const destCore = path.join(root, 'adapters/claude-code/core');
  const fromDispatch = path.relative(
    path.dirname(path.join(destCore, 'lib/templates/dispatch.js')),
    path.join(destCore, 'assets')
  );
  assert.strictEqual(fromDispatch, path.join('..', '..', 'assets'));

  const fromMarkdown = path.relative(
    path.dirname(path.join(destCore, 'lib/markdown.js')),
    path.join(destCore, 'vendor')
  );
  assert.strictEqual(fromMarkdown, path.join('..', 'vendor'));
});

test('sync-core: is idempotent (running twice produces identical tree)', () => {
  const root = makeTempRoot();
  touch(path.join(root, 'core/lib/a.js'), 'A');
  touch(path.join(root, 'core/vendor/v.js'), 'V');
  touch(path.join(root, 'core/assets/x.css'), 'X');
  touch(path.join(root, 'shared/transcript/index.js'), 'I');
  fs.mkdirSync(path.join(root, 'adapters/claude-code'), { recursive: true });

  syncCore({ root, adapter: 'adapters/claude-code' });
  const snapshot1 = listAll(path.join(root, 'adapters/claude-code'));
  syncCore({ root, adapter: 'adapters/claude-code' });
  const snapshot2 = listAll(path.join(root, 'adapters/claude-code'));
  assert.deepStrictEqual(snapshot2, snapshot1);
});

function listAll(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push([path.relative(dir, p), fs.readFileSync(p, 'utf8')]);
    }
  })(dir);
  return out.sort();
}
