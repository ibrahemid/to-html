'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { stripControlLines, collectAssistantTexts, pickRenderTarget } = require('../bin/stop-hook');

function writeTranscript(lines) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-to-html-tx-'));
  const file = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n'), 'utf8');
  return file;
}

function assistant(text) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

function user(text) {
  return { type: 'user', message: { role: 'user', content: text } };
}

test('stripControlLines removes HTML mode status lines', () => {
  const out = stripControlLines('HTML mode: ON · auto-open: yes · artifacts → ~/x\n\nReal content here.');
  assert.equal(out, 'Real content here.');
});

test('stripControlLines removes the auto-open question', () => {
  const out = stripControlLines('Auto-open generated HTML files in your browser? (yes/no)');
  assert.equal(out, '');
});

test('stripControlLines removes [to-html ...] echoes', () => {
  const out = stripControlLines('[to-html · prose] file:///x\nkeep this');
  assert.equal(out, 'keep this');
});

test('pickRenderTarget skips the toggle status turn and returns prior substantive reply', () => {
  const big = '# Gap analysis\n\n' + 'Detailed substantive content. '.repeat(20)
    + '\n\n## Section\n\nMore.';
  const file = writeTranscript([
    user('whats left?'),
    assistant(big),
    user('/to-html'),
    assistant('HTML mode: ON · auto-open: yes · artifacts → ~/Library/Caches/cc-to-html')
  ]);
  const target = pickRenderTarget(file);
  assert.ok(target, 'should find a target');
  assert.ok(target.text.startsWith('# Gap analysis'), 'renders the substantive reply, not the status');
  assert.ok(!/HTML mode:/.test(target.text));
});

test('pickRenderTarget skips the auto-open Q&A turn too', () => {
  const big = '# Plan\n\n## Phase 1: A\n\n- [ ] one\n- [ ] two\n\n## Phase 2: B\n\n- [ ] three';
  const file = writeTranscript([
    assistant(big),
    user('/to-html'),
    assistant('HTML mode: ON · auto-open: unset'),
    user('yes'),
    assistant('HTML mode: ON · auto-open: yes · artifacts → ~/x')
  ]);
  const target = pickRenderTarget(file);
  assert.ok(target);
  assert.ok(target.text.startsWith('# Plan'));
  assert.equal(target.template, 'plan');
});

test('pickRenderTarget returns null when only control chatter exists', () => {
  const file = writeTranscript([
    user('/to-html'),
    assistant('HTML mode: ON · auto-open: yes · artifacts → ~/x')
  ]);
  assert.equal(pickRenderTarget(file), null);
});

test('pickRenderTarget returns latest substantive when multiple exist', () => {
  const a = '# First\n\n' + 'content one. '.repeat(30);
  const b = '# Second\n\n' + 'content two. '.repeat(30);
  const file = writeTranscript([
    assistant(a),
    user('more'),
    assistant(b),
    user('/to-html'),
    assistant('HTML mode: ON · auto-open: yes')
  ]);
  const target = pickRenderTarget(file);
  assert.ok(target.text.startsWith('# Second'));
});

test('collectAssistantTexts ignores tool-only and user lines', () => {
  const file = writeTranscript([
    user('hi'),
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: {} }] } },
    assistant('Real text.')
  ]);
  const texts = collectAssistantTexts(file);
  assert.equal(texts.length, 1);
  assert.equal(texts[0], 'Real text.');
});
