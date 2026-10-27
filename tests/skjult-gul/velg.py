import json,math,sys
sys.path.insert(0,'/tmp/fa27/hid'); 
H=json.load(open('/tmp/fa27/hid/hidden.json'))
covs={s:[c for c in json.load(open(f'/tmp/fa27/hid/{s}/hid.json'))['cover'] if c['type']=='low'] for s in ('s11','s22','s33')}
allc={s:json.load(open(f'/tmp/fa27/hid/{s}/hid.json'))['cover'] for s in ('s11','s22','s33')}
def segrect(x1,y1,x2,y2,c):
  # Liang-Barsky: returnerer (t0,t1) eller None
  dx,dy=x2-x1,y2-y1;t0,t1=0.0,1.0
  for p,q in ((-dx,x1-c['x']),(dx,c['x']+c['w']-x1),(-dy,y1-c['y']),(dy,c['y']+c['h']-y1)):
    if p==0:
      if q<0: return None
    else:
      r=q/p
      if p<0: t0=max(t0,r)
      else: t1=min(t1,r)
  return (t0,t1) if t0<=t1 else None
def cat(a): return 'forfra' if a<45 else 'skrått' if a<80 else 'side' if a<110 else 'bakfra'
out=[]
for k in ('forfra','skrått','side','bakfra'):
  ys=sorted([e for e in H if e['cause']=='2a' and cat(e['faceAng'])==k],key=lambda e:(-e['amt'], e['faceAng'] if k in ('forfra','skrått') else -e['faceAng']))
  xs=[];seen=set()
  for e in ys:
    key=(e['seed'],round(e['wx']/24),round(e['wy']/24),round(e['ox']/40),round(e['oy']/40))
    if key in seen: continue
    seen.add(key); xs.append(e)
    if len(xs)==3: break
  for e in xs:
    tx,ty=e['wx'],e['wy']
    nd=lambda c: math.hypot(tx-max(c['x'],min(tx,c['x']+c['w'])),ty-max(c['y'],min(ty,c['y']+c['h'])))
    c=min(covs[e['seed']],key=nd)
    horiz=c['w']>=c['h']  # langs x
    if horiz: ends=[(c['x'],c['y']+c['h']/2),(c['x']+c['w'],c['y']+c['h']/2)]; endd=min(abs(tx-c['x']),abs(tx-c['x']-c['w'])); within= c['x']<=tx<=c['x']+c['w']
    else: ends=[(c['x']+c['w']/2,c['y']),(c['x']+c['w']/2,c['y']+c['h'])]; endd=min(abs(ty-c['y']),abs(ty-c['y']-c['h'])); within= c['y']<=ty<=c['y']+c['h']
    # side: hvilken side står Warden og skytter
    if horiz: ws='N' if ty<c['y']+c['h']/2 else 'S'; ss='N' if e['oy']<c['y']+c['h']/2 else 'S'; past = e['ox']<c['x'] or e['ox']>c['x']+c['w']
    else: ws='V' if tx<c['x']+c['w']/2 else 'Ø'; ss='V' if e['ox']<c['x']+c['w']/2 else 'Ø'; past = e['oy']<c['y'] or e['oy']>c['y']+c['h']
    cr=segrect(e['ox'],e['oy'],tx,ty,c)
    crs=[ (o['type'],o.get('kind')) for o in allc[e['seed']] if segrect(e['ox'],e['oy'],tx,ty,o)]
    out.append(dict(kat=k,seed=e['seed'],t=e['t'],src=e['src'],amt=e['amt'],faceAng=e['faceAng'],wx=tx,wy=ty,ox=e['ox'],oy=e['oy'],sx=e['sx'],sy=e['sy'],d=e['d'],
      cover=c,coverDist=round(nd(c),1),endDist=round(endd,1),innenforBredde=within,wSide=ws,sSide=ss,samme=ws==ss,forbiEnden=past,
      kryss=None if not cr else [round(e['ox']+(tx-e['ox'])*cr[0]),round(e['oy']+(ty-e['oy'])*cr[0])],linjeKrysser=crs,ownDist=e.get('ownDist'),free=e.get('free')))
json.dump(out,open('/workspace/breach/shots/test/qa/skjult-gul/utvalg.json','w'),indent=1)
for o in out: print(o['kat'],o['seed'],o['t'],o['src'],o['amt'],o['faceAng'],'W',round(o['wx']),round(o['wy']),'S',round(o['ox']),round(o['oy']),'cov',o['cover'].get('kind'),o['cover']['x'],o['cover']['y'],o['cover']['w'],o['cover']['h'],'cd',o['coverDist'],'end',o['endDist'],'inn',o['innenforBredde'],o['wSide'],o['sSide'],'forbi',o['forbiEnden'],'kryss',o['kryss'],o['linjeKrysser'],'free',o['free'])
