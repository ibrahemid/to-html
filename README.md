# to-html

Renderer for assistant replies. Shipped as a Claude Code plugin via `ibrahemid/plugins` and (Phase 3) as the `to-html` CLI.

## Install (Claude Code)

```
/plugin marketplace add ibrahemid/plugins
/plugin install to-html@ibrahemid
```

## Layout

- `core/`: renderer (markdown → self-contained HTML).
- `adapters/claude-code/`: Claude Code plugin. Synced `core/` and `shared/` bundles inside.
- `shared/transcript/`: per-tool transcript parsers.
- `cli/`: universal CLI (scaffold; Phase 3).
- `scripts/sync-core.js`: mirrors `core/`+`shared/` into the adapter.
- `scripts/sync-version.js`: propagates root version.
