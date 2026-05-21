(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

  function getPicked() {
    var radio = document.querySelector('input[name="pick-option"]:checked');
    if (!radio) return null;
    return {
      id: radio.value,
      label: radio.getAttribute('data-option-label') || radio.value
    };
  }

  function getReason() {
    var input = $('#pick-reason');
    return input ? input.value.trim() : '';
  }

  function refresh() {
    var picked = getPicked();
    var pickLabel = $('#pick-label');
    var btn = $('#copy-decision-btn');
    if (pickLabel) pickLabel.textContent = picked ? 'Going with: ' + picked.label : 'Pick an option';
    if (btn) btn.disabled = !picked;
  }

  function buildPrompt() {
    var picked = getPicked();
    if (!picked) return null;
    var reason = getReason();
    var title = (document.querySelector('.cmp-head h1') || {}).textContent || 'this decision';
    var lines = ['Go with **' + picked.label + '** for ' + title.trim() + '.'];
    if (reason) {
      lines.push('');
      lines.push('Reason: ' + reason);
    }
    lines.push('');
    lines.push('Proceed with implementation. Confirm any assumptions before writing code.');
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

  function copyDecision() {
    var text = buildPrompt();
    if (!text) {
      flashStatus('Nothing picked.', 3000);
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

  function wireOptionCardClick() {
    $$('.opt').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.matches('input, label, button, a')) return;
        var radio = card.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('input[name="pick-option"]').forEach(function (r) { r.addEventListener('change', refresh); });
    var reason = $('#pick-reason');
    if (reason) reason.addEventListener('input', refresh);
    var btn = $('#copy-decision-btn');
    if (btn) btn.addEventListener('click', copyDecision);
    wireOptionCardClick();
    refresh();
  });
})();
