'use strict';

const { classify } = require('./classifier');
const { dispatchRender } = require('./templates/dispatch');
const { extractSummary } = require('./summary');
const { buildSectionIndex } = require('./section-index');
const { resolveGraph } = require('./graph-source');
const { renderTldrBand, renderMapSection, renderChrome } = require('./templates/parts');

const OWNS_LAYOUT = new Set(['plan', 'comparison']);

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
  const bodyMarkdown = ownsLayout ? bodyAfterTldr : annotatedMarkdown;

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

  return {
    skipped: false,
    template: cls.template,
    reason: cls.reason,
    title: rendered.title,
    html: rendered.html,
    hasTldr: tldrHtml.length > 0,
    hasGraph: !!resolvedGraph,
    sectionCount: sections.length
  };
}

module.exports = { composeArtifact, OWNS_LAYOUT };
