(function () {
  'use strict';

  function flash(btn) {
    var original = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('is-copied');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('is-copied');
    }, 1200);
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch (_e) {
      return false;
    }
  }

  // file:// is not a secure context in several browsers, so navigator.clipboard
  // can be absent or reject. Fall back to execCommand, which works from file://.
  function copyText(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flash(btn); },
        function () { if (legacyCopy(text)) flash(btn); }
      );
      return;
    }
    if (legacyCopy(text)) flash(btn);
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest ? event.target.closest('.cc-copy-btn') : null;
    if (!btn) return;
    var wrap = btn.closest('.cc-copy');
    var field = wrap ? wrap.querySelector('.cc-copy-text') : null;
    if (!field) return;
    copyText(field.value, btn);
  });
})();
