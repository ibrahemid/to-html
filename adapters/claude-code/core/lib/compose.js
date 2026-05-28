'use strict';

const { classify } = require('./classifier');
const { dispatchRender } = require('./templates/dispatch');
const { extractSummary } = require('./summary');
const { buildSectionIndex } = require('./section-index');
const { resolveGraph } = require('./graph-source');
const { renderTldrBand, renderMapSection, renderChrome } = require('./templates/parts');

const OWNS_LAYOUT = new Set(['plan', 'comparison']);

function normalizeHeadingText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function injectHeadingIds(html, sections) {
  if (!sections || sections.length === 0) return html;
  const pool = sections.map((s) => ({ slug: s.slug, norm: normalizeHeadingText(s.text), used: false }));
  return html.replace(/<(h[1-3])([^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, inner) => {
    if (/\bid=/.test(attrs)) return m;
    const norm = normalizeHeadingText(inner);
    const hit = pool.find((p) => !p.used && p.norm === norm);
    if (!hit) return m;
    hit.used = true;
    return `<${tag}${attrs} id="${hit.slug}">${inner}</${tag}>`;
  });
}

function stripLines(markdown, startLine, endLine) {
  const lines = markdown.split('\n');
  if (startLine < 0 || endLine >= lines.length || startLine > endLine) return markdown;
  lines.splice(startLine, endLine - startLine + 1);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function composeArtifact({ markdown, classification = null, meta = {}, uiDefaults = null }) {
  const cls = classification || classify(markdown);
  if (cls.template === 'skip') {
    return { skipped: true, reason: cls.reason, template: 'skip' };
  }

  const sourceMarkdown = cls.source || markdown;
  const ownsLayout = OWNS_LAYOUT.has(cls.template);

  const { tldr, body: bodyAfterTldr } = extractSummary(sourceMarkdown);
  const { sections, annotatedMarkdown } = buildSectionIndex(bodyAfterTldr);
  const tldrHtml = renderTldrBand(tldr);

  const resolvedGraph = ownsLayout ? null : resolveGraph(annotatedMarkdown, sections);
  const mapHtml = ownsLayout ? '' : renderMapSection({ graph: resolvedGraph, sections });
  const chromeHtml = renderChrome({ uiDefaults, sections, template: cls.template });
  let bodyMarkdown = ownsLayout ? bodyAfterTldr : annotatedMarkdown;
  if (!ownsLayout && resolvedGraph && resolvedGraph.source === 'salvage' && resolvedGraph.span) {
    bodyMarkdown = stripLines(bodyMarkdown, resolvedGraph.span.startLine, resolvedGraph.span.endLine);
  }

  const rendered = dispatchRender({
    template: cls.template,
    markdown: bodyMarkdown,
    meta,
    signals: cls.signals,
    override: cls.override,
    tldrHtml,
    mapHtml,
    chromeHtml,
    uiDefaults
  });

  const html = injectHeadingIds(rendered.html, sections);

  return {
    skipped: false,
    template: cls.template,
    reason: cls.reason,
    title: rendered.title,
    html,
    hasTldr: tldrHtml.length > 0,
    hasGraph: !!resolvedGraph,
    sectionCount: sections.length
  };
}

module.exports = { composeArtifact, OWNS_LAYOUT };
