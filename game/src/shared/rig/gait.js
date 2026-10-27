// Fotplanting og beinpositurer (hofte-rom). Port av demoens legPoses med kne-, slide-, rulle- og landingspositurer.
import { lerp, easeIO, PI } from './math.js';

/** S = riggtilstand. Returnerer to føtter {s, jx, jy, kx, ky, fx, fy, lift, fa} i hofte-rom (x fram). */
export function legPoses(S, def, roll) {
  const hc = Math.cos(-S.hip), hs = Math.sin(-S.hip);
  const mlx = hc * S.mvx - hs * S.mvy, mly = hs * S.mvx + hc * S.mvy;
  const L = S.stride, amp = S.amp, sp = def.gait.footSpread;
  const out = [];
  for (const s of [-1, 1]) {
    const p = (S.phase + (s > 0 ? 0 : .5)) % 1; let off, lift;
    if (p < .5) { off = L / 2 - (p / .5) * L; lift = 0; } else { const t = (p - .5) / .5; off = -L / 2 + easeIO(t) * L; lift = Math.sin(t * PI); }
    off *= amp; lift *= Math.max(amp, S.shuffle * .6);
    const st = { jx: 0, jy: s * 5.5, fx: 1 + mlx * off, fy: s * (sp + .2 + S.sprint * .5) + mly * off, lift, fa: s * .12 };
    // kne i low cover (KARAKTER-SPEC §5.2): framfot 9 px fram/venstre, bakre kne i bakken, legg+støvel 18 px ut bak sekken
    const kn = s < 0 ? { fx: 9 + mlx * off * .6, fy: -8 + mly * off * .6, kx: 6, ky: -9, lift: lift * .6, fa: -.1 } : { fx: -19 + mlx * off * .6, fy: 8.5 + mly * off * .6, kx: -3, ky: 9.5, lift: 0, fa: .1 };
    // baseball-slide: framfoten strukket 14 px lenger mot dekningen, bakbeinet bøyd under
    const sl = s < 0 ? { fx: 23, fy: -3, kx: 12, ky: -5, lift: 0, fa: -.05 } : { fx: -6, fy: 10, kx: 4, ky: 11, lift: 0, fa: .55 };
    // rulle (tuck) og landing (føtter plantet foran fwd +10, ±6)
    const ro = s < 0 ? { fx: -4, fy: -4, kx: 3, ky: -6, lift: .3, fa: 0 } : { fx: -4, fy: 4, kx: 3, ky: 6, lift: .3, fa: 0 };
    const la = { fx: 10, fy: s * 6, kx: 7, ky: s * 9, lift: 0, fa: s * .15 };
    const f = { fx: st.fx, fy: st.fy, kx: lerp(st.jx, st.fx, .55) + 1.5, ky: lerp(st.jy, st.fy, .55) + s * 1.2, lift: st.lift, fa: st.fa };
    const mix = (g, w) => { if (w <= .001) return; for (const k in f) f[k] = lerp(f[k], g[k], w); };
    mix(kn, S.kneel); mix(sl, S.slideB); mix(ro, S.rollB * (roll ? 1 - roll.feetPlanted : 1)); if (roll) mix(la, roll.feetPlanted);
    f.jx = 0; f.jy = s * 5.5; f.s = s; out.push(f);
  }
  return out;
}

/** Fotsteg: en fot plantes når fasen dens krysser fra sving (≥ .5) til stand (< .5). */
export function footsteps(prevPhase, phase, amp) {
  if (amp < .3) return [];
  const ev = [];
  for (const [foot, o] of [['R', 0], ['L', .5]]) { const a = (prevPhase + o) % 1, b = (phase + o) % 1; if (a > .5 && b < a) ev.push(foot); }
  return ev;
}
