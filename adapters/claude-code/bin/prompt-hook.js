#!/usr/bin/env node
'use strict';

const { readState } = require('../lib/state');
const { readJsonStdin } = require('../lib/io');
const { appendEvent } = require('../lib/diag');

async function main() {
  const payload = await readJsonStdin();
  const cwd = (payload && typeof payload.cwd === 'string') ? payload.cwd
    : (process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const state = readState(cwd);
  appendEvent({ kind: 'prompt', mode: state.mode, cwd, note: 'no inject' });
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`[to-html] prompt-hook fatal: ${err.message}\n`);
    process.exit(0);
  });
}

module.exports = {};
