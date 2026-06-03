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

// owns-layout bodies carry one <main> + an inert <aside class="decision-bar">; the timeline fragment demotes main to div and strips the bar. N <main>s in one doc is invalid HTML; per-turn form ids collide. Archive html is untouched.
function toFragmentBody(bodyHtml) {
  return String(bodyHtml)
    .replace('<main class="cc-main">', '<div class="cc-main">')
    .replace('</main>', '</div>')
    .replace(/<aside class="decision-bar"[\s\S]*?<\/aside>/g, '');
}

function composeArtifact({ markdown, classification = null, meta = {}, uiDefaults = null, nowIso = null, enrichment = null }) {
  const cls = classification || classify(markdown);
  if (cls.template === 'skip') {
    return { skipped: true, reason: cls.reason, template: 'skip' };
  }

  const sourceMarkdown = cls.source || markdown;
  const ownsLayout = OWNS_LAYOUT.has(cls.template);

  const { tldr, body: bodyAfterTldr } = extractSummary(sourceMarkdown);
  const { sections, annotatedMarkdown } = buildSectionIndex(bodyAfterTldr);
  const enrichTldr = (enrichment && typeof enrichment.tldr === 'string' && enrichment.tldr.trim()) ? enrichment.tldr.trim() : null;
  const effectiveTldr = enrichTldr || tldr;
  const tldrHtml = renderTldrBand(effectiveTldr);

  const preferMermaid = (enrichment && typeof enrichment.graph === 'string') ? enrichment.graph : '';
  const resolvedGraph = ownsLayout ? null : resolveGraph(annotatedMarkdown, sections, { preferMermaid });
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
    uiDefaults,
    nowIso
  });

  const html = injectHeadingIds(rendered.html, sections);

  const bodyContent = ownsLayout
    ? toFragmentBody(rendered.body)
    : `<div class="cc-main">\n${rendered.body}\n</div>`;
  const fragment = `${tldrHtml}\n${mapHtml}\n${bodyContent}`;

  return {
    skipped: false,
    template: cls.template,
    reason: cls.reason,
    title: rendered.title,
    html,
    fragment,
    hasTldr: tldrHtml.length > 0,
    hasGraph: !!resolvedGraph,
    sectionCount: sections.length
  };
}

module.exports = { composeArtifact, OWNS_LAYOUT };
