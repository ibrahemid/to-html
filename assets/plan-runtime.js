(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function getPlanData() {
    var el = document.getElementById('plan-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent || el.innerText || '{}'); } catch (_) { return null; }
  }

  function planToMarkdown(plan) {
    if (!plan) return '';
    var lines = ['# ' + (plan.title || 'Plan'), ''];
    var statusMap = { pending: ' ', in_progress: '~', completed: 'x', failed: '!' };
    (plan.phases || []).forEach(function (phase, idx) {
      lines.push('## Phase ' + (idx + 1) + ': ' + phase.title);
      lines.push('');
      (phase.notes || []).forEach(function (note) {
        lines.push(note);
        lines.push('');
      });
      (phase.tasks || []).forEach(function (task) {
        var marker = statusMap[task.status] || ' ';
        lines.push('- [' + marker + '] ' + task.text);
      });
      lines.push('');
    });
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

  function copyMarkdown() {
    var plan = getPlanData();
    var text = planToMarkdown(plan);
    if (!text) {
      flashStatus('No plan data found.', 4000);
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashStatus('Copied as markdown. Paste back into Claude Code.', 4000); },
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

  document.addEventListener('DOMContentLoaded', function () {
    preserveScrollAcrossReloads();
    var btn = $('#copy-plan-md-btn');
    if (btn) btn.addEventListener('click', copyMarkdown);
  });
})();
