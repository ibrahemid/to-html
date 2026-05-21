#!/usr/bin/env node
'use strict';

const { readState } = require('../lib/state');
const { renderPlan } = require('./plan-renderer');

function readHookPayload() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => {
      if (!data.trim()) return resolve({});
      try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
    });
  });
}

function emit(systemMessage) {
  process.stdout.write(JSON.stringify({ systemMessage }));
}

function extractPlanFromExitPlanMode(payload) {
  const input = (payload.tool_input || payload.toolInput || payload.input || {});
  if (typeof input.plan === 'string') return input.plan;
  if (typeof input.markdown === 'string') return input.markdown;
  return null;
}

async function handleExitPlanMode(payload) {
  const planMarkdown = extractPlanFromExitPlanMode(payload);
  if (!planMarkdown) return;

  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const state = readState(cwd);
  if (state.mode !== 'on') return;

  const sessionId = payload.session_id || payload.sessionId || 'unknown';
  try {
    const result = await renderPlan({
      markdown: planMarkdown,
      sessionId,
      cwd,
      project: cwd ? require('path').basename(cwd) : '',
      autoOpen: state.autoOpen === true,
      source: 'exit-plan-mode'
    });
    const tail = result.opened ? ' (opened)' : '';
    emit(`[to-html] plan rendered → ${result.url}${tail}`);
  } catch (err) {
    emit(`[to-html] plan render failed: ${err.message}`);
  }
}

async function main() {
  const payload = await readHookPayload();
  const toolName = payload.tool_name || payload.toolName || '';
  if (toolName === 'ExitPlanMode' || toolName === 'exit_plan_mode') {
    await handleExitPlanMode(payload);
  }
  process.exit(0);
}

main();
