/* ----- Cape Studio: player + cape preview with Minecraft-style cape motion; local designs only ----- */
const CAPE_BUILTIN={aurora:["Aurora","#0b1a2e","#6fe3ff","#b58cff","waves"],sakura:["Sakura","#3a1d33","#ffb7cf","#fff0f5","petals"],cosmic:["Cosmic","#0a0718","#8a6bff","#ffffff","stars"],
midnight:["Midnight","#0a1230","#4f6fd8","#e8eeff","moon"],void:["Endless Void","#020306","#4fd6e6","#8a6bff","lines"]};
const CS={yaw:Math.PI*0.82,pitch:0.12,dist:78,walk:true,sneak:false,stride:ls.get("capeStride",0.77),design:ls.get("capeDesign","aurora"),mine:ls.get("capeDesigns",[]),fav:ls.get("capeFav",[]),raf:0,drag:null,sim:null,pos:0,phase:0,tick:0,img:null,skin:null,skinKey:"",gen:{base:"#101826",a:"#6fe3ff",b:"#b58cff",pattern:"gradient"}};
/** Draws a 64x32 cape texture: the pattern fills the cape faces (Cosmetics.CAPE_FACES), so it wraps the box like a real cape file. */
function makeCape(base,a,b,pattern){const c=document.createElement("canvas");c.width=64;c.height=32;const x=c.getContext("2d");x.fillStyle=base;x.fillRect(0,0,22,17);
const front=(fn)=>{x.save();x.beginPath();x.rect(1,1,10,16);x.rect(12,1,10,16);x.clip();fn();x.restore()};const r=new VX.Rng(31);
front(()=>{if(pattern==="gradient"||pattern==="waves"){const g=x.createLinearGradient(0,1,0,17);g.addColorStop(0,a);g.addColorStop(1,b);x.fillStyle=g;x.fillRect(0,0,22,17)}
 if(pattern==="waves"){x.fillStyle=base;for(let i=0;i<22;i++){const y=6+Math.round(Math.sin(i*0.9)*2);x.fillRect(i,y,1,2);x.fillRect(i,y+6,1,1)}}
 if(pattern==="stripes"){for(let i=0;i<17;i+=2){x.fillStyle=i%4?a:b;x.fillRect(0,i,22,1)}}
 if(pattern==="stars"){const g=x.createLinearGradient(0,1,0,17);g.addColorStop(0,base);g.addColorStop(1,a);x.fillStyle=g;x.fillRect(0,0,22,17);for(let i=0;i<26;i++){x.fillStyle=r.next()<0.7?b:a;x.fillRect(Math.floor(r.next()*22),Math.floor(r.next()*17),1,1)}}
 if(pattern==="petals"){for(let i=0;i<22;i++){x.fillStyle=r.next()<0.5?a:b;x.fillRect(Math.floor(r.next()*22),Math.floor(r.next()*17),1,1)}}
 if(pattern==="moon"){x.fillStyle=b;x.fillRect(4,4,4,4);x.fillRect(15,4,4,4);x.fillStyle=base;x.fillRect(6,4,2,2);x.fillRect(17,4,2,2);for(let i=0;i<12;i++){x.fillStyle=a;x.fillRect(Math.floor(r.next()*22),9+Math.floor(r.next()*8),1,1)}}
 if(pattern==="lines"){x.fillStyle=a;x.fillRect(5,1,1,16);x.fillRect(17,1,1,16);x.fillStyle=b;x.fillRect(1,12,10,1);x.fillRect(12,12,10,1)}
 x.fillStyle="rgba(255,255,255,.85)";for(const ox of[4,15])[[2,0],[1,1],[3,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3],[4,3],[0,4],[4,4]].forEach(([dx,dy])=>x.fillRect(ox+dx-0.5+0.5,12+dy-0,1,1))});
x.fillStyle=a;x.fillRect(0,1,1,16);x.fillRect(11,1,1,16);x.fillRect(1,0,10,1);x.fillRect(11,0,10,1);return c}
const capeCanvas=id=>{if(CAPE_BUILTIN[id]){const [,base,a,b,p]=CAPE_BUILTIN[id];return makeCape(base,a,b,p)}const m=CS.mine.find(d=>d.id===id);if(m&&m.img){const c=document.createElement("canvas"),im=CS.imgCache[m.id];if(im){c.width=im.width;c.height=im.height;c.getContext("2d").drawImage(im,0,0);return c}}return makeCape("#101826","#6fe3ff","#b58cff","gradient")};
CS.imgCache={};function cacheImages(){for(const d of CS.mine)if(!CS.imgCache[d.id]){const im=new Image();im.onload=()=>{CS.imgCache[d.id]=im;CS.img=null};im.src=d.img}}
const texOf=c=>{const d=c.getContext("2d").getImageData(0,0,c.width,c.height);return{w:c.width,h:c.height,data:d.data}};
PAGES.capes=()=>`<div class="page" style="max-width:1120px"><div class="head"><h1>Cape Studio</h1><span class="tag" title="Capes made here are drawn by Auroras on your screen only.">Local only: other players never see these capes</span></div>
<div class="studio"><div><div class="stagebox" style="height:440px"><canvas id="cs-cv" aria-label="Player and cape preview"></canvas><div class="vtag" id="cs-tag"></div></div>
<div class="row2"><label style="display:flex;gap:8px;align-items:center"><button class="tg" role="switch" id="cs-walk" aria-checked="${CS.walk}" aria-label="Walk"></button><small>Walk</small></label><label style="display:flex;gap:8px;align-items:center"><button class="tg" role="switch" id="cs-sneak" aria-checked="${CS.sneak}" aria-label="Sneak"></button><small>Sneak</small></label>
<span class="capespeed" style="display:flex;gap:8px;align-items:center;min-width:220px"><label for="cs-stride"><small>Speed</small></label><input type="range" class="rng" id="cs-stride" min="0" max="1" step="0.05" value="${CS.stride}" style="flex:1;--fill:${fillPct(CS.stride,0,1)}%" aria-valuetext="${capePace(CS.stride)}"><output id="cs-pace" class="clock" style="min-width:64px;text-align:left">${capePace(CS.stride)}</output></span><button class="btn" id="cs-reset">Reset camera</button></div>
<small>Cape motion follows the same rules the game uses for capes. Drag to turn the player; scroll to zoom. The skin comes from your selected account.</small></div>
<div><h2>Designs</h2><div class="capegrid" id="cs-grid"></div>
<details class="more"><summary>Make a design</summary><div class="panel setlist" style="margin-top:8px"><div class="set"><label for="cg-base">Base</label><input type="color" id="cg-base" class="colorbox" value="${CS.gen.base}"></div><div class="set"><label for="cg-a">Color 1</label><input type="color" id="cg-a" class="colorbox" value="${CS.gen.a}"></div><div class="set"><label for="cg-b">Color 2</label><input type="color" id="cg-b" class="colorbox" value="${CS.gen.b}"></div>
<div class="set"><label for="cg-p">Pattern</label><select class="f" id="cg-p" style="width:auto">${["gradient","waves","stripes","stars","petals","moon","lines"].map(p=>`<option${p===CS.gen.pattern?" selected":""}>${p}</option>`).join("")}</select></div></div><div class="row2" style="justify-content:flex-end"><button class="btn" id="cg-preview">Preview</button><button class="btn pri" id="cg-save">Save design</button></div></details>
<div class="row2"><label class="btn" style="cursor:pointer">Import cape PNG<input type="file" id="cs-imp" accept="image/png" hidden></label><button class="btn" id="cs-exp">Export PNG</button></div><div class="err" id="cs-err" role="alert"></div>
<div class="panel" style="padding:10px 14px;margin-top:10px" id="cs-game"></div></div></div></div>`;
function drawCapeGrid(){const g=$("#cs-grid");if(!g)return;const items=[...Object.keys(CAPE_BUILTIN).map(id=>({id,name:CAPE_BUILTIN[id][0],builtin:true})),...CS.mine];
items.sort((a,b)=>(CS.fav.includes(b.id)?1:0)-(CS.fav.includes(a.id)?1:0));
g.innerHTML=items.map(d=>`<div class="capecard${CS.design===d.id?" on":""}"><button class="pbtn" data-cd="${esc(d.id)}" aria-pressed="${CS.design===d.id}"><canvas width="44" height="68" data-cthumb="${esc(d.id)}"></canvas><span>${esc(d.name)}</span></button><span class="pact"><button class="ibtn sm up star${CS.fav.includes(d.id)?" on":""}" data-cfav="${esc(d.id)}" aria-pressed="${CS.fav.includes(d.id)}" aria-label="${CS.fav.includes(d.id)?"Remove":"Add"} ${esc(d.name)} ${CS.fav.includes(d.id)?"from":"to"} favorites" data-tt="Favorite">${ic("star",13)}</button>${d.builtin?`<button class="ibtn sm up" data-cdup="${esc(d.id)}" aria-label="Duplicate ${esc(d.name)}" data-tt="Duplicate">${ic("copy",13)}</button>`:`<button class="ibtn sm up" data-cren="${esc(d.id)}" aria-label="Rename ${esc(d.name)}" data-tt="Rename">${ic("pen",13)}</button><button class="ibtn sm up danger" data-cdel="${esc(d.id)}" aria-label="Delete ${esc(d.name)}" data-tt="Delete">${ic("trash",13)}</button>`}</span></div>`).join("");
g.querySelectorAll("[data-cthumb]").forEach(c=>{const src=capeCanvas(c.dataset.cthumb),x=c.getContext("2d"),sc=src.width/64;x.imageSmoothingEnabled=false;x.clearRect(0,0,44,68);x.drawImage(src,1*sc,1*sc,10*sc,16*sc,2,2,40,64)})}
function useDesign(id){CS.previewing=false;CS.design=id;ls.set("capeDesign",id);CS.img=null;drawCapeGrid();const set={"cape.design":CAPE_BUILTIN[id]?id:"custom"};mcSave(set).catch(()=>{})}
/** The in-game panel: the selected design can be shown in the game, to you only (the mod draws it on your own player). */
function drawCapeGame(){const el=$("#cs-game");if(!el||!MC.data)return;const on=mcVals()["cape.enabled"]==="true",m=REG.modules.find(x=>x.id==="cape");
el.innerHTML=`<div class="row2" style="justify-content:space-between;align-items:center;gap:10px"><div><b>In game</b> ${availTag(m)}<br><small>${on?"Your selected design shows on your player in "+esc(cur().name)+". ":"Show the selected design on your player in the game. "}Only you see it: other players see your Minecraft cape or none.</small></div>
<div class="row2">${on?`<button class="btn" id="cs-gameoff">Stop showing in game</button>`:""}<button class="btn pri" id="cs-gameon">${on?"Update in game":"Use in game"}</button></div></div>`;
$("#cs-gameon").onclick=async()=>{const c=capeCanvas(CS.design);try{if(c.width===22)throw new Error("This design is in the old 22x17 layout. Import it again to convert it.");if(isDesk())await auroras.capeWrite({id:cur().id,png:c.toDataURL("image/png")});await mcSave({"cape.enabled":"true","cape.design":CAPE_BUILTIN[CS.design]?CS.design:"custom"});toast((isDesk()?"Cape saved to "+cur().name:"Saved in this browser only")+". It shows the next time the game starts, to you only.","ok");drawCapeGame()}catch(x){toast(errMsg(x),"err")}};
const off=$("#cs-gameoff");if(off)off.onclick=async()=>{try{if(isDesk())await auroras.capeClear(cur().id);await mcSave({"cape.enabled":"false"});toast("The game won’t show your Auroras cape after its next start.");drawCapeGame()}catch(x){toast(errMsg(x),"err")}}}
function persistMine(){ls.set("capeDesigns",CS.mine)}
async function initCapes(){await mcLoad();cacheImages();drawCapeGrid();drawCapeGame();CS.sim=VX.CapeSim();CS.pos=0;CS.phase=0;CS.st=null;
const page=document.querySelector(".page"),err=()=>$("#cs-err");
page.onclick=async e=>{const t=e.target.closest("[data-cd],[data-cfav],[data-cdup],[data-cren],[data-cdel],#cs-walk,#cs-sneak,#cs-reset,#cg-preview,#cg-save,#cs-exp");if(!t)return;err().textContent="";
if(t.dataset.cd)useDesign(t.dataset.cd);
else if(t.dataset.cfav){const i=CS.fav.indexOf(t.dataset.cfav);i<0?CS.fav.push(t.dataset.cfav):CS.fav.splice(i,1);ls.set("capeFav",CS.fav);drawCapeGrid()}
else if(t.dataset.cdup){const src=capeCanvas(t.dataset.cdup),d={id:"c"+Date.now(),name:(CAPE_BUILTIN[t.dataset.cdup]||[t.dataset.cdup])[0]+" copy",img:src.toDataURL()};CS.mine.push(d);persistMine();cacheImages();setTimeout(drawCapeGrid,50)}
else if(t.dataset.cren){const d=CS.mine.find(x=>x.id===t.dataset.cren);promptDlg("Rename design","Design name",d.name,n=>{if(!n||n.length>32)return"Give it a name (up to 32 characters).";d.name=n;persistMine();drawCapeGrid()})}
else if(t.dataset.cdel){const d=CS.mine.find(x=>x.id===t.dataset.cdel);confirmDlg(`Delete “${d.name}”?`,"This removes the design from this computer.","Delete",()=>{CS.mine=CS.mine.filter(x=>x!==d);persistMine();if(CS.design===d.id)useDesign("aurora");else drawCapeGrid()})}
else if(t.id==="cs-walk"){CS.walk=!CS.walk;t.setAttribute("aria-checked",CS.walk)}else if(t.id==="cs-sneak"){CS.sneak=!CS.sneak;t.setAttribute("aria-checked",CS.sneak)}
else if(t.id==="cs-reset"){CS.yaw=Math.PI*0.82;CS.pitch=0.12;CS.dist=78}
else if(t.id==="cg-preview"||t.id==="cg-save"){CS.gen={base:$("#cg-base").value,a:$("#cg-a").value,b:$("#cg-b").value,pattern:$("#cg-p").value};const c=makeCape(CS.gen.base,CS.gen.a,CS.gen.b,CS.gen.pattern);
  if(t.id==="cg-preview"){CS.img=texOf(c);CS.previewing=true}else promptDlg("Save design","Design name","My cape",n=>{if(!n||n.length>32)return"Give it a name (up to 32 characters).";const d={id:"c"+Date.now(),name:n,img:c.toDataURL()};CS.mine.push(d);persistMine();cacheImages();setTimeout(()=>useDesign(d.id),60)})}
else if(t.id==="cs-exp"){const c=capeCanvas(CS.design);c.toBlob(b=>saveBlob("cape-"+CS.design+".png",b),"image/png")}};
$("#cs-stride").oninput=e=>{CS.stride=+e.target.value;ls.set("capeStride",CS.stride);const p=capePace(CS.stride);e.target.style.setProperty("--fill",fillPct(CS.stride,0,1)+"%");e.target.setAttribute("aria-valuetext",p);$("#cs-pace").textContent=p};
$("#cs-imp").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{if(f.type!=="image/png")throw new Error("Capes must be PNG images.");const url=URL.createObjectURL(f);const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("That PNG couldn’t be read."));i.src=url});URL.revokeObjectURL(url);
  const sc=VX.capeScale(im.width,im.height),c=document.createElement("canvas");if(sc===0){c.width=64;c.height=32;c.getContext("2d").drawImage(im,0,0)}else{c.width=im.width;c.height=im.height;c.getContext("2d").drawImage(im,0,0)}
  const d={id:"c"+Date.now(),name:f.name.replace(/\.png$/i,"").slice(0,32)||"Imported cape",img:c.toDataURL()};CS.mine.push(d);persistMine();cacheImages();setTimeout(()=>useDesign(d.id),60);toast("Imported “"+d.name+"”")}catch(x){err().textContent=errMsg(x)}};
