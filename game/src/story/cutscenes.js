// BREACH – manus for mellomsekvenser (eies av Breach Nivåer og story).
// Historie: Konsept A «CINDER» (LÅST av Alexander 23.10, se docs/PROSJEKT.md og docs/STORY-KONSEPTER.md).
// «The Protocol», omprogrammerte Wardens og Hale-vrien er ERSTATTET og fjernet. All spilltekst på engelsk.
//
// Sekvens = 3–5 paneler (tegneserieruter). Panel:
//   { id, scene, image?, transition?, cam?, textDelay?, lines: [{ speaker, who?, text }] }
//   id     – stabil panel-id ('intro-01'), brukes som filnavn for det malte bildet.
//   image  – sti til malt bilde, relativt til game/ (img/story/<id>.webp, 16:9, 1920×1080 WebP).
//            Lastes BARE når id-en står i PAINTED_PANELS (unngår 404 i konsollen); ellers brukes
//            den kodetegnede scenen `scene` (scenes.js) som midlertidig plassholder.
//   transition 'fade' | 'cut' | 'swipe' (overgang INN), cam { from:[zoom,fx,fy], to, dur }, textDelay s.
// speaker (avtalt med Lyd, UENDRET): 'announcer' = nødkringkasting (PA/radio til sivile) ·
//   'command' = stemme på samband (Garrison-kommando ELLER troppen på radio; `who` gir navnet: HALE/OKAFOR/BRANDT/COMMAND) ·
//   'warden' = Wardens stemme · 'caption' = stum tekst uten stemme.
// trigger beskriver når sekvensen spilles (norsk).

export const SPEAKERS = ['announcer', 'command', 'warden', 'caption'];
/** Etikett over linjen i spillet (bare stemmene utenfra får etikett). Linjens `who` går foran. */
export const SPEAKER_LABEL = { announcer: 'BROADCAST', command: 'RADIO' };

/** Panel-id-er som har fått malt bilde i game/img/story/<id>.webp. Maleren legger til id her ved levering. */
export const PAINTED_PANELS = new Set(['intro-01', 'intro-02', 'intro-03', 'intro-04', 'yard-clear-01', 'yard-clear-02', 'yard-clear-03',
  'ashmaw-rise-01', 'ashmaw-rise-02', 'ashmaw-rise-03', 'ashmaw-rise-04', 'ending-01', 'ending-02', 'ending-03', 'ending-04',
  'fallen-01', 'refinery-clear-01', 'refinery-clear-02', 'refinery-clear-03', 'refinery-clear-04',
  'foundry-core-01', 'foundry-core-02', 'foundry-core-03', 'foundry-core-04']);
/** Felles bildeformat for malte paneler. */
export const PANEL_IMAGE = { dir: 'img/story/', ext: '.webp', width: 1920, height: 1080 };
const P = (id, scene, rest) => ({ id, scene, image: PANEL_IMAGE.dir + id + PANEL_IMAGE.ext, ...rest });

