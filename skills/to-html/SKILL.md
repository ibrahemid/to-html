---
name: to-html
description: Toggle HTML rendering mode for the conversation. When on, every substantive assistant reply is also written to a self-contained HTML file that opens in the browser. Use when the user types /to-html, /html, "turn on html mode", "render this as html", "open this in browser", or wants to read agent output visually instead of in the terminal.
---

The user invoked `/to-html`. Toggle the project-scoped HTML rendering mode.

Run exactly one Bash call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" toggle
```

The script flips state and writes JSON to stdout:

```json
{
  "ok": true,
  "mode": "on" | "off",
  "autoOpen": true | false | null,
  "changed": true,
  "message": "<status line>"
}
```

After the call:

1. If `mode` is `on` and `autoOpen` is `null`, ask the user **once**: `Auto-open generated HTML files in your browser? (yes/no)`. When they answer, run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" set-auto-open "<yes|no>"
   ```

2. Print the `message` field as a single line. Nothing else. No headers, no commentary, no closing summary.

When mode is on, the Stop hook decides per-reply whether to render an HTML artifact (it skips trivial replies). A PostToolUse hook on `ExitPlanMode` always renders plans as a live dashboard. Toggling off silences both hooks. State persists per project across CC restarts.