const cv=$("#cs-cv");cv.onpointerdown=e=>{CS.drag=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(!CS.drag)return;CS.yaw-=(e.clientX-CS.drag[0])*0.01;CS.pitch=Math.max(-0.6,Math.min(1,CS.pitch+(e.clientY-CS.drag[1])*0.01));CS.drag=[e.clientX,e.clientY]};
cv.onpointerup=cv.onpointercancel=()=>{CS.drag=null};cv.onwheel=e=>{e.preventDefault();CS.dist=Math.max(40,Math.min(160,CS.dist*(e.deltaY>0?1.1:0.9)))};
cancelAnimationFrame(CS.raf);let last=0,acc=0;const loop=ts=>{if(!cv.isConnected)return;CS.raf=requestAnimationFrame(loop);if(studioPaused()||ts-last<(UNFOCUSED?100:33))return;const dt=Math.min(0.1,(ts-last)/1000||0.033);last=ts;
acc+=dt;while(acc>=0.05){acc-=0.05;capeTick()}
drawCapeScene(cv,acc/0.05)};CS.raf=requestAnimationFrame(loop)}
POST.capes=initCapes;
/**
 * One game tick (1/20 s) of the preview player, using Minecraft's own movement numbers: speed in blocks per tick (1 on the
 * slider = sprinting, 0.28; about 0.77 = walking, 0.216; sneaking is 0.3 of that), the stride and walk distance that drive
 * the cape flap (PlayerEntity: stride eases 40% a tick toward min(0.1, speed)), and the limb swing (LivingEntity: limb
 * distance eases toward min(1, speed x 4)). Rendering then interpolates between the last two ticks, as the game does.
 */
