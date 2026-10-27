#!/usr/bin/env python3
"""Genererer cutscene-stemmer (Stemme A) til game/assets/voice/<scene>/<panel>-<linje>.ogg + manifest.json.
Kokoro-82M (Apache-2.0) via kokoro-onnx (MIT). Modellfilene ligger IKKE i repoet: sett KOKORO_DIR
(standard /workspace/tts) med kokoro-v1.0.onnx og voices-v1.0.bin. Krever ffmpeg med libopus og node.
Bruk: python3 gen.py [--only intro] [--check]   (--check: ASR-kontroll med faster-whisper tiny)"""
import json, os, subprocess, sys, re, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '../../../..'))
OUT = os.path.join(GAME, 'assets/voice')
KD = os.environ.get('KOKORO_DIR', '/workspace/tts')
k = Kokoro(os.path.join(KD, 'kokoro-v1.0.onnx'), os.path.join(KD, 'voices-v1.0.bin'))
V = k.get_voice_style
def blend(a, b, w=0.5): return V(a) * (1 - w) + V(b) * w

# Rollebesetning (Stemme A: amerikanske, dype Kokoro-stemmer). (stemme, tempo, tonehøydefaktor)
CAST = {
  'caption':   (V('am_onyx'), 0.88, 0.93),                 # forteller: dyp, tørr, litt rom
  'announcer': (V('am_echo'), 0.95, 0.98),                 # AM-nødsending
  'warden':    (V('am_onyx') * .5 + V('am_fenrir') * .3 + V('am_michael') * .2, 0.88, 0.88),  # v1.10 «Grus» (Alexanders valg), hjelmradio
  'HALE':      (V('am_michael'), 0.95, 0.97),
  'BRANDT':    (blend('am_eric', 'am_fenrir', 0.35), 1.0, 0.92),   # grovere, rask
  'OKAFOR':    (blend('am_adam', 'am_onyx', 0.4), 0.9, 0.95),      # rolig, mørk
  'COMMAND':   (V('am_liam'), 0.97, 0.95),                 # HQ-radio, nøytral
}
# Uttale: stavemåte som Kokoro (espeak/misaki) leser riktig. Sjekkes med --check.
SPELL = [(r'\bKessa\b', 'Kessah'), (r'\bAshmaw\b', 'Ash-maw'), (r'\bASHMAW\b', 'Ash-maw.'), (r'\bDeepwell\b', 'Deep-well'),
         (r'\bCinderborn\b', 'Cinder-born'), (r'\bOkafor\b', 'Oh-kah-for'), ('’', "'"), (' — ', ', ')]
# Rop: høyere energi (raskere, litt lysere, pre-gain + metning)
SHOUT_OLD = {"Warden’s down! Get up — we hold this together.", 'Lift’s loaded. Warden, get on. Now.', 'Contacts. Every crack. Hundreds.',
         'Contact. They’re coming up through the cracks.'}
FX = {
 'caption':   "equalizer=f=120:t=q:w=1:g=3,aecho=0.8:0.4:45|90:0.10|0.06",
 'announcer': "highpass=f=450,lowpass=f=3000,asoftclip=type=tanh:param=1.2,aecho=0.8:0.6:180|340:0.3|0.18,acompressor=threshold=0.1:ratio=6",
 'command':   "highpass=f=300,lowpass=f=3400,equalizer=f=1800:t=q:w=1:g=5,asoftclip=type=atan:param=1.5,acompressor=threshold=0.08:ratio=8",
 'warden':    "highpass=f=180,lowpass=f=5000,equalizer=f=2500:t=q:w=1:g=3,asoftclip=type=tanh,acompressor=threshold=0.1:ratio=4",
}
NOISE = {'announcer': 0.012, 'command': 0.008, 'warden': 0.003, 'caption': 0}

def lines():
    return json.loads(subprocess.check_output(['node', os.path.join(HERE, 'export-lines.mjs')]))

def speak(text):
    for a, b in SPELL: text = re.sub(a, b, text)
    return text

DIRECTION = json.load(open(os.path.join(HERE, 'direction.json'), encoding='utf-8'))
SR = 24000

