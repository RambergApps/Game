# python3 analyse.py DIR → per fase: frames>50, verste frame, FPS, long tasks (antall, maks, sum), + lasteskjerm/sekvens-synlighet og våpen
import json, sys, subprocess
sys.argv += []
for D in sys.argv[1:]:
    R = json.load(open(D + '/raa.json')); M = dict(R['marks'])
    F = [('lasting/meny', 0, M['meny']), ('intro', M['introSynlig'], M['introSlutt']), ('overgang', M['introSlutt'], M['spill6s']), ('slutt', M['sluttStart'], M['sluttSlutt'])]
    print('==', D, 'errs', R['errs'], 'introSkip', R['introSkip'], 'endDone', R['endDone'])
    tot = []
    for n, a, b in F:
        fr = [d for t, d in R['fr'] if a <= t <= b]; lt = [x for x in R['lt'] if a <= x[0] <= b]; tot += lt
        print(f"  {n:14s} frames>50 {sum(d > 50 for d in fr):5d}  verste {max(fr or [0]):7.0f}  fps {len(fr) / ((b - a) / 1000):5.1f}  lt {len(lt):4d} maks {max([x[1] for x in lt] or [0]):6.0f} sum {sum(x[1] for x in lt):7.0f}")
    print(f"  TOTALT long tasks {len(R['lt'])} maks {max([x[1] for x in R['lt']] or [0]):.0f} sum {sum(x[1] for x in R['lt']):.0f}; topp5 {sorted(R['lt'], key=lambda x: -x[1])[:5]}")
    print('  synlighet (t ms, L=lasteskjerm 0/1 inn, C=sekvenscanvas opasitet):', R.get('vis', [])[:60])
    print('  marks', R['marks']); print('  VAP', json.dumps(R.get('VAP')))
