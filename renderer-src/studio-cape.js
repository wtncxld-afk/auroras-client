/* ----- Cape Studio: player + cape preview with Minecraft-style cape motion; local designs only ----- */
const CAPE_BUILTIN={aurora:["Aurora","#0b1a2e","#6fe3ff","#b58cff","waves"],sakura:["Sakura","#3a1d33","#ffb7cf","#fff0f5","petals"],cosmic:["Cosmic","#0a0718","#8a6bff","#ffffff","stars"],
midnight:["Midnight","#0a1230","#4f6fd8","#e8eeff","moon"],void:["Endless Void","#020306","#4fd6e6","#8a6bff","lines"]};
const CS={yaw:Math.PI*0.82,pitch:0.12,dist:78,walk:true,sneak:false,stride:ls.get("capeStride",0.77),design:ls.get("capeDesign","aurora"),mine:[],fav:ls.get("capeFav",[]),raf:0,drag:null,sim:null,pos:0,phase:0,tick:0,img:null,skin:null,skinKey:"",gen:{base:"#101826",a:"#6fe3ff",b:"#b58cff",pattern:"gradient"}};
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
/* Cape library: designs you upload or make, kept on this computer. In the desktop app they live as PNG files in the
   launcher's data folder (any size the game supports); the browser preview keeps them in local storage. */
const CL={desk:()=>!!(window.auroras&&auroras.capeLibList),
  async list(){if(!CL.desk())return ls.get("capeDesigns",[]);const old=ls.get("capeDesigns",[]);if(old.length){for(const d of old)try{await auroras.capeLibSave({id:d.id,name:d.name,png:d.img,source:d.source||"made"})}catch(e){}try{localStorage.removeItem("capeDesigns")}catch(e){}}return auroras.capeLibList()},
  async save(d){if(CL.desk())return auroras.capeLibSave({id:d.id,name:d.name,png:d.img,source:d.source});const all=ls.get("capeDesigns",[]).filter(x=>x.id!==d.id).concat([d]),j=JSON.stringify(all);
    try{localStorage.setItem("capeDesigns",j)}catch(e){throw new Error("This browser is out of room for more capes. The desktop app has no such limit.")}},
  async rename(id,name){if(CL.desk())return auroras.capeLibRename({id,name});const all=ls.get("capeDesigns",[]);const d=all.find(x=>x.id===id);if(d)d.name=name;ls.set("capeDesigns",all)},
  async remove(id){if(CL.desk())return auroras.capeLibDelete(id);ls.set("capeDesigns",ls.get("capeDesigns",[]).filter(x=>x.id!==id))}};
CS.imgCache={};CS.imgWait={};CS.filter=ls.get("capeFilter","all");CS.tab="lib";
/** Loads each custom design's image once; when one arrives its thumbnail and (if selected) the preview update. */
function cacheImages(){for(const d of CS.mine)if(!CS.imgWait[d.id])CS.imgWait[d.id]=new Promise(ok=>{const im=new Image();im.onload=()=>{CS.imgCache[d.id]=im;if(CS.design===d.id)CS.img=null;drawThumb(d.id);ok(im)};im.onerror=()=>ok(null);im.src=d.img})}
const capeCanvas=id=>{if(CAPE_BUILTIN[id]){const [,base,a,b,p]=CAPE_BUILTIN[id];return makeCape(base,a,b,p)}const im=CS.imgCache[id];if(im){const c=document.createElement("canvas");c.width=im.width;c.height=im.height;c.getContext("2d").drawImage(im,0,0);return c}return makeCape("#101826","#6fe3ff","#b58cff","gradient")};
/** Same as capeCanvas, but waits for a custom design's image, so nothing ever saves the placeholder by mistake. */
async function capeCanvasReady(id){if(!CAPE_BUILTIN[id]&&CS.imgWait[id])await CS.imgWait[id];return capeCanvas(id)}
const texOf=c=>{const d=c.getContext("2d").getImageData(0,0,c.width,c.height);return{w:c.width,h:c.height,data:d.data}};
/**
 * Turns any supported cape image into the game's layout: 64x32 and its HD sizes as they are; OptiFine's 46x22 (and
 * its multiples, which add an elytra beside the cape) and the old 22x17 cape-only layout are placed on a 64x32 canvas;
 * anything bigger than the game supports (512x256) is scaled down. Wrong shapes get the same message as the game's check.
 */
