#!/usr/bin/env python3
"""Analyse av offline-renders: skriver 16-bit WAV, måler peak/RMS/crest/lavfrekvent andel, lager PNG (bølgeform+spektrum+spektrogram)."""
import sys, os, json, glob, wave
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

d = sys.argv[1] if len(sys.argv) > 1 else '/workspace/breach/reviews/lyd-2026-10-23'
only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
rows = []
for f in sorted(glob.glob(os.path.join(d, '*.f32'))):
    name = os.path.basename(f)[:-4]
    if only and name not in only: continue
    meta = json.load(open(f[:-4] + '.json')); sr = meta['sr']
    x = np.fromfile(f, dtype=np.float32).reshape(-1, 2)
    peak = float(np.max(np.abs(x))); peak_db = 20 * np.log10(peak + 1e-12)
    mono = x.mean(axis=1)
    rms = float(np.sqrt(np.mean(mono ** 2))); rms_db = 20 * np.log10(rms + 1e-12)
    # kort-tids RMS (50 ms) maks
    w = int(sr * 0.05); st = np.sqrt(np.convolve(mono ** 2, np.ones(w) / w, 'valid')); st_db = 20 * np.log10(st.max() + 1e-12)
    # uten vindu: hendelsen starter ved 50 ms, og et Hann-vindu ville dempet transient/kropp
    spec = np.abs(np.fft.rfft(mono)) ** 2; fr = np.fft.rfftfreq(len(mono), 1 / sr)
    tot = spec.sum() + 1e-20
    lo = spec[fr < 150].sum() / tot; mid = spec[(fr >= 150) & (fr < 2000)].sum() / tot; hi = spec[fr >= 2000].sum() / tot
    centroid = float((spec * fr).sum() / tot)
    clipped = int(np.sum(np.abs(x) >= 0.999))
    rows.append((name, peak_db, st_db, rms_db, lo, mid, hi, centroid, clipped))
    # WAV
    pcm = np.clip(x, -1, 1); pcm = (pcm * 32767).astype('<i2')
    with wave.open(os.path.join(d, name + '.wav'), 'wb') as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes(pcm.tobytes())
    # PNG
    fig = plt.figure(figsize=(11, 7.5), facecolor='#121416')
    gs = fig.add_gridspec(3, 1, height_ratios=[1, 1, 1.3], hspace=0.45)
    t = np.arange(len(mono)) / sr
    ax = fig.add_subplot(gs[0]); ax.plot(t, x[:, 0], lw=0.5, color='#39c6ff', alpha=0.8); ax.plot(t, x[:, 1], lw=0.5, color='#ff7a1a', alpha=0.5)
    ax.axhline(1, color='r', lw=0.6, ls='--'); ax.axhline(-1, color='r', lw=0.6, ls='--'); ax.set_ylim(-1.1, 1.1)
    ax.set_title(f'{name} – bølgeform (L blå, R oransje)  peak {peak_db:.2f} dBFS, maks 50ms-RMS {st_db:.1f} dBFS', color='w', fontsize=10)
    ax2 = fig.add_subplot(gs[1])
    # glattet spektrum (1/6 oktav)
    sdb = 10 * np.log10(spec / spec.max() + 1e-14)
    cf = np.geomspace(20, sr / 2, 200); sm = []
    for c in cf:
        m = (fr >= c / 2 ** (1 / 12)) & (fr < c * 2 ** (1 / 12)); sm.append(10 * np.log10(spec[m].mean() / spec.max() + 1e-14) if m.any() else np.nan)
    ax2.semilogx(cf, sm, color='#ffb347'); ax2.set_xlim(20, 20000); ax2.set_ylim(-90, 5)
    ax2.axvspan(20, 150, color='#39c6ff', alpha=0.1)
    ax2.set_title(f'spektrum (1/6 okt)  energi <150 Hz {lo*100:.0f}%  150–2k {mid*100:.0f}%  >2k {hi*100:.0f}%  sentroide {centroid:.0f} Hz', color='w', fontsize=10)
    ax3 = fig.add_subplot(gs[2])
    ax3.specgram(mono, NFFT=2048, Fs=sr, noverlap=1792, cmap='magma', vmin=-140, vmax=-20, scale='dB')
    ax3.set_yscale('symlog', linthresh=200); ax3.set_ylim(20, 16000); ax3.set_title('spektrogram', color='w', fontsize=10)
    for a in (ax, ax2, ax3):
        a.set_facecolor('#1b1e21'); a.tick_params(colors='#aaa', labelsize=8)
        for s in a.spines.values(): s.set_color('#444')
    fig.savefig(os.path.join(d, name + '.png'), dpi=90, facecolor=fig.get_facecolor()); plt.close(fig)

print(f"{'lyd':26s} {'peak dBFS':>9s} {'50msRMS':>8s} {'RMS':>7s} {'<150Hz':>7s} {'150-2k':>7s} {'>2k':>6s} {'sentr.':>7s} {'klipp':>5s}")
for r in rows:
    print(f"{r[0]:26s} {r[1]:9.2f} {r[2]:8.1f} {r[3]:7.1f} {r[4]*100:6.0f}% {r[5]*100:6.0f}% {r[6]*100:5.0f}% {r[7]:7.0f} {r[8]:5d}")
