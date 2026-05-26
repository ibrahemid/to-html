'use strict';

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const FENCE_RE = /^(```+|~~~+)/;

function slugify(text, idx) {
  const base = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `s-${idx}-${base || 'section'}`;
}

function buildSectionIndex(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return { sections: [], annotatedMarkdown: markdown || '' };
  }
  const lines = markdown.split('\n');
  const sections = [];
  let fenceChar = null;
  let idx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.trim().match(FENCE_RE);
    if (fm) {
      const ch = fm[1][0];
      if (fenceChar === null) fenceChar = ch;
      else if (ch === fenceChar) fenceChar = null;
      continue;
    }
    if (fenceChar !== null) continue;
    const m = line.match(HEADING_RE);
    if (!m) continue;
    const level = m[1].length;
    if (level < 1 || level > 3) continue;
    const text = m[2].trim();
    if (!text) continue;
    const slug = slugify(text, ++idx);
    sections.push({ slug, text, level, lineIndex: i });
  }

  if (sections.length === 0) {
    return { sections: [], annotatedMarkdown: markdown };
  }

  const out = [];
  let sIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (sIdx < sections.length && sections[sIdx].lineIndex === i) {
      out.push(`<a id="${sections[sIdx].slug}"></a>`);
      sIdx++;
    }
    out.push(lines[i]);
  }

  const clean = sections.map(({ lineIndex, ...rest }) => rest);
  return { sections: clean, annotatedMarkdown: out.join('\n') };
}

module.exports = { buildSectionIndex, slugify };
