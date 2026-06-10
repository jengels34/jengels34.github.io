/* Khakichimp — brings the chimp mascot to life.
   Injects /assets/chimp.svg into every [data-chimp] host, then rigs it:
   idle head sway, cursor head + eye tracking, periodic wave, ear flicks,
   and poke/celebrate reactions. Idle breathing + blinking live in the SVG's
   own CSS so the mascot is alive even before this script runs (or if it can't).
   Exposes host._chimp = { el, react(combo), celebrate(), wave() } per instance. */
(function () {
  'use strict';
  var SVG_URL = '/assets/chimp.svg';
  var cache = null;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fetchSvg() {
    if (cache) return cache;
    cache = fetch(SVG_URL).then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; });
    return cache;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function noop() {}

  function rig(host) {
    var svg = host.querySelector('svg');
    var api = { el: svg, react: noop, celebrate: noop, wave: noop };
    host._chimp = api;
    if (!svg || reduce || !window.gsap) return api;

    var head = svg.querySelector('.ck-head');
    var pupils = svg.querySelector('.ck-pupils');
    var earL = svg.querySelector('.ck-ear-l');
    var earR = svg.querySelector('.ck-ear-r');
    var armR = svg.querySelector('.ck-arm-r');

    /* hand head + ears over to JS (they have CSS idle animations by default) */
    if (head) head.style.animation = 'none';
    if (earL) earL.style.animation = 'none';
    if (earR) earR.style.animation = 'none';

    /* idle head sway */
    if (head) gsap.to(head, { y: -2, rotation: -1.2, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut', svgOrigin: '120 148' });

    /* follow the cursor with head + eyes */
    function onMove(e) {
      var r = svg.getBoundingClientRect();
      if (!r.width) return;
      var dx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      var dy = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 1.5), -1, 1);
      if (head) gsap.to(head, { rotation: dx * 5, x: dx * 5, duration: 0.6, overwrite: 'auto', svgOrigin: '120 148' });
      if (pupils) gsap.to(pupils, { x: dx * 4, y: dy * 3, duration: 0.5, overwrite: 'auto' });
    }
    window.addEventListener('mousemove', onMove, { passive: true });

    function earFlick() {
      if (earL) gsap.fromTo(earL, { rotation: 0 }, { rotation: -8, duration: 0.14, yoyo: true, repeat: 1, svgOrigin: '70 86' });
      if (earR) gsap.fromTo(earR, { rotation: 0 }, { rotation: 8, duration: 0.14, yoyo: true, repeat: 1, svgOrigin: '170 86' });
    }

    api.wave = function () {
      if (!armR) return;
      gsap.timeline()
        .to(armR, { rotation: -52, duration: 0.3, ease: 'power2.out', svgOrigin: '148 162' })
        .to(armR, { rotation: -38, duration: 0.22, yoyo: true, repeat: 3, ease: 'sine.inOut', svgOrigin: '148 162' })
        .to(armR, { rotation: 0, duration: 0.4, ease: 'power2.inOut', svgOrigin: '148 162' });
    };
    (function scheduleWave() {
      gsap.delayedCall(8 + Math.random() * 9, function () {
        if (!document.hidden) api.wave();
        scheduleWave();
      });
    })();

    api.react = function (combo) {
      var lift = clamp(7 + (combo || 1) * 2, 7, 20);
      gsap.fromTo(svg, {}, { keyframes: [
        { y: -lift, scaleX: 1.05, scaleY: 0.95, duration: 0.14, ease: 'power2.out' },
        { y: 0, scaleX: 1, scaleY: 1, duration: 0.55, ease: 'elastic.out(1,0.45)' }
      ], transformOrigin: '50% 100%', overwrite: 'auto' });
      earFlick();
    };
    api.celebrate = function () {
      gsap.fromTo(svg, {}, { keyframes: [
        { y: -30, scale: 1.08, duration: 0.2, ease: 'power2.out' },
        { rotation: 360, duration: 0.6, ease: 'power1.inOut' },
        { y: 0, scale: 1, rotation: 0, duration: 0.45, ease: 'bounce.out' }
      ], transformOrigin: '50% 60%', overwrite: 'auto' });
    };
    return api;
  }

  function mount(host) {
    return fetchSvg().then(function (txt) {
      host.innerHTML = txt
        ? txt
        : '<img src="' + SVG_URL + '" alt="Khakichimp" style="width:100%;height:auto;display:block">';
      rig(host);
      host.dispatchEvent(new CustomEvent('chimp:ready', { bubbles: true }));
    });
  }
  function init() {
    var hosts = document.querySelectorAll('[data-chimp]');
    Array.prototype.forEach.call(hosts, mount);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.Khakichimp = { mount: mount };
})();
