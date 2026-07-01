'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runArtifact, parseArgs, slugify, defaultOutPath } = require('../bin/artifact');
const { ArtifactSpecError } = require('../core/lib/artifact');

let seq = 0;
function tmpOut() {
  seq += 1;
  return path.join(os.tmpdir(), `to-html-test-${process.pid}-${seq}.html`);
}

function dashSpec() {
  return {
    kind: 'dashboard',
    title: 'My status',
    sections: [{ title: 'A', items: [{ label: 'one', status: 'done' }] }]
  };
}

test('runArtifact: writes a self-contained file and reports it', () => {
  const out = tmpOut();
  let opened = null;
  const r = runArtifact({ spec: dashSpec(), out, open: true, openFn: (p) => { opened = p; } });
  assert.strictEqual(r.path, out);
  assert.strictEqual(opened, out, 'opener called with the output path');
  assert.ok(r.url.startsWith('file://'));
  assert.strictEqual(r.kind, 'dashboard');
  const html = fs.readFileSync(out, 'utf8');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<title>My status</title>'));
  assert.ok(html.includes('.cc-dash {'));
  fs.unlinkSync(out);
});

test('runArtifact: --no-open path does not call the opener', () => {
  const out = tmpOut();
  let opened = false;
  runArtifact({ spec: dashSpec(), out, open: false, openFn: () => { opened = true; } });
  assert.strictEqual(opened, false);
  fs.unlinkSync(out);
});

test('runArtifact: invalid spec throws ArtifactSpecError (model can fix)', () => {
  const out = tmpOut();
  assert.throws(() => runArtifact({ spec: { kind: 'nope', title: 't', sections: [] }, out, open: false }), ArtifactSpecError);
  assert.ok(!fs.existsSync(out), 'no file written on invalid spec');
});

test('parseArgs: positional spec, --out, --no-open, --spec', () => {
  assert.deepStrictEqual(parseArgs(['/x/spec.json']), { specFile: '/x/spec.json', out: null, open: true });
  assert.deepStrictEqual(parseArgs(['--spec', '/y.json', '--out', '/z.html', '--no-open']),
    { specFile: '/y.json', out: '/z.html', open: false });
});

test('slugify: safe filename stub from title', () => {
  assert.strictEqual(slugify('Writ: session status!'), 'writ-session-status');
  assert.strictEqual(slugify(''), 'artifact');
  assert.strictEqual(slugify('<<<>>>'), 'artifact');
});

test('defaultOutPath: deterministic when now is provided', () => {
  const p1 = defaultOutPath({ title: 'X' }, 1000);
  const p2 = defaultOutPath({ title: 'X' }, 1000);
  assert.strictEqual(p1, p2);
  assert.ok(p1.endsWith('x-1000.html'));
});
