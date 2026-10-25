/* 2D-9 Transfer Feed: neutraler, fiktiver Feed (keine echten Marken). Widerlegt, lauter, mehr Zustimmung. */
(function () {
  'use strict';
  const { h, s, ease, Timeline, clamp, lerp } = VT;
  const INK = '#1B1B1F', AMBER = '#E0A030', BLAU = '#3B7DD8';

  const zahl = (v) => (v < 1000 ? String(Math.round(v)) : v < 10000 ? (Math.round(v / 100) / 10).toFixed(1).replace('.', ',') + ' Tsd.' : Math.round(v / 1000) + ' Tsd.');

  function herz(size, fill) {
    const svg = s('svg', { viewBox: '0 0 64 64', width: size, height: size, style: { position: 'static', width: size + 'px', height: size + 'px', overflow: 'visible' } });
    svg.append(s('path', { d: 'M32,56 C10,40 4,28 4,19 C4,10 11,5 18,5 C24,5 29,8 32,14 C35,8 40,5 46,5 C53,5 60,10 60,19 C60,28 54,40 32,56 Z', fill }));
    return svg;
  }

  VT.anims.feed = {
    create(host, cfg) {
      const root = h('div', { class: 'scene papier feed', 'data-anim': 'feed' });
      host.append(root);
      const tl = new Timeline(cfg.dauer || 12);
      const grp = h('div', { class: 'abs', style: { left: 0, top: 0, width: '1920px', height: '1080px' } });
      root.append(grp);

      /* Beitrag */
      const post = h('div', { class: 'post' });
      const avatar = h('div', { class: 'avatar', style: { background: BLAU } });
      avatar.append(h('div', { class: 'abs', style: { left: '50%', top: '26%', width: '34%', height: '34%', marginLeft: '-17%', background: '#F4F1EA', borderRadius: '50%' } }));
      avatar.append(h('div', { class: 'abs', style: { left: '17%', top: '64%', width: '66%', height: '60%', background: '#F4F1EA', borderRadius: '50% 50% 0 0' } }));
      avatar.style.overflow = 'hidden';
      const name = h('div', { class: 'f-name', text: cfg.autor || '@klartext_77' });
      const text1 = h('div', { class: 'f-text', text: cfg.text || '' });
      const text2 = h('div', { class: 'f-text laut', text: cfg.textLaut || '' });
      const heartIcon = herz(60, AMBER);
      const zaehlText = h('span', { text: zahl(cfg.zaehler ? cfg.zaehler[0] : 1200) });
      const herzRow = h('div', { class: 'f-herz' }, heartIcon, zaehlText);
      post.append(avatar, name, text1, text2, herzRow);

      /* Faktencheck-Feld (schiebt sich unter den Beitrag) */
      const checkWrap = h('div', { class: 'abs', style: { overflow: 'hidden' } });
      const lupe = s('svg', { viewBox: '0 0 64 64', style: { position: 'static', width: '56px', height: '56px', flex: 'none', overflow: 'visible' } });
      lupe.append(s('circle', { cx: 26, cy: 26, r: 17, fill: 'none', stroke: INK, 'stroke-width': 7 }), s('line', { x1: 39, y1: 39, x2: 56, y2: 56, stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }));
      const check = h('div', { class: 'check' }, lupe, h('span', { text: cfg.check || 'Faktencheck: nicht belegt' }));
      checkWrap.append(check);

      const stempel = h('div', { class: 'stempel', text: cfg.stempelText || 'WIDERLEGT', style: { opacity: 0 } });

      /* Kommentare */
      const FARB = [AMBER, '#7A8CA0', '#2F9E8F'];
      const kTexte = cfg.kommentarTexte || ['So ist es!', 'Endlich sagt es mal einer.', 'Genau!'];
      const kRows = kTexte.map((tx, i) => {
        const av = h('div', { class: 'avatar', style: { position: 'static', width: '72px', height: '72px', flex: 'none', background: FARB[i % FARB.length] } });
        const row = h('div', { class: 'kommentar', style: { left: '300px', top: 700 + i * 94 + 'px', opacity: 0, transformOrigin: '0 50%' } }, av, h('div', { class: 'k-blase', text: tx }));
        return row;
      });

      grp.append(checkWrap, post, stempel, ...kRows);
      const balken = h('div', { class: 'balken', style: { top: '984px', height: '96px' }, text: cfg.balkenText || '' });
      root.append(balken);

      const T = cfg;
      const tCheck = T.faktencheck ?? 2, tStempel = T.stempel ?? 3, tLaut = T.laut ?? 4, tBalken = T.balken ?? 9;
      const z = T.zaehler || [1200, 4800, 19000], zt = T.zaehlerZeiten || [4.0, 5.0, 6.2];
      const km = T.kommentare || [6, 7.25, 8.5];
      const CY = 54;

      tl.each((t) => {
        // Beitrag erscheint
        const pin = ease.outCubic(clamp(t / 0.5));
        const g = ease.outBackSoft(clamp((t - tLaut) / 0.5));
        const cardW = lerp(1500, 1580, g), cardH = lerp(380, 500, g);
        const cardX = 960 - cardW / 2;
        const A = lerp(150, 184, g);
        const padd = 44;
        const tx = padd + A + 30, tw = cardW - tx - padd;
        post.style.left = cardX + 'px'; post.style.top = CY + (1 - pin) * 40 + 'px';
        post.style.width = cardW + 'px'; post.style.height = cardH + 'px'; post.style.opacity = pin;
        avatar.style.left = padd + 'px'; avatar.style.top = padd + 'px'; avatar.style.width = A + 'px'; avatar.style.height = A + 'px';
        name.style.left = tx + 'px'; name.style.top = padd + 4 + 'px';
        text1.style.left = tx + 'px'; text1.style.top = padd + 82 + 'px'; text1.style.width = tw + 'px';
        text2.style.left = tx + 'px'; text2.style.top = padd + 82 + 'px'; text2.style.width = tw + 'px';
        const sw = clamp((t - tLaut) / 0.25);
        text1.style.opacity = 1 - sw; text2.style.opacity = sw;
        text2.style.transform = 'scale(' + lerp(0.94, 1, sw) + ')'; text2.style.transformOrigin = '0 0';
        herzRow.style.left = tx + 'px'; herzRow.style.top = cardH - padd - 66 + 'px';
        // Zähler
        let v = z[0];
        if (t >= zt[0]) { const p = clamp((t - zt[0]) / (zt[1] - zt[0])); v = lerp(z[0], z[1], ease.inOutSine(p)); }
        if (t >= zt[1]) { const p = clamp((t - zt[1]) / (zt[2] - zt[1])); v = lerp(z[1], z[2], ease.inOutSine(p)); }
        zaehlText.textContent = zahl(v);
        let pulse = 1;
        [zt[1], zt[2]].forEach((m) => { const q = t - m; if (q > 0 && q < 0.4) pulse += Math.sin(q / 0.4 * Math.PI) * 0.28; });
        heartIcon.style.transform = 'scale(' + pulse + ')';
        // Faktencheck
        const cp = ease.outCubic(clamp((t - tCheck) / 0.55));
        const checkH = 104;
        checkWrap.style.left = cardX + 40 + 'px'; checkWrap.style.width = cardW - 80 + 'px';
        checkWrap.style.top = CY + cardH - 6 + 'px'; checkWrap.style.height = checkH * cp + 'px';
        check.style.width = cardW - 80 + 'px'; check.style.height = checkH + 'px';
        check.style.transform = 'translateY(' + -(1 - cp) * checkH + 'px)';
        // Stempel
        const sp = clamp((t - tStempel) / 0.28);
        stempel.style.opacity = sp > 0 ? 1 : 0;
        const scl = lerp(2.8, 1, ease.outCubic(sp));
        stempel.style.left = cardX + cardW - 400 + 'px'; stempel.style.top = CY + cardH - 30 + 'px';
        stempel.style.transform = 'translate(-50%,-50%) rotate(-8deg) scale(' + scl + ')';
        // Beben
        const q = t - (tStempel + 0.22);
        const sh = q > 0 ? Math.sin(q * 70) * 15 * Math.exp(-q * 9) : 0;
        const sh2 = q > 0 ? Math.cos(q * 55) * 8 * Math.exp(-q * 9) : 0;
        grp.style.transform = 'translate(' + sh + 'px,' + sh2 + 'px)';
        // Kommentare
        kRows.forEach((r, i) => {
          const p = ease.outBack(clamp((t - km[i]) / 0.5));
          r.style.opacity = clamp((t - km[i]) / 0.15);
          r.style.transform = 'scale(' + (0.6 + 0.4 * p) + ')';
          r.style.top = 700 + i * 94 + 'px';
        });
        // Balken
        const bp = ease.outCubic(clamp((t - tBalken) / 0.55));
        balken.style.transform = 'translateX(' + -(1 - bp) * 1920 + 'px)';
      });
      return { tl, root };
    },
  };
})();
