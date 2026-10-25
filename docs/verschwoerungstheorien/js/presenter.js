/* Referentenansicht: zeigt Zustand des Hauptfensters, Notizen, Zeitmarke; sendet Befehle zurück */
(function () {
  'use strict';
  const VT = window.VT;
  const { h } = VT;
  const $ = (id) => document.getElementById(id);

  (async function boot() {
    try { await VT.loadAll(); } catch (e) { document.body.textContent = 'Daten nicht ladbar. Bitte über start.bat starten.'; return; }
    await VT.fontsReady();
    document.title = 'Referent · ' + (VT.config.titel || '');
    const cfg = VT.config, steps = VT.steps.schritte;
    const ab = Object.assign({ amberAb: 20, rotAb: 45 }, cfg.abweichung || {});
    const ch = new VT.Channel('sekten-vortrag');
    const guard = VT.makeGuard(250);
    let S = null, lastMsg = 0, numBuf = '', shownKey = null, shownNext = null, fontPx = 40;
    try { fontPx = Number(localStorage.getItem('notizPx')) || 40; } catch (e) { /* */ }
    $('n-text').style.fontSize = fontPx + 'px';

    const send = (c, a) => ch.send({ t: 'cmd', c, a });
    ch.onMessage((m) => { if (m.t === 'state') { S = m.s; lastMsg = Date.now(); render(true); } });
    const hello = () => ch.send({ t: 'hello' });
    hello(); const helloIv = setInterval(() => { if (S) { clearInterval(helloIv); return; } hello(); }, 800);

    VT.buildHelp($('hilfe'));

    /* ---------- Notizen ---------- */
    const cueRe = (cfg.cues && cfg.cues.length) ? new RegExp('\\b(' + cfg.cues.join('|') + ')\\b', 'g') : null;
    const cues = (txt) => {
      if (!cueRe) return [txt];
      const out = []; let last = 0, m; cueRe.lastIndex = 0;
      while ((m = cueRe.exec(txt))) { out.push(txt.slice(last, m.index), h('span', { class: 'cue', text: m[0] })); last = m.index + m[0].length; }
      out.push(txt.slice(last)); return out;
    };
    const inline = (txt) => txt.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean).map((p) => {
      if (p.startsWith('**') && p.endsWith('**')) return h('strong', {}, cues(p.slice(2, -2)));
      if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return h('em', {}, cues(p.slice(1, -1)));
      return cues(p);
    });
    const renderNotes = (md) => {
      const box = $('n-text'); box.replaceChildren();
      if (!md || !md.trim()) { box.append(h('p', { class: 'leer', text: Object.entries(VT.notes || {}).some(([k, v]) => k[0] !== '_' && v && v.trim()) ? 'Keine Notiz für diesen Klick.' : 'Keine Sprechnotizen geladen. Datei sprechtext.md in den Ordner website/ legen und tools/build-notes.py ausführen (oder start.bat).' })); return; }
      let para = [];
      const flush = () => { if (para.length) { box.append(h('p', {}, inline(para.join(' ')))); para = []; } };
      md.split(/\r?\n/).forEach((ln) => {
        if (/^\s*$/.test(ln)) { flush(); return; }
        const m = ln.match(/^#{1,6}\s+(.*)$/);
        if (m) { flush(); box.append(h('h3', {}, inline(m[1]))); return; }
        para.push(ln.trim());
      });
      flush();
    };

    /* ---------- Darstellung ---------- */
    const fmt = VT.fmtTime;
    const sign = (v) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v)) + ' s';
    const klass = (d) => { const a = Math.abs(d); return a >= ab.rotAb ? 'rot' : a >= ab.amberAb ? 'amber' : 'gruen'; };

    function render(full) {
      const connected = S && Date.now() - lastMsg < 3500;
      if (!S) { $('k-nr').textContent = 'Warte …'; $('k-name').textContent = 'Warte auf das Hauptfenster. Es muss unter derselben Adresse offen sein.'; footer(false); return; }
      const st = steps[S.pos];
      const k = S.klick;
      $('k-nr').textContent = k >= 1 && k <= 18 ? 'Klick ' + k : k === 0 ? 'Titelfolie' : k === 19 ? 'Quellenfolie' : 'Ende';
      $('k-von').textContent = k >= 1 && k <= 18 ? 'von ' + S.nKlicks : '';
      $('k-name').textContent = connected ? st.name + (S.screen ? '   ·   Bildschirm ' + (S.screen === 'black' ? 'schwarz' : 'weiß') : '') : 'Hauptfenster nicht verbunden';

      // Stoppuhr und Zeitmarke
      const el = S.t0 ? (Date.now() - S.t0) / 1000 : 0;
      $('uhr').textContent = fmt(el);
      $('uhr').style.opacity = S.t0 ? 1 : 0.45;
      const soll = VT.parseTime(st.sollzeit), ist = S.clickTimes && S.clickTimes[k] && S.t0 ? (S.clickTimes[k] - S.t0) / 1000 : null;
      const sb = $('soll'); sb.className = '';
      if (soll != null && ist != null) { const d = ist - soll; sb.textContent = 'Klick ' + k + ': Soll ' + st.sollzeit + ' · Ist ' + fmt(ist) + ' · ' + sign(d); sb.classList.add(klass(d)); }
      else if (soll != null) sb.textContent = 'Soll ' + st.sollzeit;
      else sb.textContent = S.t0 ? 'Ziel ' + (cfg.zielzeit || '') : 'Stoppuhr startet mit Klick 1';
      const nxt = steps[S.pos + 1], nsoll = nxt ? VT.parseTime(nxt.sollzeit) : null, s2 = $('soll2'); s2.className = '';
      if (S.t0 && nsoll != null) { const late = el - nsoll; s2.textContent = 'Klick ' + nxt.klick + ' Soll ' + nxt.sollzeit + (late < 0 ? ' · noch ' + fmt(-late) : ' · ' + fmt(late) + ' überfällig'); s2.classList.add(late < 0 ? 'gruen' : klass(late)); }
      else if (nxt && nsoll != null) s2.textContent = 'Klick ' + nxt.klick + ' Soll ' + nxt.sollzeit; else s2.textContent = '';

      // Warnsymbol
      const w = $('k-warn'); w.className = S.nMissing ? '' : 'keine';
      w.replaceChildren(h('span', { text: S.nMissing ? '▲ ' + S.nMissing + ' von ' + S.nClips + ' Clips fehlen' : 'Alle ' + S.nClips + ' Clips vorhanden', title: S.nMissing ? S.missing.join(', ') : '' }));

      // Kette
      $('phase').textContent = S.phase === 'playing' ? 'Läuft' : S.phase === 'hold' ? 'Halten, wartet auf den Klick' : '';
      const ol = $('kette'); ol.replaceChildren();
      S.items.forEach((it, i) => {
        const frac = it.state === 'fertig' ? 1 : it.state === 'jetzt' ? (S.phase === 'hold' ? 1 : Math.min(1, S.itemT / Math.max(0.1, it.dauer))) : 0;
        ol.append(h('li', { class: it.state + (it.echt === false ? ' ph' : '') }, h('small', { text: fmt(it.dauer) }), it.label, h('div', { class: 'bar', style: { width: frac * 100 + '%' } })));
      });
      $('rest').textContent = S.phase === 'playing' ? 'Rest der Kette: ' + fmt(S.remaining) : (S.overlays.some((o) => o.optional) ? 'Overlay (O): ' + (S.overlays.find((o) => o.optional).state === 'an' ? 'sichtbar' : 'aus') : '');

      // Nächster Schritt
      const nk = S.nextPos;
      if (shownNext !== nk) {
        shownNext = nk;
        $('nx-name').textContent = nxt ? (nxt.klick >= 1 && nxt.klick <= 18 ? 'Klick ' + nxt.klick + ': ' : '') + nxt.name : 'Ende des Vortrags';
        const box = $('nx-bild'); box.replaceChildren(h('div', { class: 'bild' }));
        if (nk != null) VT.thumbInto(box.firstChild, nk); else box.firstChild.style.background = '#000';
      }

      // Notizen
      const key = String(k);
      if (shownKey !== key) { shownKey = key; renderNotes((VT.notes || {})[key] || ''); $('notizen').scrollTop = 0; }

      $('b-mute').textContent = S.muted ? 'Ton aus (M)' : 'Ton an (M)';
      footer(connected);
    }

    function footer(connected) {
      const f = $('fuss'); f.replaceChildren();
      const add = (cls, txt) => f.append(h('span', { class: cls, text: txt }));
      if (!connected) { f.append(h('button', { text: 'Hauptfenster öffnen', onclick: () => window.open('index.html', 'sekten-vortrag-haupt') })); add('warn', 'Keine Verbindung zum Hauptfenster.'); }
      if (S) {
        Object.keys(S.errors || {}).forEach((id) => add('fehler', 'Clip „' + ((VT.clipById[id] || {}).name || id) + '“: ' + S.errors[id] + ' (Bühne zeigt Posterbild/Platzhalter)'));
        if (S.soundBlocked) add('warn', 'Ton blockiert: einmal ins Hauptfenster klicken oder F drücken.');
        if (S.ticking) add('ok', 'Uhr tickt (WebAudio)');
        if (S.pen) add('ok', 'Stift an'); if (S.laser) add('ok', 'Laser an');
        if (S.tempo !== 1) add('warn', 'Testtempo ×' + S.tempo);
        if (S.numBuf || numBuf) add('ok', 'Sprung: Klick ' + (numBuf || S.numBuf) + ' … Enter');
      }
    }

    /* ---------- Eingaben ---------- */
    const NAV = ['next', 'prev', 'replay', 'skip', 'home', 'end'];
    const close = () => { VT.closeOverview($('uebersicht')); $('hilfe').classList.remove('offen'); };
    function act(a) {
      switch (a.a) {
        case 'digit': numBuf = (numBuf + a.v).slice(-2); render(); return;
        case 'enter':
          if (numBuf) { const n = parseInt(numBuf, 10); numBuf = ''; if (guard()) send(a.shift ? 'jumpPlay' : 'jump', n); render(); return; }
          if (guard()) send('next'); return;
        case 'backspace': if (numBuf) { numBuf = numBuf.slice(0, -1); render(); return; } if (guard()) send('prev'); return;
        case 'escape': if ($('uebersicht').classList.contains('offen') || $('hilfe').classList.contains('offen')) close(); else numBuf = ''; render(); return;
        case 'help': $('uebersicht').classList.contains('offen') && close(); $('hilfe').classList.toggle('offen'); return;
        case 'overview':
          if ($('uebersicht').classList.contains('offen')) { close(); return; }
          $('hilfe').classList.remove('offen');
          VT.openOverview($('uebersicht'), S ? S.pos : 0, (pos) => { close(); if (guard()) send('jump', pos); });
          return;
        case 'fullscreen': try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) { /* */ } return;
        case 'laser': case 'pen': case 'erase': case 'presenter': return;   // nur im Hauptfenster
        default:
          if (NAV.includes(a.a) && !guard()) return;
          close(); send(a.a === 'optional' ? 'optional' : a.a);
      }
    }
    document.addEventListener('keydown', (e) => {
      if (e.repeat) { if (VT.keyAction(e)) e.preventDefault(); return; }
      const a = VT.keyAction(e); if (!a) return; e.preventDefault(); act(a);
    });
    document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.cmd;
      if (NAV.includes(c) && !guard()) return;
      send(c === 'overlay' ? 'optional' : c);
    }));
    $('b-uebersicht').addEventListener('click', () => act({ a: 'overview' }));
    $('b-hilfe').addEventListener('click', () => act({ a: 'help' }));
    const px = (d) => { fontPx = Math.max(24, Math.min(90, fontPx + d)); $('n-text').style.fontSize = fontPx + 'px'; try { localStorage.setItem('notizPx', fontPx); } catch (e) { /* */ } };
    $('n-plus').addEventListener('click', () => px(4)); $('n-minus').addEventListener('click', () => px(-4));

    setInterval(() => render(false), 250);
    render(true);
    document.body.dataset.ready = '1';
    window.VTP = { state: () => S, notesShown: () => $('n-text').textContent };
  })();
})();
