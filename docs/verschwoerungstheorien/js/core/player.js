/* Wiedergabe-Engine: Schritte, Ketten, Halten, Overlays, zwei Video-Puffer (Double Buffering) */
(function () {
  'use strict';
  const VT = window.VT;
  const { h } = VT;
  const now = () => performance.now();

  class Player {
    constructor(stage, opts = {}) {
      this.stage = stage;
      this.domEl = stage.querySelector('#dom');
      this.ovEl = stage.querySelector('#ov');
      this.tempo = opts.tempo || 1;
      this.vids = [0, 1].map(() => this._mkVideo());
      this.vids.forEach((v) => stage.insertBefore(v, this.domEl));
      this.srcs = [null, null];
      this.front = 0;
      this.pos = -1; this.phase = 'idle'; this.step = null;
      this.items = []; this.itemIdx = -1; this.itemStarts = []; this.itemT0 = 0;
      this.token = 0;
      this.muted = false;
      this.t0 = null; this.clickTimes = {};
      this.failed = {}; this.errors = {};
      this.soundBlocked = false;
      this.metrics = { gaps: [], endedAt: 0, log: [] };
      this.overlays = []; this.cur = null; this.chainT0 = now(); this.holdStart = 0;
      this._ls = {}; this._lastEmit = 0;
      this.total = VT.steps.schritte.length;          // inkl. Titel und Ende
      this.lastPos = this.total - 1;
      this.nKlicks = VT.steps.schritte.filter((s) => s.klick >= 1 && s.klick <= 18).length;
      this._iv = setInterval(() => this._tick(), 50);
    }

    /* ---------- Ereignisse ---------- */
    on(ev, fn) { (this._ls[ev] = this._ls[ev] || []).push(fn); return this; }
    emit(ev, d) { (this._ls[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); }

    /* ---------- Bedienung ---------- */
    next() {
      if (this.phase === 'playing') { this.emit('ignored'); return false; }
      if (this.pos >= this.lastPos) return false;
      this.goto(this.pos + 1, 'play');
      return true;
    }
    prev() { if (this.pos <= 0) return false; this.goto(this.pos - 1, 'end'); return true; }
    replayPrev() { if (this.pos <= 0) return false; this.goto(this.pos - 1, 'play'); return true; }
    skip() {
      if (this.phase !== 'playing') return false;
      const behalten = this.overlays.filter((o) => o.state === 'aus').map((o) => o.cfg.id);   // per O ausgeschaltete bleiben aus
      this.goto(this.pos, 'end', behalten); return true;
    }
    home() { this.t0 = null; this.clickTimes = {}; this.goto(0, 'end'); }
    end() { this.goto(this.lastPos, 'end'); }
    jump(n, play) { this.goto(Math.max(0, Math.min(this.lastPos, n)), play ? 'play' : 'end'); }
    resetClock() { this.t0 = null; this.clickTimes = {}; this.emit('change'); }
    setMuted(m) {
      this.muted = m; VT.audio.setMuted(m);
      this.vids.forEach((v) => { v.muted = m || !!v._stumm || this.soundBlocked; });
      this.emit('change');
    }
    unblock() {
      if (!this.soundBlocked) return;
      this.soundBlocked = false;
      this.vids.forEach((v) => { v.muted = this.muted || !!v._stumm; });
      this.emit('change');
    }
    toggleOptional() {
      const ov = this.overlays.find((o) => o.cfg.optional && o.idx >= 0);
      if (!ov) return false;
      if (ov.state === 'an') this._hideOverlay(ov, 'aus');
      else this._showOverlay(ov, false);
      this.emit('change');
      return true;
    }

    /* ---------- Schritt starten ---------- */
    async goto(pos, mode, aus = []) {
      pos = Math.max(0, Math.min(this.lastPos, pos));
      const tok = ++this.token;
      this._cleanup();
      this.pos = pos; this.step = VT.steps.schritte[pos];
      this.items = VT.buildItems(pos);
      this.itemIdx = -1; this.itemStarts = [];
      this.phase = mode === 'play' ? 'playing' : 'hold';
      this.overlays = (this.step.overlays || []).map((cfg) => {
        const idx = typeof cfg.bei === 'number' ? cfg.bei : this.items.findIndex((it) => it.id === cfg.bei);
        if (idx < 0) console.warn('Overlay ohne Bezug:', cfg);
        return { cfg, idx, state: aus.includes(cfg.id) ? 'aus' : 'idle', host: null, inst: null };
      });
      this.metrics.endedAt = 0;
      this.emit('stepchange', pos);
      if (mode === 'play') {
        const k = this.step.klick;
        if (k === 1 && !this.t0) this.t0 = Date.now();
        if (k >= 1 && k <= this.nKlicks) this.clickTimes[k] = Date.now();
        this.chainT0 = now();
        this.emit('change');
        await this._startItem(0, tok);
      } else {
        await this._showEnd(tok);
      }
    }

    _cleanup() {
      if (this.cur && this.cur.inst) this.cur.inst.tl.stop();
      this.cur = null;
      this.vids.forEach((v) => { v.onended = null; v.onerror = null; try { v.pause(); } catch (e) { /* */ } });
      this.overlays.forEach((o) => { if (o.inst) o.inst.destroy(); if (o.host) o.host.remove(); });
      this.overlays = [];
      this.ovEl.replaceChildren();
      VT.audio.stop();
    }

    _chainTime() { return ((now() - this.chainT0) / 1000) * this.tempo; }

    /* ---------- Kette ---------- */
    async _startItem(i, tok) {
      if (tok !== this.token) return;
      const it = this.items[i];
      this.itemIdx = i; this.itemStarts[i] = this._chainTime(); this.itemT0 = now();
      if (!(it.typ === 'clip' && it.clip.ticken)) VT.audio.stop();
      this.emit('change');
      if (it.typ === 'clip') {
        if (it.echt && !this.failed[it.id]) return this._playVideo(it, i, tok);
        return this._playAnim(it, i, tok, 'platzhalter');
      }
      if (it.typ === 'karte') return this._playAnim(it, i, tok, 'kapitel');
      if (it.typ === 'anim' || it.typ === 'folie') return this._playAnim(it, i, tok, it.anim);
      if (it.typ === 'schwarz') { this._blackLayer(); return this._itemEnded(i, tok); }
    }

    _itemEnded(i, tok) {
      if (tok !== this.token) return;
      if (i < this.items.length - 1) this._startItem(i + 1, tok);
      else this._enterHold(tok, false);
    }

    _enterHold(tok, instant) {
      if (tok !== this.token) return;
      this.phase = 'hold'; this.holdStart = now();
      if (!VT.steps.ticken.imHalten) VT.audio.stop();
      this._overlayTick(instant);
      this._preloadStep(this.pos + 1);
      this.emit('change');
    }

    _mountLayer(fade) {
      const layer = h('div', { class: 'layer' });
      const old = [...this.domEl.children];
      this.domEl.append(layer);
      if (fade > 0) {
        layer.classList.add('fade'); layer.style.transitionDuration = fade + 's';
        requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('on')));
        setTimeout(() => old.forEach((o) => o.remove()), fade * 1000 + 80);
      } else old.forEach((o) => o.remove());
      return layer;
    }
    _clearDom() { this.domEl.replaceChildren(); }
    _blackLayer() { const l = this._mountLayer(0); l.style.background = '#000'; return l; }

    _clipLabel(it) {
      const k = this.step.klick;
      const base = k >= 1 && k <= this.nKlicks ? 'Klick ' + k : this.step.name;
      return this.items.length > 1 ? base + ' · Teil ' + (it.index + 1) + ' von ' + this.items.length : base;
    }

    _playAnim(it, i, tok, animName, endState) {
      this.metrics.endedAt = 0;
      const layer = this._mountLayer(endState ? 0 : (it.ueberblendung || 0) / this.tempo);
      const cfg = Object.assign({}, VT.steps.animationen[animName] || {});
      let opt = { text: it.text };
      if (animName === 'platzhalter') {
        cfg.dauer = it.dauer;
        opt = { clip: it.clip, label: this._clipLabel(it), dur: it.dauer, poster: this.failed[it.id] ? VT.posterUrl(it.id, endState ? 'last' : 'first') : null };
      }
      let inst;
      try { inst = VT.createAnim(animName, layer, cfg, opt); } catch (e) { console.error(e); this._reportError(it, e); return this._itemEnded(i, tok); }
      inst.tl.speed = this.tempo;
      this.cur = { typ: 'anim', inst, i };
      if (endState) { inst.tl.finish(); return inst; }
      inst.tl.onend = () => this._itemEnded(i, tok);
      inst.tl.play(0);
      if (it.typ === 'clip') this._setupTick(it, null);
      return inst;
    }

    /* ---------- Video ---------- */
    _mkVideo() {
      const v = document.createElement('video');
      v.className = 'vid'; v.playsInline = true; v.preload = 'auto'; v.controls = false;
      v.disablePictureInPicture = true; v.setAttribute('disableremoteplayback', ''); v.tabIndex = -1;
      v.style.zIndex = 1;
      return v;
    }
    _reveal(idx, fade = 0) {
      const v = this.vids[idx], alt = this.vids[1 - idx];
      this.front = idx;
      v.style.zIndex = 2; alt.style.zIndex = 1;
      alt.style.transition = 'none'; alt.style.opacity = 1;
      const doms = [...this.domEl.children];
      if (fade > 0 && doms.length) {          // Schwarz/Folie blendet aus, Video darunter läuft schon
        v.style.transition = 'none'; v.style.opacity = 1;
        doms.forEach((c) => { c.style.transition = 'opacity ' + fade + 's linear'; });
        requestAnimationFrame(() => doms.forEach((c) => { c.style.opacity = 0; }));
        setTimeout(() => doms.forEach((c) => c.remove()), fade * 1000 + 80);
      } else if (fade > 0) {                  // Video blendet über das vorige Bild ein
        v.style.transition = 'none'; v.style.opacity = 0; void v.offsetWidth;
        v.style.transition = 'opacity ' + fade + 's linear'; v.style.opacity = 1;
      } else { v.style.transition = 'none'; v.style.opacity = 1; this._clearDom(); }
    }
    _load(idx, url) {
      const v = this.vids[idx];
      if (this.srcs[idx] !== url) { this.srcs[idx] = url; v.src = url; v.load(); }
      if (v.readyState >= 2 && !v.error) return Promise.resolve();
      return new Promise((res, rej) => {
        let fin = false;
        const done = (err) => {
          if (fin) return; fin = true; clearTimeout(to);
          v.removeEventListener('loadeddata', ok); v.removeEventListener('error', er);
          err ? rej(err) : res();
        };
        const ok = () => done();
        const er = () => done(new Error((v.error && v.error.message) || 'Video nicht ladbar'));
        const to = setTimeout(() => done(new Error('Zeitüberschreitung beim Laden')), 15000);
        v.addEventListener('loadeddata', ok); v.addEventListener('error', er);
      });
    }
    _seek(v, t) {
      return new Promise((res) => {
        if (Math.abs(v.currentTime - t) < 0.002) return res();
        const f = () => { v.removeEventListener('seeked', f); res(); };
        v.addEventListener('seeked', f);
        v.currentTime = t;
        setTimeout(res, 3000);
      });
    }
    _play(v) {
      const p = v.play();
      if (p && p.catch) p.catch((e) => {
        if (e && e.name === 'NotAllowedError') {
          this.soundBlocked = true; v.muted = true; v.play().catch(() => {}); this.emit('change');
        }
      });
    }
    _setMute(v, clip) { v._stumm = !!(clip && clip.stumm); v.muted = this.muted || v._stumm || this.soundBlocked; }

    async _prepare(it) {
      const idx = 1 - this.front, v = this.vids[idx];
      await this._load(idx, VT.media[it.id].url);
      if (v.currentTime > 0.002) await this._seek(v, 0);
      return idx;
    }

    async _playVideo(it, i, tok) {
      let idx;
      try { idx = await this._prepare(it); } catch (e) { return this._videoFailed(it, i, tok, e); }
      if (tok !== this.token) return;
      const v = this.vids[idx];
      this._setMute(v, it.clip);
      v.playbackRate = this.tempo;
      this._reveal(idx, (it.ueberblendung || 0) / this.tempo);
      this.cur = { typ: 'video', v, i };
      v.onended = () => { if (tok === this.token) { this.metrics.endedAt = now(); this._itemEnded(i, tok); } };
      v.onerror = () => { if (tok === this.token) this._videoFailed(it, i, tok, new Error((v.error && v.error.message) || 'Wiedergabefehler')); };
      this._play(v);
      const tEnd = this.metrics.endedAt; this.metrics.endedAt = 0;
      if (tEnd && v.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(() => this.metrics.gaps.push({ step: this.step.klick, item: i, ms: Math.round(now() - tEnd) }));
      }
      if (isFinite(v.duration) && v.duration > 0) { it.dauer = v.duration; VT.media[it.id].dauer = v.duration; }
      this._setupTick(it, v);
      this._preloadNextVideo(i);
      this.emit('change');
    }

    _videoFailed(it, i, tok, err) {
      if (tok !== this.token) return;
      this._reportError(it, err);
      this.failed[it.id] = true; it.echt = false;
      this.vids.forEach((v) => { v.onended = null; v.onerror = null; });
      this._playAnim(it, i, tok, 'platzhalter');
    }
    _reportError(it, err) {
      const msg = (err && err.message) || String(err);
      this.errors[it.id] = msg;
      console.warn('Clip-Fehler', it.id, msg);
      this.emit('error', { id: it.id, msg });
    }

    async _showVideoEnd(it, i, tok) {
      const url = VT.posterUrl(it.id, 'last');
      if (url) {
        const l = this._mountLayer(0);
        l.append(h('img', { src: url, alt: '', style: { width: '1920px', height: '1080px', objectFit: 'cover', display: 'block' } }));
      }
      try {
        const mediaUrl = VT.media[it.id].url;
        const reuse = this.srcs[this.front] === mediaUrl && this.vids[this.front].readyState >= 2;   // liegt schon vorn
        const idx = reuse ? this.front : 1 - this.front, v = this.vids[idx];
        await this._load(idx, mediaUrl);
        if (tok !== this.token) return;
        const d = v.duration;
        if (isFinite(d) && d > 0) { it.dauer = d; VT.media[it.id].dauer = d; }
        this._setMute(v, it.clip);
        await this._seek(v, Math.max(0, (d || 0) - 0.001));
        if (tok !== this.token) return;
        this._reveal(idx);
        this.cur = { typ: 'video', v, i };
      } catch (e) {
        this._reportError(it, e); this.failed[it.id] = true; it.echt = false;
        this._playAnim(it, i, tok, 'platzhalter', true);
      }
    }

    _preload(it) {
      if (!it || it.typ !== 'clip' || !it.echt || this.failed[it.id]) return;
      this._load(1 - this.front, VT.media[it.id].url).catch(() => {});
    }
    _preloadNextVideo(after) {
      for (let j = after + 1; j < this.items.length; j++) {
        const it = this.items[j];
        if (it.typ === 'clip' && it.echt && !this.failed[it.id]) { this._preload(it); return; }
      }
    }
    _preloadStep(pos) {
      if (pos > this.lastPos) return;
      let items; try { items = VT.buildItems(pos); } catch (e) { return; }
      const it = items.find((x) => x.typ === 'clip' && x.echt && !this.failed[x.id]);
      // nur sinnvoll, wenn vor dem Video nichts anderes mit Video kommt
      if (it) this._preload(it);
    }

    /* ---------- Endzustand ---------- */
    async _showEnd(tok) {
      const items = this.items, n = items.length;
      let acc = 0;
      items.forEach((it, i) => { this.itemStarts[i] = acc; acc += it.dauer || 0; });
      this.chainT0 = now() - (acc / this.tempo) * 1000;
      this.itemIdx = n - 1;
      const last = items[n - 1];
      if (last.typ === 'clip') {
        if (last.echt && !this.failed[last.id]) await this._showVideoEnd(last, n - 1, tok);
        else this._playAnim(last, n - 1, tok, 'platzhalter', true);
      } else if (last.typ === 'karte') this._playAnim(last, n - 1, tok, 'kapitel', true);
      else if (last.typ === 'anim' || last.typ === 'folie') this._playAnim(last, n - 1, tok, last.anim, true);
      else if (last.typ === 'schwarz') this._blackLayer();
      if (tok !== this.token) return;
      if (last.typ === 'clip') this._setupTick(last, null);
      this._enterHold(tok, true);
    }

    /* ---------- Ticken ---------- */
    _setupTick(it, v) {
      VT.audio.stop();
      if (!it.clip || !it.clip.ticken) return;
      const m = VT.media[it.id];
      if (m && m.vorhanden && m.ton === true) return;      // Clip bringt eigenen Ton mit
      const cfg = VT.steps.ticken || {};
      VT.audio.volume = cfg.lautstaerke ?? 0.5; VT.audio.versatz = cfg.versatz || 0;
      VT.audio.ensure();
      const t0 = now(), tempo = this.tempo;
      VT.audio.start(() => ((now() - t0) / 1000) * tempo, it.dauer);
      if (v && m && m.vorhanden && m.ton == null) {
        setTimeout(() => { if ((v.webkitAudioDecodedByteCount || 0) > 0) VT.audio.stop(); }, 2000);
      }
    }

    /* ---------- Overlays ---------- */
    _overlayTick(instant) {
      const T = this._chainTime();
      for (const ov of this.overlays) {
        if (ov.idx < 0) continue;
        const ref = this.itemStarts[ov.idx];
        if (ref == null) continue;
        const dur = this.items[ov.idx].dauer || 0, c = ov.cfg;
        const showAt = ref + (c.bezug === 'ende' ? dur : 0) + (c.nach || 0);
        const hideAt = c.ausblendenVorEnde != null ? ref + dur - c.ausblendenVorEnde : Infinity;
        if (ov.state === 'idle') {
          if (T >= hideAt) ov.state = 'weg';
          else if (T >= showAt) this._showOverlay(ov, instant);
        } else if (ov.state === 'an' && T >= hideAt) this._hideOverlay(ov, 'weg');
      }
    }
    _showOverlay(ov, instant) {
      if (ov.host) { if (ov.inst) ov.inst.destroy(); ov.host.remove(); }
      const host = h('div', { class: 'ovl', 'data-overlay': ov.cfg.id });
      this.ovEl.append(host);
      const cfg = VT.steps.animationen[ov.cfg.anim] || {};
      ov.host = host; ov.inst = VT.createAnim(ov.cfg.anim, host, cfg, {});
      ov.inst.tl.speed = this.tempo;
      if (instant) ov.inst.tl.finish(); else ov.inst.tl.play(0);
      ov.state = 'an';
      this.emit('change');
    }
    _hideOverlay(ov, state) {
      ov.state = state;
      const host = ov.host, inst = ov.inst;
      if (!host) return;
      host.classList.add('weg');
      setTimeout(() => { if (ov.host === host) { if (inst) inst.destroy(); host.remove(); ov.host = null; ov.inst = null; } }, 600);
      this.emit('change');
    }

    /* ---------- Takt ---------- */
    _tick() {
      if (this.pos < 0) return;
      VT.audio.update();
      this._overlayTick(false);
      const t = now();
      if (t - this._lastEmit > 250) { this._lastEmit = t; this.emit('tick'); }
    }

    /* ---------- Zustand für Referentenfenster und Probenmodus ---------- */
    itemTime() {
      if (!this.cur) return 0;
      if (this.cur.typ === 'video') return this.cur.v.currentTime;
      if (this.cur.typ === 'anim') return this.cur.inst.tl.t;
      return 0;
    }
    chainInfo() {
      const total = this.items.reduce((a, it) => a + (it.dauer || 0), 0);
      let done = 0;
      for (let i = 0; i < this.itemIdx; i++) done += this.items[i].dauer || 0;
      const cur = this.phase === 'playing' ? done + this.itemTime() : total;
      return { total, t: Math.min(total, cur), remaining: this.phase === 'playing' ? Math.max(0, total - cur) : 0 };
    }
    snapshot() {
      const steps = VT.steps.schritte, st = this.step, ci = this.chainInfo();
      const nx = steps[this.pos + 1];
      const miss = VT.missing();
      return {
        pos: this.pos, klick: st ? st.klick : 0, nKlicks: this.nKlicks, name: st ? st.name : '', phase: this.phase,
        items: this.items.map((it, i) => ({ label: it.label, typ: it.typ, dauer: it.dauer || 0, echt: it.typ === 'clip' ? !!it.echt && !this.failed[it.id] : null, state: i < this.itemIdx ? 'fertig' : i === this.itemIdx ? 'jetzt' : 'offen' })),
        itemIdx: this.itemIdx, itemT: this.itemTime(), chainT: ci.t, chainTotal: ci.total, remaining: ci.remaining,
        nextName: nx ? nx.name : '', nextKlick: nx ? nx.klick : null, nextPos: nx ? this.pos + 1 : null,
        t0: this.t0, clickTimes: this.clickTimes, muted: this.muted, soundBlocked: this.soundBlocked,
        overlays: this.overlays.map((o) => ({ id: o.cfg.id, optional: !!o.cfg.optional, state: o.state })),
        missing: miss.map((c) => c.name), nMissing: miss.length, nClips: VT.steps.clips.length,
        errors: this.errors, ticking: VT.audio.ticking, tempo: this.tempo, now: Date.now(),
      };
    }
  }

  VT.Player = Player;
})();
