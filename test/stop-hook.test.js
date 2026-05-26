'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { stripControlLines, collectAssistantTexts, pickRenderTarget, resolveTarget, hashText } = require('../bin/stop-hook');

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

const PREV = '# Previous answer\n\n' + 'Already rendered content. '.repeat(30);
const NEXT = '# New answer\n\n' + 'Freshly flushed substantive content. '.repeat(30);

test('resolveTarget waits past an already-rendered reply for the freshly-flushed one', async () => {
  const file = writeTranscript([user('q1'), assistant(PREV)]);
  const lastHash = hashText(stripControlLines(PREV));
  // Simulate CC flushing the new reply to the transcript just after the hook fires.
  setTimeout(() => {
    fs.appendFileSync(file, '\n' + JSON.stringify(user('q2')) + '\n' + JSON.stringify(assistant(NEXT)));
  }, 60);
  const target = await resolveTarget(file, lastHash, { delayMs: 50, maxRetries: 5 });
  assert.ok(target.text.startsWith('# New answer'), 'should render the new reply, not the already-rendered one');
  assert.ok(target.retries >= 1);
});

test('resolveTarget returns the already-rendered reply when nothing new flushes (caller skips it)', async () => {
  const file = writeTranscript([user('q1'), assistant(PREV)]);
  const lastHash = hashText(stripControlLines(PREV));
  const target = await resolveTarget(file, lastHash, { delayMs: 10, maxRetries: 2 });
  assert.ok(target.text.startsWith('# Previous answer'));
  assert.equal(target.retries, 2);
  assert.equal(hashText(target.text), lastHash);
});

test('resolveTarget returns a fresh substantive reply immediately when no lastHash', async () => {
  const file = writeTranscript([user('q1'), assistant(NEXT)]);
  const target = await resolveTarget(file, null, { delayMs: 10, maxRetries: 2 });
  assert.ok(target.text.startsWith('# New answer'));
  assert.equal(target.retries, 0);
});

test('collectAssistantTexts: caps total bytes and still returns the latest entry', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-th-cap-'));
  const file = path.join(dir, 't.jsonl');
  const filler = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x'.repeat(500) }] } });
  const last = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'LAST-ENTRY' }] } });
  const lines = [];
  for (let i = 0; i < 200; i++) lines.push(filler);
  lines.push(last);
  fs.writeFileSync(file, lines.join('\n') + '\n');
  const out = collectAssistantTexts(file, 2048);
  assert.ok(out.length >= 1);
  assert.ok(out[out.length - 1].includes('LAST-ENTRY'));
});
