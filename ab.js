/* Fineboy Producer copy split test (A = current copy, B = research-based copy).
   - Each visitor is put in A or B once, and stays there on every page (stored in localStorage as fp_ab).
   - B copy is defined in /ab-copy.js as exact text swaps per page. A page with no B copy is left alone.
   - The variant is written to fp_exp as "copy", so /track.js tags every event with it (e.g. "copy:B")
     and the /dash/ A/B table compares the two on each page.
   - Preview (owner device only): open any page with ?owner=fineboy-preview&copy=B (or copy=A).
   - If storage is blocked or anything fails, the visitor just sees the current copy (A). */
(function () {
  'use strict';
  var d = document.documentElement, ls = null;
  try { ls = window.localStorage; } catch (e) {}
  function get(k) { try { return ls && ls.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { ls && ls.setItem(k, v); } catch (e) {} }
  function del(k) { try { ls && ls.removeItem(k); } catch (e) {} }

  var q = new URLSearchParams(window.location.search);
  if (q.get('owner') === 'fineboy-preview') set('fp_owner', '1');
  else if (q.get('owner') === 'off') del('fp_owner');
  var owner = get('fp_owner') === '1';

  var page = window.location.pathname;
  try { page = decodeURIComponent(page); } catch (e) {}
  page = page.replace(/index\.html$/i, '').replace(/\/+$/, '').toLowerCase() || '/';

  var pairs = (window.FP_COPY_B || {})[page];
  var exps = {};
  try { exps = JSON.parse(get('fp_exp') || '{}') || {}; } catch (e) {}

  /* Pages with no B copy are not part of the test, so they carry no copy tag. */
  if (!pairs || !pairs.length) {
    if (exps.copy) { delete exps.copy; set('fp_exp', JSON.stringify(exps)); }
    return;
  }

  var bucket = get('fp_ab');
  if (bucket !== 'A' && bucket !== 'B') {
    bucket = Math.random() < 0.5 ? 'A' : 'B';
    set('fp_ab', bucket);
  }
  exps.copy = bucket;
  set('fp_exp', JSON.stringify(exps));

  var show = bucket;
  var ov = (q.get('copy') || '').toUpperCase();
  if (owner && (ov === 'A' || ov === 'B')) show = ov;
  if (show !== 'B') return;

  d.classList.add('fp-copy-b', 'fp-ab-wait');
  var st = document.createElement('style');
  st.textContent = 'html.fp-ab-wait body{opacity:0}';
  (document.head || d).appendChild(st);
  function done() { d.classList.remove('fp-ab-wait'); }
  var safety = setTimeout(done, 1500);

  function norm(t) { return t.replace(/\s+/g, ' ').trim(); }
  function apply() {
    try {
      var map = {};
      for (var i = 0; i < pairs.length; i++) map[norm(pairs[i][0])] = pairs[i][1];
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false), n, todo = [];
      while ((n = w.nextNode())) {
        var p = n.parentNode && n.parentNode.nodeName;
        if (p === 'SCRIPT' || p === 'STYLE' || p === 'NOSCRIPT') continue;
        var key = norm(n.nodeValue);
        if (key && map.hasOwnProperty(key)) todo.push([n, map[key]]);
      }
      todo.forEach(function (t) {
        var v = t[0].nodeValue;
        t[0].nodeValue = v.match(/^\s*/)[0] + t[1] + v.match(/\s*$/)[0];
      });
    } catch (e) {}
    clearTimeout(safety); done();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
