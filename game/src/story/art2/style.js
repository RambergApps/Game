// BREACH – CHARACTER_STYLE: designkjennetegnene for figurene i mellomsekvensene, samlet på ett sted.
// Kilde: docs/KARAKTER-SPEC.md §1 (utseende, farger), src/shared/rig/skins.js (warden/protocol-glød), shared/rig/defs/warden.js.
// SKISSENIVÅ: Karakter jobber med en malt v3. Når v3 er godkjent justeres bare tallene her – tegnekoden leser alt herfra.
export const CHARACTER_STYLE = {
  // rustning mørk / mellom / lys, drakt, skjerf, våpen (KARAKTER-SPEC §1)
  armor: { d: '#1a1e23', m: '#333a42', l: '#5b6570' },
  armorLight: { d: '#232930', m: '#444d57', l: '#727e8a' },     // skulderplater, hjelmkuppel
  suit: { d: '#141619', m: '#23272c', l: '#3a4048' },
  scarf: { d: '#6e5232', m: '#a8814f', l: '#d8b67e' },          // sandfarget shemagh: krage + to haler bakover
  gun: { d: '#15181b', m: '#2b3036', l: '#59626c' },
  blue: '#3c86c8', blueL: '#7cc4ff',                              // skulderstripe (blått felt) + hvitt Λ-emblem
  emblem: '#e8ecef',
  ink: 'rgba(7,9,11,0.92)',                                       // kontur
  rim: '#a9c0d2',                                                 // kaldt kantlys – miljøets #ffb347 farger aldri Warden
  // glød per «skin» (skins.js): cyan = Warden-troppen, rødt = omprogrammert av The Protocol
  glow: {
    warden: { visor: '#39c6ff', hot: '#61e9ff', led: '#39c6ff', sight: '#39c6ff' },
    protocol: { visor: '#ff4a36', hot: '#ff7a60', led: '#ff4a36', sight: '#ff4a36' },
    dark: { visor: '#0b1218', hot: '#2a3a46', led: null, sight: null },   // slukket (Hale i slutten)
  },
  // silhuett (sidevisning, enhet = 1/100 av figurhøyden): bred «T» – skulderplater + lang rifle; sekken markerer baksiden
  shape: { helmetR: 10.5, visorArc: [-0.55, 0.62], pack: { x: -25, y: -84, w: 13, h: 32 }, antenna: [[-20, -84], [-30, -112]], rifle: { len: 52, y: -68 } },
  // troppskameratene: samme utstyr, skilles på skjerf, stripe og stensil (FORSLAG – sjekkes mot Karakter)
  squad: {
    warden: { callsign: 'W-09', scarf: true, stripes: 1, skin: 'warden' },
    hale: { callsign: 'H-04', scarf: true, stripes: 1, scarfTails: 2, skin: 'warden' },  // som Warden – derfor skjerf+stripe gjenkjennes
    okafor: { callsign: 'O-02', scarf: false, stripes: 2, skin: 'warden' },              // ingen skjerf, dobbel stripe
    brandt: { callsign: 'B-11', scarf: true, scarfCol: '#4a4f45', stripes: 0, longAntenna: true, skin: 'warden' }, // grått skjerf, lang antenne
  },
  // Protocol-fiendene (KARAKTER-SPEC §7): varm palett, ingen cyan
  enemy: {
    grunt: { glow: '#ff4a2a', accent: '#c0392b' },              // hjelm med rød-oransje visirspalte, røde skulderfelt
    flanker: { glow: '#ff2a1a', accent: '#8e1e1e' },            // spiss hette + kappe
    heavy: { glow: '#ff7a1a', accent: '#ff7a1a' },              // massiv, ammotank, glødende brystkjerne
    grenadier: { glow: '#9b59ff', accent: '#9b59ff' },          // gassmaske med to lilla linser
  },
};
