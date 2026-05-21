---
description: Alias for /to-html — toggles HTML rendering mode for the conversation.
argument-hint: "[on|off|status|reset]"
allowed-tools: Bash
---

This is an alias for `/to-html`.

Run exactly one Bash call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" toggle "$ARGUMENTS"
```

Then follow the exact same protocol as `/to-html`: if `autoOpen` is `null` after enabling, ask the user once whether to auto-open generated files, persist their answer via `node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" set-auto-open <yes|no>`, then print a single status line and stop.
