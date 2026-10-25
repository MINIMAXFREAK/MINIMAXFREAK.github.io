/* Daten laden und prüfen, welche Clips als echte Videos vorliegen (HEAD + manifest.json) */
(function () {
  'use strict';
  const VT = window.VT;

  async function getJSON(url, fallback) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      if (fallback !== undefined) return fallback;
      throw e;
    }
  }

  async function exists(url) {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!r.ok) return null;
      const type = (r.headers.get('content-type') || '').toLowerCase();
      if (type.includes('text/html')) return null; // Server liefert Fehlerseite
      return { bytes: Number(r.headers.get('content-length') || 0) };
    } catch (e) { return null; }
  }

  VT.loadAll = async function () {
    const [steps, config, notes, manifest] = await Promise.all([
      getJSON('data/steps.json'),
      getJSON('data/config.json', {}),
      getJSON('data/notes.json', {}),
      getJSON('media/manifest.json', { clips: {} }),
    ]);
    VT.steps = steps; VT.config = config; VT.notes = notes; VT.manifest = manifest;
    VT.clipById = {};
    steps.clips.forEach((c) => { VT.clipById[c.id] = c; });
    await VT.scanMedia();
    return VT;
  };

  /* Prüft jeden Clip: Datei da? Maßgeblich ist media/manifest.json (schreibt tools/sync-clips.py, läuft bei start.bat).
     Fehlt das Manifest oder wurde es nie erzeugt, fragt die Seite jede Datei per HEAD an. Infos (Dauer, Ton, Poster) kommen aus dem Manifest. */
  VT.scanMedia = async function () {
    const info = {};
    const mf = (VT.manifest && VT.manifest.clips) || {};
    const autoritativ = !!(VT.manifest && VT.manifest.erzeugt);
    const force = new URLSearchParams(location.search).get('scan') === '1';
    await Promise.all(VT.steps.clips.map(async (c) => {
      const m = mf[c.datei];
      let da = !!m, bytes = m ? m.bytes : 0;
      if (!autoritativ || force) { const head = await exists('media/' + c.datei); da = !!head; if (head) bytes = head.bytes; }
      const e = { id: c.id, datei: c.datei, vorhanden: da, dauer: null, ton: null, poster: null, hinweise: [] };
      if (da) {
        if (m && (!m.bytes || !bytes || m.bytes === bytes)) {
          e.dauer = m.dauer || null;
          e.ton = m.ton == null ? null : !!m.ton;
          if (m.poster_first || m.poster_last) e.poster = { first: m.poster_first || null, last: m.poster_last || null };
          e.hinweise = m.warnungen || [];
        }
        e.url = 'media/' + c.datei + '?v=' + (bytes || 0) + '-' + ((m && m.mtime) || 0);
      }
      info[c.id] = e;
    }));
    VT.media = info;
  };

  VT.missing = () => VT.steps.clips.filter((c) => !VT.media[c.id].vorhanden);
  VT.posterUrl = (clipId, which) => {
    const m = VT.media[clipId];
    return m && m.poster && m.poster[which] ? 'media/' + m.poster[which] : null;
  };
  VT.clipDuration = (clipId) => {
    const c = VT.clipById[clipId], m = VT.media[clipId];
    return (m && m.vorhanden && m.dauer) ? m.dauer : c.platzhalterDauer;
  };

  /* Schriften vorab laden, damit nichts springt */
  VT.fontsReady = async function () {
    try {
      await Promise.all([
        document.fonts.load('700 100px "Space Grotesk"'), document.fonts.load('500 40px "Space Grotesk"'),
        document.fonts.load('600 40px "Inter"'), document.fonts.load('400 40px "Inter"'),
      ]);
      await document.fonts.ready;
    } catch (e) { /* egal */ }
  };

  /* Schritte vorbereiten: Eintragsliste mit Typ, Name, Dauer */
  VT.buildItems = function (stepIdx) {
    const st = VT.steps.schritte[stepIdx];
    const items = [];
    (st.ablauf || []).forEach((a, i) => {
      if (a.clip) {
        const c = VT.clipById[a.clip];
        if (!c) throw new Error('Unbekannter Clip: ' + a.clip);
        items.push({ typ: 'clip', id: a.clip, clip: c, label: c.name, ueberblendung: a.ueberblendung || 0 });
      } else if (a.karte) {
        const cfg = VT.steps.animationen.kapitel;
        items.push({ typ: 'karte', id: 'karte', text: a.karte, label: 'Kapitelkarte „' + a.karte + '“', dauer: cfg.dauer, ueberblendung: a.ueberblendung || 0 });
      } else if (a.anim) {
        const cfg = VT.steps.animationen[a.anim] || {};
        items.push({ typ: 'anim', id: a.anim, anim: a.anim, label: cfg.name || a.anim, dauer: cfg.dauer || 1, ueberblendung: a.ueberblendung || 0 });
      } else if (a.folie) {
        const cfg = VT.steps.animationen[a.folie] || {};
        items.push({ typ: 'folie', id: a.folie, anim: a.folie, label: cfg.name || a.folie, dauer: cfg.dauer || 0.5, ueberblendung: a.ueberblendung || 0 });
      } else if (a.schwarz) {
        items.push({ typ: 'schwarz', id: 'schwarz', label: 'Schwarz', dauer: 0 });
      }
      items[items.length - 1].index = i;
    });
    items.forEach((it) => {
      if (it.typ === 'clip') {
        const m = VT.media[it.id];
        it.echt = !!(m && m.vorhanden);
        it.dauer = VT.clipDuration(it.id);
      }
    });
    return items;
  };
})();
