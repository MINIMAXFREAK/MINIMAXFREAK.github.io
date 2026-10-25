/* Verbindung Hauptfenster <-> Referentenfenster (BroadcastChannel) */
(function () {
  'use strict';
  const VT = window.VT;
  VT.Channel = class Channel {
    constructor(name) {
      this.ok = typeof BroadcastChannel !== 'undefined';
      this.bc = this.ok ? new BroadcastChannel(name || 'sekten-vortrag') : null;
      this.handlers = [];
      if (this.bc) this.bc.onmessage = (e) => this.handlers.forEach((f) => f(e.data));
    }
    send(msg) { if (this.bc) { try { this.bc.postMessage(msg); } catch (e) { /* */ } } }
    onMessage(fn) { this.handlers.push(fn); }
  };
})();
