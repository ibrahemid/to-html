(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function refreshDecisionState() {
    var inputs = $$('.task-focus-input');
    var checked = inputs.filter(function (i) { return i.checked; });
    var count = checked.length;
    var label = count === 1 ? '1 selected' : count + ' selected';
    var countEl = $('#focus-count');
    if (countEl) countEl.textContent = label;
    var btn = $('#copy-decision-btn');
    if (btn) btn.disabled = count === 0;
  }

  function wireFocusInputs() {
    $$('.task-focus-input').forEach(function (input) {
      input.addEventListener('change', refreshDecisionState);
    });
    refreshDecisionState();
  }

  function wireNoteButtons() {
    $$('.task-note-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var taskId = btn.getAttribute('data-task-id');
        var noteInput = $('.task-note-input[data-task-id="' + taskId + '"]');
        if (!noteInput) return;
        noteInput.hidden = !noteInput.hidden;
        btn.textContent = noteInput.hidden ? '+' : '−';
        if (!noteInput.hidden) noteInput.focus();
      });
    });
  }

  function planTitle() {
    var meta = document.querySelector('meta[name="cc-plan-id"]');
    var h1 = document.querySelector('.plan-head h1');
    return {
      title: h1 ? h1.textContent.trim() : 'Plan',
      planId: meta ? meta.content : ''
    };
  }

  function buildPrompt() {
    var info = planTitle();
    var focused = $$('.task-focus-input:checked').map(function (input) {
      var taskId = input.getAttribute('data-task-id');
      var text = input.getAttribute('data-task-text') || '';
      var phase = input.getAttribute('data-phase-title') || '';
      var noteInput = $('.task-note-input[data-task-id="' + taskId + '"]');
      var note = noteInput && !noteInput.hidden && noteInput.value
        ? noteInput.value.trim()
        : '';
      return { phase: phase, text: text, note: note };
    });
    if (focused.length === 0) return null;

    var byPhase = {};
    focused.forEach(function (t) {
      if (!byPhase[t.phase]) byPhase[t.phase] = [];
      byPhase[t.phase].push(t);
    });

    var lines = [];
    lines.push('Focus on these tasks from the "' + info.title + '" plan next. Skip the rest for now.');
    lines.push('');
    Object.keys(byPhase).forEach(function (phase) {
      if (phase) lines.push('### ' + phase);
      byPhase[phase].forEach(function (t) {
        var line = '- ' + t.text;
        if (t.note) line += ' (' + t.note + ')';
        lines.push(line);
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function flashStatus(text, ms) {
    var status = $('#copy-status');
    if (!status) return;
    status.textContent = text;
    if (ms) {
      setTimeout(function () {
        if (status.textContent === text) status.textContent = '';
      }, ms);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyDecision() {
    var text = buildPrompt();
    if (!text) {
      flashStatus('Nothing selected.', 3000);
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashStatus('Copied. Paste into Claude.', 4000); },
        function () {
          var ok = fallbackCopy(text);
          flashStatus(ok ? 'Copied (fallback).' : 'Copy failed.', 4000);
        }
      );
    } else {
      var ok = fallbackCopy(text);
      flashStatus(ok ? 'Copied (fallback).' : 'Copy failed.', 4000);
    }
  }

  function preserveScrollAcrossReloads() {
    var KEY = 'cc-to-html-plan-scroll-' + ((document.querySelector('meta[name="cc-plan-id"]') || {}).content || 'p');
    try {
      var stored = sessionStorage.getItem(KEY);
      if (stored !== null) window.scrollTo(0, Number(stored) || 0);
    } catch (_) {}
    window.addEventListener('scroll', function () {
      try { sessionStorage.setItem(KEY, String(window.scrollY)); } catch (_) {}
    }, { passive: true });
  }

  function preserveDecisionAcrossReloads() {
    var KEY = 'cc-to-html-plan-focus-' + ((document.querySelector('meta[name="cc-plan-id"]') || {}).content || 'p');
    try {
      var stored = JSON.parse(sessionStorage.getItem(KEY) || '{}');
      Object.keys(stored.focus || {}).forEach(function (id) {
        var input = $('.task-focus-input[data-task-id="' + id + '"]');
        if (input) input.checked = true;
      });
      Object.keys(stored.notes || {}).forEach(function (id) {
        var inp = $('.task-note-input[data-task-id="' + id + '"]');
        var btn = $('.task-note-btn[data-task-id="' + id + '"]');
        if (inp && stored.notes[id]) {
          inp.value = stored.notes[id];
          inp.hidden = false;
          if (btn) btn.textContent = '−';
        }
      });
    } catch (_) {}

    function save() {
      var focus = {};
      $$('.task-focus-input:checked').forEach(function (i) { focus[i.getAttribute('data-task-id')] = 1; });
      var notes = {};
      $$('.task-note-input').forEach(function (i) {
        if (!i.hidden && i.value) notes[i.getAttribute('data-task-id')] = i.value;
      });
      try { sessionStorage.setItem(KEY, JSON.stringify({ focus: focus, notes: notes })); } catch (_) {}
    }

    document.addEventListener('change', save);
    document.addEventListener('input', save);
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireFocusInputs();
    wireNoteButtons();
    preserveScrollAcrossReloads();
    preserveDecisionAcrossReloads();
    var btn = $('#copy-decision-btn');
    if (btn) btn.addEventListener('click', copyDecision);
    refreshDecisionState();
  });
})();
