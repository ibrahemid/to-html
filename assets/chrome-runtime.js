(function () {
  'use strict';

  var STORAGE_KEY = 'cc-to-html-ui';
  var SECTION_TOGGLE_KEYS = ['tldr', 'map', 'stepper'];
  var UI_KEYS = ['theme', 'size', 'width', 'family'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function readStorage() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function writeStorage(state) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function readSections() {
    var node = document.getElementById('cc-sections');
    if (!node) return [];
    try { return JSON.parse(node.textContent || '[]'); } catch (_) { return []; }
  }

  function applyUi(ui) {
    var root = document.documentElement;
    UI_KEYS.forEach(function (k) {
      if (typeof ui[k] === 'string' && ui[k]) root.setAttribute('data-' + k, ui[k]);
    });
    SECTION_TOGGLE_KEYS.forEach(function (k) {
      var key = 'show' + k.charAt(0).toUpperCase() + k.slice(1);
      var cls = 'cc-hide-' + k;
      if (ui[key] === false) document.body.classList.add(cls);
      else document.body.classList.remove(cls);
    });
  }

  function currentUiFromDom() {
    var root = document.documentElement;
    var out = {};
    UI_KEYS.forEach(function (k) { out[k] = root.getAttribute('data-' + k) || null; });
    return out;
  }

  function wireGear(state) {
    var toggle = $('.cc-gear-toggle');
    var panel = $('.cc-gear-panel');
    if (!toggle || !panel) return;
    toggle.addEventListener('click', function () {
      var open = panel.hidden === false;
      panel.hidden = open;
      toggle.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', function (ev) {
      if (panel.hidden) return;
      if (ev.target.closest('.cc-gear-panel') || ev.target.closest('.cc-gear-toggle')) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });

    UI_KEYS.forEach(function (k) {
      $$('input[name="cc-' + k + '"]', panel).forEach(function (input) {
        input.addEventListener('change', function () {
          if (!input.checked) return;
          state[k] = input.value;
          applyUi(state);
          writeStorage(state);
        });
      });
    });

    SECTION_TOGGLE_KEYS.forEach(function (k) {
      var input = $('input[name="cc-show-' + k + '"]', panel);
      if (!input) return;
      var key = 'show' + k.charAt(0).toUpperCase() + k.slice(1);
      if (state[key] === false) input.checked = false;
      input.addEventListener('change', function () {
        state[key] = input.checked;
        applyUi(state);
        writeStorage(state);
      });
    });
  }

  function wireSearch(sections) {
    var input = $('.cc-search-input');
    if (!input) return;

    document.addEventListener('keydown', function (ev) {
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (ev.key === '/') {
        ev.preventDefault();
        input.focus();
        input.select();
      }
    });

    function filter(q) {
      var query = String(q || '').trim().toLowerCase();
      sections.forEach(function (s) {
        var anchor = document.getElementById(s.slug);
        if (!anchor) return;
        var heading = anchor.nextElementSibling;
        if (!heading) return;
        var match = !query || s.text.toLowerCase().indexOf(query) !== -1;
        if (match) {
          heading.classList.remove('cc-section-dim');
          if (query) heading.classList.add('cc-section-hit');
          else heading.classList.remove('cc-section-hit');
        } else {
          heading.classList.add('cc-section-dim');
          heading.classList.remove('cc-section-hit');
        }
      });
      $$('.diagram-svg .node').forEach(function (node) {
        var label = (node.getAttribute('aria-label') || '').toLowerCase();
        if (!query || label.indexOf(query) !== -1) node.classList.remove('cc-section-dim');
        else node.classList.add('cc-section-dim');
      });
    }

    input.addEventListener('input', function () { filter(input.value); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { input.value = ''; filter(''); input.blur(); }
    });
  }

  function wireStepper(sections) {
    var nav = $('.cc-stepper');
    if (!nav || sections.length < 2) return;
    var prev = $('.cc-step-prev', nav);
    var next = $('.cc-step-next', nav);
    var pos = $('.cc-step-pos', nav);
    var title = $('.cc-step-title', nav);
    var idx = 0;

    function update() {
      pos.textContent = (idx + 1) + ' / ' + sections.length;
      title.textContent = sections[idx].text;
      prev.disabled = idx === 0;
      next.disabled = idx === sections.length - 1;
      $$('.cc-toc-item a').forEach(function (a) {
        var s = a.getAttribute('data-section');
        if (s === sections[idx].slug) a.classList.add('cc-step-current');
        else a.classList.remove('cc-step-current');
      });
      $$('.diagram-svg .node').forEach(function (n) {
        var target = n.getAttribute('data-target-section');
        if (target === sections[idx].slug) n.classList.add('is-active');
        else n.classList.remove('is-active');
      });
    }

    function go(delta) {
      var nextIdx = Math.max(0, Math.min(sections.length - 1, idx + delta));
      if (nextIdx === idx) return;
      idx = nextIdx;
      var anchor = document.getElementById(sections[idx].slug);
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      update();
    }

    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });

    document.addEventListener('keydown', function (ev) {
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (ev.key === 'j' || ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
      else if (ev.key === 'k' || ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
    });

    update();
  }

  function init() {
    var stored = readStorage() || {};
    var dom = currentUiFromDom();
    var state = {
      theme: stored.theme || dom.theme || 'auto',
      size: stored.size || dom.size || 'm',
      width: stored.width || dom.width || 'comfortable',
      family: stored.family || dom.family || 'sans',
      showTldr: stored.showTldr !== false,
      showMap: stored.showMap !== false,
      showStepper: stored.showStepper !== false
    };
    applyUi(state);

    UI_KEYS.forEach(function (k) {
      var input = $('input[name="cc-' + k + '"][value="' + state[k] + '"]');
      if (input) input.checked = true;
    });

    wireGear(state);
    var sections = readSections();
    wireSearch(sections);
    wireStepper(sections);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
