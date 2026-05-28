#!/usr/bin/env bash
set -euo pipefail

MARKETPLACE_REF="${1:?usage: install-test.sh <marketplace-branch> [plugin-tag]}"
PLUGIN_TAG="${2:-v2.1.0}"

CACHE="$HOME/.claude/plugins/cache/ibrahemid"
if [ -d "$CACHE" ]; then
  echo "clearing $CACHE"
  rm -rf "$CACHE"
fi

echo "EXPECTED MARKETPLACE BRANCH:  ibrahemid/plugins#${MARKETPLACE_REF}"
echo "EXPECTED PLUGIN TAG:          ${PLUGIN_TAG}"
echo "Run in a fresh Claude Code session:"
echo "  /plugin marketplace remove ibrahemid"
echo "  /plugin marketplace add ibrahemid/plugins#${MARKETPLACE_REF}"
echo "  /plugin install to-html@ibrahemid"
echo "Then verify cache lands at: $CACHE/to-html/${PLUGIN_TAG#v}/"
echo "Then run the stop-hook smoke against the INSTALLED bin:"
echo "  bash scripts/stop-hook-smoke.sh $CACHE/to-html/${PLUGIN_TAG#v}/bin/stop-hook.js 3"
