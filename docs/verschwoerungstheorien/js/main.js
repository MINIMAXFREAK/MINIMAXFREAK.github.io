/* Hauptfenster (Bühne): Start, Skalierung, QA-Hilfen */
(function () {
  'use strict';
  const VT = window.VT;
  const q = new URLSearchParams(location.search);

  function fatal(msg) {
    document.body.innerHTML = '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0B0B0D;color:#F4F1EA;font:600 28px Inter,Segoe UI,sans-serif;text-align:center;padding:40px">' + msg + '</div>';
  }

  (async function boot() {
    const stage = document.getElementById('stage');
    const view = { scale: 1, ox: 0, oy: 0 };
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight, s = Math.min(w / 1920, h / 1080);
      view.scale = s; view.ox = (w - 1920 * s) / 2; view.oy = (h - 1080 * s) / 2;
      stage.style.transform = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + s + ')';
    };
    fit(); window.addEventListener('resize', fit);
    VT.view = view;

    try { await VT.loadAll(); } catch (e) {
      return fatal('Daten nicht ladbar. Bitte über <b>start.bat</b> starten (lokaler Server), nicht per Doppelklick auf die HTML-Datei.');
    }
    await VT.fontsReady();
    document.title = VT.config.titel || 'Vortrag';
    if (q.get('probe') === '1') document.body.classList.add('probe');

    const tempo = Math.max(0.25, Math.min(16, Number(q.get('tempo')) || 1));
    const player = new VT.Player(stage, { tempo });
    const tools = new VT.Tools(view);
    const channel = new VT.Channel('sekten-vortrag');
    const controls = new VT.Controls(player, tools, channel);
    VT.player = player; VT.controls = controls; VT.tools = tools;

    /* Hilfen für den automatischen Test */
    VT.qa = {
      ready: true,
      snapshot: () => controls.fullState(),
      metrics: () => player.metrics,
      /* Animation (auch Overlays) an einer Zeit anhalten und zeigen */
      animAt(name, t, opt) {
        player._cleanup(); player._clearDom();
        player.token++;
        const isOv = ['frage', 'losungen'].includes(name);
        const host = VT.h('div', isOv ? { class: 'ovl' } : { class: 'layer' });
        if (isOv) {
          player.domEl.replaceChildren(VT.h('div', { class: 'layer', style: { background: 'linear-gradient(#5a6c88,#2b3345)' } }));
          player.ovEl.append(host);
        } else player.domEl.append(host);
        const inst = VT.createAnim(name === 'karte' ? 'kapitel' : name, host, VT.steps.animationen[name === 'karte' ? 'kapitel' : name] || {}, opt || {});
        inst.tl.seek(Math.min(t, inst.tl.duration));
        return inst.tl.duration;
      },
    };

    const start = q.get('klick');
    if (start != null && start !== '') player.goto(Number(start), 'end'); else player.goto(0, 'end');
    document.body.dataset.ready = '1';
  })();
})();
