# Cutscene-stemmer (v1.7) – generering

Filer: `game/assets/voice/manifest.json` + `game/assets/voice/<scene>/<panel>-<linje>.ogg`
(Opus mono 40 kbps, 48 kHz, ca. −16 LUFS, topp ≤ −1 dBTP). Replikkene leses fra `src/story/cutscenes.js` og spilles av `src/audio/voice.js`.
Endres en replikk i cutscenes.js, kjører du gen.py på nytt. En fil som mangler gir ingen stemme og ingen feil.

## Regenerere
```bash
python3 -m venv /workspace/tts/v && /workspace/tts/v/bin/pip install kokoro-onnx soundfile numpy faster-whisper
# modellfiler (IKKE i repoet), ca. 350 MB:
wget -P /workspace/tts https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
     https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd game/src/audio/tools/voice
KOKORO_DIR=/workspace/tts /workspace/tts/v/bin/python gen.py            # alt (~1 min på CPU)
KOKORO_DIR=/workspace/tts /workspace/tts/v/bin/python gen.py --only intro
KOKORO_DIR=/workspace/tts /workspace/tts/v/bin/python gen.py --check-only   # ASR- og fonemsjekk (faster-whisper base.en)
```
Krever node (export-lines.mjs) og ffmpeg med libopus.

## Rollebesetning («Stemme A»)
caption/forteller = am_onyx (tørr, litt rom) · announcer = am_echo (AM-nødsending) · warden = am_fenrir (hjelmradio) ·
HALE = am_michael · BRANDT = blanding eric/fenrir · OKAFOR = blanding adam/onyx · COMMAND = am_liam (feltradio).
Rop (`SHOUT` i gen.py) får raskere tempo, høyere tonehøyde, +6 dB inn i metning og kompressor 10:1.
Uttale: `SPELL` i gen.py. Kessa → /kˈɛsə/, Ashmaw → /ˈæʃmɔː/, Deepwell, Cinderborn.

## Opptak av testklipp
`clip.cjs` spiller meny → intro → kamp i headless Chrome og tar opp miksen (`_tap()`) og skjermbilder. Se toppen av fila.

## Lisens
- Kokoro-82M (modell og stemmer): Apache-2.0, https://huggingface.co/hexgrad/Kokoro-82M
- kokoro-onnx: MIT, https://github.com/thewh1teagle/kokoro-onnx
- De genererte lydfilene er våre egne og kan brukes kommersielt. Kreditering i rulleteksten: «Voices: Kokoro-82M (Apache-2.0)».
- ffmpeg og faster-whisper brukes bare som verktøy og følger ikke med spillet.

## Regi (v1.8/v1.9)
`direction.json` har én nøkkel per linje (`<scene>/<panel>-<linje>`). Feltene er:
- `parts`: liste av [tekst, tempofaktor, pause etter]
- `mix`: [[stemme, vekt]]
- `pitch`, `drive` (dB), `trem`, `tail`, `breath`
- `lufs`: valgfri
- `tempo`: atempo etter Kokoros grense på 2,0
- `blip`: bare squelch
- `under`: {text, voice, speed, gain}, en svak stemme under replikken
- `text`: overstyrer teksten

voice.js matcher på panel og linje, ikke på tekst.
