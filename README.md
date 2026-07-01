# to-html

On-demand HTML artifacts for Claude Code. Ask for one and the model composes a
structured spec that renders to a single self-contained file you open in your browser.

![to-html](docs/hero.png)

## Install

```
/plugin marketplace add ibrahemid/to-html
/plugin install to-html@ibrahemid
```

## Use

Just ask, in plain language:

- "build me html of what we just did"
- "put this in a status html"
- "show me options for X"
- "make a checklist to test this"

The model picks a kind, composes the content, and opens the file. Kinds:

| kind | for |
|---|---|
| `dashboard` | status / handoff: sections of items with status, detail, links, copy-able prompts |
| `report` | tables + links (supports a bare `plain` table) |
| `options` | 2 to 4 option cards to compare and pick |
| `diagram` | a system/flow diagram from nodes and edges |
| `checklist` | groups of checkable items (state saved in your browser) |
| `asset-grid` | a grid of downloadable assets |
| `findings` | an audit/inventory list with severities |

Every artifact is one self-contained file (inline CSS/JS/SVG, no external assets),
sanitized, and theme-aware. Configure the default look and the browser it opens in:

```
/to-html config theme dark
/to-html config opener Dia
```

## How it works

The model authors a structured spec, not raw HTML; a deterministic, zero-dependency
core assembles it into the final file. It does not touch your normal replies: no
auto-render, no formatting contract.

## Layout

- `core/` - the renderer and the artifact kinds. Zero runtime deps, deterministic.
- `shared/` - tool-agnostic transcript parsing.
- `adapters/claude-code/` - the Claude Code plugin (skill + CLI).
- `cli/` - the standalone CLI.
- `scripts/` - bundle sync and version propagation.

## License

MIT.
