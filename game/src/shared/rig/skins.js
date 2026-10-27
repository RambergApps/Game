// Skins = palett/emisjon for samme rigg og teksturer. 'warden' = spilleren, 'protocol' = omprogrammert Warden (fiende).
// Fiende-AI kan legge til egne via registerSkin(id, {...}) – manglende felt arves fra 'warden'.
// paint: teksturnavn for malte striper ('blue' | 'red' | 'amber' | 'violet' | 'white').
export const SKINS = {
  warden: {
    paint: 'blue', glow: '#39c6ff', glowDim: '#1d93c2', stripe: 'rgba(57,198,255,.8)', gunStripe: 'rgba(46,96,128,.75)',
    ring: '57,198,255', visorHi: 'rgba(200,245,255,.55)', rim: '196,206,214', coverEdge: '57,198,255',
  },
  protocol: {
    paint: 'red', glow: '#ff4a36', glowDim: '#c4301e', stripe: 'rgba(255,80,60,.85)', gunStripe: 'rgba(120,36,30,.8)',
    ring: '255,74,54', visorHi: 'rgba(255,215,200,.5)', rim: '214,200,196', coverEdge: '255,74,54',
  },
};
export function registerSkin(id, s) { SKINS[id] = { ...SKINS.warden, ...s }; return SKINS[id]; }
export const skinOf = (id) => SKINS[id] || SKINS.warden;