function capeNormalize(im){const w=im.width,h=im.height;let k=0,ow=0,oh=0;
  if(w===22&&h===17){k=1}else if(w%46===0&&h*46===w*22){k=w/46}else if(w%64===0&&w===h*2){k=w/64}else VX.capeScale(w,h);
  const out=Math.min(k,8),c=document.createElement("canvas");c.width=64*out;c.height=32*out;const x=c.getContext("2d");x.imageSmoothingEnabled=out<k;
  const f=out/k;x.drawImage(im,0,0,w,h,0,0,w*f,h*f);return{canvas:c,note:w===22||w%46===0&&w!==64*k?"Converted from the "+(w===22?"old 22x17":"OptiFine")+" layout.":k>8?"Scaled down to 512x256, the largest size the game shows.":""}}
const capeSrcLabel={upload:"Uploaded",made:"Made here",copy:"Copy"};
PAGES.capes=()=>`<div class="page capes" style="max-width:1180px"><div class="head"><h1>Cape Studio</h1><span class="tag" title="Capes made here are drawn by Auroras on your screen only.">Local only: other players never see these capes</span></div>
<div class="studio"><div class="panel cs-stage"><div class="stagebox"><canvas id="cs-cv" aria-label="Player and cape preview"></canvas><div class="vtag" id="cs-tag"></div>
<button class="ibtn sm cs-reset" id="cs-reset" aria-label="Reset camera" data-tt="Reset camera">${ic("reset",14)}</button></div>
<div class="cs-ctrl"><label class="tgl"><button class="tg" role="switch" id="cs-walk" aria-checked="${CS.walk}" aria-label="Walk"></button><span>Walk</span></label><label class="tgl"><button class="tg" role="switch" id="cs-sneak" aria-checked="${CS.sneak}" aria-label="Sneak"></button><span>Sneak</span></label>
<span class="capespeed"><label for="cs-stride">Speed</label><input type="range" class="rng" id="cs-stride" min="0" max="1" step="0.05" value="${CS.stride}" style="--fill:${fillPct(CS.stride,0,1)}%" aria-valuetext="${capePace(CS.stride)}"><output id="cs-pace" class="clock">${capePace(CS.stride)}</output></span></div>
<small class="cs-hint">Cape motion follows the same rules the game uses for capes. Drag to turn the player; scroll to zoom. The skin comes from your selected account.</small></div>
<div class="cs-side"><div class="seg cs-tabs" role="tablist"><button role="tab" data-cstab="lib" aria-selected="${CS.tab==="lib"}">${ic("grid",14)}Library</button><button role="tab" data-cstab="make" aria-selected="${CS.tab==="make"}">${ic("pen",14)}Editor</button></div>
<div id="cs-lib"${CS.tab==="lib"?"":" hidden"}><label class="dropzone" id="cs-drop" tabindex="0">${ic("upload",18)}<span><b>Upload capes</b><small>PNG at 64x32 or HD (128x64 to 512x256). OptiFine capes work too. Drop files here or click.</small></span><input type="file" id="cs-imp" accept="image/png" multiple hidden></label>
<div class="seg cs-filter" role="group" aria-label="Show">${[["all","All"],["fav","Favorites"],["mine","Yours"]].map(([k,l])=>`<button data-cfilter="${k}" aria-pressed="${CS.filter===k}">${l}</button>`).join("")}</div>
<div class="capegrid" id="cs-grid"></div></div>
<div id="cs-make"${CS.tab==="make"?"":" hidden"}></div>
<div class="err" id="cs-err" role="alert"></div>
<div class="panel cs-game" id="cs-game"></div>
<div class="row2"><button class="btn" id="cs-exp">${ic("download",14)}Export PNG</button></div></div></div></div>`;
function capeItems(){const all=[...Object.keys(CAPE_BUILTIN).map(id=>({id,name:CAPE_BUILTIN[id][0],builtin:true})),...CS.mine];
  const shown=CS.filter==="fav"?all.filter(d=>CS.fav.includes(d.id)):CS.filter==="mine"?all.filter(d=>!d.builtin):all;
  return shown.sort((a,b)=>(CS.fav.includes(b.id)?1:0)-(CS.fav.includes(a.id)?1:0))}
