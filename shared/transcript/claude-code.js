'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const MAX_TRANSCRIPT_LINE_BYTES = 1 * 1024 * 1024;
const MAX_TRANSCRIPT_BYTES = 64 * 1024 * 1024;

const CONTROL_LINE_RE = /^\s*(HTML mode:|Auto-open generated HTML files|\[to-html\b)/i;

function extractTextFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n');
}

function stripControlLines(text) {
  return text
    .split('\n')
    .filter((line) => !CONTROL_LINE_RE.test(line))
    .join('\n')
    .trim();
}

function hashText(text) {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
}

function collectAssistantTexts(transcriptPath, maxBytes = MAX_TRANSCRIPT_BYTES) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return [];
  if (!fs.existsSync(transcriptPath)) return [];
  let raw;
  try {
    const size = fs.statSync(transcriptPath).size;
    if (size > maxBytes) {
      const fd = fs.openSync(transcriptPath, 'r');
      try {
        const buf = Buffer.alloc(maxBytes);
        fs.readSync(fd, buf, 0, maxBytes, size - maxBytes);
        raw = buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
      const nl = raw.indexOf('\n');
      if (nl !== -1) raw = raw.slice(nl + 1);
    } else {
      raw = fs.readFileSync(transcriptPath, 'utf8');
    }
  } catch (_) {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line, 'utf8') > MAX_TRANSCRIPT_LINE_BYTES) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (_) { continue; }
    if (!obj || obj.type !== 'assistant') continue;
    const msg = obj.message;
    if (!msg || typeof msg !== 'object') continue;
    const text = extractTextFromContent(msg.content);
    if (text && text.trim()) out.push(text);
  }
  return out;
}

function isStale(candidate, lastHash, minChars) {
  if (!candidate || !candidate.text) return true;
  if (candidate.text.length < minChars) return true;
  if (lastHash != null && hashText(candidate.text) === lastHash) return true;
  return false;
}

module.exports = {
  MAX_TRANSCRIPT_LINE_BYTES,
  MAX_TRANSCRIPT_BYTES,
  extractTextFromContent,
  stripControlLines,
  hashText,
  collectAssistantTexts,
  isStale
};
