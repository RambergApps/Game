// Breach – lyd: motor. Busser, romklang, stemmebegrensning og romlig plassering.
// Kjede: [sfx-buss, musikk-buss, romklang-retur] → master → DynamicsCompressor → destination
// Romklang: send-buss → ConvolverNode (generert betong/industrihall-IR) → retur → master
import { SOUNDS } from './sfx.js';
import { makeImpulse, clamp, safetyClipper } from './synth.js';

export class AudioEngine {
  /** @param {BaseAudioContext} ac – AudioContext eller OfflineAudioContext */
  constructor(ac) {
    this.ac = ac;
    this.listener = null;          // { x, y } – settes fra world.player
    this.hearRange = 900;          // px: utover dette er lyder nesten borte
    this.voices = {};              // name → [{ end, gain }]
    this.lastPlay = {};            // name → tid
    this.muted = false;
    this._master = 0.8; this._music = 0.42; this._sfx = 1;

    this.master = ac.createGain(); this.master.gain.value = this._master;
    this.comp = ac.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 8; this.comp.ratio.value = 8;
    this.comp.attack.value = 0.002; this.comp.release.value = 0.22;
    // sikkerhetsklipper etter kompressoren: transparent under ca. -3 dBFS, garanterer topp < 0 dBFS
    this.clip = safetyClipper(ac);
    this.master.connect(this.comp); this.comp.connect(this.clip.input); this.clip.output.connect(ac.destination);

    this.sfx = ac.createGain(); this.sfx.gain.value = this._sfx; this.sfx.connect(this.master);
    // radio-buss (mellomsekvens-kringkasting): følger sfx-volumet, men dukkes ikke av pause
    this.radio = ac.createGain(); this.radio.gain.value = this._sfx; this.radio.connect(this.master);
    // ui-buss (nivå-stingere, oppgradering): som radio – følger sfx-volum, dukkes ikke
    this.ui = ac.createGain(); this.ui.gain.value = this._sfx; this.ui.connect(this.master);
    this.music = ac.createGain(); this.music.gain.value = this._music;
    this.musicDuck = ac.createGain(); this.musicDuck.gain.value = 1;
    // musikk: senk sub-bunnen litt så våpen-/eksplosjonskropp får plass
    this.musicShelf = ac.createBiquadFilter(); this.musicShelf.type = 'lowshelf'; this.musicShelf.frequency.value = 110; this.musicShelf.gain.value = -5;
    // pause: myk demping + lavpass på musikken (stoppes ikke)
    this.pauseLP = ac.createBiquadFilter(); this.pauseLP.type = 'lowpass'; this.pauseLP.frequency.value = 20000; this.pauseLP.Q.value = 0.5;
    this.pauseGain = ac.createGain(); this.pauseGain.gain.value = 1;
    this.music.connect(this.musicShelf); this.musicShelf.connect(this.musicDuck); this.musicDuck.connect(this.pauseLP);
    this.pauseLP.connect(this.pauseGain); this.pauseGain.connect(this.master);
    this.paused = false;
    /** (x, y, lx, ly) → true hvis høy dekning står mellom kilde og lytter. Settes av index.js. */
    this.occlusionTest = null;

    this.reverbSend = ac.createGain(); this.reverbSend.gain.value = 1;
    const pre = ac.createBiquadFilter(); pre.type = 'highpass'; pre.frequency.value = 180; // ikke gjørmete bunn i romklangen
    this.convolver = ac.createConvolver(); this.convolver.normalize = false;
    this.convolver.buffer = makeImpulse(ac);
    this.reverbReturn = ac.createGain(); this.reverbReturn.gain.value = 0.42;
    this.reverbSend.connect(pre); pre.connect(this.convolver); this.convolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);
  }

  setMaster(v) { this._master = clamp(v, 0, 1); this._applyMaster(); }
  setMusic(v) { this._music = clamp(v, 0, 1); this.music.gain.setTargetAtTime(this._music, this.ac.currentTime, 0.05); }
  setSfx(v) { this._sfx = clamp(v, 0, 1); this.radio?.gain.setTargetAtTime(this._sfx, this.ac.currentTime, 0.05); this.ui?.gain.setTargetAtTime(this._sfx, this.ac.currentTime, 0.05); this.sfx.gain.setTargetAtTime(this.paused ? this._sfx * 0.6 : this._sfx, this.ac.currentTime, 0.05); }
  mute(on = !this.muted) { this.muted = !!on; this._applyMaster(); return this.muted; }
  _applyMaster() { this.master.gain.setTargetAtTime(this.muted ? 0 : this._master, this.ac.currentTime, 0.03); }

  /** Pause: musikk ned ~-18 dB og mørkere, effekter og romklangshaler litt ned. Myke overganger. */
  setPaused(on) {
    on = !!on; if (on === this.paused) return; this.paused = on;
    const t = this.ac.currentTime;
    this.pauseGain.gain.setTargetAtTime(on ? 0.12 : 1, t, on ? 0.35 : 0.5);
    this.pauseLP.frequency.setTargetAtTime(on ? 700 : 20000, t, on ? 0.3 : 0.6);
    this.sfx.gain.setTargetAtTime(on ? this._sfx * 0.6 : this._sfx, t, 0.15);
    this.reverbReturn.gain.setTargetAtTime(on ? 0.2 : 0.42, t, 0.25);
  }

  /** Kort demping av musikken (f.eks. ved eksplosjon). */
  duck(amount = 0.5, dur = 0.6) {
    const g = this.musicDuck.gain, t = this.ac.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1 - amount, t + 0.03); g.setTargetAtTime(1, t + 0.05, dur / 3);
  }

  /** Romlige parametre ut fra avstand/retning til lytteren. */
  spatial(x, y, occluded) {
    const L = this.listener;
    if (!L || !Number.isFinite(x) || !Number.isFinite(y)) {
      return occluded ? { pan: 0, gain: 0.5, lp: 1200, wet: 0.2, occ: true } : { pan: 0, gain: 1, lp: 20000, wet: 0 };
    }
    const dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy);
    const pan = clamp(dx / 520, -1, 1) * 0.85;
    const r = d / this.hearRange;
    let gain = 1 / (1 + 3.2 * r * r);                    // jevn demping, ~0.24 ved hearRange
    let lp = clamp(20000 * Math.exp(-d / 650), 900, 20000); // luftdemping: fjerne lyder mørkere
    let wet = clamp(r * 0.5, 0, 0.5);                      // fjerne lyder: mer rom
    // okklusjon: én LOS-sjekk per lyd ved start. Kilden flyttes 8 px mot lytteren først,
    // så treff på selve dekningsflaten (f.eks. kula i din egen vegg) ikke regnes som skjult.
    let occ = occluded;
    if (occ === undefined && this.occlusionTest && d > 48) {
      const k = 8 / d;
      try { occ = this.occlusionTest(x - dx * k, y - dy * k, L.x, L.y); } catch (_) { occ = false; }
    }
    if (occ) { gain *= 0.5; lp = Math.min(lp, 1200); wet += 0.2; } // ca. -6 dB, mørk, mer «rundt hjørnet»
    return { pan, gain, lp, wet, d, occ: !!occ };
  }

  /**
   * Spill en lyd. opts: { x, y, when (s, absolutt ac-tid), gain, pan, surface, type, ... }
   * Returnerer stemme-objekt eller null hvis droppet (voice-limit / for tett).
   */
  play(name, opts = {}) {
    const def = SOUNDS[name]; if (!def) return null;
    const ac = this.ac;
    // immediate (v1.4.1, nærkamp): ingen +5 ms sikkerhetsmargin – Effekter synker glimtet mot anslaget
    const t = Math.max(ac.currentTime, opts.when ?? ac.currentTime) + (opts.immediate ? 0 : 0.005);
    // for tett avspilling av samme type → dropp
    const last = this.lastPlay[name] ?? -1;
    if (t - last < def.minGap && !opts.force) return null;
    this.lastPlay[name] = t;

    const sp = def.spatial === false ? { pan: 0, gain: 1, lp: 20000, wet: 0 } : this.spatial(opts.x, opts.y, opts.occluded);
    if (sp.gain < 0.02) return null; // utenfor hørevidde

    // voice-limiting: stjel eldste stemme med kort fade
    const list = (this.voices[name] = (this.voices[name] || []).filter((v) => v.end > ac.currentTime));
    if (list.length >= def.max) {
      const old = list.shift();
      try { old.gain.gain.cancelScheduledValues(t); old.gain.gain.setValueAtTime(old.gain.gain.value, t); old.gain.gain.linearRampToValueAtTime(0, t + 0.02); } catch (_) {}
    }
    // gain-kompensasjon når mange stemmer av samme type spiller (automatisk ild)
    const crowd = 1 / Math.sqrt(1 + list.length * 0.35);

    const vg = ac.createGain();
    vg.gain.value = def.gain * (opts.gain ?? 1) * sp.gain * crowd * Math.pow(10, (Math.random() * 2 - 1) * 1.5 / 20);
    const input = ac.createGain();
    const send = ac.createGain();
    let tail = vg;
    if (sp.lp < 19000) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = sp.lp; lp.Q.value = 0.5; vg.connect(lp); tail = lp; }
    const panV = opts.pan ?? sp.pan;
    if (ac.createStereoPanner && panV !== 0) { const p = ac.createStereoPanner(); p.pan.value = clamp(panV, -1, 1); tail.connect(p); tail = p; }
    input.connect(vg);
    tail.connect(def.bus === 'radio' ? this.radio : def.bus === 'ui' ? this.ui : this.sfx);
    // romklang: fast andel av stemmen + ekstra send-lag fra oppskriften
    const wetG = ac.createGain(); wetG.gain.value = def.send + sp.wet;
    tail.connect(wetG); wetG.connect(this.reverbSend);
    // send-lag fra oppskriften går kun til hallen (våt), dempet med avstand
    const sendExtra = ac.createGain(); sendExtra.gain.value = (0.8 + sp.wet) * sp.gain * def.gain * (opts.gain ?? 1);
    send.connect(sendExtra); sendExtra.connect(this.reverbSend);

    const dur = def.fn(ac, input, send, t, opts) || 1;
    const voice = { name, end: t + dur + 0.1, gain: vg, occluded: !!sp.occ };
    list.push(voice);
    if (typeof window !== 'undefined' && ac instanceof (window.AudioContext || Object)) {
      setTimeout(() => { try { vg.disconnect(); wetG.disconnect(); sendExtra.disconnect(); } catch (_) {} }, (dur + 0.6) * 1000 + (t - ac.currentTime) * 1000);
    }
    if (name === 'explosion') this.duck(0.55 * sp.gain, 1.2);
    return voice;
  }

  activeVoices() {
    const now = this.ac.currentTime; let n = 0;
    for (const k in this.voices) n += this.voices[k].filter((v) => v.end > now).length;
    return n;
  }
}