def breath(sr, dur=0.28, amp=0.05):
    """Kort innpust før rop: båndpasset støy med myk kurve."""
    import scipy.signal as ss
    n = int(dur * sr); x = np.random.default_rng(7).standard_normal(n).astype(np.float32)
    b, a = ss.butter(2, [500 / (sr / 2), 2200 / (sr / 2)], 'band'); x = ss.lfilter(b, a, x).astype(np.float32)
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    return x / (np.abs(x).max() + 1e-9) * amp * env

def render(L, path):
    """Regi fra direction.json: deler genereres hver for seg (eget tempo) og skjøtes med regisserte pauser."""
    key = L['speaker'] if L['speaker'] != 'command' else (L['who'] or 'COMMAND')
    voice, speed, pitch = CAST.get(key, CAST['COMMAND'])
    D = DIRECTION.get(f"{L['scene']}/{L['panel']}-{L['line']}", {})
    if D.get('mix'):  # stemmeblanding: rolle-stemmen beholder resten av vekten
        w = sum(m[1] for m in D['mix']); voice = voice * (1 - w) + sum(V(m[0]) * m[1] for m in D['mix'])
    parts = D.get('parts') or [[L['text'], 1.0, 0]]
    chunks = []
    if D.get('breath'): chunks += [breath(SR, 0.18), np.zeros(int(0.02 * SR), np.float32)]
    for txt, sp, pause in parts:
        a, sr = k.create(speak(txt), voice=voice, speed=min(2.0, speed * sp), lang='en-us'); assert sr == SR
        a = a.astype(np.float32); nz = np.flatnonzero(np.abs(a) > 0.02 * np.abs(a).max())  # Kokoro legger stillhet rundt hver del
        a = a[max(0, nz[0] - int(.03 * SR)): nz[-1] + int(.08 * SR)]
        chunks += [a, np.zeros(int(pause * SR), np.float32)]
    a = np.concatenate(chunks)
    if D.get('blip'):  # bare et kort radioblipp (squelch) i stedet for tale
        a = breath(SR, D['blip'], 0.25)
    if D.get('under'):  # en annen stemme som svakt radiofragment under replikken (overlapp)
        u = D['under']; ua, _ = k.create(speak(u['text']), voice=V(u['voice']), speed=u.get('speed', 1.3), lang='en-us')
        ua = ua.astype(np.float32); nz = np.flatnonzero(np.abs(ua) > 0.02 * np.abs(ua).max()); ua = ua[nz[0]:nz[-1]]
        ua = ua / np.abs(ua).max() * np.abs(a).max() * 10 ** (u.get('gain', -12) / 20)
        if len(ua) > len(a): a = np.concatenate([a, np.zeros(len(ua) - len(a), np.float32)])
        a[:len(ua)] += ua
    tmp = tempfile.mktemp(suffix='.wav'); sf.write(tmp, a, SR)
    sp = L['speaker'] if L['speaker'] in FX else 'command'
    pitch *= D.get('pitch', 1.0)
    chain = f"asetrate={SR*pitch:.0f},aresample=48000,atempo={1/pitch:.4f}"
    if D.get('tempo'): chain += f",atempo={D['tempo']}"  # ekstra tempo utover Kokoros grense (2,0)
    if D.get('trem'): chain += f",vibrato=f=5.5:d={D['trem']*0.35:.3f},tremolo=f=7:d={D['trem']:.3f}"   # frykt: ustabil stemme
    if L['speaker'] == 'warden': D = dict(D, drive=max(D.get('drive', 0), 6))  # Grus: alltid litt metning
    if D.get('drive'): chain += f",volume={D['drive']}dB,asoftclip=type=tanh:param={1 + D['drive']/10:.2f},acompressor=threshold=0.06:ratio=10:attack=2:release=60"
    chain += ',' + FX[sp]
    if D.get('tail'): t = D['tail']; chain += f",aecho=0.9:0.7:180|360|620:{0.12*t:.3f}|{0.07*t:.3f}|{0.035*t:.3f}"   # hale for alvor/sorg
    chain += f",apad=pad_dur={0.06 + 0.15 * D.get('tail', 0):.2f},afade=t=in:d=0.01"
    # nivå følger leveringen: rop litt over, hvisking/frykt litt under −16 LUFS (overstyres med 'lufs')
    I = D.get('lufs', -14.5 if D.get('drive', 0) >= 7 else -17.5 if D.get('trem') and not D.get('drive') else -16)
    n = NOISE[sp]
    flt = (f"[0:a]{chain}[v];anoisesrc=c=pink:a={n}:r=48000[n];[v][n]amix=inputs=2:duration=first:normalize=0[o]" if n else f"[0:a]{chain}[o]")
    mid = tempfile.mktemp(suffix='.wav')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-filter_complex', flt, '-map', '[o]', '-ac', '1', '-ar', '48000', mid], check=True)
    # to-pass loudnorm (lineær) → −16 LUFS, true peak ≤ −1,5 dBTP
    meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', mid, '-af', f'loudnorm=I={I}:TP=-2.2:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
    ln = f"loudnorm=I={I}:TP=-2.2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,aresample=48000"
    if 'inf' in str(j['input_i']): ln = 'volume=-6dB,aresample=48000'  # for kort til loudnorm (blipp)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mid, '-af', ln, '-ac', '1', '-c:a', 'libopus', '-b:a', '40k', '-application', 'voip' if sp != 'caption' else 'audio', path], check=True)
    os.unlink(mid)
    os.unlink(tmp)
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