function drawCapeGrid(){const g=$("#cs-grid");if(!g)return;const items=capeItems();
g.innerHTML=items.length?items.map(d=>{const fav=CS.fav.includes(d.id);return `<div class="capecard${CS.design===d.id?" on":""}"><button class="pbtn" data-cd="${esc(d.id)}" aria-pressed="${CS.design===d.id}"><span class="cthumb"><canvas width="40" height="64" data-cthumb="${esc(d.id)}"></canvas></span><span class="nm">${esc(d.name)}</span><small>${d.builtin?"Built in":capeSrcLabel[d.source]||"Yours"}</small></button>
<span class="pact"><button class="ibtn sm up star${fav?" on":""}" data-cfav="${esc(d.id)}" aria-pressed="${fav}" aria-label="${fav?"Remove":"Add"} ${esc(d.name)} ${fav?"from":"to"} favorites" data-tt="Favorite">${ic("star",13)}</button>${d.builtin?`<button class="ibtn sm up" data-cdup="${esc(d.id)}" aria-label="Duplicate ${esc(d.name)}" data-tt="Duplicate">${ic("copy",13)}</button>`:`<button class="ibtn sm up" data-cren="${esc(d.id)}" aria-label="Rename ${esc(d.name)}" data-tt="Rename">${ic("pen",13)}</button><button class="ibtn sm up danger" data-cdel="${esc(d.id)}" aria-label="Delete ${esc(d.name)}" data-tt="Delete">${ic("trash",13)}</button>`}</span></div>`}).join("")
:`<div class="cs-empty"><small>${CS.filter==="fav"?"Star a cape to keep it here.":"Capes you upload or make show up here."}</small></div>`;
g.querySelectorAll("[data-cthumb]").forEach(c=>drawThumb(c.dataset.cthumb))}
/** A card's picture: the cape's outer face, pixel-sharp. */
function drawThumb(id){const c=document.querySelector(`[data-cthumb="${CSS.escape(id)}"]`);if(!c)return;if(!CAPE_BUILTIN[id]&&!CS.imgCache[id])return;const src=capeCanvas(id),x=c.getContext("2d"),sc=src.width/64;x.imageSmoothingEnabled=false;x.clearRect(0,0,40,64);x.drawImage(src,1*sc,1*sc,10*sc,16*sc,0,0,40,64)}
function useDesign(id){CS.previewing=false;CS.design=id;ls.set("capeDesign",id);CS.img=null;drawCapeGrid();if(CS.tab==="make")ceLoad(id);const set={"cape.design":CAPE_BUILTIN[id]?id:"custom"};mcSave(set).catch(()=>{})}
/** The in-game panel: the selected design can be shown in the game, to you only (the mod draws it on your own player). */
function drawCapeGame(){const el=$("#cs-game");if(!el||!MC.data)return;const on=mcVals()["cape.enabled"]==="true",m=REG.modules.find(x=>x.id==="cape");
el.innerHTML=`<div class="cs-gamerow"><div><b>In game</b> ${availTag(m)}<br><small>${on?"Your selected design shows on your player in "+esc(cur().name)+". ":"Show the selected design on your player in the game. "}Only you see it: other players see your Minecraft cape or none.</small></div>
<div class="row2" style="margin:0">${on?`<button class="btn" id="cs-gameoff">Stop showing in game</button>`:""}<button class="btn pri" id="cs-gameon">${on?"Update in game":"Use in game"}</button></div></div>`;
$("#cs-gameon").onclick=async()=>{try{const c=await capeCanvasReady(CS.design);VX.capeScale(c.width,c.height);if(isDesk())await auroras.capeWrite({id:cur().id,png:c.toDataURL("image/png")});await mcSave({"cape.enabled":"true","cape.design":CAPE_BUILTIN[CS.design]?CS.design:"custom"});toast((isDesk()?"Cape saved to "+cur().name:"Saved in this browser only")+". It shows the next time the game starts, to you only.","ok");drawCapeGame()}catch(x){toast(errMsg(x),"err")}};
const off=$("#cs-gameoff");if(off)off.onclick=async()=>{try{if(isDesk())await auroras.capeClear(cur().id);await mcSave({"cape.enabled":"false"});toast("The game won’t show your Auroras cape after its next start.");drawCapeGame()}catch(x){toast(errMsg(x),"err")}}}
async function addDesign(d){await CL.save(d);CS.mine=CS.mine.filter(x=>x.id!==d.id).concat([d]);cacheImages();await CS.imgWait[d.id];useDesign(d.id)}
const newId=()=>"c"+Date.now()+Math.floor(Math.random()*1000);
async function importCapes(files){const err=$("#cs-err");err.textContent="";const notes=[];let n=0;
  for(const f of files){try{if(f.type&&f.type!=="image/png"||!/\.png$/i.test(f.name))throw new Error("Capes must be PNG images.");if(f.size>8*1024*1024)throw new Error("That file is over 8 MB.");const url=URL.createObjectURL(f);
    const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("That PNG couldn’t be read."));i.src=url});URL.revokeObjectURL(url);
    const r=capeNormalize(im),d={id:newId(),name:f.name.replace(/\.png$/i,"").slice(0,32)||"Uploaded cape",img:r.canvas.toDataURL("image/png"),source:"upload"};await addDesign(d);n++;if(r.note)notes.push(d.name+": "+r.note)}
  catch(x){err.textContent=(files.length>1?f.name+": ":"")+errMsg(x)}}
  if(n)toast((n===1?"Added a cape":"Added "+n+" capes")+" to your library."+(notes.length?" "+notes.join(" "):""),"ok")}

