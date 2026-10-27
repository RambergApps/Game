// Enkel hendelsesutsender. on() returnerer en avmeldingsfunksjon.
export function createEvents() {
  const map = new Map();
  return {
    on(type, fn) { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); return () => map.get(type)?.delete(fn); },
    once(type, fn) { const off = this.on(type, (p) => { off(); fn(p); }); return off; },
    off(type, fn) { map.get(type)?.delete(fn); },
    emit(type, payload) {
      for (const fn of [...(map.get(type) || [])]) { try { fn(payload); } catch (e) { console.error(`[events] '${type}'`, e); } }
      for (const fn of [...(map.get('*') || [])]) fn({ type, payload });
    },
  };
}
