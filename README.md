# to-html

Renderer that turns assistant replies into self-contained HTML.

## Install (Claude Code)

```
/plugin marketplace add ibrahemid/plugins
/plugin install to-html@ibrahemid
/to-html
```

Toggle on, ask any substantive question, the reply renders to a self-contained HTML artifact and a live session preview opens in your browser.

## Layout

- `core/` - renderer (markdown to self-contained HTML), zero runtime deps, deterministic.
- `shared/` - tool-agnostic transcript parsers and the enrichment prompt + parser.
- `adapters/claude-code/` - the Claude Code plugin.
- `cli/` - the `to-html` CLI.
- `scripts/` - bundle sync and version propagation.

## License

MIT.
