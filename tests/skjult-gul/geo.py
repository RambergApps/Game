import json,math
U=json.load(open('/workspace/breach/shots/test/qa/skjult-gul/utvalg.json'))
def segrect(x1,y1,x2,y2,c):
  dx,dy=x2-x1,y2-y1;t0,t1=0.0,1.0
  for p,q in ((-dx,x1-c['x']),(dx,c['x']+c['w']-x1),(-dy,y1-c['y']),(dy,c['y']+c['h']-y1)):
    if p==0:
      if q<0: return None
    else:
      r=q/p
      if p<0: t0=max(t0,r)
      else: t1=min(t1,r)
  return (t0,t1) if t0<=t1 else None
for i,o in enumerate(U):
  c=o['cover'];tx,ty=o['wx'],o['wy'];ox,oy=o['ox'],o['oy'];r=11
  gx=max(c['x']-tx,tx-c['x']-c['w'],0); gy=max(c['y']-ty,ty-c['y']-c['h'],0)
  if gy>=gx: # Warden nord/sør for coveret -> flate horisontal, ender i x
    face='S' if ty>c['y']+c['h']/2 else 'N'; n=(0,1) if face=='S' else (0,-1); a0,a1=c['x'],c['x']+c['w']; tw,ts=tx,ox; fy=c['y']+c['h'] if face=='S' else c['y']
    E=[(a0,fy),(a1,fy)]
  else:
    face='Ø' if tx>c['x']+c['w']/2 else 'V'; n=(1,0) if face=='Ø' else (-1,0); a0,a1=c['y'],c['y']+c['h']; tw,ts=ty,oy; fx=c['x']+c['w'] if face=='Ø' else c['x']
    E=[(fx,a0),(fx,a1)]
  # vinkel mellom retning Warden->skytter og -n (inn gjennom coveret)
  vx,vy=ox-tx,oy-ty; L=math.hypot(vx,vy); ang=math.degrees(math.acos(max(-1,min(1,(-n[0]*vx-n[1]*vy)/L))))
  inside=a0<=tw<=a1; endd=min(tw-a0,a1-tw) if inside else -min(abs(tw-a0),abs(tw-a1))
  over=max(0,r-(tw-a0)) + max(0,r-(a1-tw)) # hvor mye kroppen stikker forbi endene (px)
  samme = (vx*n[0]+vy*n[1])>0  # skytter på Wardens side
  forbi = not (a0<=ts<=a1)
  cr=segrect(ox,oy,tx,ty,c)
  o.update(face=face,ang=round(ang),endDist=round(endd,1),overheng=round(over,1),sammeSide=samme,skytterForbiEnden=forbi,
    kryss=None if not cr else [round(ox+(tx-ox)*cr[0]),round(oy+(ty-oy)*cr[0]),round(ox+(tx-ox)*cr[1]),round(oy+(ty-oy)*cr[1])],ender=E,skytterAvst=round(L))
  o['dom']='feil side' if samme else ('rettferdig (forbi enden)' if forbi else ('rettferdig (kropp stikker ut)' if over>0 and (cr is None) else 'FEIL (rett foran)'))
  print(i+1,o['kat'],o['seed'],o['t'],'face',face,'ang',o['ang'],'faceAng',o['faceAng'],'end',o['endDist'],'overheng',o['overheng'],'samme',samme,'forbi',forbi,'kryss',o['kryss'],'avst',o['skytterAvst'],'free',o['free'],'->',o['dom'])
json.dump(U,open('/workspace/breach/shots/test/qa/skjult-gul/utvalg.json','w'),indent=1)
