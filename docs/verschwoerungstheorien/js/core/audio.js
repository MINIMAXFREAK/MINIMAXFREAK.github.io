/* Ton: Stummschaltung und trockenes Uhrticken per WebAudio (1 Tick pro Sekunde) */
(function () {
  'use strict';
  const VT = window.VT;

  const A = (VT.audio = {
    ctx: null, master: null, muted: false, ticking: false, _t0: 0, _lastSec: -1, volume: 0.5, versatz: 0, _n: 0,

    ensure() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
      try {
        const C = window.AudioContext || window.webkitAudioContext;
        this.ctx = new C();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
        this._noise = this._makeNoise();
      } catch (e) { this.ctx = null; }
      return this.ctx;
    },

    _makeNoise() {
      const len = this.ctx.sampleRate * 0.05;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.01);
    },

    /* ein leises, trockenes Tick/Tock */
    tick() {
      const c = this.ensure();
      if (!c || this.muted || c.state !== 'running') return;
      const now = c.currentTime;
      const tock = this._n++ % 2 === 1;
      const vol = this.volume;
      // Klick: kurzes gefiltertes Rauschen
      const src = c.createBufferSource(); src.buffer = this._noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = tock ? 2300 : 3100; bp.Q.value = 2.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol * 0.9, now + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
      src.connect(bp).connect(g).connect(this.master);
      src.start(now); src.stop(now + 0.05);
      // kleiner hölzerner Körper
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(tock ? 150 : 210, now);
      o.frequency.exponentialRampToValueAtTime(70, now + 0.04);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(vol * 0.35, now + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      o.connect(og).connect(this.master);
      o.start(now); o.stop(now + 0.07);
    },

    /* Ticken starten: zeit() liefert die Sekunden seit Clipbeginn */
    start(zeit, bis) {   // bis = Clipdauer: ab Sekunde 1, nicht mehr ab der letzten vollen Sekunde (der Zeiger tickt 1..11 bei 12 s)
      this.ticking = true; this._zeit = zeit; this._bis = bis == null ? Infinity : Math.floor(bis);
      this._lastSec = Math.floor(zeit() + this.versatz);
    },
    stop() { this.ticking = false; this._zeit = null; },
    update() {
      if (!this.ticking || !this._zeit) return;
      const sec = Math.floor(this._zeit() + this.versatz);
      if (sec !== this._lastSec) { this._lastSec = sec; if (sec >= 1 && sec < this._bis) this.tick(); }
    },
  });
})();
