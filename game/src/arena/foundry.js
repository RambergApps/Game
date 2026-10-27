// Board 03 – «The Deepwell» (id «underground-foundry»). MIDLERTIDIG PLASSHOLDER (runde 2): gjenbruker Kessa Yard-layouten
// slik at nivå 3 laster uten krasj. Riktige navngitte spawns for kapittel 3 (W spiller; NE, E, N, S fiender)
// og zones.core for hold-finalen (3-6). Erstattes av egen layout (ovner, smeltedigler, bro, gantry).
import { YARD } from './yard.js';

export const FOUNDRY = {
  ...YARD,
  id: 'underground-foundry',
  name: 'The Deepwell',
  board: 'BOARD 03',
  placeholder: true,
  seed: 0xB03F,
  playerSpawn: { x: 2.5, y: 20.5 },
  theme: { floor: '#4a4644', ambient: 'rgb(70,60,80)', warm: [255, 120, 40], puddle: '#ff9a50', lightScale: 0.9 },
  spawnPoints: {
    west: { x: 2.5, y: 20.5, dir: 'W' },       // spillerstart (Warden)
    northeast: { x: 36.5, y: 6.5, dir: 'NE' }, // fiendespawn
    east: { x: 36, y: 18, dir: 'E' },        // «broen»
    north: { x: 23, y: 3.5, dir: 'N' },        // «gantry»
    south: { x: 12, y: 27.4, dir: 'S' },       // vestflanken bakfra
  },
  // ruter; r i ruter. Plassert i den åpne gårdsplassen (kill-zone «Courtyard»).
  zones: { core: { x: 22.5, y: 19, r: 2.4 } },
};