function capeTick(){const S=CS.st||(CS.st={strideD:0,limbD:0,limbP:0,crouch:CS.sneak?1:0,prev:null,cur:null}),moving=CS.walk&&!REDUCED();
  const speed=moving?0.28*CS.stride*(CS.sneak?0.3:1):0;CS.pos+=speed;CS.phase+=speed*0.6;
  S.strideD+=(Math.min(0.1,speed)-S.strideD)*0.4;S.limbD+=(Math.min(1,speed*4)-S.limbD)*0.4;S.limbP+=S.limbD;
  CS.sim.tick(0,64,CS.pos,0,CS.sneak,S.strideD,CS.phase);
  // Minecraft snaps into the sneaking pose; easing it over about three ticks keeps the preview from jumping.
  S.crouch+=((CS.sneak?1:0)-S.crouch)*(REDUCED()?1:0.55);if(Math.abs((CS.sneak?1:0)-S.crouch)<0.01)S.crouch=CS.sneak?1:0;
  const c=Math.cos(S.limbP*0.6662);S.prev=S.cur;S.cur={swing:CS.sim.swing-(CS.sneak?25:0)+25*S.crouch,side:CS.sim.sideways,arm:-c*S.limbD,leg:-c*1.4*S.limbD,crouch:S.crouch};if(!S.prev)S.prev=S.cur}
