#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readState, writeState } = require('../lib/state');
const { render } = require('./render');
const { renderPlan } = require('./plan-renderer');
const { readJsonStdin } = require('../lib/io');
const { appendEvent } = require('../lib/diag');

const MAX_TRANSCRIPT_LINE_BYTES = 1 * 1024 * 1024;
const RETRY_DELAY_MS = 600;
const RETRY_MIN_CHARS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashText(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
}

function extractTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n');
}

function findLastAssistantText(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return { text: null, turnIndex: 0 };
  if (!fs.existsSync(transcriptPath)) return { text: null, turnIndex: 0 };
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch (_) {
    return { text: null, turnIndex: 0 };
  }
  const lines = raw.split('\n');
  let lastText = null;
  let assistantCount = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, 'utf8') > MAX_TRANSCRIPT_LINE_BYTES) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    if (!obj || obj.type !== 'assistant') continue;
    const msg = obj.message;
    if (!msg || typeof msg !== 'object') continue;
    const text = extractTextFromContent(msg.content);
    if (text && text.trim()) {
      assistantCount += 1;
      lastText = text;
    }
  }
  return { text: lastText, turnIndex: assistantCount };
}

function planToMarkdownStub(plan) {
  if (!plan || !Array.isArray(plan.phases) || plan.phases.length === 0) return null;
  const out = [`# ${plan.title || 'Plan'}`, ''];
  const map = { pending: ' ', in_progress: '~', completed: 'x', failed: '!' };
  for (const phase of plan.phases) {
    if (!phase || typeof phase !== 'object') continue;
    out.push(`## ${phase.title || 'Phase'}`);
    out.push('');
    for (const note of (Array.isArray(phase.notes) ? phase.notes : [])) {
      if (typeof note === 'string') { out.push(note); out.push(''); }
    }
    for (const task of (Array.isArray(phase.tasks) ? phase.tasks : [])) {
      if (!task || typeof task.text !== 'string') continue;
      out.push(`- [${map[task.status] || ' '}] ${task.text}`);
    }
    out.push('');
  }
  return out.join('\n');
}

async function resolveStableText(transcriptPath) {
  const first = findLastAssistantText(transcriptPath);
  const firstLen = first.text ? first.text.length : 0;
  if (firstLen >= RETRY_MIN_CHARS) {
    return { ...first, retries: 0, firstLen };
  }
  await sleep(RETRY_DELAY_MS);
  const second = findLastAssistantText(transcriptPath);
  const secondLen = second.text ? second.text.length : 0;
  if (secondLen > firstLen) return { ...second, retries: 1, firstLen };
  return { ...second, retries: 1, firstLen };
}

async function main() {
  const payload = await readJsonStdin();
  const cwd = (payload && typeof payload.cwd === 'string') ? payload.cwd
    : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const state = readState(cwd);

  if (state.mode !== 'on') {
    appendEvent({ kind: 'stop', mode: 'off', cwd, note: 'skipped — mode off' });
    process.exit(0);
  }

  const transcriptPath = payload.transcript_path || payload.transcriptPath || null;
  const stable = await resolveStableText(transcriptPath);
  const text = stable.text;
  const turnIndex = stable.turnIndex;

  if (!text || !text.trim()) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, note: 'no assistant text', firstLen: stable.firstLen, retries: stable.retries });
    process.exit(0);
  }

  const textHash = hashText(text);
  if (state.lastRenderedTextHash === textHash) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, note: 'already rendered (same text)', textLen: text.length, retries: stable.retries });
    process.exit(0);
  }

  const sessionId = payload.session_id || payload.sessionId || 'unknown';
  const projectName = cwd ? path.basename(cwd) : '';

  const messages = [];

  try {
    const result = await render({
      markdown: text,
      sessionId,
      turnIndex,
      project: projectName,
      autoOpen: state.autoOpen === true
    });
    appendEvent({
      kind: 'stop',
      mode: 'on',
      cwd,
      template: result.template || (result.skipped ? 'skip' : null),
      skipped: !!result.skipped,
      reason: result.reason,
      textLen: text.length,
      retries: stable.retries
    });
    if (!result.skipped) {
      messages.push(`[to-html · ${result.template}] ${result.url}`);
    }
    if (!result.skipped) {
      writeState(cwd, { lastRenderedTextHash: textHash });
    }
  } catch (err) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, error: err.message, textLen: text.length, retries: stable.retries });
    messages.push(`[to-html] render failed: ${err.message}`);
  }

  if (state.activePlan && state.activePlan.title) {
    const planMarkdown = planToMarkdownStub(state.activePlan);
    if (planMarkdown) {
      try {
        const planResult = await renderPlan({
          markdown: planMarkdown,
          sessionId,
          cwd,
          project: projectName,
          autoOpen: false,
          source: state.activePlan.source || 'plan',
          assistantText: text,
          titleOverride: state.activePlan.title
        });
        messages.push(`[to-html · plan] ${planResult.completed}/${planResult.tasks} ${planResult.url}`);
      } catch (err) {
        messages.push(`[to-html] plan update failed: ${err.message}`);
      }
    }
  }

  if (messages.length === 0) process.exit(0);

  process.stdout.write(JSON.stringify({ systemMessage: messages.join('\n') }));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[to-html] stop-hook fatal: ${err.message}\n`);
  process.exit(0);
});
