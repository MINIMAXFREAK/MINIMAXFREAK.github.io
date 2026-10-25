/* 2D-4 Dissonanz: zwei Gedanken stehen nebeneinander, ein Blitz dazwischen zeigt den Widerspruch, Spannung steigt, zwei Wege */
(function () {
  'use strict';
  const { h, s, ease, Timeline, clamp, mixColor } = VT;
  const INK = '#1B1B1F', AMBER = '#E0A030', BLAU = '#3B7DD8', ROT = '#D8402B', PAPIER = '#F4F1EA', PAPIER2 = '#E6E1D4';

  VT.anims.dissonanz = {
    create(host, cfg) {
      const svg = s('svg', { viewBox: '0 0 1920 1080' });
      const root = h('div', { class: 'scene papier dissonanz', 'data-anim': 'dissonanz' }, svg);
      host.append(root);
      const tl = new Timeline(cfg.dauer || 12);
      const gl = cfg.gleiten ?? 2.5, tk = cfg.knoten ?? gl;

      /* Gedankenblasen */
      const BW = 660, BH = 250, BY = 120;
      const bubble = (x, fill, textCol, zeilen, side) => {
        const g = s('g', {});
        g.append(s('rect', { x, y: BY + 12, width: BW, height: BH, rx: 110, fill: 'rgba(11,11,13,.18)' }));
        g.append(s('rect', { x, y: BY, width: BW, height: BH, rx: 110, fill }));
        // Gedankenpunkte Richtung Mitte unten
        const dir = side === 'l' ? 1 : -1, bx = side === 'l' ? x + BW - 150 : x + 150;
        g.append(s('circle', { cx: bx + dir * 24, cy: BY + BH + 36, r: 16, fill }));
        g.append(s('circle', { cx: bx + dir * 56, cy: BY + BH + 74, r: 9, fill }));
        const lh = 80, y0 = BY + BH / 2 - ((zeilen.length - 1) * lh) / 2 + 22;
        const tx = x + BW / 2;
        zeilen.forEach((z, i) => g.append(s('text', { x: tx, y: y0 + i * lh, 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif', 'font-weight': 600, 'font-size': 66, fill: textCol, text: z })));
        svg.append(g);
        return g;
      };
      const split = (str) => { const w = String(str).split(' '); const m = Math.ceil(w.length / 2); return [w.slice(0, m).join(' '), w.slice(m).join(' ')]; };
      const gL = bubble(230, BLAU, PAPIER, split(cfg.links || 'Ich habe alles geopfert'), 'l');
      const gR = bubble(1030, INK, PAPIER, split(cfg.rechts || 'Es ist nichts passiert'), 'r');
      const startOff = 1000;
      tl.each((t) => {
        const off = (1 - ease.outCubic(clamp(t / gl))) * startOff;
        gL.setAttribute('transform', 'translate(' + -off + ',0)');
        gR.setAttribute('transform', 'translate(' + off + ',0)');
        gL.style.opacity = gR.style.opacity = clamp(t / 0.3);
      });

      /* Blitz zwischen den Gedanken: sie widersprechen einander */
      const blitz = s('g', { opacity: 0 });
      blitz.append(s('path', { d: 'M34,-150 L-52,12 L-6,12 L-38,152 L62,-34 L12,-34 Z', fill: AMBER, stroke: INK, 'stroke-width': 9, 'stroke-linejoin': 'round' }));
      svg.append(blitz);
      tl.each((t) => {
        const q = t - tk;
        if (q < 0) { blitz.setAttribute('opacity', 0); return; }
        const flicker = q < 0.7 ? (Math.floor(q * 18) % 3 === 1 ? 0.35 : 1) : 1;
        const pop = ease.outBack(clamp(q / 0.35));
        blitz.setAttribute('opacity', flicker);
        blitz.setAttribute('transform', 'translate(960,' + (BY + BH / 2 + 10) + ') scale(' + (0.4 + 0.6 * pop) + ')');
      });

      /* Spannungsbalken */
      const BX = 520, BYY = 470, BWW = 1100, BHH = 46;
      const bg = s('g', {});
      const track = s('rect', { x: BX, y: BYY, width: BWW, height: BHH, rx: BHH / 2, fill: PAPIER2 });
      const fillBar = s('rect', { x: BX, y: BYY, width: 0, height: BHH, rx: BHH / 2, fill: AMBER });
      const lab = s('text', { x: BX - 30, y: BYY + 36, 'text-anchor': 'end', 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 48, fill: INK, text: cfg.balken || 'Spannung' });
      bg.append(track, fillBar, lab);
      svg.append(bg);
      const bs = cfg.balkenStart ?? 3, br = cfg.balkenRot ?? 7;
      tl.tween(bs - 0.4, 0.4, ease.outCubic, (p) => { bg.style.opacity = p; });
      tl.tween(bs, br - bs, ease.inOutSine, (p) => {
        fillBar.setAttribute('width', Math.max(0, BHH + p * (BWW - BHH)) * (p > 0 ? 1 : 0));
        fillBar.setAttribute('fill', mixColor(AMBER, ROT, p));
      });

      /* Pfeile nach unten */
      const pf = cfg.pfeile ?? 8;
      const pfeil = (x2) => {
        const g = s('g', {});
        const x1 = 960, y1 = 570, y2 = 668;
        const ln = Math.hypot(x2 - x1, y2 - y1);
        const line = s('line', { x1, y1, x2, y2, stroke: INK, 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-dasharray': ln, 'stroke-dashoffset': ln });
        const ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const head = s('path', { d: 'M-8,-26 L30,0 L-8,26 Z', fill: INK, transform: 'translate(' + x2 + ',' + y2 + ') rotate(' + ang + ')', opacity: 0 });
        g.append(line, head);
        svg.append(g);
        tl.tween(pf, 0.8, ease.outCubic, (p) => {
          line.setAttribute('stroke-dashoffset', ln * (1 - p));
          const e = Math.min(1, p * 1.0);
          head.setAttribute('opacity', p > 0.85 ? 1 : 0);
          void e;
        });
      };
      pfeil(520); pfeil(1400);

      /* Karte links: schwer */
      const kL = cfg.karteLinks ?? 9, kR = cfg.karteRechts ?? 9.4;
      const left = h('div', { class: 'karte-links', style: { opacity: 0 } });
      const lb = h('div', { style: { position: 'absolute', inset: 0, borderRadius: '34px', background: INK, boxShadow: '0 22px 0 rgba(11,11,13,.4)', padding: '40px 44px', color: PAPIER } },
        h('div', { style: { font: '700 74px/1.05 var(--kopf)', color: AMBER, marginBottom: '16px' }, text: cfg.zugeben || 'Zugeben:' }),
        h('div', { style: { font: '600 56px/1.18 var(--text)' }, text: cfg.zugebenText || 'alles umsonst, dazu Scham und Spott' }));
      // kleines Preisschild-Symbol
      const tagSvg = s('svg', { viewBox: '0 0 80 80', style: { position: 'absolute', right: '26px', top: '-30px', width: '92px', height: '92px', overflow: 'visible' } });
      tagSvg.append(s('path', { d: 'M8,34 L34,8 H70 V44 L44,70 Z', fill: ROT, stroke: PAPIER, 'stroke-width': 5, 'stroke-linejoin': 'round' }), s('circle', { cx: 52, cy: 26, r: 6, fill: PAPIER }));
      lb.append(tagSvg);
      left.append(lb);
      root.append(left);
      tl.tween(kL, 0.55, ease.inCubic, (p) => {
        left.style.opacity = p > 0 ? 1 : 0;
        const q = p, y = -(1 - q) * 360;
        left.style.transform = 'translateY(' + y + 'px) rotate(' + (-1.2 * q) + 'deg)';
      });
      tl.tween(kL + 0.55, 0.5, (x) => x, (p) => {
        if (p === 0) return;
        const wob = Math.sin(p * 30) * Math.exp(-p * 7) * 9;
        left.style.transform = 'translateY(' + wob + 'px) rotate(-1.2deg)';
      });

      /* Karte rechts: hell, leuchtet */
      const right = h('div', { class: 'karte-rechts', style: { opacity: 0 } });
      const rb = h('div', { style: { position: 'absolute', inset: 0, borderRadius: '34px', background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 112px/1 var(--kopf)', color: INK }, text: cfg.umdeuten || 'Umdeuten' });
      right.append(rb);
      root.append(right);
      tl.tween(kR, 0.6, ease.outBack, (p) => {
        right.style.opacity = clamp(p * 3);
        right.style.transform = 'translateY(' + (1 - p) * 140 + 'px) scale(' + (0.86 + 0.14 * p) + ')';
      });
      tl.each((t) => rb.classList.toggle('glimmt', t >= kR + 0.7));
      return { tl, root };
    },
  };
})();
