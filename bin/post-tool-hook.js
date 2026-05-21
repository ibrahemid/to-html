#!/usr/bin/env node
'use strict';

const path = require('path');
const { readState } = require('../lib/state');
const { renderPlan } = require('./plan-renderer');
const { readJsonStdin } = require('../lib/io');

function emit(systemMessage) {
  process.stdout.write(JSON.stringify({ systemMessage }));
}

function coerceInput(rawInput) {
  if (!rawInput) return {};
  if (typeof rawInput === 'object') return rawInput;
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) { /* fall through */ }
    return { plan: rawInput };
  }
  return {};
}

function extractPlanFromExitPlanMode(payload) {
  const raw = payload.tool_input ?? payload.toolInput ?? payload.input;
  const input = coerceInput(raw);
  if (typeof input.plan === 'string') return input.plan;
  if (typeof input.markdown === 'string') return input.markdown;
  if (typeof input.body === 'string') return input.body;
  return null;
}

async function handleExitPlanMode(payload) {
  const planMarkdown = extractPlanFromExitPlanMode(payload);
  if (!planMarkdown) return;

  const cwd = (typeof payload.cwd === 'string') ? payload.cwd : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const state = readState(cwd);
  if (state.mode !== 'on') return;

  const sessionId = payload.session_id || payload.sessionId || 'unknown';
  try {
    const result = await renderPlan({
      markdown: planMarkdown,
      sessionId,
      cwd,
      project: path.basename(cwd),
      autoOpen: state.autoOpen === true,
      source: 'exit-plan-mode'
    });
    const tail = result.opened ? ' (opened)' : '';
    emit(`[to-html · plan] ${result.completed}/${result.tasks} ${result.url}${tail}`);
  } catch (err) {
    emit(`[to-html] plan render failed: ${err.message}`);
  }
}

async function main() {
  const payload = await readJsonStdin();
  if (!payload || typeof payload !== 'object') {
    process.exit(0);
  }
  const toolName = payload.tool_name || payload.toolName || '';
  if (toolName === 'ExitPlanMode' || toolName === 'exit_plan_mode') {
    await handleExitPlanMode(payload);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[to-html] post-tool-hook fatal: ${err.message}\n`);
  process.exit(0);
});
