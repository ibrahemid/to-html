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
const { classify } = require('../core/lib/classifier');

const MAX_TRANSCRIPT_LINE_BYTES = 1 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;
const RETRY_DELAY_MS = 500;
const RETRY_MIN_CHARS = 400;
const MAX_RETRIES = 3;
const MAX_LOOKBACK = 12;

const CONTROL_LINE_RE = /^\s*(HTML mode:|Auto-open generated HTML files|\[to-html\b)/i;

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

function stripControlLines(text) {
  return text
    .split('\n')
    .filter((line) => !CONTROL_LINE_RE.test(line))
    .join('\n')
    .trim();
}

function collectAssistantTexts(transcriptPath, maxBytes = MAX_TRANSCRIPT_BYTES) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return [];
  if (!fs.existsSync(transcriptPath)) return [];
  let raw;
  try {
    const size = fs.statSync(transcriptPath).size;
    if (size > maxBytes) {
      const fd = fs.openSync(transcriptPath, 'r');
      try {
        const buf = Buffer.alloc(maxBytes);
        fs.readSync(fd, buf, 0, maxBytes, size - maxBytes);
        raw = buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
      const nl = raw.indexOf('\n');
      if (nl !== -1) raw = raw.slice(nl + 1);
    } else {
      raw = fs.readFileSync(transcriptPath, 'utf8');
    }
  } catch (_) {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, 'utf8') > MAX_TRANSCRIPT_LINE_BYTES) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    if (!obj || obj.type !== 'assistant') continue;
    const msg = obj.message;
    if (!msg || typeof msg !== 'object') continue;
    const text = extractTextFromContent(msg.content);
    if (text && text.trim()) out.push(text);
  }
  return out;
}

// Pick the most recent SUBSTANTIVE assistant message — skipping plugin-control
// chatter (the /to-html toggle status, the auto-open question) and anything the
// classifier would skip. This is what the user was actually looking at when they
// toggled, not the toggle's own reply.
function pickRenderTarget(transcriptPath) {
  const texts = collectAssistantTexts(transcriptPath);
  const total = texts.length;
  const start = Math.max(0, total - MAX_LOOKBACK);
  for (let i = total - 1; i >= start; i--) {
    const stripped = stripControlLines(texts[i]);
    if (!stripped) continue;
    const cls = classify(stripped);
    if (cls.template !== 'skip') {
      return { text: stripped, turnIndex: i + 1, template: cls.template };
    }
  }
  return null;
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

// Resolve the substantive target. CC flushes the final assistant text block to
// the transcript shortly *after* firing the Stop hook, so an early read can miss
// the new reply and surface the previous turn instead. A candidate is "stale" if
// it is empty, too short, or identical to the reply we already rendered
// (lastHash) — the last case means the new reply has not landed yet. Retry a few
// times, accepting the first fresh, substantive read.
async function resolveTarget(transcriptPath, lastHash, opts) {
  const delayMs = opts && Number.isFinite(opts.delayMs) ? opts.delayMs : RETRY_DELAY_MS;
  const maxRetries = opts && Number.isFinite(opts.maxRetries) ? opts.maxRetries : MAX_RETRIES;

  const isStale = (t) =>
    !t || !t.text ||
    t.text.length < RETRY_MIN_CHARS ||
    (lastHash != null && hashText(t.text) === lastHash);

  let best = pickRenderTarget(transcriptPath);
  const firstLen = best && best.text ? best.text.length : 0;
  let retries = 0;

  while (retries < maxRetries && isStale(best)) {
    await sleep(delayMs);
    retries += 1;
    const next = pickRenderTarget(transcriptPath);
    if (!next || !next.text) continue;
    if (!isStale(next)) { best = next; break; }
    if (!best || !best.text || next.text.length > best.text.length) best = next;
  }

  if (!best || !best.text) return { text: null, turnIndex: 0, retries, firstLen };
  return { ...best, retries, firstLen };
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
  const stable = await resolveTarget(transcriptPath, state.lastRenderedTextHash);
  const text = stable.text;
  const turnIndex = stable.turnIndex;

  if (!text || !text.trim()) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, note: 'no substantive text', firstLen: stable.firstLen, retries: stable.retries });
    process.exit(0);
  }

  const textHash = hashText(text);
  if (state.lastRenderedTextHash === textHash) {
    appendEvent({ kind: 'stop', mode: 'on', cwd, note: 'already rendered (same text)', textLen: text.length, retries: stable.retries });
    process.exit(0);
  }

  const sessionId = payload.session_id || payload.sessionId || 'unknown';
  const projectName = cwd ? path.basename(cwd) : '';

  const window = (state.renderThreshold && Number.isFinite(state.renderThreshold.manualToggleWindowMs))
    ? state.renderThreshold.manualToggleWindowMs
    : 8000;
  const modeChangedAt = state.modeChangedAt ? Date.parse(state.modeChangedAt) : 0;
  const isManual = modeChangedAt > 0 && (Date.now() - modeChangedAt) <= window;
  const trigger = isManual ? 'manual' : 'auto';

  const messages = [];

  try {
    const result = await render({
      markdown: text,
      sessionId,
      turnIndex,
      project: projectName,
      autoOpen: state.autoOpen === true,
      trigger,
      renderThreshold: state.renderThreshold,
      uiDefaults: state.uiDefaults
    });
    appendEvent({
      kind: 'stop',
      mode: 'on',
      cwd,
      trigger,
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

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[to-html] stop-hook fatal: ${err.message}\n`);
    process.exit(0);
  });
}

module.exports = { stripControlLines, collectAssistantTexts, pickRenderTarget, resolveTarget, hashText };
