---
description: Render a markdown plan (from a file path or pasted body) into an interactive HTML plan view with phase sidebar, task statuses, and live reload.
argument-hint: "<path/to/plan.md> | reset | status"
allowed-tools: Bash, Read
---

You are processing the `/to-html plan` slash command. The user wants to render or manage a planning artifact.

The argument is `$ARGUMENTS`. Handle these cases:

1. **`reset`** — clear the active plan from state. Run:
   ```bash
   node -e "const s=require('${CLAUDE_PLUGIN_ROOT}/lib/state'); s.writeState(process.env.CLAUDE_PROJECT_DIR||process.cwd(),{activePlan:null});" && echo "active plan cleared"
   ```
   Report `Active plan cleared.` and stop.

2. **`status`** — show whether a plan is active. Run:
   ```bash
   node -e "const s=require('${CLAUDE_PLUGIN_ROOT}/lib/state'); const st=s.readState(process.env.CLAUDE_PROJECT_DIR||process.cwd()); if(st.activePlan){const ap=st.activePlan;const total=ap.phases.reduce((a,p)=>a+p.tasks.length,0);const done=ap.phases.reduce((a,p)=>a+p.tasks.filter(t=>t.status==='completed').length,0);console.log('Active plan:',ap.title,'·',done+'/'+total,'·',ap.file)}else{console.log('No active plan.')}"
   ```
   Print the script's output verbatim.

3. **Path to a markdown file** — Read the file with the Read tool, then run:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/plan-renderer.js" <<'PLAN_PAYLOAD'
   {"markdown": "<paste-the-md-here>", "sessionId": "${CLAUDE_SESSION_ID:-manual}", "cwd": "${CLAUDE_PROJECT_DIR:-$PWD}", "autoOpen": true, "source": "/to-html plan"}
   PLAN_PAYLOAD
   ```
   Where `<paste-the-md-here>` is the JSON-escaped markdown body. The script writes a stable file `plan-<slug>.html`, opens it in the browser if HTML mode auto-open is on, and prints a JSON result.

4. **No argument or pasted body** — if the user pasted markdown into the prompt, treat the markdown as the plan body. Otherwise, ask: `Provide a path to a markdown plan file or paste plan markdown.`

After running, report a single line:
- `Plan: <title> · <done>/<total> tasks · <url>` on success.
- The error message on failure.

Do not add commentary, headers, or summaries. Stop after the status line. The HTML auto-reloads every 3 seconds, so subsequent assistant turns that mention task progress (e.g., "completed: X", "blocked: Y") will update the view automatically via the Stop hook.
