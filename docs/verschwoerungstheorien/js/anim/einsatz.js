/* 2D-3 Einsatz-Stapel: vier Symbole fallen auf die Ablage, das Preisschild "Ausstieg" wächst und wird rot */
(function () {
  'use strict';
  const { h, s, ease, Timeline, clamp, mixColor } = VT;
  const INK = '#1B1B1F', AMBER = '#E0A030', BLAU = '#3B7DD8', ROT = '#D8402B', PAPIER = '#F4F1EA';

  /* Symbole 100x100 um (0,0) */
  const ICONS = {
    Job(g, c) { // Aktentasche
      g.append(s('path', { d: 'M-18,-30 V-40 a8,8 0 0 1 8,-8 H10 a8,8 0 0 1 8,8 V-30', fill: 'none', stroke: c, 'stroke-width': 9, 'stroke-linejoin': 'round' }));
      g.append(s('rect', { x: -46, y: -32, width: 92, height: 68, rx: 12, fill: c }));
      g.append(s('rect', { x: -10, y: -10, width: 20, height: 18, rx: 4, fill: AMBER }));
    },
    Besitz(g, c) { // Haus
      g.append(s('path', { d: 'M-52,-4 L0,-50 L52,-4 Z', fill: c, 'stroke-linejoin': 'round', stroke: c, 'stroke-width': 8 }));
      g.append(s('rect', { x: -36, y: -6, width: 72, height: 50, rx: 4, fill: c }));
      g.append(s('rect', { x: -10, y: 12, width: 20, height: 32, rx: 4, fill: AMBER }));
    },
    Familie(g, c) { // zwei Figuren
      g.append(s('circle', { cx: -16, cy: -28, r: 14, fill: c }));
      g.append(s('path', { d: 'M-40,40 V-4 a14,14 0 0 1 14,-14 H-6 a14,14 0 0 1 14,14 V40 Z', fill: c }));
      g.append(s('circle', { cx: 28, cy: -6, r: 10, fill: AMBER }));
      g.append(s('path', { d: 'M12,40 V14 a10,10 0 0 1 10,-10 H34 a10,10 0 0 1 10,10 V40 Z', fill: AMBER }));
    },
    Ruf(g, c) { // Sprechblase mit Stern
      g.append(s('path', { d: 'M-48,-34 a14,14 0 0 1 14,-14 H34 a14,14 0 0 1 14,14 V14 a14,14 0 0 1 -14,14 H-8 L-30,48 V28 h-4 a14,14 0 0 1 -14,-14 Z', fill: c }));
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = (-90 + i * 36) * Math.PI / 180; pts.push((Math.cos(a) * r).toFixed(1) + ',' + (Math.sin(a) * r - 6).toFixed(1)); }
      g.append(s('polygon', { points: pts.join(' '), fill: AMBER }));
    },
  };
  const FARBEN = [BLAU, AMBER, INK, BLAU];

  VT.anims.einsatz = {
    create(host, cfg) {
      const names = cfg.symbole || ['Job', 'Besitz', 'Familie', 'Ruf'];
      const svg = s('svg', { viewBox: '0 0 1920 1080' });
      const root = h('div', { class: 'scene papier', 'data-anim': 'einsatz' }, svg);
      host.append(root);
      const tl = new Timeline(cfg.dauer || 6);
      const t0 = cfg.start ?? 0.5, ab = cfg.abstand ?? 1.2, fall = cfg.fall ?? 0.45, wach = cfg.wachstum ?? 0.5;

      /* Ablage links: offene Kiste */
      const X0 = 150, W = 760, FLOOR = 900;
      svg.append(s('rect', { x: X0, y: FLOOR + 14, width: W, height: 100, rx: 18, fill: 'rgba(11,11,13,.18)' }));
      const tiles = names.map(() => s('g', {}));
      // Kacheln liegen hinter der vorderen Kistenwand
      const kisteHinten = s('g', {});
      kisteHinten.append(s('rect', { x: X0 + 38, y: 760, width: W - 76, height: FLOOR - 760, fill: '#E6E1D4' }));
      svg.append(kisteHinten);
      tiles.forEach((g) => svg.append(g));
      const kisteVorn = s('g', {});
      kisteVorn.append(s('rect', { x: X0, y: 770, width: 40, height: FLOOR - 770 + 6, rx: 8, fill: INK }));
      kisteVorn.append(s('rect', { x: X0 + W - 40, y: 770, width: 40, height: FLOOR - 770 + 6, rx: 8, fill: INK }));
      kisteVorn.append(s('rect', { x: X0, y: FLOOR, width: W, height: 100, rx: 18, fill: INK }));
      kisteVorn.append(s('text', { x: X0 + W / 2, y: FLOOR + 69, 'text-anchor': 'middle', 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 58, fill: PAPIER, 'letter-spacing': 6, text: cfg.ablage || 'EINSATZ' }));
      svg.append(kisteVorn);

      const TW = 640, TH = 152, GAP = 10;
      const rot = [-1.4, 1.1, -0.8, 1.5];
      names.forEach((nm, i) => {
        const g = tiles[i];
        const inner = s('g', { transform: 'translate(' + -TW / 2 + ',' + -TH + ')' });
        inner.append(s('rect', { x: 0, y: 8, width: TW, height: TH, rx: 30, fill: 'rgba(11,11,13,.2)' }));
        inner.append(s('rect', { x: 0, y: 0, width: TW, height: TH, rx: 30, fill: '#FFFFFF', stroke: INK, 'stroke-width': 7 }));
        inner.append(s('rect', { x: 18, y: 18, width: TH - 36, height: TH - 36, rx: 26, fill: i === 2 ? '#F4F1EA' : '#F4F1EA' }));
        const ic = s('g', { transform: 'translate(' + (18 + (TH - 36) / 2) + ',' + TH / 2 + ') scale(0.92)' });
        (ICONS[nm] || ICONS.Job)(ic, FARBEN[i % FARBEN.length] === AMBER ? INK : FARBEN[i % FARBEN.length]);
        inner.append(ic);
        inner.append(s('text', { x: TH + 14, y: TH / 2 + 22, 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 68, fill: INK, text: nm }));
        g.append(inner);
        g.style.opacity = 0;
        const yEnd = FLOOR - i * (TH + GAP) - 4;
        const xEnd = X0 + W / 2;
        const ts = t0 + i * ab;
        tl.each((t) => {
          const q = t - ts;
          if (q < 0) { g.style.opacity = 0; return; }
          g.style.opacity = 1;
          const f = clamp(q / fall);
          let dy, sy = 1, sx = 1, ang;
          if (q < fall) {
            dy = -(1 - f * f) * (yEnd + 260);
            ang = rot[i] + (1 - f) * (i % 2 ? 9 : -9);
          } else {
            const z = q - fall;
            dy = -Math.abs(Math.sin(z * 11)) * 30 * Math.exp(-z * 6);
            const sq = Math.exp(-z * 9) * Math.cos(z * 22);
            sy = 1 - 0.07 * sq; sx = 1 + 0.04 * sq;
            ang = rot[i];
          }
          g.setAttribute('transform', 'translate(' + xEnd + ',' + (yEnd + dy) + ') rotate(' + ang + ') scale(' + sx + ',' + sy + ')');
        });
      });

      /* Preisschild rechts */
      const SX = 1360, TOP = 150, SW = 420, H0 = 240, DH = 150;
      const tag = s('g', {});
      const string = s('line', { x1: SX, y1: -20, x2: SX, y2: TOP + 40, stroke: INK, 'stroke-width': 7 });
      const body = s('rect', { x: SX - SW / 2, y: TOP, width: SW, height: H0, rx: 36, stroke: INK, 'stroke-width': 7 });
      const shadow = s('rect', { x: SX - SW / 2 + 12, y: TOP + 14, width: SW, height: H0, rx: 36, fill: 'rgba(11,11,13,.2)' });
      const hole = s('circle', { cx: SX, cy: TOP + 46, r: 17, fill: PAPIER, stroke: INK, 'stroke-width': 7 });
      const label = s('text', { x: SX, y: TOP + 170, 'text-anchor': 'middle', 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 76, text: cfg.preisschild || 'Ausstieg' });
      tag.append(string, shadow, body, hole, label);
      svg.append(tag);
      const growth = (t) => { let g = 0; for (let i = 0; i < names.length; i++) { const ts = t0 + i * ab + fall; g += ease.outBackSoft(clamp((t - ts) / wach)); } return g; };
      tl.each((t) => {
        const g = growth(t);
        const frac = clamp(g / names.length);
        const hh = H0 + g * DH;
        body.setAttribute('height', hh);
        shadow.setAttribute('height', hh);
        const col = mixColor(AMBER, ROT, frac);
        body.setAttribute('fill', col);
        label.setAttribute('fill', frac > 0.55 ? PAPIER : INK);
        let sw = 0;
        for (let i = 0; i < names.length; i++) { const q = t - (t0 + i * ab + fall); if (q > 0) sw += Math.sin(q * 9) * Math.exp(-q * 2.6) * 3.2; }
        tag.setAttribute('transform', 'rotate(' + sw + ' ' + SX + ' ' + -20 + ')');
      });
      return { tl, root };
    },
  };
})();