export const CUTSCENES = {
  // Etablering: evakueringen av Kessa, Deepwell, bakken som gløder. Første kontakt.
  intro: {
    id: 'intro', chapter: 'CHAPTER 01', title: 'Kessa Yard',
    trigger: 'Før nivå 1, bølge 1-1.', when: 'Before level 1, wave 1-1.',
    panels: [
      P('intro-01', 'yardGate', { transition: 'fade', textDelay: 1.2, cam: { from: [1.0, 0.5, 0.5], to: [1.12, 0.5, 0.46], dur: 9 }, lines: [
        { speaker: 'caption', text: 'Forty kilometres inland, the Deepwell drill hit something that bled.' },
        { speaker: 'caption', text: 'Three days later, Kessa Port is still evacuating.' },
      ] }),
      P('intro-02', 'yardAftermath', { transition: 'cut', textDelay: 0.6, cam: { from: [1.15, 0.4, 0.6], to: [1.0, 0.5, 0.5], dur: 7 }, lines: [
        { speaker: 'announcer', text: 'All civilians to the piers. Stay off open ground. Repeat: stay off open ground.' },
      ] }),
      P('intro-03', 'wardenVisor', { transition: 'cut', textDelay: 0.6, cam: { from: [1.0, 0.5, 0.5], to: [1.1, 0.52, 0.45], dur: 7 }, lines: [
        { speaker: 'command', who: 'HALE', text: 'Last ship loads in twenty. Garrison Nine holds the yard.' },
        { speaker: 'warden', text: 'Then we hold the yard.' },
      ] }),
      P('intro-04', 'yardGate', { transition: 'swipe', textDelay: 0.8, cam: { from: [1.3, 0.62, 0.7], to: [1.4, 0.62, 0.78], dur: 6 }, lines: [
        { speaker: 'caption', text: 'The asphalt glows from underneath.' },
        { speaker: 'warden', text: 'Contact. They’re coming up through the cracks.' },
      ] }),
    ],
  },
  // Siste skip går. Troppen blir igjen. Sverm mot raffineriet – de jager varme.
  'yard-clear': {
    id: 'yard-clear', chapter: 'CHAPTER 02', title: 'Deepwell Refinery',
    trigger: 'Etter bølge 1-5, før nivå 2. Siste skip går; svermen drar mot raffineriet.', when: 'After wave 1-5, before level 2. The last ship leaves; the swarm turns inland.',
    panels: [
      P('yard-clear-01', 'yardAftermath', { transition: 'fade', textDelay: 1.0, cam: { from: [1.0, 0.5, 0.5], to: [1.12, 0.55, 0.45], dur: 9 }, lines: [
        { speaker: 'caption', text: 'The last ship clears the breakwater.' },
        { speaker: 'command', who: 'BRANDT', text: 'That’s everyone. Everyone but us.' },
      ] }),
      P('yard-clear-02', 'wardenVisor', { transition: 'cut', textDelay: 0.5, cam: { from: [1.1, 0.5, 0.48], to: [1.0, 0.5, 0.5], dur: 7 }, lines: [
        { speaker: 'command', who: 'COMMAND', text: 'Garrison Nine, the swarm is moving inland. Toward the refinery.' },
        { speaker: 'warden', text: 'They’re not chasing people. They’re chasing heat.' },
      ] }),
      P('yard-clear-03', 'refineryBurning', { transition: 'swipe', textDelay: 1.0, cam: { from: [1.0, 0.5, 0.5], to: [1.15, 0.45, 0.5], dur: 8 }, lines: [
        { speaker: 'caption', text: 'Deepwell Refinery. Eleven million litres of fuel.' },
        { speaker: 'warden', text: 'Then that’s where we stop them.' },
      ] }),
    ],
  },
  // Etter Kiln Alpha (2-6): Okafor ser boreriggen. «We drilled into their house.» Ordre: forsegl brønnen.
  'refinery-clear': {
    id: 'refinery-clear', chapter: 'CHAPTER 03', title: 'The Deepwell',
    trigger: 'Etter bølge 2-6 (Kiln Alpha), før nivå 3. Erkjennelsen: brønnen er inngangen.', when: 'After wave 2-6 (Kiln Alpha), before level 3. The realisation: the well is the way in.',
    panels: [
      P('refinery-clear-01', 'refineryBurning', { transition: 'fade', textDelay: 1.0, cam: { from: [1.15, 0.55, 0.55], to: [1.0, 0.5, 0.5], dur: 8 }, lines: [
        { speaker: 'caption', text: 'The Kiln goes down. Its core keeps burning for a full minute.' },
        { speaker: 'command', who: 'OKAFOR', text: 'Warden. Look at the drill tower.' },
      ] }),
      P('refinery-clear-02', 'foundryDescent', { transition: 'cut', textDelay: 1.2, cam: { from: [1.0, 0.5, 0.3], to: [1.18, 0.5, 0.62], dur: 9 }, lines: [
        { speaker: 'caption', text: 'Under the rig, the borehole. Wide as a street. Breathing heat.' },
        { speaker: 'command', who: 'OKAFOR', text: 'We didn’t find them. We drilled into their house.' },
      ] }),
      P('refinery-clear-03', 'foundryCore', { transition: 'cut', textDelay: 0.5, cam: { from: [1.0, 0.5, 0.5], to: [1.1, 0.5, 0.55], dur: 7 }, lines: [
        { speaker: 'command', who: 'COMMAND', text: 'Seal it. Charges at the bottom of the shaft.' },
        { speaker: 'warden', text: 'How far down?' },
        { speaker: 'command', who: 'HALE', text: 'All the way.' },
      ] }),
      P('refinery-clear-04', 'wardenVisor', { transition: 'swipe', textDelay: 0.6, cam: { from: [1.2, 0.5, 0.45], to: [1.3, 0.5, 0.45], dur: 5 }, lines: [
        { speaker: 'warden', text: 'Garrison Nine. We’re going down.' },
      ] }),
    ],
  },
  // Før hold-finalen 3-6: tennsatsen er manuell, noen må bli. Warden blir. 75 sekunder.
  'foundry-core': {
    id: 'foundry-core', chapter: 'CHAPTER 03', title: 'The Core',
    trigger: 'Før bølge 3-6 (hold kjernen i 75 s). Vrien: Warden blir igjen ved tennsatsen.', when: 'Before wave 3-6 (hold the core, 75 s). The turn: Warden stays at the fuse.',
    panels: [
      P('foundry-core-01', 'foundryCore', { transition: 'fade', textDelay: 1.2, cam: { from: [1.0, 0.5, 0.5], to: [1.15, 0.5, 0.52], dur: 9 }, lines: [
        { speaker: 'caption', text: 'The Deepwell. Two kilometres down.' },
        { speaker: 'command', who: 'OKAFOR', text: 'Charge is set. The fuse is manual. Someone stays.' },
      ] }),
      P('foundry-core-02', 'wardenVisor', { transition: 'cut', textDelay: 0.4, cam: { from: [1.05, 0.5, 0.5], to: [1.18, 0.52, 0.46], dur: 7 }, lines: [
        { speaker: 'command', who: 'HALE', text: 'I’ll do it.' },
        { speaker: 'warden', text: 'No. Get them to the lift, Hale. That’s an order.' },
      ] }),
      P('foundry-core-03', 'foundryDescent', { transition: 'cut', textDelay: 0.8, cam: { from: [1.2, 0.5, 0.7], to: [1.0, 0.5, 0.5], dur: 6 }, lines: [
        { speaker: 'caption', text: 'The shaft starts to shake. Something big is climbing.' },
        { speaker: 'command', who: 'BRANDT', text: 'Contacts. Every crack. Hundreds.' },
      ] }),
      P('foundry-core-04', 'v2Charge', { transition: 'swipe', textDelay: 0.5, cam: { from: [1.12, 0.48, 0.42], to: [1.0, 0.5, 0.5], dur: 1.2 }, lines: [
        { speaker: 'warden', text: 'Seventy-five seconds. Hold the core.' },
      ] }),
    ],
  },
  // Boss-introduksjon: lunta er tent, Ashmaw klatrer opp sjakta før ladningen går. Warden blir igjen.
  'ashmaw-rise': {
    id: 'ashmaw-rise', chapter: 'FINAL', title: 'Ashmaw',
    trigger: 'Etter hold-bølgen 3-6, før boss-bølgen 3-7.', when: 'After hold wave 3-6, before boss wave 3-7.',
    panels: [
      P('ashmaw-rise-01', 'foundryCore', { transition: 'fade', textDelay: 0.6, cam: { from: [1.0, 0.5, 0.5], to: [1.14, 0.5, 0.55], dur: 7 }, lines: [
        { speaker: 'caption', text: 'The fuse is lit. The charge is counting down.' },
        { speaker: 'command', who: 'BRANDT', text: 'Lift’s loaded. Warden, get on. Now.' },
      ] }),
      P('ashmaw-rise-02', 'foundryDescent', { transition: 'cut', textDelay: 0.8, cam: { from: [1.25, 0.5, 0.75], to: [1.0, 0.5, 0.5], dur: 6 }, lines: [
        { speaker: 'caption', text: 'The floor of the well splits. A black dome climbs out on short crab legs. Eight vents, burning like furnaces.' },
        { speaker: 'command', who: 'OKAFOR', text: 'That’s the mother. That’s what they were keeping warm.' },
      ] }),
      P('ashmaw-rise-03', 'wardenVisor', { transition: 'cut', textDelay: 0.4, cam: { from: [1.05, 0.5, 0.5], to: [1.2, 0.52, 0.46], dur: 6 }, lines: [
        { speaker: 'command', who: 'HALE', text: 'She’s on top of the charge. If she pulls it loose, it was all for nothing.' },
        { speaker: 'warden', text: 'Then she doesn’t leave the shaft.' },
      ] }),
      P('ashmaw-rise-04', 'v2Charge', { transition: 'swipe', textDelay: 0.5, cam: { from: [1.12, 0.48, 0.42], to: [1.0, 0.5, 0.5], dur: 1.2 }, lines: [
        { speaker: 'caption', text: 'ASHMAW.' },
        { speaker: 'warden', text: 'Take the lift up, Hale. I’ve got her.' },
      ] }),
    ],
  },
  // Seier: Warden knuser ventilene, Ashmaw faller i brønnen, ladningen går. Cinderborn sovner i kulda. Daggry.
  ending: {
    id: 'ending', chapter: '—', title: 'Cold Dawn',
    trigger: 'Etter boss-bølgen 3-7 (Ashmaw nedkjempet), før rulleteksten.', when: 'After boss wave 3-7 (Ashmaw defeated), before the credits.',
    panels: [
      P('ending-01', 'foundryCore', { transition: 'fade', textDelay: 0.8, cam: { from: [1.2, 0.5, 0.5], to: [1.0, 0.5, 0.5], dur: 6 }, lines: [
        { speaker: 'caption', text: 'The last vent bursts. Ashmaw sinks back into the well she came from.' },
        { speaker: 'warden', text: 'Stay down.' },
      ] }),
      P('ending-02', 'foundryDescent', { transition: 'cut', textDelay: 1.0, cam: { from: [1.0, 0.5, 0.5], to: [1.12, 0.5, 0.4], dur: 8 }, lines: [
        { speaker: 'caption', text: 'The charge blows. The Deepwell folds in on itself, and on her.' },
        { speaker: 'caption', text: 'Without the heat, the Cinderborn slow. Then stop. Then sleep.' },
      ] }),
      P('ending-03', 'wardenVisor', { transition: 'cut', textDelay: 0.5, cam: { from: [1.0, 0.5, 0.5], to: [1.08, 0.5, 0.48], dur: 7 }, lines: [
        { speaker: 'command', who: 'HALE', text: 'Lift’s coming back down, Warden. You coming up?' },
        { speaker: 'warden', text: 'Yeah. I’m coming up.' },
      ] }),
      P('ending-04', 'dawnYard', { transition: 'fade', textDelay: 1.4, cam: { from: [1.0, 0.5, 0.5], to: [1.1, 0.5, 0.45], dur: 10 }, lines: [
        { speaker: 'caption', text: 'Kessa Yard. Dawn. Cold, for the first time in weeks.' },
        { speaker: 'warden', text: 'All of us. Going home.' },
      ] }),
    ],
  },
  // Død: kort og rask (bevisst ett panel – spilleren skal raskt tilbake i bølgen).
  fallen: {
    id: 'fallen', chapter: '×', title: 'Down', autoEndAfter: 2,
    // Kort og selvgående: død → kontroll < 4 s (mål fra Breach). 1,0 s fall + 2,0 s + 0,45 s uttoning ≈ 3,5 s.
    timing: { fadeIn: 0.35, fadeOut: 0.45, cps: 60, autoAdvance: 0.35 },
    trigger: 'Første gang spilleren dør i økta (senere: bare banneret WARDEN DOWN). Går videre selv etter 2 s.', when: 'First player death per session (later: WARDEN DOWN banner only). Auto-ends after 2 s idle.',
    panels: [
      P('fallen-01', 'fallen', { lines: [
        { speaker: 'caption', text: 'Signal lost.' },
        { speaker: 'command', who: 'HALE', text: 'Warden’s down! Get up — we hold this together.' },
      ] }),
    ],
  },
};

export const CUTSCENE_IDS = Object.keys(CUTSCENES);
