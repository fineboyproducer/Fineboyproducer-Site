/* Fineboy Producer first-party analytics.
   Logs page views, scroll depth, checkout clicks, video progress, leads and purchases to Supabase (table fp_events), for the dashboard at /dash/.
   - Uses only the public insert-only key (same as /live). It cannot read anything back.
   - Sends no names, emails or phone numbers.
   - Skips the owner device (fp_owner=1) so your own visits never count.
   - A/B tests: give a page <meta name="fp-variant" content="B"> (or open it with ?v=B), or call
       fpTrack.variant('hero', ['A','B'])  -> returns this visitor's sticky variant and tags every event with it. */
(function () {
  'use strict';
  var URL_ = 'https://nynedxlhwephelzckjoe.supabase.co/rest/v1/fp_events';
  var KEY = 'sb_publishable_nvbgjEhrZjS7wg_YAre5qw_JdwTL6A_';
  var ls = null, ss = null;
  try { ls = window.localStorage; } catch (e) {}
  try { ss = window.sessionStorage; } catch (e) {}
  function get(s, k) { try { return s && s.getItem(k); } catch (e) { return null; } }
  function set(s, k, v) { try { s && s.setItem(k, v); } catch (e) {} }
  function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  var off = get(ls, 'fp_owner') === '1';
  /* Skip automated browsers and crawlers so they never count as visitors. */
  try { if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i.test(navigator.userAgent)) off = true; } catch (e) {}
  var q = new URLSearchParams(window.location.search);

  var vid = get(ls, 'fp_vid'); if (!vid) { vid = rid(); set(ls, 'fp_vid', vid); }
  var sid = get(ss, 'fp_sid'); if (!sid) { sid = rid(); set(ss, 'fp_sid', sid); }

  var page = window.location.pathname.replace(/index\.html$/i, '').replace(/\/+$/, '').toLowerCase() || '/';
  var exps = {};
  try { exps = JSON.parse(get(ls, 'fp_exp') || '{}') || {}; } catch (e) {}
  var meta = document.querySelector('meta[name="fp-variant"]');
  var pageVariant = (q.get('v') || (meta && meta.content) || '').slice(0, 30);

  function variantString() {
    var parts = [];
    if (pageVariant) parts.push(pageVariant);
    for (var k in exps) if (exps.hasOwnProperty(k)) parts.push(k + ':' + exps[k]);
    return parts.join(',').slice(0, 120);
  }

  var ref = '';
  try { var rh = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; ref = rh === window.location.hostname.replace(/^www\./, '') ? '' : rh; } catch (e) {}
  /* Attribution: where this visit came from. Read from the URL (utm_* or src) or the referrer on the first page,
     then remembered for the rest of the tab session so checkout and purchase events keep the same source. */
  function clean(v) { return v ? String(v).toLowerCase().trim().slice(0, 60) : null; }
  var attr = null;
  try { attr = JSON.parse(get(ss, 'fp_attr') || 'null'); } catch (e) {}
  var urlSource = clean(q.get('utm_source') || q.get('src'));
  var extRef = clean(ref) && !/paystack/.test(ref) ? clean(ref) : null;   /* the Paystack return is not a traffic source */
  if (urlSource || !attr || (attr.source === 'direct' && extRef)) {
    attr = {
      source: urlSource || extRef || 'direct',
      medium: clean(q.get('utm_medium')), campaign: clean(q.get('utm_campaign')),
      content: clean(q.get('utm_content')), term: clean(q.get('utm_term'))
    };
    set(ss, 'fp_attr', JSON.stringify(attr));
  }
  var source = attr.source || 'direct';
  var device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

  function send(event, o) {
    if (off) return;
    o = o || {};
    var row = {
      visitor_id: vid, session_id: sid, page: page, event: event,
      variant: variantString() || null, label: o.label ? String(o.label).slice(0, 60) : null,
      value: typeof o.value === 'number' ? o.value : null, source: source, device: device
    };
    var full = {};
    for (var k0 in row) if (row.hasOwnProperty(k0)) full[k0] = row[k0];
    full.medium = attr.medium; full.campaign = attr.campaign; full.content = attr.content; full.term = attr.term;
    var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    function post(body, retry) {
      try {
        fetch(URL_, { method: 'POST', keepalive: true, headers: H, body: JSON.stringify(body) })
          .then(function (r) { if (!r.ok && retry) post(row, false); })   /* database not upgraded yet: send without the campaign columns */
          .catch(function () {});
      } catch (e) {}
    }
    post(full, true);
  }

  var api = function (event, o) { send(String(event).slice(0, 40), o); };
  api.variant = function (name, options) {
    if (!exps[name] || options.indexOf(exps[name]) < 0) {
      exps[name] = options[Math.floor(Math.random() * options.length)];
      set(ls, 'fp_exp', JSON.stringify(exps));
    }
    return exps[name];
  };
  window.fpTrack = api;

  function start() {
    var closed = document.documentElement.classList.contains('is-closed');
    send('pageview', { label: closed ? 'closed' : '' });

    /* scroll depth: 50% and 90% of the page, once each */
    var s50 = false, s90 = false, tick = false;
    function check() {
      tick = false;
      var d = document.documentElement, max = d.scrollHeight - window.innerHeight;
      if (max < 200) return;
      var p = (window.pageYOffset || d.scrollTop) / max;
      if (!s50 && p >= 0.5) { s50 = true; send('scroll_50'); }
      if (!s90 && p >= 0.9) { s90 = true; send('scroll_90'); }
    }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(check); } }, { passive: true });

    /* checkout clicks: any Paystack link or [data-cta] button. The label says which button (its section). */
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-cta], a[href^="https://paystack.shop/"]') : null;
      if (!a) return;
      var sec = a.closest('section[id], [id]');
      send('checkout_click', { label: a.getAttribute('data-cta') || (sec && sec.id) || 'button' });
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
