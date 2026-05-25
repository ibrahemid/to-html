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

1. If `mode` is `on` and `autoOpen` is `null`, ask the user with the **AskUserQuestion tool** (never plain text). Use:
   - header: `Auto-open`
   - question: `Auto-open generated HTML files in your browser after each reply?`
   - options: `Yes, auto-open` (description: "Each rendered artifact opens in your default browser automatically.") and `No, just print the link` (description: "Print the file:// link; you open it when you want.")

   Map their choice to `yes` or `no` and run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" set-auto-open "<yes|no>"
   ```

2. Print the `message` field as a single line. Nothing else. No headers, no commentary, no closing summary.

When mode is on, the Stop hook renders the **most recent substantive reply** — it automatically skips its own toggle status, the auto-open question, and other trivial chatter, so toggling on mid-conversation renders the response you were already looking at. A PostToolUse hook on `ExitPlanMode` always renders plans as a live dashboard. Toggling off silences both hooks.

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
