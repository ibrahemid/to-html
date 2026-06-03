'use strict';

const INLINE_RE = /^>?\s*(?:\*\*|__)?\s*TL;?DR\s*[:\--]?\s*(?:\*\*|__)?\s*(.+?)\s*$/im;
const HEADING_RE = /^(#{1,3})\s+TL;?DR\s*[:\--]?\s*$/im;

function fenceRanges(markdown) {
  const ranges = [];
  const re = /^([ \t]*)(```|~~~)/gm;
  let open = null;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const lineStart = m.index;
    if (!open) {
      open = { start: lineStart, marker: m[2] };
    } else if (m[2] === open.marker) {
      ranges.push([open.start, re.lastIndex]);
      open = null;
    }
  }
  if (open) ranges.push([open.start, markdown.length]);
  return ranges;
}

function indexInFence(ranges, idx) {
  for (const [s, e] of ranges) if (idx >= s && idx < e) return true;
  return false;
}

function firstMatchOutsideFence(markdown, re, ranges) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = g.exec(markdown)) !== null) {
    if (!indexInFence(ranges, m.index)) return m;
    if (m.index === g.lastIndex) g.lastIndex++;
  }
  return null;
}

function readParagraphBlock(text) {
  const lines = text.split('\n');
  const buf = [];
  let started = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (started && /^#{1,3}\s+/.test(trimmed)) break;
    if (trimmed === '') {
      if (started) break;
      continue;
    }
    started = true;
    buf.push(raw);
  }
  return { text: buf.join('\n').trim(), consumed: buf.length };
}

function extractSummary(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return { tldr: null, body: markdown || '' };
  }

  const ranges = fenceRanges(markdown);
  const inline = firstMatchOutsideFence(markdown, INLINE_RE, ranges);
  const heading = firstMatchOutsideFence(markdown, HEADING_RE, ranges);

  let chosen = null;
  if (inline && heading) {
    chosen = inline.index <= heading.index ? { kind: 'inline', m: inline } : { kind: 'heading', m: heading };
  } else if (inline) {
    chosen = { kind: 'inline', m: inline };
  } else if (heading) {
    chosen = { kind: 'heading', m: heading };
  }
  if (!chosen) return { tldr: null, body: markdown };

  const m = chosen.m;
  const start = m.index;
  const matchEnd = start + m[0].length;

  let tldrText = '';
  let bodyResume = matchEnd;

  if (chosen.kind === 'inline') {
    tldrText = (m[1] || '').trim().replace(/^\s*[>]\s*/gm, '').trim();
  } else {
    const after = markdown.slice(matchEnd);
    const block = readParagraphBlock(after);
    tldrText = block.text.replace(/^\s*[>]\s*/gm, '').trim();
    const consumedChars = after.split('\n').slice(0, block.consumed).join('\n').length;
    bodyResume = matchEnd + consumedChars;
  }

  if (!tldrText) return { tldr: null, body: markdown };

  const before = markdown.slice(0, start);
  const after = markdown.slice(bodyResume);
  const trimmedAfter = after.replace(/^\n+/, '');
  const body = (before + trimmedAfter).trim();

  return { tldr: tldrText, body };
}

module.exports = { extractSummary };
