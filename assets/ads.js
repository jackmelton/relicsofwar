/* Relics of War — ArtifactSearch network banner ads.
 * Fills <div class="row-ad" data-zone="leaderboard|medium_rectangle"> slots
 * with campaigns served directly by ArtifactSearch's public ad API
 * (CORS-enabled). Impressions and clicks are recorded by ArtifactSearch,
 * tagged publisher=relicsofwar so network reports break out this site.
 *
 * Same behaviour as the sister-site loaders (civilwarartillery.com,
 * civilwardealers.com): no third-party ad SDKs, no trackers, no cookies. Slot
 * dimensions are reserved (aspect-ratio) so ads never shift the layout (CLS 0).
 * When no campaign is booked, a house ad fills the slot. Impressions count only
 * when the creative is actually viewable (>=50% on screen for one continuous
 * second — the IAB/MRC rule ArtifactSearch's own slots use). Paid links carry
 * rel="sponsored" (brief §42–§43: paid placement is labeled and separate from
 * organic content). Load once per page: <script src="/assets/ads.js" defer>. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !document.querySelectorAll) return;

  var AS = 'https://artifactsearch.com';
  var PUB = 'relicsofwar';
  var ROTATE_MS = 8000;
  var MEDIA_KIT = 'https://historicalpublicationsllc.com/media-kit-2026.pdf';

  var SIZES = { leaderboard: { w: 728, h: 90 }, medium_rectangle: { w: 300, h: 250 } };

  var HOUSE = {
    leaderboard: {
      href: MEDIA_KIT,
      title: 'Reach serious military-antique collectors',
      text: 'Advertise across Relics of War, ArtifactSearch and Civil War News — view the media kit →'
    },
    medium_rectangle: {
      href: AS + '/',
      title: 'Search the whole marketplace',
      text: 'Every listing from every dealer and auction house, searchable on ArtifactSearch.com.'
    }
  };

  function ensureStyles() {
    if (document.getElementById('row-ad-css')) return;
    var css = '' +
      '.row-ad{display:flex;flex-direction:column;align-items:center;gap:4px;margin:1.2rem auto;max-width:100%;}' +
      '.row-ad-label{font-family:Cinzel,Georgia,serif;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:#8a8275;}' +
      '.row-ad-link{display:block;line-height:0;border:1px solid rgba(184,146,58,.35);background:#132619;}' +
      '.row-ad-link img{display:block;max-width:100%;height:auto;}' +
      '.row-ad-leaderboard .row-ad-link{width:728px;max-width:100%;aspect-ratio:728/90;}' +
      '.row-ad-rectangle .row-ad-link{width:300px;max-width:100%;aspect-ratio:300/250;}' +
      '.row-house{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;line-height:1.35;text-align:center;text-decoration:none;padding:10px 18px;background:linear-gradient(180deg,#1f3d2b,#132619);}' +
      '.row-house-title{font-family:Cinzel,Georgia,serif;font-weight:700;color:#d6b256;font-size:15px;}' +
      '.row-house-text{color:#ebe3cf;font-size:12.5px;font-family:"Crimson Text",Georgia,serif;}' +
      '.row-ad-leaderboard .row-house{flex-direction:row;gap:16px;}';
    var s = document.createElement('style');
    s.id = 'row-ad-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function trackPixel(id) {
    try {
      var px = new Image(1, 1);
      px.src = AS + '/api/ads/impression?b=' + encodeURIComponent(id) + '&publisher=' + PUB + '&t=' + Date.now();
    } catch (e) {}
  }

  /* Viewable-impression watcher: >=50% on screen (30% for tall creatives) for one
     continuous second; a hidden tab never counts. */
  var VIEW_RATIO = 0.5, VIEW_LARGE_RATIO = 0.3, VIEW_MS = 1000;
  function watchViewable(el) {
    var w = { visible: true, listeners: [] };
    w.subscribe = function (fn) {
      w.listeners.push(fn);
      return function () { var i = w.listeners.indexOf(fn); if (i >= 0) w.listeners.splice(i, 1); };
    };
    if (typeof IntersectionObserver === 'undefined') return w;
    w.visible = false;
    function publish(v) {
      if (v === w.visible) return;
      w.visible = v;
      for (var i = w.listeners.length - 1; i >= 0; i--) w.listeners[i](v);
    }
    new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      if (!e) return;
      var need = e.boundingClientRect.height > window.innerHeight * 0.5 ? VIEW_LARGE_RATIO : VIEW_RATIO;
      publish(e.isIntersecting && e.intersectionRatio >= need && !document.hidden);
    }, { threshold: [0, VIEW_LARGE_RATIO, VIEW_RATIO, 1] }).observe(el);
    document.addEventListener('visibilitychange', function () { if (document.hidden) publish(false); });
    return w;
  }
  function whenSeen(w, fn) {
    var timer = null;
    function stop() { if (timer) { clearTimeout(timer); timer = null; } }
    function go() { if (timer) return; timer = setTimeout(function () { timer = null; off(); fn(); }, VIEW_MS); }
    var off = w.subscribe(function (visible) { if (visible) go(); else stop(); });
    if (w.visible) go();
    return function () { stop(); off(); };
  }

  function houseAd(slot, zone) {
    var h = HOUSE[zone] || HOUSE.leaderboard;
    var a = document.createElement('a');
    a.className = 'row-ad-link row-house';
    a.href = h.href;
    a.target = '_blank';
    a.rel = 'noopener';
    var t = document.createElement('span'); t.className = 'row-house-title'; t.textContent = h.title;
    var x = document.createElement('span'); x.className = 'row-house-text'; x.textContent = h.text;
    a.appendChild(t); a.appendChild(x);
    var old = slot.querySelector('.row-ad-link'); if (old) old.remove();
    slot.appendChild(a);
  }

  function renderAd(slot, ad, view) {
    var old = slot.querySelector('.row-ad-link');
    if (old) old.remove();
    var a = document.createElement('a');
    a.className = 'row-ad-link';
    a.href = AS + '/api/ads/click?id=' + encodeURIComponent(ad.id) + '&publisher=' + PUB;
    a.target = '_blank';
    a.rel = 'sponsored noopener';
    var img = document.createElement('img');
    img.src = ad.imageUrl;
    img.alt = ad.altText || 'Advertisement';
    if (ad.width) img.width = ad.width;
    if (ad.height) img.height = ad.height;
    img.loading = 'eager';
    img.decoding = 'async';
    a.appendChild(img);
    slot.appendChild(a);
    if (slot.rowCancelSeen) slot.rowCancelSeen();
    slot.rowCancelSeen = whenSeen(view, function () { trackPixel(ad.id); });
  }

  function label(slot) {
    if (slot.querySelector('.row-ad-label')) return;
    var l = document.createElement('span');
    l.className = 'row-ad-label';
    l.textContent = 'Advertisement';
    slot.appendChild(l);
  }

  function fillSlot(slot) {
    var zone = slot.getAttribute('data-zone') || 'leaderboard';
    if (!SIZES[zone]) zone = 'leaderboard';
    slot.classList.add(zone === 'medium_rectangle' ? 'row-ad-rectangle' : 'row-ad-leaderboard');
    label(slot);
    /* House ad first, so the slot is never blank; upgraded to a booked banner below. */
    houseAd(slot, zone);
    if (!window.fetch) return;
    fetch(AS + '/api/ads/serve?zone=' + encodeURIComponent(zone) + '&publisher=' + PUB + '&count=8', { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { if (r.status === 204) return null; return r.ok ? r.json() : null; })
      .then(function (data) {
        var ads = [];
        if (data && data.ads && data.ads.length) ads = data.ads;
        else if (data && data.id && data.imageUrl) ads = [data];
        ads = ads.filter(function (a) { return a && a.id && a.imageUrl && a.imageUrl.indexOf('https://') === 0; });
        if (!ads.length) return; // nothing booked → house ad stays
        var view = watchViewable(slot);
        /* Per-pageview rotation offset so page 1 shows banner A, page 2 banner B… */
        var i = 0;
        try {
          var key = 'row-rot-' + zone;
          var n = parseInt(window.sessionStorage.getItem(key), 10);
          n = isNaN(n) || n < 0 ? 0 : n + 1;
          window.sessionStorage.setItem(key, String(n));
          i = n % ads.length;
        } catch (e) { i = Math.floor(Math.random() * ads.length); }
        renderAd(slot, ads[i], view);
        if (ads.length > 1) {
          setInterval(function () {
            if (document.hidden || !view.visible) return;
            i = (i + 1) % ads.length;
            renderAd(slot, ads[i], view);
          }, ROTATE_MS);
        }
      })
      .catch(function () { /* network error → house ad stays */ });
  }

  function init() {
    ensureStyles();
    var slots = document.querySelectorAll('.row-ad[data-zone]');
    for (var i = 0; i < slots.length; i++) fillSlot(slots[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