/* ----- Editor: paint the cape pixel by pixel, or fill it from a pattern. Works at 64x32 (HD designs are scaled to it). ----- */
const CE={cv:null,tool:"pen",col:"#ffffff",mirror:false,undo:[],redo:[],from:null,z:14,down:false,last:null};
const CE_FACES=[["Outside",1,1,10,16],["Inside",12,1,10,16]];
function ceLoad(id){const src=capeCanvas(id),c=document.createElement("canvas");c.width=64;c.height=32;const x=c.getContext("2d");x.imageSmoothingEnabled=false;x.drawImage(src,0,0,64,32);CE.cv=c;CE.from=id;CE.undo=[];CE.redo=[];ceDraw();cePreview()}
function drawCapeMake(){const el=$("#cs-make");if(!el)return;const own=CE.from&&!CAPE_BUILTIN[CE.from]&&CS.mine.find(d=>d.id===CE.from);
el.innerHTML=`<div class="panel ce"><div class="ce-tools" role="toolbar" aria-label="Paint tools">${[["pen","Pen"],["bucket","Fill"],["picker","Pick colour"],["eraser","Erase"]].map(([t,l])=>`<button class="ibtn${CE.tool===t?" on":""}" data-cetool="${t}" aria-pressed="${CE.tool===t}" aria-label="${l}" data-tt="${l}">${ic(t,16)}</button>`).join("")}
<input type="color" class="colorbox" id="ce-col" value="${CE.col}" aria-label="Paint colour"><span class="sep"></span><button class="ibtn" data-ceact="undo" aria-label="Undo" data-tt="Undo (Ctrl+Z)"${CE.undo.length?"":" disabled"}>${ic("undo",16)}</button><button class="ibtn" data-ceact="redo" aria-label="Redo" data-tt="Redo"${CE.redo.length?"":" disabled"}>${ic("redo",16)}</button>
<label class="tgl" style="margin-left:auto"><button class="tg" role="switch" id="ce-mirror" aria-checked="${CE.mirror}" aria-label="Mirror"></button><span>Mirror</span></label></div>
<div class="ce-canvas"><canvas id="ce-cv" aria-label="Cape pixels: outside face on the left, inside face on the right"></canvas></div>
<div class="ce-legend"><small>Outside (seen behind you)</small><small>Inside</small></div>
<details class="more"><summary>Fill from a pattern</summary><div class="setlist"><div class="set"><label for="cg-base">Base</label><input type="color" id="cg-base" class="colorbox" value="${CS.gen.base}"></div><div class="set"><label for="cg-a">Color 1</label><input type="color" id="cg-a" class="colorbox" value="${CS.gen.a}"></div><div class="set"><label for="cg-b">Color 2</label><input type="color" id="cg-b" class="colorbox" value="${CS.gen.b}"></div>
<div class="set"><label for="cg-p">Pattern</label><select class="f" id="cg-p" style="width:auto">${["gradient","waves","stripes","stars","petals","moon","lines"].map(p=>`<option${p===CS.gen.pattern?" selected":""}>${p}</option>`).join("")}</select></div></div></details>
<div class="row2" style="justify-content:flex-end;margin-bottom:0"><button class="btn ghost" data-ceact="revert">Revert</button>${own?`<button class="btn" data-ceact="update">Save changes</button>`:""}<button class="btn pri" id="cg-save">Save as new</button></div></div>`;
const cv=$("#ce-cv");cv.onpointerdown=e=>{CE.down=true;cv.setPointerCapture(e.pointerId);cePush();CE.last=null;cePaint(e)};cv.onpointermove=e=>{if(CE.down)cePaint(e)};cv.onpointerup=cv.onpointercancel=()=>{CE.down=false;CE.last=null;ceButtons()};
$("#ce-col").oninput=e=>{CE.col=e.target.value};
const gen=()=>{CS.gen={base:$("#cg-base").value,a:$("#cg-a").value,b:$("#cg-b").value,pattern:$("#cg-p").value};cePush();CE.cv=makeCape(CS.gen.base,CS.gen.a,CS.gen.b,CS.gen.pattern);ceDraw();cePreview()};
["cg-base","cg-a","cg-b"].forEach(i=>$("#"+i).onchange=gen);$("#cg-p").onchange=gen;ceDraw()}
/** Undo and redo are only clickable when there is something to undo or redo. */
function ceButtons(){document.querySelectorAll("[data-ceact=undo],[data-ceact=redo]").forEach(b=>b.disabled=!(b.dataset.ceact==="undo"?CE.undo:CE.redo).length)}
function cePush(){CE.undo.push(CE.cv.getContext("2d").getImageData(0,0,64,32));if(CE.undo.length>60)CE.undo.shift();CE.redo=[]}
function ceAt(e){const cv=$("#ce-cv"),r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*22),y=Math.floor((e.clientY-r.top)/r.height*17);return x>=0&&y>=0&&x<22&&y<17?[x,y]:null}
/** The pixel on the other half of the same face, for mirrored painting. */
const ceMirror=(x,y)=>{for(const[,fx,fy,fw,fh]of CE_FACES)if(x>=fx&&x<fx+fw&&y>=fy&&y<fy+fh)return[fx+fw-1-(x-fx),y];return null};
function cePaint(e){const p=ceAt(e);if(!p)return;const x=CE.cv.getContext("2d"),[px,py]=p;
  if(CE.tool==="picker"){CE.undo.pop();const d=x.getImageData(px,py,1,1).data;CE.col="#"+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join("");CE.tool="pen";CE.down=false;drawCapeMake();return}
  if(CE.tool==="bucket"){ceFill(px,py);if(CE.mirror){const m=ceMirror(px,py);if(m)ceFill(m[0],m[1])}ceDraw();cePreview();return}
  const pts=[];if(CE.last){let[x0,y0]=CE.last;const dx=Math.abs(px-x0),dy=Math.abs(py-y0),n=Math.max(dx,dy);for(let i=1;i<=n;i++)pts.push([Math.round(x0+(px-x0)*i/n),Math.round(y0+(py-y0)*i/n)])}else pts.push(p);CE.last=p;
  for(const q of pts){const all=[q];if(CE.mirror){const m=ceMirror(q[0],q[1]);if(m)all.push(m)}for(const[a,b]of all){if(CE.tool==="eraser")x.clearRect(a,b,1,1);else{x.fillStyle=CE.col;x.fillRect(a,b,1,1)}}}
  ceDraw();cePreview()}
