#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { readState } = require('../lib/state');
const { render } = require('./render');
const { renderPlan } = require('./plan-renderer');

function readHookPayload() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      if (!data.trim()) return resolve({});
      try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
    });
  });
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
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { text: null, turnIndex: 0 };
  }
  const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n');
  let lastText = null;
  let assistantCount = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    if (obj.type !== 'assistant') continue;
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

async function main() {
  const payload = await readHookPayload();
  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const state = readState(cwd);

  if (state.mode !== 'on') {
    process.exit(0);
  }

  const transcriptPath = payload.transcript_path || payload.transcriptPath || null;
  const { text, turnIndex } = findLastAssistantText(transcriptPath);
  if (!text || !text.trim()) {
    process.exit(0);
  }

  const sessionId = payload.session_id || payload.sessionId || 'unknown';

  const lines = [];
  try {
    const result = await render({
      markdown: text,
      sessionId,
      turnIndex,
      project: cwd ? path.basename(cwd) : '',
      autoOpen: state.autoOpen === true
    });
    lines.push(`[to-html] turn ${turnIndex} → ${result.url}${result.opened ? ' (opened)' : ''}`);
  } catch (err) {
    lines.push(`[to-html] render failed: ${err.message}`);
  }

  if (state.activePlan && state.activePlan.title) {
    try {
      const planResult = await renderPlan({
        markdown: planToMarkdownStub(state.activePlan),
        sessionId,
        cwd,
        project: cwd ? path.basename(cwd) : '',
        autoOpen: false,
        source: state.activePlan.source || 'plan',
        assistantText: text,
        titleOverride: state.activePlan.title
      });
      lines.push(`[to-html] plan ${planResult.completed}/${planResult.tasks} → ${planResult.url}`);
    } catch (err) {
      lines.push(`[to-html] plan update failed: ${err.message}`);
    }
  }

  process.stdout.write(JSON.stringify({ systemMessage: lines.join('\n') }));
  process.exit(0);
}

function planToMarkdownStub(plan) {
  const out = [`# ${plan.title}`, ''];
  const map = { pending: ' ', in_progress: '~', completed: 'x', failed: '!' };
  for (let i = 0; i < plan.phases.length; i++) {
    const phase = plan.phases[i];
    out.push(`## ${phase.title}`);
    out.push('');
    for (const note of (phase.notes || [])) {
      out.push(note);
      out.push('');
    }
    for (const task of phase.tasks) {
      out.push(`- [${map[task.status] || ' '}] ${task.text}`);
    }
    out.push('');
  }
  return out.join('\n');
}

main();