def main():
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {'version': 1, 'scenes': {}}
    if '--check-only' in sys.argv: return check(man)
    if '--manifest-only' in sys.argv:  # bare oppdater delay/tekst fra cutscenes.js uten å rendre lyd
        for L in lines():
            t = DIRECTION.get(f"{L['scene']}/{L['panel']}-{L['line']}", {}).get('text'); L['text'] = t or L['text']
            e = man['scenes'].get(L['scene'], {}).get(f"{L['panel']}-{L['line']}")
            if e: e['delay'] = L['delay']; e['text'] = L['text']
        return json.dump(man, open(man_path, 'w'), indent=1, ensure_ascii=False)
    LS = lines()
    for L in LS:  # tekstoverstyring fra direction.json (f.eks. ending/3-1 før Story oppdaterer cutscenes.js); voice.js matcher på panel+linje, ikke tekst
        t = DIRECTION.get(f"{L['scene']}/{L['panel']}-{L['line']}", {}).get('text')
        if t: L['text'] = t
    for L in LS:
        if only and L['scene'] != only: continue
        if '--speaker' in sys.argv and L['speaker'] != sys.argv[sys.argv.index('--speaker') + 1]: continue
        d = os.path.join(OUT, L['scene']); os.makedirs(d, exist_ok=True)
        rel = f"{L['panel']}-{L['line']}.ogg"
        dur = render(L, os.path.join(d, rel))
        man['scenes'].setdefault(L['scene'], {})[f"{L['panel']}-{L['line']}"] = {'file': f"{L['scene']}/{rel}", 'dur': round(dur, 2), 'delay': L.get('delay', 0), 'speaker': L['speaker'], 'who': L['who'], 'text': L['text']}
        print(f"{L['scene']}/{rel} {dur:.2f}s {L['text']}")
    json.dump(man, open(man_path, 'w'), indent=1, ensure_ascii=False)
    if '--check' in sys.argv: check(man)

def check(man):
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get('ASR_MODEL', 'base.en'), device='cpu', compute_type='int8')
    for sc in man['scenes'].values():
        for e in sc.values():
            pcm = subprocess.check_output(['ffmpeg', '-loglevel', 'error', '-i', os.path.join(OUT, e['file']), '-f', 's16le', '-ac', '1', '-ar', '16000', '-'])
            a = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
            a = np.concatenate([np.zeros(8000, np.float32), a, np.zeros(16000, np.float32)])  # stillhet rundt: færre hallusinasjoner på korte klipp
            segs, _ = m.transcribe(a, beam_size=5, language='en')
            print('ASR', e['file'], '|', e['text'], '→', ' '.join(s.text.strip() for s in segs), '| fonemer:', k.tokenizer.phonemize(speak(e['text']), 'en-us'))

if __name__ == '__main__': main()
