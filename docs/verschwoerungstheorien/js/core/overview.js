/* Übersicht (Raster aller Schritte) und Hilfe; gemeinsam für Hauptfenster und Referentenfenster */
(function () {
  'use strict';
  const VT = window.VT;
  const { h } = VT;

  /* Tastenkürzel: Quelle für Hilfe und README */
  VT.HILFE = [
    ['Weiter', 'Klick links · Leertaste · Enter · → · ↓ · Bild ab'],
    ['Zurück (Endzustand des vorigen Klicks)', '← · ↑ · Bild auf · Rücktaste'],
    ['Vorigen Klick noch einmal von vorn', 'Umschalt + ←'],
    ['Kette bis zum Ende überspringen', 'S'],
    ['Zum Anfang / zum Ende', 'Pos1 / Ende'],
    ['Zu Klick n springen (Endzustand)', 'Zahl tippen, dann Enter'],
    ['Zu Klick n springen und abspielen', 'Zahl tippen, dann Umschalt + Enter'],
    ['Optional-Overlay sofort ein/aus', 'O'],
    ['Vollbild', 'F'],
    ['Übersicht aller Schritte', 'G'],
    ['Schwarzer / weißer Bildschirm', 'B · . / W · ,'],
    ['Hilfe', 'H · ?'],
    ['Laserpointer', 'L'],
    ['Stift (Amber) / alle Striche löschen', 'D / E'],
    ['Ton an/aus (auch Ticken)', 'M'],
    ['Referentenfenster öffnen', 'P'],
    ['Stoppuhr im Hauptfenster ein/aus', 'T'],
    ['Schließen', 'Esc'],
  ];

  VT.buildHelp = function (el) {
    el.replaceChildren(
      h('button', { class: 'schliessen', text: 'Schließen (Esc)', onclick: () => el.classList.remove('offen') }),
      h('h2', { text: 'Tastenkürzel' }),
      h('table', {}, VT.HILFE.map((r) => h('tr', {}, h('td', { text: r[1] }), h('td', { text: r[0] })))),
      h('h3', { text: 'Hinweise' }),
      h('p', { style: { maxWidth: '760px', opacity: .8, fontWeight: 400, lineHeight: 1.5 }, text:
        'Während eine Kette läuft, werden Weiter-Eingaben ignoriert (S überspringt bewusst). Eingaben innerhalb von 250 ms nach einer anderen werden verworfen. ' +
        'Probenmodus: Adresse mit ?probe=1 öffnen. Neustart mitten im Vortrag: ?klick=7 springt in den Endzustand von Klick 7.' }),
    );
  };

  /* Verkleinerte Nachbildung des Endzustands eines Schritts */
  VT.thumbInto = function (box, pos) {
    const inner = h('div', { class: 'innen' });
    box.append(inner);
    const w = box.clientWidth || 260;
    inner.style.transform = 'scale(' + w / 1920 + ')';
    let items;
    try { items = VT.buildItems(pos); } catch (e) { return; }
    const last = items[items.length - 1];
    if (!last) return;
    if (last.typ === 'schwarz') { inner.style.background = '#000'; return; }
    const host = h('div', { style: { position: 'absolute', inset: 0 } });
    inner.append(host);
    if (last.typ === 'clip') {
      const poster = last.echt ? VT.posterUrl(last.id, 'last') : null;
      if (poster) { host.append(h('img', { src: poster, alt: '', style: { width: '1920px', height: '1080px', objectFit: 'cover' } })); return; }
      const cfg = Object.assign({}, VT.steps.animationen.platzhalter || {}, { dauer: last.dauer });
      const inst = VT.createAnim('platzhalter', host, cfg, { clip: last.clip, label: 'Klick ' + VT.steps.schritte[pos].klick, dur: last.dauer });
      inst.tl.finish(); return;
    }
    const name = last.typ === 'karte' ? 'kapitel' : last.anim;
    try {
      const inst = VT.createAnim(name, host, VT.steps.animationen[name] || {}, { text: last.text });
      inst.tl.finish();
    } catch (e) { /* */ }
  };

  VT.openOverview = function (el, current, onPick) {
    el.replaceChildren(h('button', { class: 'schliessen', text: 'Schließen (Esc)', onclick: () => VT.closeOverview(el) }), h('h2', { text: 'Übersicht' }));
    const grid = h('div', { class: 'grid' });
    el.append(grid);
    el.classList.add('offen');
    VT.steps.schritte.forEach((st, pos) => {
      const bild = h('div', { class: 'bild' });
      const nm = st.klick >= 1 && st.klick <= 18 ? 'Klick ' + st.klick : st.klick === 0 ? 'Start' : st.klick === 19 ? 'Quellen' : 'Ende';
      const info = (st.ablauf || []).map((a) => a.clip ? VT.clipById[a.clip].name : a.karte ? '„' + a.karte + '“' : a.anim ? (VT.steps.animationen[a.anim] || {}).name || a.anim : '').filter(Boolean).join(' → ');
      const k = h('button', { class: 'kachel' + (pos === current ? ' aktuell' : ''), onclick: () => onPick(pos) },
        bild, h('div', { class: 'titel' }, h('b', { text: nm }), st.name, info && info !== st.name ? h('small', { text: info }) : null));
      grid.append(k);
      VT.thumbInto(bild, pos);
    });
    const cur = grid.querySelector('.aktuell'); if (cur) cur.scrollIntoView({ block: 'center' });
  };
  VT.closeOverview = function (el) { el.classList.remove('offen'); el.replaceChildren(); };
})();
