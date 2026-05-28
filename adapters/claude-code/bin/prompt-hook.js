#!/usr/bin/env node
'use strict';

const { readState } = require('../lib/state');
const { readJsonStdin } = require('../lib/io');
const { appendEvent } = require('../lib/diag');

const CONTRACT_REMINDER = [
  'to-html mode is on. Open substantial replies with `**TL;DR:** <one or two sentences>`.',
  'When the answer has parts that relate (flow, dependencies, comparison, dataflow),',
  'include a fenced ```mermaid block (graph TD or LR) whose node labels match your section headings.'
].join(' ');

async function main() {
  const payload = await readJsonStdin();
  const cwd = (payload && typeof payload.cwd === 'string') ? payload.cwd
    : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const state = readState(cwd);

  if (state.mode !== 'on') {
    appendEvent({ kind: 'prompt', mode: 'off', cwd, note: 'no inject — mode off' });
    process.exit(0);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: CONTRACT_REMINDER
    }
  };
  appendEvent({ kind: 'prompt', mode: 'on', cwd, note: 'contract injected' });
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[to-html] prompt-hook fatal: ${err.message}\n`);
    process.exit(0);
  });
}

module.exports = { CONTRACT_REMINDER };
