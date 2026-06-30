---
name: to-html-make
description: Generate a self-contained HTML artifact on demand from the current task context. Use when the user asks to "build me html of X", "make a tmp html", "show me in html", "put this in an html", "build a status/handoff html", "html dashboard", "render this as a page I can open", or wants a long reply or a set of decisions as an openable file. You author a structured spec; the plugin assembles one self-contained, anti-slop HTML file and opens it.
---

The user wants an HTML artifact built from what you know in this conversation. You
author a structured spec (not raw HTML); the plugin's deterministic core assembles
it into one self-contained, sanitized, themed file and opens it in the browser.

Do NOT write HTML/CSS yourself. Compose a spec object, then run the CLI.

## Steps

1. Compose a `dashboard` spec from the task context (see schema). Put the real
   substance in it: what is done, pending, blocked, what needs the user's decision,
   relevant links, and any prompt the user will want to copy.
2. Write the spec JSON to a temp file with the Write tool, e.g. `/tmp/to-html-spec.json`.
3. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/artifact.js" /tmp/to-html-spec.json
   ```

4. The CLI prints a JSON line. Print its `message` (the `file://` url) as a single
   line. If `ok` is false, print the `error` line and fix the spec.

Add `--no-open` if the user only wants the file, not a browser tab. Add `--out
<absolute-path>` to control where the file is written (use this for a kept artifact
the user names; default is a temp location).

## Dashboard spec schema

```json
{
  "kind": "dashboard",
  "title": "string (required)",
  "subtitle": "string (optional)",
  "meta": { "project": "string", "generatedAt": "string", "note": "string" },
  "sections": [
    {
      "title": "string (required)",
      "summary": "markdown string (optional)",
      "items": [
        {
          "label": "string (required)",
          "status": "done | in_progress | pending | blocked | decision (optional)",
          "detail": "markdown string (optional)",
          "links": [ { "href": "url", "text": "string" } ],
          "copyPrompt": "string (optional, shown as a copy-able block)"
        }
      ]
    }
  ]
}
```

Rules the assembler enforces (compose to fit, do not fight them):

- `kind` must be `dashboard` (the only kind today). `title` and at least one
  `section` with a `title` are required; each item needs a `label`.
- `status` drives a colored badge and the header rollup. Use `decision` for items
  that need the user, `blocked` for stuck items.
- `detail` and `summary` render as markdown; `label`/`title` are plain text. All
  content is escaped and sanitized; unsafe link urls are dropped.
- Keep it task-real and tight: this is a view to read or decide from, not a wall of
  text. No filler.

## When NOT to use this

If the user typed `/to-html` (toggle HTML mode on/off, config, or diag), use the
`to-html` skill instead. This skill is only for building a one-off artifact now.