/** Flood fill within the 22x17 cape area, matching the exact colour. */
function ceFill(sx,sy){const x=CE.cv.getContext("2d"),im=x.getImageData(0,0,22,17),d=im.data,i0=(sy*22+sx)*4,t=[d[i0],d[i0+1],d[i0+2],d[i0+3]],h=CE.col.match(/\w\w/g).map(v=>parseInt(v,16));
  if(t[0]===h[0]&&t[1]===h[1]&&t[2]===h[2]&&t[3]===255)return;const st=[[sx,sy]],seen=new Uint8Array(22*17);
  while(st.length){const[a,b]=st.pop();if(a<0||b<0||a>=22||b>=17)continue;const k=b*22+a;if(seen[k])continue;seen[k]=1;const i=k*4;if(d[i]!==t[0]||d[i+1]!==t[1]||d[i+2]!==t[2]||d[i+3]!==t[3])continue;d[i]=h[0];d[i+1]=h[1];d[i+2]=h[2];d[i+3]=255;st.push([a+1,b],[a-1,b],[a,b+1],[a,b-1])}
  x.putImageData(im,0,0)}
function ceDraw(){const cv=$("#ce-cv");if(!cv||!CE.cv)return;const box=cv.parentElement,z=Math.max(6,Math.floor((box.clientWidth||330)/22)),W=22*z,H=17*z,dpr=window.devicePixelRatio||1;
  if(cv.width!==W*dpr){cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+"px";cv.style.height=H+"px"}const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.imageSmoothingEnabled=false;
  for(let j=0;j<17;j++)for(let i=0;i<22;i++){x.fillStyle=(i+j)%2?"#1a1f2b":"#141823";x.fillRect(i*z,j*z,z,z)}
  x.drawImage(CE.cv,0,0,22,17,0,0,W,H);
  x.fillStyle="rgba(5,7,12,.55)";for(let j=0;j<17;j++)for(let i=0;i<22;i++)if(!CE_FACES.some(([,fx,fy,fw,fh])=>i>=fx&&i<fx+fw&&j>=fy&&j<fy+fh))x.fillRect(i*z,j*z,z,z);
  x.strokeStyle="rgba(255,255,255,.06)";x.lineWidth=1;x.beginPath();for(let i=1;i<22;i++){x.moveTo(i*z+.5,0);x.lineTo(i*z+.5,H)}for(let j=1;j<17;j++){x.moveTo(0,j*z+.5);x.lineTo(W,j*z+.5)}x.stroke();
  x.strokeStyle="rgba(255,255,255,.35)";for(const[,fx,fy,fw,fh]of CE_FACES)x.strokeRect(fx*z+.5,fy*z+.5,fw*z-1,fh*z-1)}
