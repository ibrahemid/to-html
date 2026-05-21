---
description: Toggle HTML rendering mode for the conversation.
allowed-tools: Bash
---

The user typed `/to-html` to toggle HTML rendering mode.

Run exactly one Bash call (no arguments needed):

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" toggle
```

The script flips mode (on→off or off→on) and writes a JSON result:

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

1. If `mode` is `"on"` and `autoOpen` is `null`, ask the user **once**:

   > Auto-open generated HTML files in your browser? (yes/no)

   When they answer, run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" set-auto-open "<yes|no>"
   ```

2. Print the `message` field in a single line. No headers, no commentary, no closing summary. Stop.

When HTML mode is on, a Stop hook renders every assistant reply to a self-contained HTML file and prints the `file://` link. A PostToolUse hook on `ExitPlanMode` auto-renders any plan into a live dashboard. Both are silent when mode is off.
