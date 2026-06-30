(function () {
  'use strict';

  var PREFIX = 'cc-checklist:' + (location.pathname || '') + ':';

  function store(box) {
    try {
      if (box.checked) localStorage.setItem(PREFIX + box.id, '1');
      else localStorage.removeItem(PREFIX + box.id);
    } catch (_e) { /* localStorage may be unavailable from file:// */ }
  }

  function load(box) {
    try { return localStorage.getItem(PREFIX + box.id) === '1'; } catch (_e) { return false; }
  }

  function updateGroup(group) {
    var boxes = group.querySelectorAll('.cc-ck-box');
    var done = 0;
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) done++;
    var count = group.querySelector('[data-ck-count]');
    if (count) count.textContent = done + ' / ' + boxes.length;
    group.classList.toggle('is-complete', boxes.length > 0 && done === boxes.length);
  }

  function init() {
    var boxes = document.querySelectorAll('.cc-ck-box');
    for (var i = 0; i < boxes.length; i++) {
      if (load(boxes[i])) boxes[i].checked = true;
      var item = boxes[i].closest('.cc-ck-item');
      if (item) item.classList.toggle('is-checked', boxes[i].checked);
    }
    var groups = document.querySelectorAll('.cc-ck-group');
    for (var g = 0; g < groups.length; g++) updateGroup(groups[g]);
  }

  document.addEventListener('change', function (event) {
    var box = event.target;
    if (!box.classList || !box.classList.contains('cc-ck-box')) return;
    store(box);
    var item = box.closest('.cc-ck-item');
    if (item) item.classList.toggle('is-checked', box.checked);
    var group = box.closest('.cc-ck-group');
    if (group) updateGroup(group);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
