/* ----- Visual Studio: sky themes and particles, previewed with the game's own math ----- */
const SKYM=()=>REG.modules.find(m=>m.id==="sky"),PFXM=()=>REG.modules.find(m=>m.id==="particlefx");
const VS={tab:"sky",ticks:13000,dim:"minecraft:overworld",compare:false,yaw:0.35,draft:null,pdraft:null,raf:0,stars:null,starsKey:"",t0:0,fps:0,pp:null,gov:null};
const mcClock=t=>{const h=(Math.floor(t/1000)+6)%24,mi=Math.floor((t%1000)*0.06);return String(h).padStart(2,"0")+":"+String(mi).padStart(2,"0")};
const qOf=vals=>VX.QUALITY[vals["settings.quality"]]||VX.QUALITY.BALANCED;
PAGES.cosmetics=()=>`<div class="page" style="max-width:1120px"><div class="head"><h1>Visual Studio</h1><div class="chips" id="vs-tabs">${[["sky","Custom Skies"],["particles","Particles"]].map(([k,l])=>`<button class="chip" data-tab="${k}" aria-pressed="${VS.tab===k}">${l}</button>`).join("")}</div></div><div id="vs-body"><div class="skel" style="height:360px"></div></div></div>`;
async function initVisualStudio(){await mcLoad(true);VS.draft=moduleValues(SKYM(),mcVals());VS.pdraft=moduleValues(PFXM(),mcVals());drawVS();
document.getElementById("vs-tabs").onclick=e=>{const b=e.target.closest("[data-tab]");if(!b)return;VS.tab=b.dataset.tab;document.querySelectorAll("#vs-tabs .chip").forEach(c=>c.setAttribute("aria-pressed",c===b));drawVS()}}
POST.cosmetics=initVisualStudio;
function drawVS(){cancelAnimationFrame(VS.raf);const b=document.getElementById("vs-body");if(!b)return;if(VS.tab==="sky")skyTab(b);else particleTab(b)}
const studioPaused=()=>document.hidden||GAME_RUNNING;

