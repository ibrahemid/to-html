---
name: to-html
description: Toggle HTML rendering mode for the conversation. When on, every substantive assistant reply is also written to a self-contained HTML file that opens in the browser. Use when the user types /to-html, /html, "turn on html mode", "render this as html", "open this in browser", or wants to read agent output visually instead of in the terminal. If the user types /to-html diag, /to-html debug, /to-html status, /to-html doctor, or asks "why isn't to-html working", run the diagnostic flow instead of toggling.
---

The user invoked `/to-html`. Look at the user's exact text. If it contains the words "diag", "debug", "doctor", or "status" anywhere, run the **diagnostic flow**. Otherwise run the **toggle flow**.

## Toggle flow (default)

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

When mode is on, the Stop hook decides per-reply whether to render an HTML artifact (it skips trivial replies). A PostToolUse hook on `ExitPlanMode` always renders plans as a live dashboard. Toggling off silences both hooks.

## Diagnostic flow

Run exactly one Bash call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/diagnose.js"
```

Print the script's output verbatim. Add no commentary unless the user explicitly asks for interpretation.

If the output's `recent hook events` section says `(none yet)`, tell the user verbatim:

> The Stop hook hasn't fired since this CC session started. Run `/reload-plugins`. If that doesn't help, restart Claude Code. After that, ask any question, then run `/to-html diag` again to confirm.

If hook events exist but all show `mode=off`, tell them: HTML mode is OFF. Run `/to-html` to enable.

If events show errors, surface the most recent error and stop.
