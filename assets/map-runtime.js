(function () {
  'use strict';

  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function $(sel, root) { return (root || document).querySelector(sel); }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\' + c; });
  }

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function buildAdjacency(svg) {
    var outgoing = {};
    var incoming = {};
    $$('.edge', svg).forEach(function (edge) {
      var from = edge.getAttribute('data-from');
      var to = edge.getAttribute('data-to');
      if (!from || !to) return;
      (outgoing[from] = outgoing[from] || []).push({ edge: edge, to: to });
      (incoming[to] = incoming[to] || []).push({ edge: edge, from: from });
    });
    return { outgoing: outgoing, incoming: incoming };
  }

  function clearFocus(svg) {
    svg.classList.remove('has-focus');
    $$('.node.is-active', svg).forEach(function (n) { n.classList.remove('is-active'); });
    $$('.edge.is-active', svg).forEach(function (e) { e.classList.remove('is-active'); });
  }

  function focusNode(svg, nodeId, adj) {
    clearFocus(svg);
    svg.classList.add('has-focus');
    var node = svg.querySelector('.node[data-node-id="' + cssEscape(nodeId) + '"]');
    if (node) node.classList.add('is-active');
    (adj.outgoing[nodeId] || []).forEach(function (rel) {
      rel.edge.classList.add('is-active');
      var dn = svg.querySelector('.node[data-node-id="' + cssEscape(rel.to) + '"]');
      if (dn) dn.classList.add('is-active');
    });
    (adj.incoming[nodeId] || []).forEach(function (rel) {
      rel.edge.classList.add('is-active');
      var sn = svg.querySelector('.node[data-node-id="' + cssEscape(rel.from) + '"]');
      if (sn) sn.classList.add('is-active');
    });
  }

  function collectSectionContent(anchor) {
    var heading = anchor.nextElementSibling;
    while (heading && !/^H[1-6]$/.test(heading.tagName)) heading = heading.nextElementSibling;
    if (!heading) return null;
    var frag = document.createDocumentFragment();
    frag.appendChild(heading.cloneNode(true));
    var cur = heading.nextElementSibling;
    var taken = 0;
    while (cur && !/^H[1-6]$/.test(cur.tagName) && taken < 6) {
      if (cur.tagName === 'A' && !cur.textContent.trim()) {
        cur = cur.nextElementSibling;
        continue;
      }
      frag.appendChild(cur.cloneNode(true));
      taken++;
      cur = cur.nextElementSibling;
    }
    return frag;
  }

  function openDetailPanel(slug) {
    var panel = document.getElementById('cc-detail-panel');
    if (!panel) return;
    var anchor = document.getElementById(slug);
    if (!anchor) return;
    var content = collectSectionContent(anchor);
    var body = $('.cc-detail-body', panel);
    if (!body) return;
    clearChildren(body);
    if (content) body.appendChild(content);
    panel.hidden = false;
    anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var target = anchor.nextElementSibling;
    if (target) {
      target.classList.add('cc-section-flash');
      setTimeout(function () { target.classList.remove('cc-section-flash'); }, 1400);
    }
  }

  function closeDetailPanel() {
    var panel = document.getElementById('cc-detail-panel');
    if (panel) panel.hidden = true;
  }

  function wireSvgInteractions(svg) {
    var adj = buildAdjacency(svg);
    var locked = null;

    $$('.node', svg).forEach(function (node) {
      var id = node.getAttribute('data-node-id');
      var target = node.getAttribute('data-target-section');

      node.addEventListener('mouseenter', function () {
        if (locked) return;
        focusNode(svg, id, adj);
      });
      node.addEventListener('mouseleave', function () {
        if (locked) return;
        clearFocus(svg);
      });
      node.addEventListener('click', function (e) {
        e.stopPropagation();
        if (target) {
          locked = id;
          focusNode(svg, id, adj);
          openDetailPanel(target);
          return;
        }
        if (locked === id) {
          locked = null;
          clearFocus(svg);
        } else {
          locked = id;
          focusNode(svg, id, adj);
        }
      });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
    });

    svg.addEventListener('click', function () {
      if (locked) {
        locked = null;
        clearFocus(svg);
      }
    });
  }

  function wireZoomPan(canvas) {
    var svg = $('svg', canvas);
    if (!svg) return;
    svg.removeAttribute('preserveAspectRatio');
    var state = { scale: 1, tx: 0, ty: 0 };
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var startTx = 0;
    var startTy = 0;

    function apply() {
      var g = svg.querySelector('.nodes');
      var e = svg.querySelector('.edges');
      var transform = 'translate(' + state.tx + ' ' + state.ty + ') scale(' + state.scale + ')';
      if (g) g.setAttribute('transform', transform);
      if (e) e.setAttribute('transform', transform);
    }

    canvas.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey && Math.abs(ev.deltaY) < 4 && Math.abs(ev.deltaX) < 4) return;
      ev.preventDefault();
      var factor = ev.deltaY < 0 ? 1.12 : 0.89;
      state.scale = Math.max(0.4, Math.min(4, state.scale * factor));
      apply();
    }, { passive: false });

    canvas.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.node')) return;
      dragging = true;
      startX = ev.clientX;
      startY = ev.clientY;
      startTx = state.tx;
      startTy = state.ty;
      canvas.setPointerCapture(ev.pointerId);
      canvas.classList.add('is-dragging');
    });

    canvas.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      state.tx = startTx + (ev.clientX - startX);
      state.ty = startTy + (ev.clientY - startY);
      apply();
    });

    function endDrag(ev) {
      dragging = false;
      try { canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
      canvas.classList.remove('is-dragging');
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    var controls = canvas.parentElement && canvas.parentElement.querySelector('.cc-map-controls');
    if (controls) {
      controls.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.cc-map-btn');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        if (action === 'zoom-in') state.scale = Math.min(4, state.scale * 1.2);
        else if (action === 'zoom-out') state.scale = Math.max(0.4, state.scale / 1.2);
        else if (action === 'zoom-reset') { state.scale = 1; state.tx = 0; state.ty = 0; }
        apply();
      });
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) return;
      if (ev.key === '+' || ev.key === '=') { state.scale = Math.min(4, state.scale * 1.15); apply(); }
      else if (ev.key === '-') { state.scale = Math.max(0.4, state.scale / 1.15); apply(); }
      else if (ev.key === '0') { state.scale = 1; state.tx = 0; state.ty = 0; apply(); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('.diagram-svg').forEach(wireSvgInteractions);
    $$('.cc-map-canvas[data-zoomable]').forEach(wireZoomPan);
    var panel = document.getElementById('cc-detail-panel');
    if (panel) {
      var close = panel.querySelector('.cc-detail-close');
      if (close) close.addEventListener('click', closeDetailPanel);
    }
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeDetailPanel();
    });
  });
})();
