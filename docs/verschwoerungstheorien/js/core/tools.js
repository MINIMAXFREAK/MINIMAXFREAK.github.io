/* Laserpointer (roter Punkt mit weicher Spur) und Stift (Amber) auf der Bühne */
(function () {
  'use strict';
  const VT = window.VT;

  VT.Tools = class Tools {
    constructor(view) {
      this.view = view;               // { scale, ox, oy }
      this.pen = document.getElementById('pen'); this.laser = document.getElementById('laser');
      this.pctx = this.pen.getContext('2d'); this.lctx = this.laser.getContext('2d');
      this.penOn = false; this.laserOn = false; this.drawing = false; this.strokes = []; this.cur = null;
      this.trail = []; this.raf = 0; this.inside = false; this.mouse = null;
      const vp = document.getElementById('viewport');
      vp.addEventListener('pointerdown', (e) => this._down(e));
      window.addEventListener('pointermove', (e) => this._move(e));
      window.addEventListener('pointerup', (e) => this._up(e));
      document.addEventListener('mouseleave', () => { this.inside = false; });
      document.addEventListener('mouseenter', () => { this.inside = true; });
    }
    _pt(e) { return { x: (e.clientX - this.view.ox) / this.view.scale, y: (e.clientY - this.view.oy) / this.view.scale }; }
    togglePen() {
      this.penOn = !this.penOn; if (this.penOn) this.laserOn = false;
      this._sync(); return this.penOn;
    }
    toggleLaser() {
      this.laserOn = !this.laserOn; if (this.laserOn) { this.penOn = false; this.drawing = false; }
      this._sync();
      if (this.laserOn) this._loop(); else { this.trail = []; this.lctx.clearRect(0, 0, 1920, 1080); }
      return this.laserOn;
    }
    _sync() {
      document.body.classList.toggle('pen', this.penOn);
      document.body.classList.toggle('laser', this.laserOn);
    }
    clear() {
      this.strokes = []; this.cur = null; this.drawing = false;
      this.pctx.clearRect(0, 0, 1920, 1080);
    }
    _down(e) {
      if (!this.penOn || e.button !== 0) return;
      const p = this._pt(e);
      this.drawing = true; this.cur = [p]; this.strokes.push(this.cur);
      this._seg(p, p);
      e.preventDefault();
    }
    _move(e) {
      this.inside = true;
      if (this.laserOn) {
        const p = this._pt(e); this.mouse = p;
        this.trail.push({ x: p.x, y: p.y, t: performance.now() });
        if (this.trail.length > 80) this.trail.shift();
      }
      if (this.drawing && this.cur) {
        const p = this._pt(e), q = this.cur[this.cur.length - 1];
        this.cur.push(p); this._seg(q, p);
      }
    }
    _up() { this.drawing = false; this.cur = null; }
    _seg(a, b) {
      const c = this.pctx;
      c.strokeStyle = '#E0A030'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    _loop() {
      cancelAnimationFrame(this.raf);
      const step = () => {
        if (!this.laserOn) return;
        const c = this.lctx, now = performance.now();
        c.clearRect(0, 0, 1920, 1080);
        const life = 650;
        this.trail = this.trail.filter((p) => now - p.t < life);
        for (let i = 1; i < this.trail.length; i++) {
          const a = this.trail[i - 1], b = this.trail[i], age = 1 - (now - b.t) / life;
          c.strokeStyle = 'rgba(255,40,40,' + (0.55 * age).toFixed(3) + ')';
          c.lineWidth = 6 + 14 * age; c.lineCap = 'round';
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        if (this.mouse && this.inside) {
          const g = c.createRadialGradient(this.mouse.x, this.mouse.y, 0, this.mouse.x, this.mouse.y, 34);
          g.addColorStop(0, 'rgba(255,60,60,0.95)'); g.addColorStop(0.35, 'rgba(255,40,40,0.75)'); g.addColorStop(1, 'rgba(255,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(this.mouse.x, this.mouse.y, 34, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#ff2a2a'; c.beginPath(); c.arc(this.mouse.x, this.mouse.y, 13, 0, Math.PI * 2); c.fill();
        }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
  };
})();
