/* Hilfsbibliothek: Easing, DOM-Helfer, kleine Timeline (tl.at / tl.tween) */
(function () {
  'use strict';
  const VT = (window.VT = window.VT || {});
  VT.anims = VT.anims || {};
  const NS_SVG = 'http://www.w3.org/2000/svg';

  VT.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  VT.lerp = (a, b, t) => a + (b - a) * t;

  const bounceOut = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };
  VT.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => { const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
    outBackSoft: (t) => { const s = 1.1; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); },
    inBack: (t) => { const s = 1.70158; return (s + 1) * t * t * t - s * t * t; },
    outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
    bounce: bounceOut,
  };
  const E = VT.ease;

  /* Farben */
  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  VT.mixColor = (a, b, t) => {
    const A = hex2rgb(a), B = hex2rgb(b); t = VT.clamp(t);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  };

  VT.fmtTime = (sec) => {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  };
  VT.parseTime = (s) => {
    if (s == null || s === '') return null;
    if (typeof s === 'number') return s;
    const m = String(s).split(':').map(Number);
    return m.length === 2 ? m[0] * 60 + m[1] : m[0];
  };

  /* DOM-Helfer: h = HTML, s = SVG */
  function build(el, props, kids) {
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') {
          for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }
        } else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(c));
    }
    return el;
  }
  VT.h = (tag, props, ...kids) => build(document.createElement(tag), props, kids);
  VT.s = (tag, props, ...kids) => build(document.createElementNS(NS_SVG, tag), props, kids);

  /* Timeline: alles ist eine Funktion der Zeit, damit Seek/Ende/Neustart sauber gehen.
     tl.tween(start, dauer, easing, fn(p, t)) setzt Zustände (p=0 vor Start, p=1 danach).
     tl.at(zeit, fn) ruft fn einmalig, wenn die Zeit überschritten wird (nur vorwärts, fn muss idempotent sein).
     tl.each(fn(t)) läuft bei jedem Update. */
  VT.Timeline = class Timeline {
    constructor(duration = 0) {
      this.duration = duration; this.t = 0; this.speed = 1;
      this._ev = []; this._tw = []; this._each = []; this._ei = 0; this._sorted = true;
      this._playing = false; this._raf = 0; this._iv = 0; this._last = 0;
      this.onend = null; this._dead = false;
    }
    at(time, fn) { this._ev.push({ t: time, fn }); this._sorted = false; this.duration = Math.max(this.duration, time); return this; }
    tween(start, dur, ease, fn) {
      const e = typeof ease === 'string' ? E[ease] : (ease || E.linear);
      this._tw.push({ s: start, d: dur, e, fn, last: undefined });
      this.duration = Math.max(this.duration, start + dur);
      return this;
    }
    each(fn) { this._each.push(fn); return this; }
    _apply() {
      const t = this.t;
      for (const w of this._tw) {
        const raw = w.d > 0 ? VT.clamp((t - w.s) / w.d) : (t >= w.s ? 1 : 0);
        if (raw === w.last) continue;
        w.last = raw;
        w.fn(w.e(raw), t);
      }
      for (const f of this._each) f(t);
    }
    seek(t) {
      if (this._dead) return;
      if (!this._sorted) { this._ev.sort((a, b) => a.t - b.t); this._sorted = true; this._ei = 0; }
      t = Math.max(0, t);
      if (t < this.t) { this._ei = 0; for (const w of this._tw) w.last = undefined; }
      this.t = t;
      while (this._ei < this._ev.length && this._ev[this._ei].t <= t) { this._ev[this._ei].fn(); this._ei++; }
      this._apply();
    }
    play(from = 0) {
      if (this._dead) return;
      this.seek(from);
      this._playing = true; this._last = performance.now();
      const step = () => { if (!this._playing) return; this._tick(); if (this._playing) this._raf = requestAnimationFrame(step); };
      this._raf = requestAnimationFrame(step);
      this._iv = setInterval(() => this._tick(), 100);
    }
    _tick() {
      if (!this._playing) return;
      const now = performance.now();
      const dt = ((now - this._last) / 1000) * this.speed; this._last = now;
      this.seek(this.t + dt);
      if (this.t >= this.duration) { this.stop(); this.seek(this.duration); const f = this.onend; this.onend = null; if (f) f(); }
    }
    stop() { this._playing = false; cancelAnimationFrame(this._raf); clearInterval(this._iv); }
    finish() { this.stop(); this.onend = null; this.seek(this.duration); }
    destroy() { this.stop(); this._dead = true; this.onend = null; }
    get playing() { return this._playing; }
  };

  /* Monotone kubische Kurve (Fritsch-Carlson) durch Punkte, als SVG-Pfad */
  VT.monotonePath = (pts) => {
    const n = pts.length;
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); m.push(dy[i] / dx[i]); }
    const tg = [m[0]];
    for (let i = 1; i < n - 1; i++) tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    tg.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { tg[i] = 0; tg[i + 1] = 0; continue; }
      const a = tg[i] / m[i], b = tg[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); tg[i] = k * a * m[i]; tg[i + 1] = k * b * m[i]; }
    }
    let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 0; i < n - 1; i++) {
      const x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1], h = dx[i] / 3;
      d += ' C' + (x0 + h) + ',' + (y0 + tg[i] * h) + ' ' + (x1 - h) + ',' + (y1 - tg[i + 1] * h) + ' ' + x1 + ',' + y1;
    }
    return d;
  };

  /* Sprechblase als Pfad: Rechteck w*h mit Rundung r, Spitze unten */
  VT.bubblePath = (w, h, r, tail) => {
    let d = 'M' + r + ',0 H' + (w - r) + ' A' + r + ',' + r + ' 0 0 1 ' + w + ',' + r + ' V' + (h - r) +
      ' A' + r + ',' + r + ' 0 0 1 ' + (w - r) + ',' + h;
    if (tail) d += ' H' + tail.x2 + ' L' + tail.tx + ',' + tail.ty + ' L' + tail.x1 + ',' + h;
    d += ' H' + r + ' A' + r + ',' + r + ' 0 0 1 0,' + (h - r) + ' V' + r + ' A' + r + ',' + r + ' 0 0 1 ' + r + ',0 Z';
    return d;
  };

  /* Anim-Fabrik: (Wirt, Config, Optionen) -> { tl, root, destroy } */
  VT.createAnim = (name, host, cfg, opt) => {
    const def = VT.anims[name];
    if (!def) throw new Error('Unbekannte Animation: ' + name);
    const inst = def.create(host, cfg || {}, opt || {});
    if (cfg && cfg.dauer != null) inst.tl.duration = Math.max(cfg.dauer, inst.tl.duration);
    inst.destroy = () => { inst.tl.destroy(); host.replaceChildren(); };
    inst.tl.seek(0);
    return inst;
  };
})();
