/* 2D-7 Die Waage: Zugeben wiegt schwer (Opfer, Scham, Spott). Fakten ändern daran wenig,
   erst die Zustimmung anderer lässt "Weiterglauben" schwerer wiegen. */
(function () {
  'use strict';
  const { h, s, ease, Timeline, clamp, lerp } = VT;
  const INK = '#1B1B1F', AMBER = '#E0A030', BLAU = '#3B7DD8', ROT = '#D8402B', PAPIER = '#F4F1EA';
  const PX = 960, PY = 400, L = 520, DROP = 260;

  const txt = (x, y, size, fill, str, anchor) => s('text', { x, y, 'text-anchor': anchor || 'middle', 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'font-size': size, fill, text: str });

  VT.anims.waage = {
    create(host, cfg) {
      const svg = s('svg', { viewBox: '0 0 1920 1080' });
      const fazit = h('div', { class: 'w-fazit', text: cfg.fazitText || 'Mit Zustimmung wiegt Weiterglauben schwerer.' });
      const root = h('div', { class: 'scene papier waage', 'data-anim': 'waage' }, svg, fazit);
      host.append(root);
      const tl = new Timeline(cfg.dauer || 10.5);
      const T = { gewichte: 0.8, abstand: 0.7, fall: 0.4, fakten: 3.4, figuren: 5.2, figAbstand: 0.45, hop: 0.6, chip: 5.0, fazit: 8.4 };
      Object.keys(T).forEach((k) => { if (typeof cfg[k] === 'number') T[k] = cfg[k]; });
      const namen = cfg.gewichte_ || cfg.gewichteNamen || ['Opfer', 'Scham', 'Spott'];

      // Ständer
      const stand = s('g', {});
      stand.append(s('rect', { x: PX - 24, y: PY, width: 48, height: 540, fill: INK }));
      stand.append(s('path', { d: 'M' + (PX - 230) + ',960 L' + (PX - 150) + ',900 H' + (PX + 150) + ' L' + (PX + 230) + ',960 Z', fill: INK }));
      svg.append(stand);

      // Waagebalken
      const beam = s('g', {});
      beam.append(s('rect', { x: PX - L - 24, y: PY - 15, width: 2 * L + 48, height: 30, rx: 15, fill: INK }));
      svg.append(beam);
      svg.append(s('circle', { cx: PX, cy: PY, r: 30, fill: AMBER, stroke: INK, 'stroke-width': 8 }));

      // Schalen
      const mkPan = (label, farbe) => {
        const g = s('g', {});
        g.append(s('line', { x1: 0, y1: 0, x2: -175, y2: DROP, stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round' }));
        g.append(s('line', { x1: 0, y1: 0, x2: 175, y2: DROP, stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round' }));
        const inhalt = s('g', {});
        g.append(inhalt);
        g.append(s('path', { d: 'M-205,' + DROP + ' H205 L160,' + (DROP + 44) + ' H-160 Z', fill: INK, 'stroke-linejoin': 'round', stroke: INK, 'stroke-width': 6 }));
        g.append(txt(0, DROP + 112, 56, farbe, label));
        svg.append(g);
        return { g, inhalt };
      };
      const links = mkPan(cfg.links || 'Zugeben', INK);
      const rechts = mkPan(cfg.rechts || 'Weiterglauben', '#B97A0B');

      // Gewichte links (fallen nacheinander)
      const BW = 250, BH = 104;
      const gewichte = namen.map((n, i) => {
        const g = s('g', {});
        g.append(s('rect', { x: -BW / 2, y: -BH, width: BW, height: BH, rx: 22, fill: INK, stroke: PAPIER, 'stroke-width': 5 }));
        g.append(s('rect', { x: -BW / 2 + 10, y: -BH + 10, width: BW - 20, height: 12, rx: 6, fill: 'rgba(255,255,255,.12)' }));
        g.append(txt(0, -BH / 2 + 20, 56, PAPIER, n));
        links.inhalt.append(g);
        return { g, land: T.gewichte + i * T.abstand + T.fall, start: T.gewichte + i * T.abstand, stapel: -(i * (BH + 6)) };
      });

      // Figuren rechts (hüpfen auf die Schale)
      const FARBEN = [BLAU, AMBER, '#FFFFFF', '#8FB3E8', '#F2C46D'];
      const figs = FARBEN.map((col, i) => {
        const g = s('g', { opacity: 0 });
        g.append(s('rect', { x: -32, y: -150, width: 64, height: 150, rx: 32, fill: col, stroke: INK, 'stroke-width': 7 }));
        g.append(s('circle', { cx: 0, cy: -190, r: 33, fill: col, stroke: INK, 'stroke-width': 7 }));
        g.append(s('circle', { cx: -10, cy: -196, r: 4.5, fill: INK }));
        rechts.inhalt.append(g);
        const st = T.figuren + i * T.figAbstand;
        return { g, st, land: st + T.hop, x: (i - 2) * 60 };
      });

      // Fakten-Pfeil von oben auf die rechte Schale
      const fakten = s('g', { opacity: 0 });
      fakten.append(s('line', { x1: 0, y1: -440, x2: 0, y2: -36, stroke: BLAU, 'stroke-width': 20, 'stroke-linecap': 'round' }));
      fakten.append(s('path', { d: 'M-38,-46 L0,10 L38,-46 Z', fill: BLAU, stroke: BLAU, 'stroke-width': 8, 'stroke-linejoin': 'round' }));
      fakten.append(txt(54, -250, 62, BLAU, cfg.faktenText || 'Fakten', 'start'));
      const kreuz = s('g', { opacity: 0 });
      kreuz.append(s('line', { x1: -50, y1: -50, x2: 50, y2: 50, stroke: ROT, 'stroke-width': 24, 'stroke-linecap': 'round' }));
      kreuz.append(s('line', { x1: 50, y1: -50, x2: -50, y2: 50, stroke: ROT, 'stroke-width': 24, 'stroke-linecap': 'round' }));
      fakten.append(kreuz);
      rechts.inhalt.append(fakten);

      // Chip "Zustimmung anderer"
      const chip = h('div', { class: 'w-chip', text: cfg.zustimmung || 'Zustimmung anderer' });
      root.append(chip);

      const winkel = (t) => {
        let wL = 0, wR = 0;
        gewichte.forEach((w) => { wL += ease.outBackSoft(clamp((t - w.land) / 0.5)); });
        figs.forEach((f) => { wR += 0.9 * ease.outBackSoft(clamp((t - f.land) / 0.5)); });
        const q = t - (T.fakten + 0.5);                                      // Aufprall der Fakten: kurzer, kleiner Ausschlag
        if (q > 0 && q < 0.5) wR += 0.35 * Math.sin((q / 0.5) * Math.PI);
        return clamp((wR - wL) * 7, -22, 22);
      };

      tl.each((t) => {
        svg.style.opacity = clamp(t / 0.4);
        const a = winkel(t);
        beam.setAttribute('transform', 'rotate(' + a + ' ' + PX + ' ' + PY + ')');
        const r = (a * Math.PI) / 180;
        links.g.setAttribute('transform', 'translate(' + (PX - L * Math.cos(r)) + ',' + (PY - L * Math.sin(r)) + ')');
        rechts.g.setAttribute('transform', 'translate(' + (PX + L * Math.cos(r)) + ',' + (PY + L * Math.sin(r)) + ')');

        gewichte.forEach((w) => {
          const q = t - w.start;
          if (q < 0) { w.g.setAttribute('opacity', 0); return; }
          w.g.setAttribute('opacity', 1);
          const y0 = DROP + w.stapel - 6;
          let y;
          if (q < T.fall) y = y0 - (1 - (q / T.fall) ** 2) * 1000;
          else { const z = q - T.fall; y = y0 - Math.abs(Math.sin(z * 12)) * 26 * Math.exp(-z * 7); }
          w.g.setAttribute('transform', 'translate(0,' + y + ')');
        });

        figs.forEach((f) => {
          const p = clamp((t - f.st) / T.hop);
          if (t < f.st) { f.g.setAttribute('opacity', 0); return; }
          f.g.setAttribute('opacity', 1);
          const x = lerp(640, f.x, ease.outCubic(p));
          const y = lerp(80, DROP - 6, p) - Math.sin(p * Math.PI) * 190;
          f.g.setAttribute('transform', 'translate(' + x + ',' + y + ') scale(0.8)');
        });

        // Fakten: fliegen auf die Schale, prallen ab, werden durchgestrichen, verblassen
        const q = t - T.fakten;
        if (q < 0) fakten.setAttribute('opacity', 0);
        else {
          const hitT = 0.5;
          let d;
          if (q < hitT) d = lerp(380, 0, (q / hitT) ** 2);
          else d = Math.sin(clamp((q - hitT) / 0.4) * Math.PI) * 90;       // federt zurück
          fakten.setAttribute('transform', 'translate(0,' + (DROP - 12 - d) + ')');
          kreuz.setAttribute('opacity', q > hitT + 0.2 ? 1 : 0);
          kreuz.setAttribute('transform', 'translate(0,-20) scale(' + ease.outBack(clamp((q - hitT - 0.2) / 0.3)) + ')');
          fakten.setAttribute('opacity', q < 1.5 ? clamp(q / 0.15) : clamp(1 - (q - 1.5) / 0.4));
        }

        const c = ease.outBack(clamp((t - T.chip) / 0.5));
        chip.style.opacity = clamp((t - T.chip) / 0.2); chip.style.transform = 'scale(' + (0.8 + 0.2 * c) + ')';
        const f = ease.outCubic(clamp((t - T.fazit) / 0.6));
        fazit.style.opacity = f; fazit.style.transform = 'translateY(' + (1 - f) * 20 + 'px)';
      });
      return { tl, root };
    },
  };
})();