/* Sky preview. Same colors, star positions, twinkle and aurora curves as client-mod/core Sky.java. */
function skyAdjust(d){return{brightness:+d.brightness,saturation:+d.saturation,contrast:+d.contrast,tint:parseInt(d.tint,16),tintStrength:+d.tintStrength}}
function drawSky(ctx,W,H,themeId,d,ticks,dim,sec,q,yaw){
  const pitch=0.32,vfov=1.15,hfov=vfov*W/H,horizonY=H/2+pitch/(vfov/2)*H/2;
  const toY=a=>H/2-(a-pitch)/(vfov/2)*H/2,toX=az=>{let r=az-yaw;r=Math.atan2(Math.sin(r),Math.cos(r));return W/2+r/(hfov/2)*W/2};
  if(!themeId){ // vanilla look for the Nether and End, approximate
    if(dim==="minecraft:the_nether"){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,"#3a0e0b");g.addColorStop(1,"#1c0605");ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
    else if(dim==="minecraft:the_end"){ctx.fillStyle="#140f1c";ctx.fillRect(0,0,W,H);const r=new VX.Rng(9);for(let k=0;k<500;k++){ctx.fillStyle=`rgba(80,60,110,${r.next()*0.5})`;ctx.fillRect(r.next()*W,r.next()*H,3,3)}}
    else{const t=SKY_THEMES.vanillaPlus;for(let y=0;y<H;y+=2){const a=pitch+(H/2-y)/(H/2)*vfov/2;ctx.fillStyle=hexs(y<horizonY?VX.skyColor(t,a/(Math.PI/2),ticks,VX.NONE):t.ground);ctx.fillRect(0,y,W,2)}}
    return}
  const qn=VX.skyQuality(d.skyQuality,Object.keys(VX.QUALITY).find(k=>VX.QUALITY[k]===q));q=VX.QUALITY[qn];const B=VX.FX_BUDGET[qn];
  const t=SKY_THEMES[themeId],adj=skyAdjust(d),night=VX.nightAmount(ticks),fx=t.fx,op=d.effectsOpacity==null?1:+d.effectsOpacity,rad=e=>e*Math.PI/2,px=a=>a/(vfov/2)*H/2,O=FXO;
  for(let y=0;y<H;y+=2){const a=pitch+(H/2-y)/(H/2)*vfov/2;ctx.fillStyle=hexs(y<horizonY?VX.skyColor(t,a/(Math.PI/2),ticks,adj):VX.adjust(t.ground,adj));ctx.fillRect(0,y,W,2)}
  const anim=d.animate==="true",clk=VX.fxClock(sec,d.animSpeed==null?1:+d.animSpeed,anim);
  if(t.nebula&&d.nebula==="true"&&q.nebula&&night>0.01&&t.nebulaColors.length){ctx.globalCompositeOperation="lighter";const drift=fx.nebulaDrift*(d.nebulaSpeed==null?1:+d.nebulaSpeed);
    for(let k=0;k<B.nebulaBlobs;k++){VX.nebula(77,k,clk,drift,O);const c=t.nebulaColors[k%t.nebulaColors.length],x=toX(O[0]),y=toY(rad(O[1])),r=Math.max(8,px(O[2])),g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,`rgba(${c>>16&255},${c>>8&255},${c&255},${O[3]*night*op})`);g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}ctx.globalCompositeOperation="source-over"}
  const key=[+d.starDensity*t.starDensity*q.starMultiplier,+d.starSize*t.starSize].join("|");if(VS.starsKey!==key){VS.stars=VX.StarField(1337,+d.starDensity*t.starDensity*q.starMultiplier,+d.starSize*t.starSize);VS.starsKey=key}
  if(night>0.005){const f=VS.stars,tw=anim?+d.twinkleSpeed:0,base=+d.starBrightness*t.starBrightness,tint=VX.adjust(t.starTint,adj),rr=tint>>16&255,gg=tint>>8&255,bb=tint&255;
    for(let k=0;k<f.count;k++){if(f.y[k]<0.02)continue;const el=Math.asin(f.y[k]),y=toY(el);if(y>horizonY||y<0)continue;const x=toX(Math.atan2(f.z[k],f.x[k]));if(x<0||x>W)continue;
      const br=f.brightness(k,clk,tw,base,night);if(br<0.02)continue;const s=Math.max(1,Math.round(f.size[k]*H/55));ctx.fillStyle=`rgba(${rr},${gg},${bb},${Math.min(1,br*1.15)})`;ctx.fillRect(Math.round(x),Math.round(y),s,s)}
    if(fx.constellations&&d.constellations!=="false"){if(VS.consKey!==key){VS.cons=VX.Constellations(f,4242,8);VS.consKey=key}const C=VS.cons;ctx.lineWidth=Math.max(1,H/400);
      for(let p=0;p<C.groupOf.length;p++){const g=C.groupOf[p];if(g>=B.constellationGroups)continue;const a=C.pairs[p*2],b=C.pairs[p*2+1],x1=toX(Math.atan2(f.z[a],f.x[a])),y1=toY(Math.asin(f.y[a])),x2=toX(Math.atan2(f.z[b],f.x[b])),y2=toY(Math.asin(f.y[b]));
        if(Math.abs(x2-x1)>W/2||y1>horizonY||y2>horizonY)continue;ctx.strokeStyle=`rgba(${rr},${gg},${bb},${VX.Constellations.alpha(g,clk,night)*op})`;ctx.beginPath();ctx.moveTo(x1+0.5,y1+0.5);ctx.lineTo(x2+0.5,y2+0.5);ctx.stroke()}}
    const rate=fx.meteorsPerMinute*(d.shootingStars==null?1:+d.shootingStars),M=VS.mo||(VS.mo=new Float32Array(VX.METEOR_FIELDS*4)),n=night>0.15&&anim?VX.meteors(99,rate,clk,B.meteors,M):0;
    for(let m=0;m<n;m++){const o=m*6,hx=toX(M[o]),hy=toY(rad(M[o+1])),tl=0.45,tx=toX(M[o]-M[o+2]*tl),ty=toY(rad(M[o+1]-M[o+3]*tl));if(Math.abs(tx-hx)>W/2)continue;const g=ctx.createLinearGradient(hx,hy,tx,ty),al=M[o+5]*night*op;
      g.addColorStop(0,`rgba(${rr},${gg},${bb},${al})`);g.addColorStop(1,`rgba(${rr},${gg},${bb},0)`);ctx.strokeStyle=g;ctx.lineWidth=Math.max(1.2,H/260);ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(tx,ty);ctx.stroke();ctx.fillStyle=`rgba(255,255,255,${al})`;ctx.fillRect(hx-1,hy-1,2,2)}}
  const layers=Math.min(fx.auroraLayers,B.auroraLayers),waves=d.auroraWaves==null?1:+d.auroraWaves,step=Math.max(4,Math.round(W/B.ribbonSteps));
  if(t.aurora&&d.aurora==="true"&&q.aurora&&night>0.01&&layers>0){ctx.globalCompositeOperation="lighter";for(let l=layers-1;l>=0;l--)t.auroraColors.forEach((c,ri)=>{const col=`${c>>16&255},${c>>8&255},${c&255}`;for(let x=0;x<W;x+=step){const az=yaw+(x/W-0.5)*hfov,e=VX.auroraWave(az,clk,ri,l,t.auroraHeight,t.auroraSpeed,waves),y=toY(rad(e)),len=H*(0.22-l*0.04),g=ctx.createLinearGradient(0,y,0,y+len);
    g.addColorStop(0,`rgba(${col},0)`);g.addColorStop(0.25,`rgba(${col},${t.auroraStrength*night*0.5*VX.auroraShimmer(az,clk,ri,l,t.auroraSpeed)})`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;ctx.fillRect(x,y,step,len)}});ctx.globalCompositeOperation="source-over"}
  const ang=VX.skyAngle(ticks)*Math.PI*2,body=(dir,col,size,glow)=>{const el=Math.asin(Math.max(-1,Math.min(1,dir[1]))),az=Math.atan2(dir[2],dir[0]),x=toX(az),y=toY(el);if(y>horizonY+20)return;
    const r=H*0.035*size,R=r*(2.5+glow*5),c3=`${col>>16&255},${col>>8&255},${col&255}`,g=ctx.createRadialGradient(x,y,r*0.6,x,y,R);g.addColorStop(0,`rgba(${c3},${0.55*glow})`);g.addColorStop(0.35,`rgba(${c3},${0.16*glow})`);g.addColorStop(1,`rgba(${c3},0)`);
    ctx.fillStyle=g;ctx.fillRect(x-R,y-R,R*2,R*2);ctx.save();ctx.shadowColor=`rgba(${c3},${Math.min(1,0.4+glow)})`;ctx.shadowBlur=r*1.2;ctx.fillStyle=hexs(col);ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
    ctx.fillStyle="rgba(255,255,255,.35)";ctx.fillRect(x-r*0.55,y-r*0.55,r*1.1,r*1.1)};
  body([-Math.sin(ang),Math.cos(ang),0.15],VX.adjust(t.sunColor,adj),t.sunSize*+d.sunSize,t.sunGlow);body([Math.sin(ang),-Math.cos(ang),-0.15],VX.adjust(t.moonColor,adj),t.moonSize*+d.moonSize,t.moonGlow*night);
  if(fx.clouds>0&&d.clouds!=="false"){const day=VX.daylight(ticks);for(let k=0;k<B.cloudPuffs;k++){VX.cloud(17,k,clk,O);const x=toX(O[0]),y=toY(rad(O[1])),r=px(O[2]);if(x<-r||x>W+r)continue;const c=VX.cloudColor(VX.adjust(fx.cloudColor,adj),VX.skyColor(t,O[1],ticks,adj),day),g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(${c>>16&255},${c>>8&255},${c&255},${O[3]*fx.clouds*op})`);g.addColorStop(1,`rgba(${c>>16&255},${c>>8&255},${c&255},0)`);ctx.fillStyle=g;ctx.save();ctx.translate(x,y);ctx.scale(1.8,0.55);ctx.translate(-x,-y);ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore()}}
  if(t.mountains){ctx.fillStyle=hexs(VX.mix(VX.adjust(t.ground,adj),VX.skyColor(t,0,ticks,adj),0.25));ctx.beginPath();ctx.moveTo(0,H);for(let x=0;x<=W;x+=6){const az=yaw+(x/W-0.5)*hfov,h=(Math.sin(az*5)*0.5+Math.sin(az*11+1.3)*0.3+Math.sin(az*23+0.7)*0.2+0.6)*H*0.07;ctx.lineTo(x,horizonY-h)}ctx.lineTo(W,H);ctx.closePath();ctx.fill()}
  ctx.fillStyle=hexs(VX.adjust(t.ground,adj));ctx.fillRect(0,horizonY,W,H-horizonY);
  if(fx.petals>0&&d.petals!=="false"){const c=VX.adjust(fx.petalColor,adj),n=Math.round(B.petals*fx.petals),sz=Math.max(2,H/90);ctx.fillStyle=`rgb(${c>>16&255},${c>>8&255},${c&255})`;
    for(let k=0;k<n;k++){VX.petal(31,k,clk,O);const x=toX(O[0]),y=toY(rad(O[1]));if(x<0||x>W||y<0||y>H)continue;ctx.globalAlpha=O[3]*op;ctx.save();ctx.translate(x,y);ctx.rotate(O[2]);ctx.scale(1,0.5+0.5*Math.abs(Math.sin(O[2]*0.7)));ctx.beginPath();ctx.ellipse(0,0,sz,sz*0.6,0,0,Math.PI*2);ctx.fill();ctx.restore()}ctx.globalAlpha=1}}
const FXO=new Float32Array(4);
const SKY_TIMES=[[6000,"Noon"],[12800,"Sunset"],[18000,"Night"],[23300,"Sunrise"]];
function skyTab(b){const m=SKYM(),vals=mcVals(),on=vals["sky.enabled"]==="true",low=VX.skyQuality(VS.draft.skyQuality,vals["settings.quality"])==="LOW";
b.innerHTML=`<div class="studio"><div><div class="stagebox skystage"><canvas id="sky-cv" aria-label="Live sky preview. Drag to look around."></canvas><div class="vtag" id="sky-tag"></div></div>
<div class="themestrip" role="radiogroup" aria-label="Sky theme">${VX.THEME_IDS.map(id=>`<button class="thcard" role="radio" data-th="${id}" aria-checked="${VS.draft.theme===id}" aria-pressed="${VS.draft.theme===id}"><canvas width="176" height="96" data-thumb="${id}" aria-hidden="true"></canvas><span><b>${esc(SKY_THEMES[id].name)}</b>${VS.draft.theme===id?`<i class="selmark">${ic("check",12)}Selected</i>`:""}</span></button>`).join("")}</div>
<div class="skyctl"><div class="skyrow">${UI.seg('id="sky-dim"',[["minecraft:overworld","Overworld"],["minecraft:the_nether","Nether"],["minecraft:the_end","End"]],VS.dim,"Dimension")}
${UI.seg('id="sky-tk"',SKY_TIMES,SKY_TIMES.some(x=>x[0]===VS.ticks)?VS.ticks:"","Time of day")}<label class="cmp"><button class="tg" role="switch" id="sky-cmp" aria-checked="${VS.compare}" aria-label="Compare with vanilla"></button><span>Compare with vanilla</span></label></div>
<div class="skyrow"><label for="sky-time" class="tlab">Time of day</label><input type="range" class="rng" id="sky-time" min="0" max="23999" step="50" value="${VS.ticks}" style="flex:1;--fill:${fillPct(VS.ticks,0,23999)}%" aria-label="Time of day"><output id="sky-clock" class="clock">${mcClock(VS.ticks)}</output></div></div>
<small>Live preview using the game’s own formulas for colors, stars, aurora, shooting stars, clouds, petals and constellations. Minecraft also adds fog, weather and lighting, so the game won’t look identical.</small></div>
<div class="skyside">${UI.head("moon","Custom Skies",`${on?"On":"Off"} in ${esc(cur().name)}. Read when the game starts; switching skies on or off needs a restart.`,availTag(m)+impactTag(m),`<button class="tg" role="switch" id="sky-on" aria-checked="${on}" aria-label="Custom Skies on or off"></button>`)}
<div id="sky-set">${panelHtml(m,prefixed(m,VS.draft),{exclude:["theme"]})}</div>${low?`<div class="note-inline">${ic("info",14)}<span>Sky quality is Low: the aurora and nebula are hidden and fewer clouds, petals and shooting stars are drawn.</span></div>`:""}
<div class="actbar"><button class="btn ghost" id="sky-reset">${ic("reset",14)}Reset</button><span style="flex:1"></span><button class="btn" id="sky-cancel">Cancel</button><button class="btn pri" id="sky-apply">Apply</button></div><small style="display:block;margin-top:6px">${whereNote()}</small></div></div>`;
document.querySelectorAll("[data-thumb]").forEach(c=>drawSky(c.getContext("2d"),c.width,c.height,c.dataset.thumb,{...VS.draft,theme:c.dataset.thumb,brightness:"1",saturation:"1",contrast:"1",tintStrength:"0",tint:"FFFFFF"},19000,"minecraft:overworld",6,VX.QUALITY.BALANCED,0.35));
const setRoot=$("#sky-set"),sync=()=>{VS.draft={...VS.draft,...readCtrls(setRoot,m)}};wireCtrls(setRoot,sync);
kitWire($(".skyctl"),g=>{if(g.id==="sky-dim")VS.dim=g.dataset.value;else if(g.id==="sky-tk"){VS.ticks=+g.dataset.value;const r=$("#sky-time");r.value=VS.ticks;r.style.setProperty("--fill",fillPct(VS.ticks,0,23999)+"%");$("#sky-clock").textContent=mcClock(VS.ticks)}});
const pickTheme=id=>{if(id===VS.draft.theme)return;sync();VS.fadeFrom=VS.lastFrame;VS.fadeAt=performance.now();VS.draft.theme=id;b.querySelectorAll("[data-th]").forEach(c=>{const on=c.dataset.th===id;c.setAttribute("aria-pressed",on);c.setAttribute("aria-checked",on);const sp=c.querySelector("span");sp.innerHTML=`<b>${esc(SKY_THEMES[c.dataset.th].name)}</b>${on?`<i class="selmark">${ic("check",12)}Selected</i>`:""}`})};
$(".themestrip").onpointerover=e=>{const c=e.target.closest("[data-th]");VS.hoverTh=c?c.dataset.th:null};$(".themestrip").onpointerleave=()=>{VS.hoverTh=null};
$(".themestrip").onkeydown=e=>{const ids=VX.THEME_IDS,i=ids.indexOf(VS.draft.theme);let n=-1;if(e.key==="ArrowRight")n=(i+1)%ids.length;else if(e.key==="ArrowLeft")n=(i-1+ids.length)%ids.length;if(n>=0){e.preventDefault();pickTheme(ids[n]);b.querySelector(`[data-th="${ids[n]}"]`).focus()}};
b.onclick=async e=>{const t=e.target.closest("[data-th],#sky-cmp,#sky-on,#sky-reset,#sky-cancel,#sky-apply");if(!t)return;
if(t.dataset.th)pickTheme(t.dataset.th);
else if(t.id==="sky-cmp"){VS.compare=!VS.compare;t.setAttribute("aria-checked",VS.compare)}
else if(t.id==="sky-on"){const v=t.getAttribute("aria-checked")!=="true";try{await mcSave({"sky.enabled":String(v)});toast("Custom Skies "+(v?"on":"off")+". Restart the game for this to take effect.","ok");skyTab(b)}catch(err){toast(errMsg(err),"err")}}
else if(t.id==="sky-reset"){VS.draft=Object.fromEntries(m.settings.map(s=>[s.key,s.key==="enabled"?VS.draft.enabled:s.def]));skyTab(b)}
else if(t.id==="sky-cancel"){VS.draft=moduleValues(m,mcVals());skyTab(b)}
else if(t.id==="sky-apply"){sync();const set=prefixed(m,VS.draft);delete set["sky.enabled"];try{await mcSave(set);toast("Sky settings saved for "+cur().name,"ok")}catch(err){toast(errMsg(err),"err")}}};
$("#sky-time").oninput=e=>{VS.ticks=+e.target.value;e.target.style.setProperty("--fill",fillPct(VS.ticks,0,23999)+"%");$("#sky-clock").textContent=mcClock(VS.ticks);const g=$("#sky-tk");g.dataset.value="";g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-checked",+x.dataset.v===VS.ticks))};
const cv=$("#sky-cv");let drag=null;cv.onpointerdown=e=>{drag=e.clientX;cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(drag==null)return;VS.yaw-=(e.clientX-drag)*0.005;drag=e.clientX};cv.onpointerup=cv.onpointercancel=()=>{drag=null};
VS.t0=performance.now();let last=0;const loop=ts=>{if(!cv.isConnected)return;VS.raf=requestAnimationFrame(loop);if(studioPaused()||ts-last<(UNFOCUSED?100:33))return;last=ts;
const W=cv.clientWidth|0,H=cv.clientHeight|0;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const ctx=cv.getContext("2d"),vals2=mcVals(),q2=qOf(vals2),sec=REDUCED()?0:(ts-VS.t0)/1000;
const theme=VX.themeFor(VS.dim,VS.draft.theme,VS.draft.netherTheme,VS.draft.endTheme);
if(VS.compare){ctx.save();ctx.beginPath();ctx.rect(0,0,W/2,H);ctx.clip();drawSky(ctx,W,H,null,VS.draft,VS.ticks,VS.dim,sec,q2,VS.yaw);ctx.restore();ctx.save();ctx.beginPath();ctx.rect(W/2,0,W/2,H);ctx.clip();drawSky(ctx,W,H,theme,VS.draft,VS.ticks,VS.dim,sec,q2,VS.yaw);ctx.restore();ctx.fillStyle="rgba(255,255,255,.7)";ctx.fillRect(W/2-1,0,2,H)}
else drawSky(ctx,W,H,theme,VS.draft,VS.ticks,VS.dim,sec,q2,VS.yaw);
const fd=REDUCED()?1:(ts-(VS.fadeAt||0))/450;if(VS.fadeFrom&&fd<1){ctx.globalAlpha=1-fd*fd*(3-2*fd);ctx.drawImage(VS.fadeFrom,0,0,W,H);ctx.globalAlpha=1}else VS.fadeFrom=null;
if(!VS.lastFrame)VS.lastFrame=document.createElement("canvas");if(VS.lastFrame.width!==W||VS.lastFrame.height!==H){VS.lastFrame.width=W;VS.lastFrame.height=H}if(!VS.fadeFrom)VS.lastFrame.getContext("2d").drawImage(cv,0,0);
if(ts-(VS.thumbT||0)>66){VS.thumbT=ts;for(const id of new Set([VS.draft.theme,VS.hoverTh].filter(Boolean))){const c=document.querySelector(`[data-thumb="${id}"]`);if(c)drawSky(c.getContext("2d"),c.width,c.height,id,{...VS.draft,theme:id,brightness:"1",saturation:"1",contrast:"1",tintStrength:"0",tint:"FFFFFF"},19000,"minecraft:overworld",6+sec,VX.QUALITY.BALANCED,0.35)}}
const tag=$("#sky-tag");if(tag)tag.textContent=(VS.compare?"Vanilla (approximate) | ":"")+(theme?SKY_THEMES[theme].name:"Vanilla look (approximate)")};VS.raf=requestAnimationFrame(loop)}

/* Particles preview: the same pool, budget and governor rules as client-mod/core Particles.java */
function particleTab(b){const m=PFXM(),vals=mcVals(),q=qOf(vals);
b.innerHTML=`<div class="studio"><div><div class="stagebox"><canvas id="px-cv" aria-label="Particle preview"></canvas><div class="vtag" id="px-tag"></div></div>
<div class="row2"><span class="chips">${VX.STYLE_IDS.map(s=>`<button class="chip" data-style="${s}" aria-pressed="${VS.pdraft.style===s}">${esc(label(s))}</button>`).join("")}</span><button class="btn" id="px-burst">Event burst</button></div>
<small>Live preview of the particle budget, lifetime and spawn rules the game uses. ${availTag(m)} The in-game particle system isn’t written yet, so these settings are saved for it but don’t change the game today.</small></div>
<div><div id="px-set">${panelHtml(m,prefixed(m,VS.pdraft))}</div><div class="row2" style="justify-content:flex-end"><button class="btn" id="px-reset">Reset to default</button><button class="btn" id="px-cancel">Cancel</button><button class="btn pri" id="px-apply">Apply</button></div><small style="display:block;margin-top:6px">${whereNote()}</small></div></div>`;
const setRoot=$("#px-set"),sync=()=>{VS.pdraft={...VS.pdraft,...readCtrls(setRoot,m)};b.querySelectorAll("[data-style]").forEach(c=>c.setAttribute("aria-pressed",c.dataset.style===VS.pdraft.style))};wireCtrls(setRoot,sync);
VS.pp=VX.Particles(4096,11);VS.gov=VX.Governor(60);let burst=0;
b.onclick=async e=>{const t=e.target.closest("[data-style],#px-burst,#px-reset,#px-cancel,#px-apply");if(!t)return;
if(t.dataset.style){sync();VS.pdraft.style=t.dataset.style;const sel=setRoot.querySelector('[data-sk="style"]');if(sel)sel.value=t.dataset.style;b.querySelectorAll("[data-style]").forEach(c=>c.setAttribute("aria-pressed",c===t))}
else if(t.id==="px-burst")burst=0.35;else if(t.id==="px-reset"){VS.pdraft=Object.fromEntries(m.settings.map(s=>[s.key,s.def]));particleTab(b)}else if(t.id==="px-cancel"){VS.pdraft=moduleValues(m,mcVals());particleTab(b)}
else if(t.id==="px-apply"){sync();try{await mcSave(prefixed(m,VS.pdraft));toast("Particle settings saved for "+cur().name)}catch(err){toast(errMsg(err))}}};
const cv=$("#px-cv"),P=VS.pp,G=VS.gov;let last=0,lastFrame=performance.now();const loop=ts=>{if(!cv.isConnected)return;VS.raf=requestAnimationFrame(loop);if(studioPaused()||ts-last<16)return;
const dt=Math.min(0.05,(ts-(last||ts))/1000)||0.016;last=ts;const W=cv.clientWidth|0,H=cv.clientHeight|0;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const ctx=cv.getContext("2d"),d=VS.pdraft,q2=qOf(mcVals());
const frameMs=ts-lastFrame;lastFrame=ts;const gf=d.autoReduce==="true"?G.update(frameMs):1;P.setBudget(+d.maxCount,q2,gf);
const reduced=d.reducedMotion==="true"||REDUCED(),col=parseInt(d.color,16),speed=+d.speed*(reduced?0.3:1);
if(d.ambient==="true")P.emit(+d.spawnRate*+d.density,dt,0,0.2,0,1.2,speed,+d.lifetime,+d.size,col);
if(burst>0&&d.events==="true"){P.emit(1200*+d.density,dt,0,0.8,0,0.25,speed*2.5,+d.lifetime*0.6,+d.size*1.3,col);burst-=dt}
P.update(dt,reduced?0:0.35,4,+d.maxDistance);
ctx.fillStyle="#07090f";ctx.fillRect(0,0,W,H);const g=ctx.createRadialGradient(W/2,H*0.62,0,W/2,H*0.62,H*0.6);g.addColorStop(0,"rgba(111,227,255,.06)");g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
ctx.fillStyle="#141a26";ctx.fillRect(0,H*0.82,W,H*0.18);ctx.globalCompositeOperation=d.style==="sakura"?"source-over":"lighter";const op=+d.opacity;
for(let k=0;k<P.count;k++){const zz=P.z[k]+4,sx=W/2+P.x[k]/zz*H*0.9,sy=H*0.8-P.y[k]/zz*H*0.9,a=P.fade(k)*op,c=P.color[k],s=Math.max(1,P.size[k]*H/zz/60);
  ctx.fillStyle=`rgba(${c>>16&255},${c>>8&255},${c&255},${a})`;
  if(d.style==="geometric"){ctx.fillRect(sx-s,sy-s,s*2,s*2)}else if(d.style==="sakura"){ctx.beginPath();ctx.ellipse(sx,sy,s*1.6,s,(k%7)*0.9,0,6.3);ctx.fill()}else if(d.style==="cosmic"&&k%5===0){ctx.fillRect(sx-s*2,sy-0.5,s*4,1);ctx.fillRect(sx-0.5,sy-s*2,1,s*4)}else{ctx.beginPath();ctx.arc(sx,sy,s,0,6.3);ctx.fill()}}
ctx.globalCompositeOperation="source-over";const tag=$("#px-tag");if(tag)tag.textContent=`${P.count} / ${P.budget()} particles · quality ${mcVals()["settings.quality"].toLowerCase()}${gf<1?` · reduced to ${Math.round(gf*100)}% for frame rate`:""}`};VS.raf=requestAnimationFrame(loop)}