function cePreview(){if(!CE.cv)return;CS.img=texOf(CE.cv);CS.previewing=true}
function ceUndo(redo){const a=redo?CE.redo:CE.undo,b=redo?CE.undo:CE.redo;if(!a.length)return;const x=CE.cv.getContext("2d");b.push(x.getImageData(0,0,64,32));x.putImageData(a.pop(),0,0);ceDraw();cePreview();ceButtons()}
function setCapeTab(t){CS.tab=t;document.querySelectorAll("[data-cstab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.cstab===t)));$("#cs-lib").hidden=t!=="lib";$("#cs-make").hidden=t!=="make";
  if(t==="make"){ceLoad(CS.design);drawCapeMake()}else{CS.previewing=false;CS.img=null}}
async function initCapes(){await mcLoad();try{CS.mine=await CL.list()}catch(e){CS.mine=[]}if(!CAPE_BUILTIN[CS.design]&&!CS.mine.some(d=>d.id===CS.design))CS.design="aurora";cacheImages();drawCapeGrid();drawCapeGame();if(CS.tab==="make")setCapeTab("make");CS.sim=VX.CapeSim();CS.pos=0;CS.phase=0;CS.st=null;
const page=document.querySelector(".page"),err=()=>$("#cs-err");
page.onclick=async e=>{const t=e.target.closest("[data-cd],[data-cfav],[data-cdup],[data-cren],[data-cdel],[data-cstab],[data-cfilter],[data-cetool],[data-ceact],#ce-mirror,#cs-walk,#cs-sneak,#cs-reset,#cg-save,#cs-exp");if(!t)return;err().textContent="";
try{
if(t.dataset.cd)useDesign(t.dataset.cd);
else if(t.dataset.cstab)setCapeTab(t.dataset.cstab);
else if(t.dataset.cfilter){CS.filter=t.dataset.cfilter;ls.set("capeFilter",CS.filter);document.querySelectorAll("[data-cfilter]").forEach(b=>b.setAttribute("aria-pressed",String(b===t)));drawCapeGrid()}
else if(t.dataset.cfav){const i=CS.fav.indexOf(t.dataset.cfav);i<0?CS.fav.push(t.dataset.cfav):CS.fav.splice(i,1);ls.set("capeFav",CS.fav);drawCapeGrid()}
else if(t.dataset.cdup){const src=capeCanvas(t.dataset.cdup);await addDesign({id:newId(),name:(CAPE_BUILTIN[t.dataset.cdup]||[t.dataset.cdup])[0]+" copy",img:src.toDataURL("image/png"),source:"copy"})}
else if(t.dataset.cren){const d=CS.mine.find(x=>x.id===t.dataset.cren);promptDlg("Rename design","Design name",d.name,n=>{if(!n||n.length>32)return"Give it a name (up to 32 characters).";d.name=n;CL.rename(d.id,n).catch(x=>toast(errMsg(x),"err"));drawCapeGrid()})}
else if(t.dataset.cdel){const d=CS.mine.find(x=>x.id===t.dataset.cdel);confirmDlg(`Delete “${d.name}”?`,"This removes the cape from your library on this computer.","Delete",async()=>{try{await CL.remove(d.id)}catch(x){return toast(errMsg(x),"err")}CS.mine=CS.mine.filter(x=>x!==d);if(CS.design===d.id)useDesign("aurora");else drawCapeGrid()})}
else if(t.dataset.cetool){CE.tool=t.dataset.cetool;drawCapeMake()}
else if(t.dataset.ceact==="undo"||t.dataset.ceact==="redo")ceUndo(t.dataset.ceact==="redo");
else if(t.dataset.ceact==="revert"){ceLoad(CE.from||CS.design);drawCapeMake()}
else if(t.dataset.ceact==="update"){const d=CS.mine.find(x=>x.id===CE.from);if(d){d.img=CE.cv.toDataURL("image/png");await CL.save(d);delete CS.imgWait[d.id];delete CS.imgCache[d.id];cacheImages();await CS.imgWait[d.id];toast("Saved “"+d.name+"”","ok");drawCapeGrid()}}
else if(t.id==="ce-mirror"){CE.mirror=!CE.mirror;t.setAttribute("aria-checked",CE.mirror)}
else if(t.id==="cs-walk"){CS.walk=!CS.walk;t.setAttribute("aria-checked",CS.walk)}else if(t.id==="cs-sneak"){CS.sneak=!CS.sneak;t.setAttribute("aria-checked",CS.sneak)}
else if(t.id==="cs-reset"){CS.yaw=Math.PI*0.82;CS.pitch=0.12;CS.dist=78}
else if(t.id==="cg-save"){const png=CE.cv.toDataURL("image/png");promptDlg("Save design","Design name","My cape",n=>{if(!n||n.length>32)return"Give it a name (up to 32 characters).";const d={id:newId(),name:n,img:png,source:"made"};addDesign(d).then(()=>{CE.from=d.id;drawCapeMake();toast("Saved “"+n+"” to your library","ok")}).catch(x=>{err().textContent=errMsg(x)})})}
else if(t.id==="cs-exp"){const c=CS.tab==="make"&&CE.cv?CE.cv:await capeCanvasReady(CS.design);c.toBlob(b=>saveBlob("cape-"+(CS.tab==="make"?"edited":CS.design)+".png",b),"image/png")}
}catch(x){err().textContent=errMsg(x)}};
page.onkeydown=e=>{if(CS.tab==="make"&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();ceUndo(e.shiftKey)}};
$("#cs-stride").oninput=e=>{CS.stride=+e.target.value;ls.set("capeStride",CS.stride);const p=capePace(CS.stride);e.target.style.setProperty("--fill",fillPct(CS.stride,0,1)+"%");e.target.setAttribute("aria-valuetext",p);$("#cs-pace").textContent=p};
$("#cs-imp").onchange=async e=>{const fs=[...e.target.files];e.target.value="";if(fs.length)await importCapes(fs)};
const dz=$("#cs-drop");dz.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#cs-imp").click()}};dz.ondragover=e=>{e.preventDefault();dz.classList.add("over")};dz.ondragleave=()=>dz.classList.remove("over");
dz.ondrop=async e=>{e.preventDefault();dz.classList.remove("over");const fs=[...(e.dataTransfer?.files||[])];if(fs.length)await importCapes(fs)};
if(!CE.rs){CE.rs=1;window.addEventListener("resize",()=>ceDraw())}
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
