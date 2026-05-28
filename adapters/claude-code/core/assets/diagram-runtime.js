(function () {
  'use strict';

  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function buildAdjacency(diagram) {
    var outgoing = {};
    var incoming = {};
    $$('.edge', diagram).forEach(function (edge) {
      var from = edge.getAttribute('data-from');
      var to = edge.getAttribute('data-to');
      if (!from || !to) return;
      (outgoing[from] = outgoing[from] || []).push({ edge: edge, to: to });
      (incoming[to] = incoming[to] || []).push({ edge: edge, from: from });
    });
    return { outgoing: outgoing, incoming: incoming };
  }

  function clearFocus(diagram) {
    diagram.classList.remove('has-focus');
    $$('.node.is-active', diagram).forEach(function (n) { n.classList.remove('is-active'); });
    $$('.edge.is-active', diagram).forEach(function (e) { e.classList.remove('is-active'); });
  }

  function focusNode(diagram, nodeId, adj) {
    clearFocus(diagram);
    diagram.classList.add('has-focus');
    var node = diagram.querySelector('.node[data-node-id="' + cssEscape(nodeId) + '"]');
    if (node) node.classList.add('is-active');
    (adj.outgoing[nodeId] || []).forEach(function (rel) {
      rel.edge.classList.add('is-active');
      var dn = diagram.querySelector('.node[data-node-id="' + cssEscape(rel.to) + '"]');
      if (dn) dn.classList.add('is-active');
    });
    (adj.incoming[nodeId] || []).forEach(function (rel) {
      rel.edge.classList.add('is-active');
      var sn = diagram.querySelector('.node[data-node-id="' + cssEscape(rel.from) + '"]');
      if (sn) sn.classList.add('is-active');
    });
  }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (c) { return '\\' + c; });
  }

  function wireDiagram(diagram) {
    var adj = buildAdjacency(diagram);
    var locked = null;

    $$('.node', diagram).forEach(function (node) {
      var id = node.getAttribute('data-node-id');
      node.addEventListener('mouseenter', function () {
        if (locked) return;
        focusNode(diagram, id, adj);
      });
      node.addEventListener('mouseleave', function () {
        if (locked) return;
        clearFocus(diagram);
      });
      node.addEventListener('click', function (e) {
        e.stopPropagation();
        if (locked === id) {
          locked = null;
          clearFocus(diagram);
        } else {
          locked = id;
          focusNode(diagram, id, adj);
        }
      });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          node.click();
        }
      });
    });

    diagram.addEventListener('click', function () {
      if (locked) {
        locked = null;
        clearFocus(diagram);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('.diagram').forEach(wireDiagram);
  });
})();
