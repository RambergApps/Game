// CSS for hovedmenyen (docs/MENY-STIL.md). Mål i 1920×1080-skala via --s (1 enhet = 1 px ved 1920 bredde / 1080 høyde).
import { FAMILY } from './fonts.js';
export const CSS = `
.bm-root{position:fixed;inset:0;z-index:40;background:#0b0b0d;overflow:hidden;user-select:none;-webkit-user-select:none;cursor:default;
  --s:min(calc(100vw / 1920), calc(100vh / 1080));font-family:"${FAMILY}","Arial Narrow",sans-serif;color:#e6e1d6}
.bm-bg{position:absolute;inset:0;width:100%;height:100%;display:block}
.bm-read{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(8,8,10,.45) 0%,rgba(8,8,10,0) 55%)}
.bm-strip{position:absolute;left:0;right:0;bottom:0;height:calc(var(--s)*140);pointer-events:none;background:linear-gradient(180deg,rgba(8,8,10,0),rgba(8,8,10,.8))}
.bm-black{position:absolute;inset:0;background:#000;pointer-events:none;opacity:1;transition:opacity 1.2s ease-out}
.bm-root.bm-in .bm-black{opacity:0}
.bm-root.bm-out .bm-black{opacity:1;transition:opacity .45s ease-in}
.bm-col{position:absolute;left:calc(var(--s)*150);top:calc(50% - var(--s)*230);width:calc(var(--s)*600)}
.bm-logo{position:relative;margin-left:calc(var(--s)*-46);opacity:0;transform:translateY(4px);transition:opacity .7s ease-out .9s,transform .7s ease-out .9s}
.bm-logo canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.bm-root.bm-in .bm-logo{opacity:1;transform:none}
.bm-sub{display:flex;align-items:center;gap:calc(var(--s)*20);margin-top:calc(var(--s)*-30);font-weight:600;font-size:calc(var(--s)*38);
  letter-spacing:.24em;color:#c8c4bc;opacity:0;transition:opacity .6s ease-out 1.25s}
.bm-sub::before{content:"";width:calc(var(--s)*56);height:calc(var(--s)*3);background:#ff7a1a;flex:none}
.bm-root.bm-in .bm-sub{opacity:1}
.bm-list{margin-top:calc(var(--s)*64);display:flex;flex-direction:column}
.bm-btn{all:unset;box-sizing:border-box;position:relative;display:flex;align-items:center;height:calc(var(--s)*78);width:calc(var(--s)*470);
  font-weight:600;font-size:calc(var(--s)*46);letter-spacing:.1em;text-transform:uppercase;color:#e6e1d6;cursor:pointer;
  opacity:0;transform:translateX(-6px);transition:opacity .4s ease-out,transform .4s ease-out}
.bm-root.bm-in .bm-btn{opacity:1;transform:none}
.bm-btn::after{content:"";position:absolute;left:0;bottom:0;width:calc(var(--s)*280);height:1px;background:#3c3c3e}
.bm-btn .bm-face{position:absolute;inset:calc(var(--s)*6) 0 calc(var(--s)*6) 0;background:rgba(255,122,26,.15);
  clip-path:polygon(0 0,100% 0,calc(100% - var(--s)*20) 100%,0 100%);opacity:0;transition:opacity .12s ease-out}
.bm-btn .bm-bar{position:absolute;left:0;top:calc(var(--s)*6);bottom:calc(var(--s)*6);width:calc(var(--s)*5);background:#ff7a1a;opacity:0;transition:opacity .12s}
.bm-btn .bm-txt{position:relative;padding-left:calc(var(--s)*22);transition:transform .12s ease-out,color .12s,text-shadow .12s}
.bm-btn .bm-chev{position:absolute;right:calc(var(--s)*38);color:#ff7a1a;opacity:0;font-size:calc(var(--s)*40);transition:opacity .12s}
.bm-btn .bm-lock{position:absolute;right:calc(var(--s)*36);font-weight:500;font-size:calc(var(--s)*22);letter-spacing:.12em;color:#5c5954}
.bm-btn.bm-sel .bm-face,.bm-btn.bm-sel .bm-bar,.bm-btn.bm-sel .bm-chev{opacity:1}
.bm-btn.bm-sel .bm-txt{color:#fff0e1;transform:translateX(calc(var(--s)*8));text-shadow:0 0 calc(var(--s)*14) rgba(237,134,69,.45)}
.bm-btn.bm-down .bm-face{background:rgba(255,122,26,.28)}
.bm-btn.bm-down .bm-bar{background:#ffea9c;box-shadow:0 0 calc(var(--s)*12) #ff7a1a}
.bm-btn.bm-down .bm-txt{transform:translate(calc(var(--s)*8),2px)}
.bm-btn.bm-off{cursor:default}.bm-btn.bm-off .bm-txt{color:#5c5954}
.bm-btn.bm-off.bm-sel .bm-face{opacity:.35}.bm-btn.bm-off.bm-sel .bm-bar{opacity:.35;background:#5b5753}.bm-btn.bm-off.bm-sel .bm-txt{color:#5c5954;text-shadow:none;transform:none}.bm-btn.bm-off .bm-chev{display:none}
.bm-ver,.bm-hint{position:absolute;bottom:calc(var(--s)*44);font-weight:500;font-size:calc(var(--s)*24);letter-spacing:.12em;color:#9a958d}
.bm-ver{left:calc(var(--s)*150)}
.bm-hint{right:calc(var(--s)*150);display:flex;align-items:center;gap:calc(var(--s)*12)}
.bm-hint i{display:inline-block;width:calc(var(--s)*12);height:calc(var(--s)*12);background:#39c6ff}
.bm-hint b{font-weight:500;color:#e6e1d6}
.bm-toast{position:absolute;left:calc(var(--s)*150);bottom:calc(var(--s)*110);font-weight:500;font-size:calc(var(--s)*24);letter-spacing:.12em;color:#ed8645;opacity:0;transition:opacity .2s}
.bm-toast.bm-on{opacity:1}
.bm-credits{position:absolute;inset:0;display:flex;align-items:center;background:rgba(11,11,13,.72)}
.bm-credits .bm-panel{margin-left:calc(var(--s)*150);width:calc(var(--s)*620);padding:calc(var(--s)*40) calc(var(--s)*48);background:#16171a;border-left:calc(var(--s)*5) solid #ff7a1a}
.bm-credits h2{margin:0 0 calc(var(--s)*24);font-weight:800;font-size:calc(var(--s)*56);letter-spacing:.08em;color:#e6e1d6}
.bm-credits p{margin:calc(var(--s)*6) 0;font-weight:500;font-size:calc(var(--s)*26);letter-spacing:.06em;color:#9a958d}
.bm-credits p b{display:inline-block;width:calc(var(--s)*210);font-weight:600;color:#e6e1d6;letter-spacing:.12em}
.bm-credits .bm-back{margin-top:calc(var(--s)*28);font-size:calc(var(--s)*22);color:#5b5753;letter-spacing:.12em}
`;
