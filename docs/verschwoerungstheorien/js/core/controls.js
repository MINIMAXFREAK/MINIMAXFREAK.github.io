/* Tastatur, Maus, Bildschirm-Zustände, HUD und Referenten-Befehle im Hauptfenster */
(function () {
  'use strict';
  const VT = window.VT;
  const now = () => performance.now();

  /* Taste -> Aktion (gemeinsam für Hauptfenster und Referentenfenster) */
  VT.keyAction = function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    const k = e.key;
    if (k.length === 1 && k >= '0' && k <= '9') return { a: 'digit', v: k };
    switch (k) {
      case ' ': case 'ArrowRight': case 'ArrowDown': case 'PageDown': return { a: 'next' };
      case 'Enter': return { a: 'enter', shift: e.shiftKey };
      case 'ArrowLeft': return { a: e.shiftKey ? 'replay' : 'prev' };
      case 'ArrowUp': case 'PageUp': return { a: 'prev' };
      case 'Backspace': return { a: 'backspace' };
      case 'Home': return { a: 'home' };
      case 'End': return { a: 'end' };
      case 'Escape': return { a: 'escape' };
      case 'F1': case '?': return { a: 'help' };
      case '.': return { a: 'black' };
      case ',': return { a: 'white' };
    }
    switch (k.toLowerCase()) {
      case 's': return { a: 'skip' };
      case 'f': return { a: 'fullscreen' };
      case 'g': return { a: 'overview' };
      case 'b': return { a: 'black' };
      case 'w': return { a: 'white' };
      case 'h': return { a: 'help' };
      case 'l': return { a: 'laser' };
      case 'd': return { a: 'pen' };
      case 'e': return { a: 'erase' };
      case 'm': return { a: 'mute' };
      case 'p': return { a: 'presenter' };
      case 't': return { a: 'stopwatch' };
      case 'o': return { a: 'optional' };
    }
    return null;
  };

  /* Doppelklick-Schutz: Eingaben innerhalb von 250 ms nach einer anderen werden verworfen */
  VT.makeGuard = function (ms) {
    let last = -1e9;
    return function () { const t = now(); const ok = t - last >= ms; last = t; return ok; };
  };

  VT.Controls = class Controls {
    constructor(player, tools, channel, opts) {
      this.p = player; this.tools = tools; this.ch = channel; this.opts = opts || {};
      this.guard = VT.makeGuard(250);
      this.screen = null; this.numBuf = ''; this.swVisible = false; this.presenterWin = null;
      this.hud = {
        probe: document.getElementById('hud-probe'), warn: document.getElementById('hud-warn'),
        uhr: document.getElementById('hud-uhr'), toast: document.getElementById('hud-toast'),
      };
      this.overviewEl = document.getElementById('uebersicht'); this.helpEl = document.getElementById('hilfe');
      VT.buildHelp(this.helpEl);
      this._bind();
      this._idleTimer = 0; this._cursor();
      player.on('stepchange', () => { tools.clear(); });
      player.on('ignored', () => this.toast('Weiter ignoriert: Kette läuft (S überspringt)'));
      player.on('change', () => this._push(true));
      player.on('tick', () => { this._push(false); this._hud(); });
      this._hud();
    }

    _bind() {
      document.addEventListener('keydown', (e) => {
        this._unlock();
        if (e.repeat) { if (VT.keyAction(e)) e.preventDefault(); return; }
        const act = VT.keyAction(e);
        if (!act) return;
        e.preventDefault();
        this.key(act);
      });
      const vp = document.getElementById('viewport');
      vp.addEventListener('click', (e) => {
        this._unlock();
        if (e.button !== 0 || this.tools.penOn) return;
        if (this.overviewEl.classList.contains('offen') || this.helpEl.classList.contains('offen')) return;
        this.exec('next');
      });
      window.addEventListener('pointerdown', () => this._unlock());
      window.addEventListener('mousemove', () => this._cursor());
      window.addEventListener('pointerdown', () => this._cursor());
      this.ch.onMessage((m) => {
        if (m.t === 'hello') this._push(true);
        else if (m.t === 'cmd') this.exec(m.c, m.a, true);
      });
    }

    _unlock() { VT.audio.ensure(); this.p.unblock(); }

    _cursor() {
      document.body.classList.remove('idle');
      clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(() => document.body.classList.add('idle'), 2000);
    }

    /* Taste verarbeiten */
    key(act) {
      switch (act.a) {
        case 'digit': this.numBuf = (this.numBuf + act.v).slice(-2); this.toast('Klick ' + this.numBuf + ' … Enter'); this._push(true); return;
        case 'enter':
          if (this.numBuf) { const n = parseInt(this.numBuf, 10); this.numBuf = ''; return this.exec(act.shift ? 'jumpPlay' : 'jump', n); }
          return this.exec('next');
        case 'backspace':
          if (this.numBuf) { this.numBuf = this.numBuf.slice(0, -1); this._push(true); return; }
          return this.exec('prev');
        case 'escape':
          if (this.overviewEl.classList.contains('offen')) return this.exec('overview');
          if (this.helpEl.classList.contains('offen')) return this.exec('help');
          if (this.numBuf) { this.numBuf = ''; this._push(true); return; }
          if (this.screen) return this.setScreen(null);
          return;
        default: return this.exec(act.a);
      }
    }

    /* Befehl ausführen (Tastatur, Maus oder Referentenfenster) */
    exec(cmd, arg, remote) {
      const nav = ['next', 'prev', 'replay', 'skip', 'home', 'end', 'jump', 'jumpPlay'];
      if (nav.includes(cmd)) {
        if (!this.guard()) return;
        if (this.screen) { this.setScreen(null); return; }   // wie PowerPoint: erst Bild zurück
        this.closePanels();
      }
      switch (cmd) {
        case 'next': return this.p.next();
        case 'prev': return this.p.prev();
        case 'replay': return this.p.replayPrev();
        case 'skip': return this.p.skip();
        case 'home': return this.p.home();
        case 'end': return this.p.end();
        case 'jump': return this.p.jump(arg, false);
        case 'jumpPlay': return this.p.jump(arg, true);
        case 'optional': return this.p.toggleOptional();
        case 'black': return this.setScreen(this.screen === 'black' ? null : 'black');
        case 'white': return this.setScreen(this.screen === 'white' ? null : 'white');
        case 'mute': this.p.setMuted(!this.p.muted); this.toast(this.p.muted ? 'Ton aus' : 'Ton an'); return;
        case 'laser': { const on = this.tools.toggleLaser(); this.toast(on ? 'Laserpointer an' : 'Laserpointer aus'); this._push(true); return; }
        case 'pen': { const on = this.tools.togglePen(); this.toast(on ? 'Stift an' : 'Stift aus'); this._push(true); return; }
        case 'erase': return this.tools.clear();
        case 'stopwatch': this.swVisible = !this.swVisible; this._hud(); this._push(true); return;
        case 'resetClock': return this.p.resetClock();
        case 'fullscreen': return this.fullscreen();
        case 'overview': return this.toggleOverview();
        case 'help': return this.toggleHelp();
        case 'presenter': return this.openPresenter();
      }
    }

    closePanels() {
      if (this.overviewEl.classList.contains('offen')) VT.closeOverview(this.overviewEl);
      this.helpEl.classList.remove('offen');
    }
    toggleOverview() {
      if (this.overviewEl.classList.contains('offen')) { VT.closeOverview(this.overviewEl); return; }
      this.helpEl.classList.remove('offen');
      VT.openOverview(this.overviewEl, this.p.pos, (pos) => { VT.closeOverview(this.overviewEl); this.guard(); this.setScreen(null); this.p.jump(pos, false); });
    }
    toggleHelp() {
      if (this.overviewEl.classList.contains('offen')) VT.closeOverview(this.overviewEl);
      this.helpEl.classList.toggle('offen');
    }
    setScreen(s) {
      this.screen = s;
      const el = document.getElementById('screen');
      el.className = s || '';
      this._push(true);
    }
    fullscreen() {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch (e) { /* */ }
    }
    openPresenter() {
      try {
        if (this.presenterWin && !this.presenterWin.closed) { this.presenterWin.focus(); return; }
        this.presenterWin = window.open('presenter.html', 'sekten-vortrag-presenter', 'width=1400,height=860');
      } catch (e) { /* */ }
    }

    toast(msg) {
      if (!document.body.classList.contains('probe')) return;
      const t = this.hud.toast; t.textContent = msg; t.classList.add('zeigen');
      clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.remove('zeigen'), 1600);
    }

    /* HUD: Probenmodus, Warnsymbol, Stoppuhr */
    _hud() {
      const p = this.p, st = p.step;
      if (!st) return;
      const probe = document.body.classList.contains('probe');
      if (probe) {
        const ci = p.chainInfo();
        const it = p.items[p.itemIdx];
        const kl = st.klick >= 1 && st.klick <= 18 ? 'Klick ' + st.klick + '/' + p.nKlicks : st.name;
        this.hud.probe.textContent = kl + ' · ' + st.name + (it ? ' · ' + it.label + (p.items.length > 1 ? ' (' + (p.itemIdx + 1) + '/' + p.items.length + ')' : '') : '') +
          (p.phase === 'playing' ? ' · Rest ' + VT.fmtTime(ci.remaining) : ' · Halten');
        const nm = VT.missing().length;
        this.hud.warn.innerHTML = '';
        this.hud.warn.append(VT.h('span', { text: '▲ ' + nm + ' von ' + VT.steps.clips.length + ' Clips fehlen' }));
        this.hud.warn.classList.toggle('zeigen', nm > 0);
      }
      const u = this.hud.uhr;
      u.classList.toggle('zeigen', this.swVisible);
      u.textContent = p.t0 ? VT.fmtTime((Date.now() - p.t0) / 1000) : '0:00';
    }

    fullState() {
      return Object.assign(this.p.snapshot(), { screen: this.screen, swVisible: this.swVisible, pen: this.tools.penOn, laser: this.tools.laserOn, numBuf: this.numBuf });
    }
    _push(immediate) {
      const t = now();
      if (!immediate && t - (this._lastPush || 0) < 240) return;
      if (immediate && t - (this._lastPush || 0) < 40) { clearTimeout(this._pt); this._pt = setTimeout(() => this._push(true), 45); return; }
      this._lastPush = t;
      this.ch.send({ t: 'state', s: this.fullState() });
    }
  };
})();
