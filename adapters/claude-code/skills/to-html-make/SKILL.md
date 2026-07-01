---
name: to-html-make
description: Generate a self-contained HTML artifact on demand from the current task context. Use when the user asks to "build me html of X", "make a tmp html", "show me in html", "put this in an html", "build a status/handoff html", "html dashboard", "render a report/options/diagram/checklist/asset grid/findings", or wants a long reply or a set of decisions as an openable file. You author a structured spec; the plugin assembles one self-contained, anti-slop HTML file and opens it.
---

The user wants an HTML artifact built from what you know in this conversation. You
author a structured spec (not raw HTML); the plugin's deterministic core assembles
it into one self-contained, sanitized, themed file and opens it in the browser.

Do NOT write HTML/CSS yourself. Pick the `kind` that fits the content, compose a
spec object, then run the CLI.

## Kinds

- `dashboard`: status / handoff. Sections of items with a status badge, detail,
  links, and copy-able prompts. A header rollup counts statuses.
- `report`: a linked report. Sections each with a data table and/or a list of
  links. `plain: true` drops styling to a bare HTML table.
- `options`: 2 to 4 option cards side by side to compare and pick, each with
  pros/cons or bullets and an optional recommended flag.
- `diagram`: a system/flow diagram rendered as an SVG graph from nodes and edges.
- `checklist`: groups of checkable items. Checkboxes persist in the browser's
  localStorage only.
- `asset-grid`: a grid of asset cards, each with a name, optional preview image,
  and download links.
- `findings`: an audit/inventory list. Finding rows with a severity, category tag,
  markdown description, and links. A header rollup counts severities.

## Steps

1. Choose a `kind` and compose its spec from the task context (schemas below). Put
   the real substance in it. No filler.
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

## Shared rules (all kinds)

- `title` is required on every spec. `subtitle` and `meta` (`project`,
  `generatedAt`, `note`) are optional everywhere.
- Plain-text fields (`title`, labels, table cells, names, tags) are escaped.
  Markdown fields (`summary`, `detail`, `description`, `caption`) render as
  sanitized markdown. Unsafe link/image urls are dropped.
- An invalid spec throws; read the error line and fix the structure.

## dashboard

```json
{
  "kind": "dashboard",
  "title": "string",
  "subtitle": "string (optional)",
  "meta": { "project": "string", "generatedAt": "string", "note": "string" },
  "sections": [
    {
      "title": "string",
      "summary": "markdown (optional)",
      "items": [
        {
          "label": "string",
          "status": "done | in_progress | pending | blocked | decision (optional)",
          "detail": "markdown (optional)",
          "links": [ { "href": "url", "text": "string" } ],
          "copyPrompt": "string (optional, copy-able block)"
        }
      ]
    }
  ]
}
```

Use `decision` for items that need the user, `blocked` for stuck items. At least
one section with a `title`; each item needs a `label`.

## report

Sections each carry an optional `table` (model-authored columns and rows) and/or a
list of `links`. Rows are padded or truncated to the column count. Set
`plain: true` for a bare HTML table with no styling.

```json
{
  "kind": "report",
  "title": "string",
  "plain": false,
  "sections": [
    {
      "title": "string",
      "summary": "markdown (optional)",
      "table": {
        "columns": ["Package", "Current", "Latest"],
        "rows": [ ["marked", "9.1.0", "12.0.0"], ["node", "18", "22"] ]
      },
      "links": [ { "href": "url", "text": "string" } ]
    }
  ]
}
```

## options

2 to 4 cards. Each needs a `title`. Provide `pros`/`cons` (tinted panels) or
`bullets`. Set `recommended: true` on at most one.

```json
{
  "kind": "options",
  "title": "string",
  "options": [
    {
      "title": "string",
      "summary": "markdown (optional)",
      "recommended": false,
      "pros": ["string"],
      "cons": ["string"],
      "bullets": ["string"],
      "links": [ { "href": "url", "text": "string" } ]
    }
  ]
}
```

## diagram

A graph of `nodes` (2+, unique `id`, plain `label`) and `edges` (1+, `from`/`to`
must reference node ids, optional `label`). `direction` is `TD` (top-down,
default) or `LR` (left-right). Nodes render as uniform rounded boxes.

```json
{
  "kind": "diagram",
  "title": "string",
  "direction": "TD",
  "nodes": [
    { "id": "spec", "label": "Spec" },
    { "id": "render", "label": "Render" },
    { "id": "open", "label": "Open file" }
  ],
  "edges": [
    { "from": "spec", "to": "render", "label": "validate" },
    { "from": "render", "to": "open" }
  ]
}
```

## checklist

Groups of checkable items. Each group needs a `title` and a non-empty `items`
array; each item needs `text`. Checked state is saved in the viewer's browser
localStorage only (stated in the artifact).

```json
{
  "kind": "checklist",
  "title": "string",
  "groups": [
    {
      "title": "string",
      "summary": "markdown (optional)",
      "items": [
        {
          "text": "string",
          "detail": "markdown (optional)",
          "links": [ { "href": "url", "text": "string" } ]
        }
      ]
    }
  ]
}
```

## asset-grid

A grid of asset cards. Each needs a `name` and at least one valid `downloads`
link. `preview.src` accepts a `data:image/*` url or an `http(s)` image url.

```json
{
  "kind": "asset-grid",
  "title": "string",
  "assets": [
    {
      "name": "string",
      "caption": "string (optional)",
      "preview": { "src": "data:image/png;base64,... | https url", "alt": "string" },
      "downloads": [ { "href": "url", "text": "string" } ]
    }
  ]
}
```

## findings

An audit/inventory list. Use a flat `findings` array, or `groups` each with an
optional `title` and a non-empty `findings` array. `severity` is one of
`critical | high | medium | low | info` and drives the color and header rollup.

```json
{
  "kind": "findings",
  "title": "string",
  "groups": [
    {
      "title": "string (optional)",
      "findings": [
        {
          "title": "string",
          "severity": "critical | high | medium | low | info (optional)",
          "category": "string (optional tag)",
          "description": "markdown (optional)",
          "links": [ { "href": "url", "text": "string" } ]
        }
      ]
    }
  ]
}
```

A flat form is also accepted: `{ "kind": "findings", "title": "...", "findings": [ ... ] }`.

## When NOT to use this

If the user typed `/to-html` (toggle HTML mode on/off, config, or diag), use the
`to-html` skill instead. This skill is only for building a one-off artifact now.
