/* Titelfolie, Quellenfolie, Kapitelkarte (2D-8), Frage (2D-1), Losungen (2D-2), Platzhalterkarte */
(function () {
  'use strict';
  const { h, s, ease, Timeline, clamp } = VT;
  const INK = '#1B1B1F', AMBER = '#E0A030', PAPER2 = '#E6E1D4';

  const kursiv = (txt, repl) => {
    txt = String(txt).replace(/\{(\w+)\}/g, (_, k) => (repl && repl[k] != null ? repl[k] : ''));
    return txt.split(/\*(.+?)\*/g).map((part, i) => (i % 2 ? h('em', { text: part }) : part));
  };

  /* Uhr-Umriss, ruhiges Motiv */
  function uhrSvg(cls, stroke, sec) {
    const svg = s('svg', { viewBox: '0 0 800 800', class: cls });
    svg.append(s('circle', { cx: 400, cy: 400, r: 380, fill: 'none', stroke, 'stroke-width': 16 }));
    svg.append(s('circle', { cx: 400, cy: 400, r: 340, fill: 'none', stroke: PAPER2, 'stroke-width': 4 }));
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      svg.append(s('line', {
        x1: 400, y1: big ? 70 : 90, x2: 400, y2: 52, stroke: i % 15 === 0 ? AMBER : stroke,
        'stroke-width': big ? 12 : 4, 'stroke-linecap': 'round', transform: 'rotate(' + i * 6 + ' 400 400)',
      }));
    }
    const hand = (len, w, deg, col) => s('line', { x1: 400, y1: 400 + len * 0.16, x2: 400, y2: 400 - len, stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', transform: 'rotate(' + deg + ' 400 400)' });
    svg.append(hand(170, 26, 358.5, stroke), hand(260, 16, 348, stroke), hand(280, 6, sec == null ? 0 : sec, AMBER));
    svg.append(s('circle', { cx: 400, cy: 400, r: 20, fill: AMBER }));
    return svg;
  }
  VT.uhrSvg = uhrSvg;

  VT.anims.titel = {
    create(host, cfg) {
      const c = VT.config || {};
      const text = h('div', { class: 't-text' }, h('h1', { text: c.titel || '' }), h('div', { class: 't-bar' }), c.untertitel ? h('p', { text: c.untertitel }) : null);
      const root = h('div', { class: 'scene papier titel', 'data-anim': 'titel' }, uhrSvg('t-uhr', INK, 0), text);
      host.append(root);
      const tl = new Timeline(cfg.dauer || 0.9);
      tl.tween(0, tl.duration, ease.outCubic, (p) => { root.style.opacity = p; text.style.transform = 'translateY(' + (1 - p) * 18 + 'px)'; });
      return { tl, root };
    },
  };

  VT.anims.quellen = {
    create(host, cfg) {
      const c = VT.config || {};
      const root = h('div', { class: 'scene dunkel quellen', 'data-anim': 'quellen' }, h('h2', { text: 'Quellen' }), h('div', { class: 'q-bar' }));
      host.append(root);
      const liste = h('div', { class: 'q-liste' });
      root.append(liste);
      const tl = new Timeline(cfg.dauer || 1.5);
      let nr = 0;
      (c.quellen || []).forEach((q, i) => {
        const hin = q.art === 'hinweis';
        const zeile = h('div', { class: 'q-zeile' + (hin ? ' hinweis' : '') },
          h('div', { class: 'q-marke', text: hin ? '→' : ++nr + '.' }),
          h('div', { class: 'q-text' }, kursiv(q.text, { buchtitel: c.buchtitel })));
        liste.append(zeile);
        tl.tween(0.1 + i * (cfg.abstand || 0.15), 0.45, ease.outCubic, (p) => { zeile.style.opacity = p; zeile.style.transform = 'translateY(' + (1 - p) * 24 + 'px)'; });
      });
      return { tl, root };
    },
  };

  VT.anims.kapitel = {
    create(host, cfg, opt) {
      const wort = h('div', { class: 'kap-wort', text: opt.text || '' });
      const linie = h('div', { class: 'kap-linie' });
      const root = h('div', { class: 'scene kapitel', 'data-anim': 'kapitel' }, wort, linie);
      host.append(root);
      const dauer = cfg.dauer || 2, ein = cfg.ein || 0.4, aus = cfg.aus || 0.4, lin = cfg.linie || 0.8;
      const tl = new Timeline(dauer);
      tl.each((t) => {
        const o = t < ein ? t / ein : t > dauer - aus ? (dauer - t) / aus : 1;
        root.style.opacity = clamp(o);
      });
      tl.tween(ein * 0.5, lin, ease.outCubic, (p) => { linie.style.transform = 'scaleX(' + p + ')'; });
      return { tl, root };
    },
  };

  VT.anims.frage = {
    create(host, cfg) {
      const t = h('div', { class: 'f-text', text: cfg.text || 'Wer stellt deine Uhr?' });
      const root = h('div', { class: 'scene frage', 'data-anim': 'frage' }, h('div', { class: 'schleier' }), t);
      root.style.background = 'none';
      host.append(root);
      const tl = new Timeline(cfg.dauer || 0.6);
      tl.tween(0, tl.duration, ease.outCubic, (p) => {
        root.firstChild.style.opacity = p; t.style.opacity = p; t.style.transform = 'translateY(' + (1 - p) * 20 + 'px)';
      });
      return { tl, root };
    },
  };

  /* Schluss: Bild blendet auf Schwarz ab (die Überblendung macht der Player), dann erscheint die Frage */
  VT.anims.fragekarte = {
    create(host, cfg) {
      const w = h('div', { class: 'f-wort', text: cfg.text || 'Wer stellt deine Uhr?' });
      const root = h('div', { class: 'scene fragekarte', 'data-anim': 'fragekarte' }, w);
      host.append(root);
      const tl = new Timeline(cfg.dauer || 4);
      const t0 = cfg.text_ab ?? 1.9;
      tl.tween(t0, 0.9, ease.outCubic, (p) => { w.style.opacity = p; w.style.transform = 'translateY(' + (1 - p) * 24 + 'px)'; });
      return { tl, root };
    },
  };

  VT.anims.losungen = {
    create(host, cfg) {
      const svg = s('svg', { viewBox: '0 0 1920 1080' });
      const root = h('div', { class: 'scene', 'data-anim': 'losungen' }, svg);
      root.style.background = 'none';
      host.append(root);
      const pop = cfg.pop || 0.5, abst = cfg.abstand || 0.6;
      const tl = new Timeline(pop + abst);
      const blase = (x, y, w, hh, tail, zeilen, delay) => {
        const tipX = x + tail.tx, tipY = y + tail.ty;
        const g = s('g', {});
        const d = VT.bubblePath(w, hh, 64, tail);
        const inner = s('g', { transform: 'translate(' + x + ',' + y + ')' });
        inner.append(s('path', { d, fill: 'rgba(11,11,13,.28)', transform: 'translate(12,14)' }));
        inner.append(s('path', { d, fill: '#F4F1EA', stroke: INK, 'stroke-width': 8, 'stroke-linejoin': 'round' }));
        const lh = 78, y0 = hh / 2 - ((zeilen.length - 1) * lh) / 2 + 22;
        zeilen.forEach((z, i) => inner.append(s('text', { x: w / 2, y: y0 + i * lh, 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif', 'font-weight': 600, 'font-size': 64, fill: INK, text: z })));
        g.append(inner);
        svg.append(g);
        tl.tween(delay, pop, ease.outBack, (p) => {
          const sc = Math.max(0.001, p);
          g.setAttribute('transform', 'translate(' + tipX + ',' + tipY + ') scale(' + sc + ') translate(' + -tipX + ',' + -tipY + ')');
          g.style.opacity = clamp(p * 3);
        });
      };
      const split = (str) => { const w = String(str).split(' '); const m = Math.ceil(w.length / 2); return [w.slice(0, m).join(' '), w.slice(m).join(' ')]; };
      blase(120, 110, 830, 300, { x1: 600, x2: 710, tx: 770, ty: 420 }, split(cfg.links || 'Ich habe meinen Hut zu Hause vergessen.'), 0);
      blase(1060, 290, 740, 300, { x1: 70, x2: 190, tx: -10, ty: 420 }, split(cfg.rechts || 'Ich bin mein eigener Träger.'), abst);
      return { tl, root };
    },
  };

  /* Platzhalterkarte: simulierter Ablauf mit Fortschrittsbalken */
  VT.anims.platzhalter = {
    create(host, cfg, opt) {
      const clip = opt.clip || {};
      const dur = opt.dur || 10;
      const nameLen = String(clip.name || '').length;
      const fs = nameLen <= 10 ? 210 : nameLen <= 14 ? 180 : 150;
      const fuell = h('div', { class: 'p-fuell' });
      const zeit = h('div', { class: 'p-zeit', text: '0:00 / ' + VT.fmtTime(dur) });
      const kids = [];
      if (opt.poster) {
        kids.push(h('img', { class: 'p-poster', src: opt.poster, alt: '' }));
      } else {
        kids.push(uhrSvg('abs p-ring', PAPER2, 0));
        kids.push(h('div', { class: 'p-klick', text: opt.label || '' }));
        kids.push(h('div', { class: 'p-name', style: { fontSize: fs + 'px' }, text: clip.name || '' }));
        kids.push(h('div', { class: 'p-folgt', text: 'Video folgt' }));
        kids.push(h('div', { class: 'p-datei', text: clip.datei || '' }));
        kids.push(h('div', { class: 'p-bahn' }, fuell));
        kids.push(zeit);
      }
      const root = h('div', { class: 'scene papier platzhalter', 'data-anim': 'platzhalter' }, kids);
      host.append(root);
      const tl = new Timeline(dur);
      tl.each((t) => {
        fuell.style.width = (clamp(t / dur) * 100).toFixed(2) + '%';
        zeit.textContent = VT.fmtTime(Math.min(t, dur)) + ' / ' + VT.fmtTime(dur);
      });
      return { tl, root };
    },
  };
})();
