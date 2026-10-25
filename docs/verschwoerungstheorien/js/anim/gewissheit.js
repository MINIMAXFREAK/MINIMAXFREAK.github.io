/* 2D-6 Gewissheit gegen Missionseifer: schematisches Liniendiagramm, ohne Zahlen auf der Y-Achse */
(function () {
  'use strict';
  const { h, s, ease, Timeline, clamp } = VT;
  const INK = '#1B1B1F', AMBER = '#E0A030', BLAU = '#3B7DD8', PAPIER2 = '#E6E1D4';

  VT.anims.gewissheit = {
    create(host, cfg) {
      const svg = s('svg', { viewBox: '0 0 1920 1080' });
      const fazit = h('div', { class: 'g-fazit' });
      const fuss = h('div', { class: 'g-fuss', text: cfg.fussnote || 'Skizze, keine Messdaten.' });
      const root = h('div', { class: 'scene papier gewissheit', 'data-anim': 'gewissheit' }, svg, fazit, fuss);
      host.append(root);
      const tl = new Timeline(cfg.dauer || 8);

      const X = [380, 740, 1100, 1460], Y0 = 250, YB = 740, AX = 250;
      const yv = (v) => YB - v * (YB - Y0);
      const labels = cfg.beschriftung || ['Vorabend', 'Mitternacht', '4:45', 'Morgen'];

      /* Achsen und Hilfslinien */
      const achsen = s('g', {});
      X.forEach((x) => achsen.append(s('line', { x1: x, y1: Y0 - 10, x2: x, y2: YB, stroke: PAPIER2, 'stroke-width': 4, 'stroke-dasharray': '4 14', 'stroke-linecap': 'round' })));
      achsen.append(s('line', { x1: AX, y1: YB, x2: 1560, y2: YB, stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }));
      achsen.append(s('line', { x1: AX, y1: YB, x2: AX, y2: Y0 - 30, stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }));
      achsen.append(s('path', { d: 'M' + (AX - 18) + ',' + (Y0 - 14) + ' L' + AX + ',' + (Y0 - 44) + ' L' + (AX + 18) + ',' + (Y0 - 14), fill: 'none', stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      achsen.append(s('text', { x: AX + 34, y: Y0 - 28, 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 46, fill: INK, text: cfg.achsentitel || 'Stärke' }));
      X.forEach((x, i) => {
        achsen.append(s('line', { x1: x, y1: YB, x2: x, y2: YB + 16, stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }));
        achsen.append(s('text', { x, y: YB + 78, 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif', 'font-weight': 600, 'font-size': 46, fill: INK, text: labels[i] }));
      });
      svg.append(achsen);
      tl.tween(0, cfg.achsen ?? 0.4, ease.outCubic, (p) => { achsen.style.opacity = p; });

      /* Linien */
      const linie = (werte, farbe, start, dauer, name, dyLabel) => {
        const pts = werte.map((v, i) => [X[i], yv(v)]);
        const d = VT.monotonePath(pts);
        const g = s('g', {});
        const pfad = s('path', { d, fill: 'none', stroke: farbe, 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        g.append(pfad);
        const dots = pts.map((p) => s('circle', { cx: p[0], cy: p[1], r: 15, fill: farbe, stroke: '#F4F1EA', 'stroke-width': 5, opacity: 0 }));
        dots.forEach((c) => g.append(c));
        const lab = s('text', { x: 0, y: 0, 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': 54, fill: farbe === AMBER ? '#B97A0B' : farbe, opacity: 0, text: name });
        g.append(lab);
        svg.append(g);
        const L = pfad.getTotalLength();
        pfad.setAttribute('stroke-dasharray', L);
        // Länge bis zu jedem Datenpunkt (für das Einblenden der Punkte)
        const lens = [];
        {
          let lo = 0;
          pts.forEach((p, i) => {
            if (i === 0) { lens.push(0); return; }
            let a = lo, b = L;
            for (let k = 0; k < 28; k++) { const m = (a + b) / 2; const q = pfad.getPointAtLength(m); if (q.x < p[0]) a = m; else b = m; }
            lens.push(b); lo = b;
          });
        }
        tl.tween(start, dauer, ease.inOutSine, (p) => {
          pfad.setAttribute('stroke-dashoffset', L * (1 - p));
          const cur = L * p;
          dots.forEach((c, i) => c.setAttribute('opacity', p > 0 && cur >= lens[i] - 0.5 ? 1 : 0));
          if (p > 0) {
            const q = pfad.getPointAtLength(Math.max(0.01, cur));
            lab.setAttribute('x', q.x + 36); lab.setAttribute('y', q.y + dyLabel);
            lab.setAttribute('opacity', 1);
          } else lab.setAttribute('opacity', 0);
        });
      };
      const t1 = (cfg.achsen ?? 0.4);
      linie(cfg.gewissheit || [0.9, 0.8, 0.25, 0.3], BLAU, t1, cfg.linie1 ?? 2.5, 'Gewissheit', 18);
      linie(cfg.missionseifer || [0.05, 0.05, 0.15, 0.95], AMBER, t1 + (cfg.linie1 ?? 2.5), cfg.linie2 ?? 3.0, 'Missionseifer', 18);

      /* Fazit */
      const teile = cfg.fazitText || ['Unsicherheit', 'macht', 'Missionare'];
      const woerter = teile.map((w, i) => {
        const mark = i !== 1;
        const sp = h('span', { class: mark ? 'wort' : 'wort2', text: w });
        return sp;
      });
      woerter.forEach((w, i) => { fazit.append(w); if (i < woerter.length - 1) fazit.append(' '); });
      const f0 = cfg.fazit ?? 6.5;
      tl.tween(f0, 0.5, ease.outCubic, (p) => { fazit.style.opacity = p; fazit.style.transform = 'translateY(' + (1 - p) * 22 + 'px)'; });
      woerter.filter((w) => w.className === 'wort').forEach((w, k) => {
        tl.tween(f0 + 0.45 + k * 0.35, 0.45, ease.outCubic, (p) => { w.style.setProperty('--u', p); });
      });
      return { tl, root };
    },
  };
})();
