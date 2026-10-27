const fs=require('fs'),dir=process.argv[2];const D={E:0,SE:45,S:90,SW:135,W:180,NW:-135,N:-90,NE:-45};
const ad=(a,b)=>{let d=(a-b)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;return Math.abs(d)*180/Math.PI};
for(const f of fs.readdirSync(dir).filter(f=>f.startsWith('logg-'))){const L=JSON.parse(fs.readFileSync(dir+'/'+f));const by={};for(const r of L){(by[r.tag]=by[r.tag]||[]).push(r)}
 for(const [tag,R] of Object.entries(by)){const d=tag.split('-').pop();const want=D[d]!=null?D[d]*Math.PI/180:null;for(let i=0;i<R.length;i++){const q=R[i-1];R[i].dx=q?R[i].px-q.px:0;R[i].dy=q?R[i].py-q.py:0;R[i].dt=q?R[i].t-q.t:16;}
  const real=R.filter(r=>r.dt>0&&Math.hypot(r.dx,r.dy)/r.dt*1000>25);const blk=R.filter(r=>Math.hypot(r.vx,r.vy)>25&&Math.hypot(r.dx,r.dy)<0.05).length;
  const realWalk=real.filter(r=>r.walk);const legReal=realWalk.filter(r=>ad(r.leg,Math.atan2(r.dy,r.dx))<25).length;const glidR=real.filter(r=>!r.walk&&!r.whole&&r.mode!=='cover').length;
  const pd=R.length?Math.round(Math.atan2(R.at(-1).py-R[0].py,R.at(-1).px-R[0].px)*57.3):0;const dist=R.length?Math.round(Math.hypot(R.at(-1).px-R[0].px,R.at(-1).py-R[0].py)):0;
  const fr=R.filter(r=>r.fire);const aimSpread=fr.length?Math.round((Math.max(...fr.map(r=>r.pa))-Math.min(...fr.map(r=>r.pa)))*573)/10:null;const mSpread=fr.length?Math.round(Math.max(...fr.map(r=>Math.hypot(r.mwx-fr[0].mwx,r.mwy-fr[0].mwy)))):null;
  console.log('R2',tag.padEnd(12),'faktisk-beveg',real.length,'blokkert',blk,'gange',realWalk.length,'bein→faktisk',legReal+'/'+realWalk.length,'glid',glidR,'faser',new Set(realWalk.map(r=>r.phase)).size,'retn°',pd,'dist',dist,'skyt',fr.length,'P.aim-spenn°',aimSpread,'mus-flytt',mSpread);
  const mv=R.filter(r=>Math.hypot(r.vx,r.vy)>25);
  const walk=mv.filter(r=>r.walk);const legOK=want==null?null:walk.filter(r=>ad(r.leg,want)<25).length;const vOK=want==null?null:mv.filter(r=>ad(Math.atan2(r.vy,r.vx),want)<25).length;
  const ph=new Set(walk.map(r=>r.phase)).size;const aimMed=R.length?R.map(r=>r.aim).sort((a,b)=>a-b)[R.length>>1]:null;const modes={};for(const r of R)modes[r.mode]=(modes[r.mode]||0)+1;
  const glide=mv.filter(r=>!r.walk&&!r.whole&&r.mode!=='cover').length;
  console.log(f.slice(5,-5).padEnd(8),tag.padEnd(12),'n',R.length,'beveg',mv.length,'gange',walk.length,'bein→ønsket',legOK+'/'+walk.length,'v→ønsket',vOK,'faser',ph,'glid(beveg uten gange)',glide,'sikte°',aimMed!=null?Math.round(aimMed*180/Math.PI):'-',JSON.stringify(modes),
  'rull',[...new Set(R.map(r=>r.roll).filter(Boolean))].join('/'),'fall',Math.max(0,...R.map(r=>r.fall??0)).toFixed(2));}}
