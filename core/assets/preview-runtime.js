'use strict';

var MIN_INTERVAL = 600;
var MAX_INTERVAL = 5000;
var BACKSTOP_MS = 35000;

function nextInterval(s) {
  if (s.pending || s.advanced) return MIN_INTERVAL;
  return Math.min(MAX_INTERVAL, Math.round(s.current * 1.8));
}

function isTurnPending(turn, local) {
  // The lock-free invariant bars the enricher from clearing the manifest's pending flag,
  // and the next Stop hook only upserts its own turn. So a finished turn's manifest entry
  // stays pending:true forever. The poller's locally-observed final chunk (knownFinal[i])
  // is authoritative; without this gate, the chunk is re-fetched every tick and the
  // backstop reload fires every BACKSTOP_MS for every previously-enriched turn.
  if (!turn || !turn.pending) return false;
  if (local && local.knownFinal && local.knownFinal[turn.i]) return false;
  return true;
}

function selectChunksToLoad(manifest, local) {
  if (!manifest || !Array.isArray(manifest.turns)) return [];
  var out = [];
  for (var k = 0; k < manifest.turns.length; k++) {
    var t = manifest.turns[k];
    var rendered = local.renderedRev[t.i];
    if (rendered === undefined) { out.push(t.i); continue; }
    if (isTurnPending(t, local)) out.push(t.i);
  }
  return out;
}

function shouldBackstopReload(turnState, now) {
  if (!turnState || turnState.pendingSince == null) return false;
  return (now - turnState.pendingSince) > BACKSTOP_MS;
}

function scrollStashKey(href) { return 'tohtml-scroll:' + String(href); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { nextInterval, isTurnPending, selectChunksToLoad, shouldBackstopReload, scrollStashKey, MIN_INTERVAL, MAX_INTERVAL, BACKSTOP_MS };
}

if (typeof document !== 'undefined') {
  (function bootstrap() {
    var state = { version: 0, renderedRev: {}, knownFinal: {}, interval: MIN_INTERVAL, pendingSince: {}, nonce: 0 };
    var manifest = null;

    window.__tohtmlManifest = function (m) { manifest = m; };
    window.__tohtmlChunk = function (i, data) { applyChunk(i, data); };

    function injectScript(src, id) {
      var prev = document.getElementById(id);
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
      var el = document.createElement('script');
      el.id = id;
      el.src = src;
      document.body.appendChild(el);
    }

    function applyChunk(i, data) {
      if (!data || data.rev === undefined) return;
      if (state.renderedRev[i] !== undefined && data.rev <= state.renderedRev[i]) return;
      var art = document.querySelector('article[data-turn="' + i + '"]');
      if (!art) {
        art = document.createElement('article');
        art.className = 'cc-turn';
        art.setAttribute('data-turn', String(i));
        mountNewestFirst(art, i);
      }
      // innerHTML trust boundary: data.fragment is HTML already produced by core/lib/compose.js,
      // which routes all model content through the v2.0.3 escape/sanitize path before it is
      // written to a chunk. Same trust model as the on-disk archive file. Header substrings are
      // additionally run through escapeText. Do NOT escape data.fragment at this layer - it would
      // double-escape the rendered output.
      art.innerHTML =
        '<header class="cc-turn-head"><span class="cc-turn-n">turn ' + i + '</span>'
        + '<span class="cc-turn-title">' + escapeText(data.title || '') + '</span>'
        + (data.template ? '<span class="cc-turn-tpl">' + escapeText(data.template) + '</span>' : '')
        + '</header><div class="cc-turn-frag">' + (data.fragment || '') + '</div>';
      state.renderedRev[i] = data.rev;
      if (data.final || data.rev >= 2) {
        state.pendingSince[i] = null;
        state.knownFinal[i] = true;
      }
    }

    function mountNewestFirst(art, i) {
      var feed = document.getElementById('cc-feed');
      var nodes = feed.querySelectorAll('article[data-turn]');
      var inserted = false;
      for (var n = 0; n < nodes.length; n++) {
        if (Number(nodes[n].getAttribute('data-turn')) < i) { feed.insertBefore(art, nodes[n]); inserted = true; break; }
      }
      if (!inserted) feed.appendChild(art);
    }

    function escapeText(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function tick() {
      state.nonce++;
      injectScript('preview-manifest.js?v=' + state.nonce, 'cc-manifest-script');
      setTimeout(afterManifest, 120);
    }

    function afterManifest() {
      var advanced = false;
      var pending = false;
      var now = Date.now();
      if (manifest && manifest.version > state.version) { state.version = manifest.version; advanced = true; }
      if (manifest && Array.isArray(manifest.turns)) {
        var toLoad = selectChunksToLoad(manifest, state);
        for (var j = 0; j < manifest.turns.length; j++) {
          var t = manifest.turns[j];
          if (isTurnPending(t, state)) { pending = true; if (state.pendingSince[t.i] == null) state.pendingSince[t.i] = now; }
        }
        for (var q = 0; q < toLoad.length; q++) {
          state.nonce++;
          var ti = toLoad[q];
          injectScript('preview-turns/' + pad4(ti) + '.js?v=' + state.nonce, 'cc-chunk-script-' + ti);
        }
        for (var p = 0; p < manifest.turns.length; p++) {
          var tt = manifest.turns[p];
          if (isTurnPending(tt, state) && shouldBackstopReload({ pendingSince: state.pendingSince[tt.i] }, now)) { backstopReload(); return; }
        }
      }
      state.interval = nextInterval({ pending: pending, advanced: advanced, current: state.interval });
      setTimeout(tick, state.interval);
    }

    function pad4(n) { return String(n).padStart(4, '0'); }

    function backstopReload() {
      try { sessionStorage.setItem(scrollStashKey(location.href), String(window.scrollY)); } catch (_e) {}
      location.reload();
    }

    function restoreScroll() {
      try {
        var v = sessionStorage.getItem(scrollStashKey(location.href));
        if (v != null) { window.scrollTo(0, Number(v)); sessionStorage.removeItem(scrollStashKey(location.href)); }
      } catch (_e) {}
    }

    restoreScroll();
    tick();
  })();
}
