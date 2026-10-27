// Kameraanalyse: node tests/qa-kamera.cjs <logg.json> – per tag: spillerens skjermavstand fra sentrum, sikt fremover (verdensenheter til kant), rykk (2.-derivert kamera), overskyting
const L=require(require('path').resolve(process.argv[2]));const by={};for(const r of L)(by[r.tag]=by[r.tag]||[]).push(r);
const W=1280,H=720;
for(let[t,R]of Object.entries(by)){{const seg=[[]];for(let i=0;i<R.length;i++){if(i&&Math.hypot(R[i].px-R[i-1].px,R[i].py-R[i-1].py)>20)seg.push([]);seg.at(-1).push(R[i])}R=seg.sort((a,b)=>b.length-a.length)[0];R=R.filter(r=>r.t-R[0].t>250);}if(R.length<20||R[0].cx==null)continue;const z=R[0].z,g=R[0].g||1;
 const s=R.slice(-15);const ox=s.reduce((a,r)=>a+(r.px-r.cx)*z,0)/s.length,oy=s.reduce((a,r)=>a+(r.py-r.cy)*z*g,0)/s.length;
 const dx=R.at(-1).px-R[0].px,dy=R.at(-1).py-R[0].py,n=Math.hypot(dx,dy)||1,ux=dx/n,uy=dy/n;
 // sikt: fra spillerens skjermpos langs retning til kanten, i verdensenheter
 const sx=W/2+ox,sy=H/2+oy;let k=1e9;if(ux>0.01)k=Math.min(k,(W-sx)/ux);if(ux<-0.01)k=Math.min(k,-sx/ux);if(uy>0.01)k=Math.min(k,(H-sy)/uy);if(uy<-0.01)k=Math.min(k,-sy/uy);
 const ahead=Math.round(Math.hypot(k*ux/z,k*uy/(z*g)));
 let j=[];for(let i=2;i<R.length;i++){const dt=(R[i].t-R[i-2].t)/2||16;j.push(Math.hypot(R[i].cx-2*R[i-1].cx+R[i-2].cx,R[i].cy-2*R[i-1].cy+R[i-2].cy)*z)}j.sort((a,b)=>a-b);
 // overskyting: kamera passerer forbi spiller+lead etter stopp? mål maks projeksjon av (cam - player) langs retning
 const os=Math.max(...R.map(r=>(r.cx-r.px)*ux+(r.cy-r.py)*uy));
 console.log(t.padEnd(12),'z',z,'g',+g.toFixed(3),'spiller-offset px',Math.round(ox),Math.round(oy),'sikt-frem(verden)',ahead,'rykk p50/p99 px',j[j.length>>1]?.toFixed(2),j[Math.floor(j.length*.99)]?.toFixed(2),'kamera-foran-spiller maks',Math.round(os));}