/** The pose to draw: between the last two ticks by alpha (0..1). */
function capeView(alpha){if(!CS.st||!CS.st.cur)capeTick();const p=CS.st.prev,c=CS.st.cur,t=Math.max(0,Math.min(1,alpha)),l=k=>p[k]+(c[k]-p[k])*t;return{swing:l("swing"),side:l("side"),arm:l("arm"),leg:l("leg"),crouch:l("crouch")}}
const capePace=v=>v<=0?"Standing":v<0.55?"Slow walk":v<0.9?"Walking":"Sprinting";
function drawCapeScene(cv,alpha=1){const W=cv.clientWidth|0,H=cv.clientHeight|0;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const ctx=cv.getContext("2d"),a=curAcct();
const key=a?a.uuid+":"+(a.skin?a.skin.length:0):"default";if(CS.skinKey!==key){CS.skinKey=key;CS.skin=null;const done=img=>{try{CS.skin=texOf(img?skinCanvas(img):defaultSkin())}catch(e){CS.skin=texOf(defaultSkin())}};if(a&&a.skin){const im=new Image();im.onload=()=>done(im);im.onerror=()=>done(null);im.src=a.skin}else done(null)}
if(!CS.skin)return;if(!CS.img&&!CS.previewing){const c=capeCanvas(CS.design);CS.img=texOf(c)}
const v=capeView(alpha),sc=CS.img.w/64;
const model=PV.player(CS.skin,{slim:!!(a&&a.model==="slim"),armSwing:v.arm,legSwing:v.leg,crouch:v.crouch}).concat(PV.cape(CS.img,sc||1,v.swing,v.side,v.crouch));
const st=PV.render(ctx,W,H,model,{yaw:CS.yaw,pitch:CS.pitch,dist:CS.dist,target:[0,16,0],fov:30},{light:"studio",shadow:{y:0,r:9}});
const tag=$("#cs-tag");if(tag)tag.textContent=`${CS.previewing?"Unsaved preview · ":""}cape ${v.swing.toFixed(0)}°${a?" · "+a.name:" · default skin"}`;cv.dataset.drawn=st.drawn}
