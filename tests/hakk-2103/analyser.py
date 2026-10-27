# Analyse av hakk.mjs-utdata: python3 analyser.py DIR...  → tabell + topp-funksjoner i lange frames + nettverk/dekoding per fase
import json, sys, os, collections, bisect
def phases(m):
    M = dict(m); return [('lasting/meny', 0, M['meny']), ('intro', M['introSynlig'], M['introSlutt']), ('overgang til spill', M['introSlutt'], M['spill6s']), ('slutt', M['sluttStart'], M['sluttSlutt'])]
def prof_self(prof, pn0, wins):
    nodes = {n['id']: n for n in prof['nodes']}; t = 0; out = collections.Counter(); tot = 0
    ws = sorted(wins); starts = [a for a, _ in ws]; ts = []
    for s, d in zip(prof['samples'], prof['timeDeltas']):
        t += d / 1000.0; ts.append((pn0 + t, s, d / 1000.0))
    for (tt, s, d) in ts:
        i = bisect.bisect_right(starts, tt) - 1
        if i >= 0 and tt <= ws[i][1]:
            cf = nodes[s]['callFrame']; u = cf['url'].split('/game/')[-1] if cf['url'] else ''
            out[f"{u}:{cf['functionName'] or '(anonym)'}:{cf['lineNumber']+1}" if u else cf['functionName']] += d; tot += d
    return out, tot
res = {}
for D in sys.argv[1:]:
    R = json.load(open(os.path.join(D, 'raa.json'))); prof = json.load(open(os.path.join(D, 'profil.cpuprofile')))
    rows = []
    for name, a, b in phases(R['marks']):
        fr = [(t, d) for t, d in R['fr'] if a <= t <= b]; ds = [d for _, d in fr]
        lt = [x for x in R['lt'] if a <= x[0] <= b]
        long = [(t - d, t) for t, d in fr if d > 50]
        rs = [r for r in R['res'] if a <= r[1] <= b]; mb = sum(r[3] or 0 for r in rs) / 1e6
        story = [r for r in R['res'] if '/img/story/' in r[0] or '/voice/' in r[0]]
        fin = max([r[2] for r in rs if '/img/story/' in r[0] or '/voice/' in r[0]] or [a]) - a
        dec = [x for x in R['dec'] if a <= x[1] <= b]
        decmid = collections.Counter(x[0] for x in dec)
        top, tot = prof_self(prof, R['pn0'], long)
        # forespørsler som starter inne i (eller ≤100 ms før) en lang frame
        corr = sum(1 for r in rs if any(s - 100 <= r[1] <= e for s, e in long))
        rows.append(dict(fase=name, sek=round((b - a) / 1000, 1), frames=len(ds), over50=len(long), verste=max(ds or [0]), fps=round(len(ds) / ((b - a) / 1000), 1) if b > a else 0,
            longtask=len(lt), longtask_ms=round(sum(x[1] for x in lt)), nett_mb=round(mb, 2), nett_n=len(rs), story_ferdig_s=round(fin / 1000, 2), dekoding=dict(decmid),
            req_i_lange=corr, topp=[(k, round(v, 1)) for k, v in top.most_common(8)], lang_ms=round(tot)))
    big = sorted(R['res'], key=lambda r: -(r[3] or 0))[:8]
    res[R['TAG']] = dict(cpu=R['CPU'], net=R['NET'], dpr=R['dpr'], introSkip=R['introSkip'], endDone=R['endDone'], errs=len(R['errs']), total_mb=round(sum(r[3] or 0 for r in R['res']) / 1e6, 2),
        storste=[(r[0].split('/game/')[-1], round((r[3] or 0) / 1024), round(r[1]), round(r[2])) for r in big], rader=rows,
        alle_lange=sorted([[t, d] for t, d in R['fr'] if d > 50], key=lambda x: -x[1])[:15], dec=R['dec'])
json.dump(res, open('/workspace/breach/shots/test/qa/hakk-2103/analyse.json', 'w'), indent=1)
for k, v in res.items():
    print('==', k, 'cpu', v['cpu'], 'net', v['net'], 'dpr', v['dpr'], 'MB', v['total_mb'], 'errs', v['errs'], 'skip', v['introSkip'], 'end', v['endDone'])
    for r in v['rader']: print('  ', {x: r[x] for x in r if x != 'topp'}); [print('      ', t) for t in r['topp'][:6]]
