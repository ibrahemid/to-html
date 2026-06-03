#!/usr/bin/env bash
set -euo pipefail

STOP_HOOK="$(cd "$(dirname "${1:?usage: stop-hook-smoke.sh <path-to-bin/stop-hook.js>}")" && pwd)/$(basename "$1")"
MIN_IDS="${2:-3}"

WORK=$(mktemp -d)
trap "rm -rf $WORK" EXIT

TX="$WORK/transcript.jsonl"
PAYLOAD="$WORK/payload.json"
PROJECT_DIR="$WORK/project"
mkdir -p "$PROJECT_DIR"
PROJECT_DIR="$(node -e 'const fs=require("node:fs");process.stdout.write(fs.realpathSync(process.argv[1]))' "$PROJECT_DIR")"

node -e '
const fs=require("node:fs"), path=require("node:path");
const tx=process.argv[1], payload=process.argv[2], projectDir=process.argv[3];
const reply = "## Section A\nbody A\n\n## Section B\nbody B\n\n## Section C\nbody C\n\n```mermaid\ngraph TD\nA[Section A]-->B[Section B]\nB-->C[Section C]\n```\n";
const lines = [
  { type: "user", message: { content: "smoke" } },
  { type: "assistant", message: { content: [{ type: "text", text: reply }] } }
];
fs.writeFileSync(tx, lines.map(JSON.stringify).join("\n"));
fs.writeFileSync(payload, JSON.stringify({
  transcript_path: tx,
  session_id: "smoke-session",
  cwd: projectDir
}));
' "$TX" "$PAYLOAD" "$PROJECT_DIR"

ADAPTER_ROOT="$(dirname "$(dirname "$STOP_HOOK")")"

# toggle on immediately before stop-hook so modeChangedAt is fresh;
# stop-hook computes trigger=manual (within 8000ms window), bypassing the
# minChars gate. The order matters: a stale modeChangedAt would cause auto
# gating and produce no artifact.
( cd "$PROJECT_DIR" && node "$ADAPTER_ROOT/bin/cli.js" toggle on >/dev/null )

node "$STOP_HOOK" < "$PAYLOAD" >/dev/null

node -e '
const fs=require("node:fs"), path=require("node:path");
const { sessionArtifactsDir } = require(process.argv[1]);
const dir = sessionArtifactsDir("smoke-session");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html") && f !== "preview.html");
if (files.length === 0) { console.error("no artifact written to " + dir); process.exit(1); }
files.sort();
const latest = path.join(dir, files[files.length - 1]);
const html = fs.readFileSync(latest, "utf8");
const idCount = (html.match(/ id="/g) || []).length;
const min = Number(process.argv[2]);
if (idCount < min) {
  console.error(`FAIL: ${latest} has ${idCount} id="..." attributes; want >= ${min}`);
  process.exit(1);
}
console.log(`OK: ${latest} (${idCount} ids)`);

const previewHtml = path.join(dir, "preview.html");
if (!fs.existsSync(previewHtml)) { console.error("FAIL: preview.html not written to " + dir); process.exit(1); }

const manifestFile = path.join(dir, "preview-manifest.js");
if (!fs.existsSync(manifestFile)) { console.error("FAIL: preview-manifest.js not written to " + dir); process.exit(1); }
const manifestRaw = fs.readFileSync(manifestFile, "utf8");
const versionMatch = manifestRaw.match(/"version":\s*([0-9]+)/);
if (!versionMatch || Number(versionMatch[1]) < 1) {
  console.error("FAIL: preview-manifest.js version not advanced: " + manifestRaw);
  process.exit(1);
}

const turnsDir = path.join(dir, "preview-turns");
const chunks = fs.existsSync(turnsDir) ? fs.readdirSync(turnsDir).filter((f) => f.endsWith(".js")) : [];
if (chunks.length === 0) { console.error("FAIL: no preview-turn chunk written under " + turnsDir); process.exit(1); }
console.log(`OK: preview.html + manifest v${versionMatch[1]} + ${chunks.length} chunk(s)`);
' "$ADAPTER_ROOT/lib/paths.js" "$MIN_IDS"
