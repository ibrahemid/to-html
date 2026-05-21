(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function wireSliderOutputs() {
    $$('input[type="range"][data-kind="slider"]').forEach(function (input) {
      var output = $('output[data-output-for="' + input.id + '"]');
      if (!output) return;
      input.addEventListener('input', function () { output.textContent = input.value; });
    });
  }

  function wireKanban() {
    var dragged = null;
    $$('.kanban-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        dragged = card;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', card.getAttribute('data-card-id') || '');
        }
        card.style.opacity = '0.5';
      });
      card.addEventListener('dragend', function () {
        if (dragged) dragged.style.opacity = '1';
        dragged = null;
      });
    });

    $$('.kanban-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) {
        e.preventDefault();
        col.classList.add('drag-over');
      });
      col.addEventListener('dragleave', function () {
        col.classList.remove('drag-over');
      });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('drag-over');
        if (dragged && dragged.parentElement !== col) col.appendChild(dragged);
      });
    });
  }

  function collectControlState() {
    var specs = $$('.spec').map(function (specEl) {
      var specId = specEl.getAttribute('data-spec-id') || '';
      var values = {};

      $$('input[type="range"][data-kind="slider"]', specEl).forEach(function (input) {
        values[input.name || input.id] = Number(input.value);
      });

      $$('select[data-kind="dropdown"]', specEl).forEach(function (input) {
        values[input.name || input.id] = input.value;
      });

      $$('input[type="checkbox"][data-kind="checkbox"]', specEl).forEach(function (input) {
        values[input.name || input.id] = !!input.checked;
      });

      var radioGroups = {};
      $$('input[type="radio"][data-kind="choice"]:checked', specEl).forEach(function (input) {
        radioGroups[input.name] = input.value;
      });
      Object.assign(values, radioGroups);

      $$('.kanban[data-kind="kanban"]', specEl).forEach(function (board) {
        var controlId = board.getAttribute('data-control-id') || 'kanban';
        var board2 = {};
        $$('.kanban-col', board).forEach(function (col) {
          var colId = col.getAttribute('data-col-id') || '';
          board2[colId] = $$('.kanban-card', col).map(function (card) {
            return card.getAttribute('data-card-id') || '';
          });
        });
        values[controlId] = board2;
      });

      return { id: specId, values: values };
    });
    return specs;
  }

  function buildPromptText() {
    var meta = {
      session: (document.querySelector('meta[name="cc-session"]') || {}).content || '',
      turn: (document.querySelector('meta[name="cc-turn"]') || {}).content || '',
      title: document.title
    };
    var selections = collectControlState();
    var lines = [
      '# Selections from HTML artifact',
      '',
      'Source: ' + meta.title + ' · turn ' + meta.turn,
      '',
      '```json',
      JSON.stringify({ source: meta, selections: selections }, null, 2),
      '```',
      '',
      'Please continue based on these selections.'
    ];
    return lines.join('\n');
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

  function showFallbackTextarea(text) {
    var existing = document.getElementById('copy-fallback');
    if (existing) existing.remove();
    var wrap = document.createElement('details');
    wrap.id = 'copy-fallback';
    wrap.open = true;
    wrap.style.marginTop = '12px';
    var summary = document.createElement('summary');
    summary.textContent = 'Manual copy';
    wrap.appendChild(summary);
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.width = '100%';
    ta.style.minHeight = '160px';
    ta.style.marginTop = '8px';
    ta.style.fontFamily = 'var(--font-mono)';
    wrap.appendChild(ta);
    var bar = document.querySelector('.copy-bar');
    if (bar) bar.appendChild(wrap);
    ta.select();
  }

  function copyPrompt() {
    var text = buildPromptText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashStatus('Copied to clipboard. Paste into Claude Code.', 4000); },
        function () {
          var ok = fallbackCopy(text);
          flashStatus(ok ? 'Copied (fallback).' : 'Copy failed; select prompt below manually.', 4000);
          if (!ok) showFallbackTextarea(text);
        }
      );
    } else {
      var ok = fallbackCopy(text);
      flashStatus(ok ? 'Copied (fallback).' : 'Copy failed; select prompt below manually.', 4000);
      if (!ok) showFallbackTextarea(text);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireSliderOutputs();
    wireKanban();
    var btn = $('#copy-prompt-btn');
    if (btn) btn.addEventListener('click', copyPrompt);
  });
})();
