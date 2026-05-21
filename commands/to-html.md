---
description: Toggle HTML rendering mode. Each subsequent assistant response is also rendered as a self-contained HTML artifact and printed as a clickable file:// link.
argument-hint: "[on|off|status|reset]"
allowed-tools: Bash
---

You are processing the `/to-html` slash command. The user wants to manage HTML rendering mode for this conversation.

Run exactly one Bash call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" toggle "$ARGUMENTS"
```

The script writes JSON to stdout describing the new state:

```json
{
  "mode": "on" | "off",
  "autoOpen": true | false | null,
  "sessionId": "<id>",
  "stateFile": "<absolute-path>",
  "changed": true | false,
  "message": "<short status string>"
}
```

After the script returns, do the following:

1. If `mode` is `"on"` and `autoOpen` is `null`, ask the user **exactly once**:

   > HTML mode is on. Auto-open generated files in your default browser? (yes/no)

   When they reply, run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/cli.js" set-auto-open "<yes|no>"
   ```

2. Report the final state in **one line**, no more. Examples:
   - `HTML mode: ON · auto-open: yes · artifacts → ~/Library/Caches/cc-to-html/`
   - `HTML mode: OFF`
   - `HTML mode: ON · auto-open: no · artifacts → ~/.cache/cc-to-html/`

3. Do not produce any extra commentary, no headers, no bullets, no preamble. Stop after the status line.

When HTML mode is on, a Stop hook will automatically render each of your subsequent responses into a self-contained HTML file and print the clickable link below your reply. You do not need to do anything extra in your subsequent responses; continue writing normally in markdown.

The user can also embed an interactive controls block inside a fenced code block tagged `html-spec` if they ask for interactivity. The schema for that block is described in the `to-html-schema` skill.
