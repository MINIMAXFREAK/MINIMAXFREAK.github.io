/* 2D-5 Umdeutung: eigener Zettel mit der neuen Botschaft. "Es ist nichts passiert." wird durchgestrichen,
   "Unser Licht hat die Welt gerettet." schreibt sich ein, darunter die Begründung und das Fazit. */
(function () {
  'use strict';
  const { h, ease, Timeline } = VT;

  VT.anims.umdeutung = {
    create(host, cfg) {
      const t2 = cfg.text2 || 'Unser Licht hat die Welt gerettet.';
      const strich = h('div', { class: 'u-strich' });
      const z1 = h('div', { class: 'u-z1', text: cfg.text1 || 'Es ist nichts passiert.' }, strich);
      const chars = [...t2].map((c) => h('span', { text: c }));
      const caret = h('span', { class: 'u-caret' });
      const z2 = h('div', { class: 'u-z2' }, chars, caret);
      const kopf = h('div', { class: 'u-kopf', text: cfg.kopfText || 'Die neue Botschaft' });
      const grund = h('div', { class: 'u-grund', text: cfg.grundText || 'Weil wir so fest geglaubt haben, hat Gott die Welt verschont.' });
      const tape = h('div', { class: 'u-tape' });
      const zettel = h('div', { class: 'u-zettel' }, tape, kopf, z1, z2, grund);
      const fazit = h('div', { class: 'u-fazit', text: cfg.fazitText || 'Aus dem Scheitern wird ein Sieg.' });
      const root = h('div', { class: 'scene dunkel umdeutung', 'data-anim': 'umdeutung' }, zettel, fazit);
      host.append(root);

      const tl = new Timeline(cfg.dauer || 8.5);
      const T = { zettel: 0, kopf: 0.8, z1: 1.2, strich: 2.2, strichDauer: 0.5, z2: 3.1, schreib: 1.8, grund: 5.4, fazit: 6.6 };
      Object.keys(T).forEach((k) => { if (cfg[k] != null) T[k] = cfg[k]; });
      tl.tween(T.zettel, 0.8, ease.outBackSoft, (p) => {
        zettel.style.opacity = Math.min(1, p * 3);
        zettel.style.transform = 'translateY(' + (1 - p) * 140 + 'px) rotate(' + (-6 + 4 * p) + 'deg)';
      });
      tl.tween(T.kopf, 0.4, ease.outCubic, (p) => { kopf.style.opacity = p; });
      tl.tween(T.z1, 0.5, ease.outCubic, (p) => { z1.style.opacity = p; });
      tl.tween(T.strich, T.strichDauer, ease.inOutCubic, (p) => { strich.style.width = (z1.offsetWidth + 24) * p + 'px'; });
      tl.tween(T.strich + T.strichDauer, 0.5, ease.outCubic, (p) => { z1.style.color = 'rgba(27,27,31,' + (1 - 0.55 * p).toFixed(2) + ')'; });
      tl.tween(T.grund, 0.6, ease.outCubic, (p) => { grund.style.opacity = p; grund.style.transform = 'translateY(' + (1 - p) * 14 + 'px)'; });
      tl.tween(T.fazit, 0.6, ease.outBack, (p) => {
        fazit.style.opacity = Math.min(1, p * 3); fazit.style.transform = 'scale(' + (0.8 + 0.2 * p) + ')';
      });
      tl.each((t) => {
        const n = chars.length, a2 = T.z2, wd = T.schreib;
        const kk = t < a2 ? 0 : t >= a2 + wd ? n : Math.ceil(((t - a2) / wd) * n);
        chars.forEach((c, i) => { c.style.opacity = i < kk ? 1 : 0; });
        if (caret.nextSibling !== (chars[kk] || null) || !caret.parentNode) z2.insertBefore(caret, chars[kk] || null);
        const typing = t >= a2 && t < a2 + wd;
        caret.style.opacity = t < a2 ? 0 : typing ? 1 : (Math.floor(t * 2) % 2 === 0 && t < a2 + wd + 1.0 ? 1 : 0);
      });
      return { tl, root };
    },
  };
})();
