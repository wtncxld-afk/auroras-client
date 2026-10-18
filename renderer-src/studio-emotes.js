/* ----- Emotes: library, emote wheel and creator. Same format, timing and blending as the game (client-mod/core Emotes). ----- */
const EMOTE_LIB=VX.parseEmoteLibrary(AURORAS_EMOTES),EPARTS=VX.EMOTE_PARTS,EPART_LABEL={head:"Head",body:"Body",rightArm:"Right arm",leftArm:"Left arm",rightLeg:"Right leg",leftLeg:"Left leg",root:"Whole body (height)"};
const ES={tab:"library",q:"",cat:"All",sel:"wave",repeat:true,speed:1,yaw:0.45,pitch:0.1,dist:84,custom:[],errors:[],wheel:new Array(8).fill(null),slot:null,fav:ls.get("emoteFav",[]),recent:ls.get("emoteRecent",[]),
  ctrl:VX.EmoteController(),pose:new Float64Array(28),w:new Float64Array(28),wt:new Float64Array(7),endAt:0,raf:0,skin:null,skinKey:"",
  draft:null,hist:[],fut:[],part:"rightArm",key:null,head:0,cplay:false,cerr:"",lastValid:null,thumbT:0};
const EMOTE_MOD=()=>REG.modules.find(m=>m.id==="emotes");
const allEmotes=()=>[...EMOTE_LIB,...ES.custom];
const emoteById=id=>allEmotes().find(e=>e.id===id);
PAGES.emotes=()=>`<div class="page" style="max-width:1160px"><div class="head"><h1>Emotes</h1><span class="tag" title="Emotes are drawn by Auroras on your own screen. Nothing is sent to the server or other players.">Local only: other players don’t see your emotes</span></div>
<div class="studio emstudio"><div><div class="stagebox" style="height:400px"><canvas id="em-cv" aria-label="Emote preview"></canvas><div class="vtag" id="em-tag"></div></div>
<div class="row2" id="em-ctrls"></div><small>Same keyframes, easing, timing and blending the game uses. Drag to turn the player; scroll to zoom. The skin comes from your selected account.</small>
<h2 style="margin-top:18px">Emote wheel</h2><div class="emwheel-wrap"><div class="emwheel" id="em-wheel" role="group" aria-label="Emote wheel slots"></div><div id="em-wheelinfo"></div></div></div>
<div><div class="chips" id="em-tabs" style="margin-bottom:12px">${[["library","Library"],["creator","Creator"]].map(([k,l])=>`<button class="chip" data-etab="${k}" aria-pressed="${ES.tab===k}">${l}</button>`).join("")}</div><div id="em-body"></div></div></div></div>`;

async function initEmotes(){const eb=$("#em-body");if(eb)eb.innerHTML=UI.state("loading","Loading emotes","Reading this instance’s custom emotes and wheel.");await mcLoad();await loadCustomEmotes();if(!$("#em-body"))return;if(!ES.draft)newDraft();drawEmoteTab();drawWheel();drawEmCtrls();
  document.getElementById("em-tabs").onclick=e=>{const b=e.target.closest("[data-etab]");if(!b)return;ES.tab=b.dataset.etab;ES.cplay=false;document.querySelectorAll("#em-tabs .chip").forEach(c=>c.setAttribute("aria-pressed",c===b));drawEmoteTab();drawEmCtrls()};
  const cv=$("#em-cv");let drag=null;cv.onpointerdown=e=>{drag=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(!drag)return;ES.yaw-=(e.clientX-drag[0])*0.01;ES.pitch=Math.max(-0.4,Math.min(0.8,ES.pitch+(e.clientY-drag[1])*0.005));drag=[e.clientX,e.clientY]};
  cv.onpointerup=cv.onpointercancel=()=>{drag=null};cv.onwheel=e=>{e.preventDefault();ES.dist=Math.max(40,Math.min(160,ES.dist+e.deltaY*0.05))};
  playEmote(ES.sel,false);let last=0;const loop=ts=>{if(!cv.isConnected)return;ES.raf=requestAnimationFrame(loop);if(studioPaused()||ts-last<(UNFOCUSED?100:16))return;const dt=last?Math.min(0.1,(ts-last)/1000):0;last=ts;emFrame(cv,ts/1000,dt)};ES.raf=requestAnimationFrame(loop)}
POST.emotes=initEmotes;

/* storage: per instance in the desktop app (config/auroras/emotes, read by the mod); this browser only in the web preview */
async function loadCustomEmotes(){let r;try{r=isDesk()&&auroras.emotesList?await auroras.emotesList(cur().id):{custom:ls.get("customEmotes",[]),errors:[],wheel:ls.get("emoteWheel",null)}}catch(e){r={custom:[],errors:[errMsg(e)],wheel:null}}applyEmoteList(r)}
function applyEmoteList(r){const ok=[],errs=[...(r.errors||[])];for(const j of r.custom||[]){try{ok.push({...VX.parseEmote(j),category:"Custom"})}catch(e){errs.push(e.message)}}ES.custom=ok;ES.errors=errs;
  const known=new Set(allEmotes().map(e=>e.id));ES.wheel=(r.wheel&&r.wheel.length===8?r.wheel:["wave","clap","cheer","groove","bow","shrug","point","sit"]).map(id=>id&&known.has(id)?id:null)}
async function saveWheel(slots){if(isDesk()&&auroras.emotesWheel)applyEmoteList(await auroras.emotesWheel({id:cur().id,slots}));else{ls.set("emoteWheel",slots);ES.wheel=slots.slice()}}
async function storeEmote(json){const em=VX.parseEmote(json);if(EMOTE_LIB.some(e=>e.id===em.id))throw new Error("“"+em.id+"” is a built-in emote. Pick another id.");
  if(isDesk()&&auroras.emotesSave)applyEmoteList(await auroras.emotesSave({id:cur().id,emote:VX.emoteToJson({...em,category:"Custom"})}));
  else{const list=ls.get("customEmotes",[]).filter(j=>j.id!==em.id);list.push(VX.emoteToJson({...em,category:"Custom"}));ls.set("customEmotes",list);applyEmoteList({custom:list,wheel:ES.wheel})}}
async function removeEmote(id){if(isDesk()&&auroras.emotesDelete)applyEmoteList(await auroras.emotesDelete({id:cur().id,emoteId:id}));
  else{const list=ls.get("customEmotes",[]).filter(j=>j.id!==id);ls.set("customEmotes",list);const w=ES.wheel.map(x=>x===id?null:x);ls.set("emoteWheel",w);applyEmoteList({custom:list,wheel:w})}}

function playEmote(id,remember=true){const em=emoteById(id);if(!em)return;ES.sel=id;ES.endAt=0;ES.ctrl.setSpeed(ES.speed);ES.ctrl.setBlend(+((mcVals()||{})["emotes.blend"]??0.2));ES.ctrl.play(em,performance.now()/1000);
  if(remember){ES.recent=[id,...ES.recent.filter(x=>x!==id)].slice(0,8);ls.set("emoteRecent",ES.recent)}}

function drawEmCtrls(){const c=$("#em-ctrls");if(!c)return;
  if(ES.tab==="library")c.innerHTML=`<button class="btn" data-ec="replay">Play again</button><button class="btn" data-ec="stop">Stop</button><label style="display:flex;gap:8px;align-items:center"><button class="tg" role="switch" data-ec="repeat" aria-checked="${ES.repeat}" aria-label="Repeat"></button><small>Repeat</small></label>
    ${emSpeedCtl()}<button class="btn" data-ec="cam">Reset camera</button>`;
  else c.innerHTML=`<button class="btn" data-ec="cplay">${ES.cplay?"Pause":"Play"}</button><button class="btn" data-ec="start">To start</button>${emSpeedCtl()}<button class="btn" data-ec="cam">Reset camera</button>`;
  c.onclick=e=>{const b=e.target.closest("[data-ec]");if(!b)return;const a=b.dataset.ec;
    if(a==="replay")playEmote(ES.sel,false);else if(a==="stop"){ES.repeat=false;ES.ctrl.cancel(performance.now()/1000,"stopped");drawEmCtrls()}
    else if(a==="repeat"){ES.repeat=!ES.repeat;b.setAttribute("aria-checked",ES.repeat)}else if(a==="cam"){ES.yaw=0.45;ES.pitch=0.1;ES.dist=84}
    else if(a==="cplay"){ES.cplay=!ES.cplay;const d=curDraft();if(ES.cplay&&d&&ES.head>=d.duration)ES.head=0;drawEmCtrls()}else if(a==="start"){ES.head=0;drawTimeline();drawKeyPanel()}};
  kitWire(c,r=>{if(r.id!=="em-speed")return;ES.speed=+r.value;ES.ctrl.setSpeed(ES.speed)})}
/** Playback speed: the shared slider (filled track, typed value), 0.25x to 3x. */
const emSpeedCtl=()=>`<span class="emspeed" style="display:flex;gap:8px;align-items:center;min-width:240px"><label for="em-speed"><small>Speed</small></label>${UI.range("",{min:0.25,max:3,step:0.05,value:ES.speed,id:"em-speed",aria:"Playback speed",suffix:"×"})}</span>`;

/* ---- library ---- */
function drawEmoteTab(){const b=$("#em-body");if(!b)return;if(ES.tab==="creator")return drawEmoteCreator(b);
  const cats=["All","Favorites","Recent",...VX.EMOTE_CATEGORIES],m=EMOTE_MOD(),vals=mcVals()||{},on=vals["emotes.enabled"]==="true";
  b.innerHTML=`<div class="panel" style="padding:10px 14px;margin-bottom:12px"><div class="set" style="padding:0;border:0"><div><b style="font-weight:500">Emotes in game</b><br><small>${on?"On":"Off"} in ${esc(cur().name)} · ${availTag(m)} · Hold <kbd>${esc(keyName2(vals["emotes.wheelKey"]||66))}</kbd> for the wheel</small></div><button class="tg" role="switch" id="em-on" aria-checked="${on}" aria-label="Emotes on or off"></button></div>
  <small style="display:block;margin-top:8px">Emotes play on your own screen with the Auroras mod for Minecraft 1.21.4, which hasn’t been tested in a real game yet. Other players see you standing normally: there’s no emote sync between players.</small></div>
  <div class="search" style="margin-bottom:8px">${ic("search")}<input class="f" id="em-q" placeholder="Search emotes" aria-label="Search emotes" value="${esc(ES.q)}"></div>
  <div class="chips" id="em-cats" style="margin-bottom:10px">${cats.map(c=>`<button class="chip" data-ecat="${c}" aria-pressed="${ES.cat===c}">${c}</button>`).join("")}</div><div class="emgrid" id="em-grid"></div><div id="em-detail"></div>
  ${ES.errors.length?`<div class="note-inline" role="alert" style="margin-top:8px">${ic("alert",14)}<span>${ES.errors.length===1?"One custom emote":ES.errors.length+" custom emotes"} couldn’t be loaded and ${ES.errors.length===1?"was":"were"} skipped: ${ES.errors.map(esc).join("; ")}</span></div>`:""}`;
  $("#em-q").oninput=e=>{ES.q=e.target.value;drawGrid()};
  $("#em-cats").onclick=e=>{const c=e.target.closest("[data-ecat]");if(!c)return;ES.cat=c.dataset.ecat;document.querySelectorAll("#em-cats .chip").forEach(x=>x.setAttribute("aria-pressed",x===c));drawGrid()};
  $("#em-on").onclick=async e=>{const v=e.currentTarget.getAttribute("aria-checked")!=="true";try{await mcSave({"emotes.enabled":String(v)});toast("Emotes "+(v?"on":"off")+" for "+cur().name+". The game reads this when it starts.");drawEmoteTab()}catch(err){toast(errMsg(err))}};
  drawGrid()}
function filteredEmotes(){const q=ES.q.trim().toLowerCase();let l=allEmotes();
  if(ES.cat==="Favorites")l=l.filter(e=>ES.fav.includes(e.id));else if(ES.cat==="Recent")l=ES.recent.map(emoteById).filter(Boolean);else if(ES.cat!=="All")l=l.filter(e=>e.category===ES.cat);
  return q?l.filter(e=>e.name.toLowerCase().includes(q)||e.id.includes(q)||e.category.toLowerCase().includes(q)):l}
function drawGrid(){const g=$("#em-grid");if(!g)return;const l=filteredEmotes();
  g.innerHTML=l.length?l.map(e=>`<div class="emcard${e.id===ES.sel?" on":""}"><button class="pbtn" data-esel="${e.id}" aria-pressed="${e.id===ES.sel}"><canvas width="72" height="72" data-ethumb="${e.id}" aria-hidden="true"></canvas><span>${esc(e.name)}</span><small>${esc(e.category)} · ${e.duration}s${e.loop?" · loops":""}</small></button><button class="ibtn sm star emfav${ES.fav.includes(e.id)?" on":""}" data-efav="${e.id}" aria-pressed="${ES.fav.includes(e.id)}" aria-label="${ES.fav.includes(e.id)?"Remove "+esc(e.name)+" from":"Add "+esc(e.name)+" to"} favorites">${ic("star",14)}</button></div>`).join("")
    :`<div style="grid-column:1/-1">${ES.cat==="Custom"?UI.state("empty","No custom emotes yet","Make your own in the Creator, or import an emote file.",{label:"Open the Creator",attrs:'data-gocreator'},"sparkles"):ES.cat==="Favorites"?UI.state("empty","No favorites yet","Star an emote to keep it here.",null,"star"):ES.cat==="Recent"?UI.state("empty","Nothing played yet","Emotes you preview show up here.",null,"clock"):UI.state("empty","No emotes match","Try another search or category.")}</div>`;
  g.onclick=e=>{if(e.target.closest("[data-gocreator]")){ES.tab="creator";document.querySelectorAll("#em-tabs .chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.etab==="creator"));drawEmoteTab();drawEmCtrls();return}const f=e.target.closest("[data-efav]");if(f){const id=f.dataset.efav;ES.fav=ES.fav.includes(id)?ES.fav.filter(x=>x!==id):[...ES.fav,id];ls.set("emoteFav",ES.fav);drawGrid();return}
    const s=e.target.closest("[data-esel]");if(s){playEmote(s.dataset.esel);drawGrid()}};
  drawDetail();drawThumbs(0)}
function drawDetail(){const d=$("#em-detail"),em=emoteById(ES.sel);if(!d||!em)return;const custom=em.category==="Custom",slot=ES.wheel.indexOf(em.id);
  d.innerHTML=`<div class="panel" style="padding:12px 14px;margin-top:12px"><b style="font-weight:500">${esc(em.name)}</b> <small>${esc(em.category)} · ${em.duration}s · ${em.loop?"loops until you move or press the key again":"plays once"} · animates ${EPARTS.filter((p,i)=>em.keys[i].length).map(p=>EPART_LABEL[p].toLowerCase()).join(", ")}</small>
  <div class="row2"><button class="btn pri" data-ed="assign">${slot>=0?"On wheel slot "+(slot+1):"Add to wheel"}</button><button class="btn" data-ed="copy">${custom?"Edit":"Edit a copy"}</button><button class="btn" data-ed="export">Export</button>${custom?`<button class="btn" data-ed="del">Delete</button>`:""}</div></div>`;
  d.onclick=async e=>{const b=e.target.closest("[data-ed]");if(!b)return;const a=b.dataset.ed;
    if(a==="assign"){const i=ES.slot!=null?ES.slot:ES.wheel.indexOf(null);if(i<0)return toast("The wheel is full. Click a slot on the wheel to choose which one to replace.");const w=ES.wheel.slice();const old=w.indexOf(em.id);if(old>=0&&old!==i)w[old]=null;w[i]=em.id;try{await saveWheel(w);ES.slot=null;toast(em.name+" is on wheel slot "+(i+1));drawWheel();drawDetail()}catch(err){toast(errMsg(err))}}
    else if(a==="copy"){loadDraft(custom?VX.emoteToJson(em):{...VX.emoteToJson(em),id:uniqueId(em.id+"_copy"),name:(em.name+" copy").slice(0,32),category:"Custom"});ES.tab="creator";document.querySelectorAll("#em-tabs .chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.etab==="creator"));drawEmoteTab();drawEmCtrls()}
    else if(a==="export")saveBlob(em.id+".json",new Blob([VX.emoteFileText(em)],{type:"application/json"}));
    else if(a==="del")confirmDlg(`Delete “${em.name}”?`,"This removes the custom emote from this instance, and from the wheel.","Delete",async()=>{try{await removeEmote(em.id);ES.sel="wave";playEmote("wave",false);drawEmoteTab();drawWheel()}catch(err){toast(errMsg(err))}})}}
function uniqueId(base){base=base.toLowerCase().replace(/[^a-z0-9_]/g,"_").slice(0,28)||"emote";let id=base,n=2;while(emoteById(id))id=(base.slice(0,28-String(n).length)+"_"+n++);return id}
const THUMB_POSE=new Float64Array(28);
function drawHub(now){const c=document.querySelector(".whubcv");if(!c)return;const id=ES.slot!=null?ES.wheel[ES.slot]:ES.sel,em=id&&emoteById(id),x=c.getContext("2d");if(!em){x.clearRect(0,0,c.width,c.height);return}
  const lt=em.loop?now%em.duration:Math.min(now%(em.duration+0.6),em.duration);VX.emotePose(em,lt,THUMB_POSE);PV.render(x,c.width,c.height,PV.posedPlayer(null,THUMB_POSE,{colors:[0xd9a066,0x6fe3ff,0xc8925a,0x34406b]}),{yaw:0.5,pitch:0.12,dist:74,target:[0,15,0],fov:30},{light:"studio",background:false})}
function drawThumbs(now){document.querySelectorAll("[data-ethumb]").forEach(c=>{const em=emoteById(c.dataset.ethumb);if(!em)return;const lt=em.loop?now%em.duration:Math.min(now%(em.duration+0.6),em.duration);VX.emotePose(em,lt,THUMB_POSE);
  const q=PV.posedPlayer(null,THUMB_POSE,{colors:[0xd9a066,em.category==="Custom"?0xb58cff:0x6fe3ff,0xc8925a,0x34406b]});PV.render(c.getContext("2d"),c.width,c.height,q,{yaw:0.5,pitch:0.12,dist:70,target:[0,15,0],fov:30},{light:"studio",background:false})})}

/* ---- wheel ---- */
/* Radial wheel, drawn like the in-game one: 8 ring segments clockwise from the top, a live mini preview in the hub. */
const WHEEL_SEG=(i,ro,ri)=>{const a0=(i*45-22.5+1.6)*Math.PI/180,a1=(i*45+22.5-1.6)*Math.PI/180,P=(r,a)=>[(120+Math.sin(a)*r).toFixed(2),(120-Math.cos(a)*r).toFixed(2)];
  const [x0,y0]=P(ro,a0),[x1,y1]=P(ro,a1),[x2,y2]=P(ri,a1),[x3,y3]=P(ri,a0);return `M${x0} ${y0}A${ro} ${ro} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 0 0 ${x3} ${y3}Z`};
function drawWheel(){const w=$("#em-wheel");if(!w)return;const hub=ES.slot!=null?(ES.wheel[ES.slot]?emoteById(ES.wheel[ES.slot]):null):null;
  w.innerHTML=`<svg viewBox="0 0 240 240" class="wsvg" aria-hidden="false">${ES.wheel.map((id,i)=>{const em=id&&emoteById(id),a=i*Math.PI/4,lx=120+Math.sin(a)*84,ly=120-Math.cos(a)*84;
    return `<g class="wseg${ES.slot===i?" on":""}${em?"":" empty"}" data-slot="${i}" role="button" tabindex="0" aria-pressed="${ES.slot===i}" aria-label="Slot ${i+1}: ${em?esc(em.name):"empty"}"><path d="${WHEEL_SEG(i,116,54)}"/>
    <text x="${lx.toFixed(1)}" y="${(ly-7).toFixed(1)}" class="wn">${i+1}</text><text x="${lx.toFixed(1)}" y="${(ly+7).toFixed(1)}" class="wl">${em?esc(em.name.length>11?em.name.slice(0,10)+"…":em.name):"Empty"}</text></g>`}).join("")}
    <circle cx="120" cy="120" r="50" class="whub"/></svg><canvas class="whubcv" width="84" height="84" aria-hidden="true"></canvas><div class="whubtxt">${ES.slot!=null?`Slot ${ES.slot+1}${hub?"":" · empty"}`:`Hold ${esc(keyName2((mcVals()||{})["emotes.wheelKey"]||66))}`}</div>`;
  $("#em-wheelinfo").innerHTML=`<small>${ES.slot!=null?`Choose an emote in the library, then <b>Add to wheel</b>. <button class="btn" data-wc="clear" style="height:24px;padding:0 8px">Empty this slot</button> <button class="btn" data-wc="done" style="height:24px;padding:0 8px">Done</button>`:"Click a slot to change it. In game, hold the wheel key, point at an emote and let go to play it; moving cancels it."}</small><br><small>${isDesk()?"Saved for "+esc(cur().name)+"; the game reads it when it starts.":"Web preview: saved in this browser only."}</small>`;
  w.onkeydown=e=>{const g=e.target.closest("[data-slot]");if(!g)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();g.dispatchEvent(new MouseEvent("click",{bubbles:true}))}else if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();const n=(+g.dataset.slot+(e.key==="ArrowRight"?1:7))%8;w.querySelector(`[data-slot="${n}"]`).focus()}};
  w.onclick=e=>{const b=e.target.closest("[data-slot]");if(!b)return;const i=+b.dataset.slot;ES.slot=ES.slot===i?null:i;if(ES.slot!=null&&ES.wheel[i]){playEmote(ES.wheel[i],false);if(ES.tab==="library")drawGrid()}drawWheel();if(ES.tab==="library")drawDetail()};
  $("#em-wheelinfo").onclick=async e=>{const b=e.target.closest("[data-wc]");if(!b)return;if(b.dataset.wc==="clear"){const w2=ES.wheel.slice();w2[ES.slot]=null;try{await saveWheel(w2)}catch(err){toast(errMsg(err))}}ES.slot=null;drawWheel();if(ES.tab==="library")drawDetail()}}

/* ---- preview ---- */
function emSkin(){const a=curAcct(),key=a?a.uuid+":"+(a.skin?a.skin.length:0):"default";if(ES.skinKey!==key){ES.skinKey=key;ES.skin=null;const done=img=>{try{ES.skin=texOf(img?skinCanvas(img):defaultSkin())}catch(e){ES.skin=texOf(defaultSkin())}};if(a&&a.skin){const im=new Image();im.onload=()=>done(im);im.onerror=()=>done(null);im.src=a.skin}else done(null)}return ES.skin}
function emFrame(cv,now,dt){const W=cv.clientWidth|0,H=cv.clientHeight|0;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const ctx=cv.getContext("2d"),skin=emSkin(),a=curAcct();if(!skin)return;let label="";
  if(ES.tab==="creator"){const d=curDraft();if(ES.cplay&&d&&!REDUCED()){ES.head+=dt*ES.speed;if(ES.head>d.duration){if(d.loop)ES.head%=d.duration;else{ES.head=d.duration;ES.cplay=false;drawEmCtrls()}}drawTimeline()}
    if(d){VX.emotePose(d,Math.min(ES.head,d.duration),ES.pose);ES.wt.fill(1)}else{ES.pose.fill(0)}label=(d?esc(d.name):"Invalid emote")+" · "+ES.head.toFixed(2)+"s"}
  else{ES.ctrl.update(now);if(!ES.ctrl.playing()&&ES.repeat&&!REDUCED()){if(!ES.endAt)ES.endAt=now;else if(now-ES.endAt>0.6)playEmote(ES.sel,false)}ES.ctrl.sample(now,ES.w,ES.wt);for(let i=0;i<28;i++)ES.pose[i]=ES.w[i]*ES.wt[i>>2];
    const em=emoteById(ES.sel);label=em?esc(em.name)+(ES.ctrl.playing()?"":ES.ctrl.lastEnd==="finished"?" · finished":" · stopped"):""}
  const q=PV.posedPlayer(skin,ES.pose,{slim:!!(a&&a.model==="slim")});PV.render(ctx,W,H,q,{yaw:ES.yaw,pitch:ES.pitch,dist:ES.dist,target:[0,16,0],fov:30},{light:"studio",shadow:{y:0,r:9}});
  const tag=$("#em-tag");if(tag&&tag.textContent!==label)tag.textContent=label;
  if(now-ES.thumbT>1/12){ES.thumbT=now;if(ES.tab==="library")drawThumbs(now);drawHub(now)}}

/* ---- creator ---- */
const blankEmote=()=>({id:uniqueId("my_emote"),name:"My emote",category:"Custom",duration:2,loop:false,keys:{rightArm:[{t:0},{t:1,p:-120,e:"easeInOut"},{t:2,e:"easeInOut"}]}});
function newDraft(){loadDraft(blankEmote())}
function loadDraft(json){ES.draft=JSON.parse(JSON.stringify(json));ES.hist=[];ES.fut=[];ES.key=null;ES.head=0;ES.cerr="";ES.part=Object.keys(json.keys||{})[0]||"rightArm";validateDraft()}
function validateDraft(){try{ES.lastValid=VX.parseEmote(ES.draft);ES.cerr=""}catch(e){ES.cerr=e.message}}
const curDraft=()=>ES.lastValid;
function edit(fn){ES.hist.push(JSON.stringify(ES.draft));if(ES.hist.length>100)ES.hist.shift();ES.fut=[];fn(ES.draft);validateDraft();drawTimeline();drawKeyPanel();drawCreatorHead()}
function undo(){if(!ES.hist.length)return;ES.fut.push(JSON.stringify(ES.draft));ES.draft=JSON.parse(ES.hist.pop());ES.key=null;validateDraft();drawEmoteCreator($("#em-body"))}
function redo(){if(!ES.fut.length)return;ES.hist.push(JSON.stringify(ES.draft));ES.draft=JSON.parse(ES.fut.pop());ES.key=null;validateDraft();drawEmoteCreator($("#em-body"))}
const partKeys=(p=ES.part)=>ES.draft.keys[p]||[];
function drawEmoteCreator(b){if(!b)return;const d=ES.draft;
  b.innerHTML=`<div id="ec-head"></div><div class="panel setlist" style="margin-bottom:10px"><div class="set"><label for="ec-name">Name</label><input class="f" id="ec-name" maxlength="32" value="${esc(d.name)}" style="max-width:220px"></div>
  <div class="set"><label for="ec-id">File id</label><input class="f" id="ec-id" maxlength="32" value="${esc(d.id)}" style="max-width:220px" spellcheck="false"></div>
  <div class="set"><label for="ec-dur">Duration (s)</label><input class="f" type="number" id="ec-dur" min="0.1" max="30" step="0.1" value="${d.duration}" style="max-width:100px"></div>
  <div class="set"><div>Loop<br><small>Looping emotes play until you move or press the key again.</small></div><button class="tg" role="switch" id="ec-loop" aria-checked="${d.loop}" aria-label="Loop"></button></div></div>
  <div class="chips" id="ec-parts" style="margin-bottom:8px">${EPARTS.map(p=>`<button class="chip" data-part="${p}" aria-pressed="${ES.part===p}">${EPART_LABEL[p]}</button>`).join("")}</div>
  <div class="stagebox" style="height:150px;cursor:pointer"><canvas id="ec-tl" aria-label="Timeline: click to move the playhead, click a keyframe to select it"></canvas></div>
  <div class="row2"><button class="btn" data-cc="add">Add keyframe at playhead</button><button class="btn" data-cc="delk">Delete keyframe</button><button class="btn" data-cc="undo" aria-label="Undo">Undo</button><button class="btn" data-cc="redo" aria-label="Redo">Redo</button></div>
  <div id="ec-key"></div><div class="err" id="ec-err" role="alert"></div>
  <div class="row2" style="justify-content:flex-end"><button class="btn" data-cc="new">New</button><label class="btn" style="cursor:pointer">Import<input type="file" id="ec-imp" accept=".json,application/json" hidden></label><button class="btn" data-cc="export">Export</button><button class="btn pri" data-cc="save">Save emote</button></div>
  <small style="display:block;margin-top:6px">${isDesk()?"Saved into "+esc(cur().name)+"’s emotes folder, which the game reads when it starts.":"Web preview: saved in this browser only."} Angles follow Minecraft’s model: negative pitch raises a limb forward; positive roll swings the right arm out, negative the left.</small>`;
  const fld=(id,fn)=>{$(id).onchange=e=>edit(d2=>fn(d2,e.target))};
  fld("#ec-name",(d2,t)=>{d2.name=t.value});fld("#ec-id",(d2,t)=>{d2.id=t.value.trim()});fld("#ec-dur",(d2,t)=>{d2.duration=+t.value});
  $("#ec-loop").onclick=e=>{const v=e.currentTarget.getAttribute("aria-checked")!=="true";e.currentTarget.setAttribute("aria-checked",v);edit(d2=>{d2.loop=v})};
  $("#ec-parts").onclick=e=>{const c=e.target.closest("[data-part]");if(!c)return;ES.part=c.dataset.part;ES.key=null;document.querySelectorAll("#ec-parts .chip").forEach(x=>x.setAttribute("aria-pressed",x===c));drawTimeline();drawKeyPanel()};
  b.querySelector(".row2").onclick=b.querySelectorAll(".row2")[1].onclick=async e=>{const t=e.target.closest("[data-cc]");if(!t)return;const a=t.dataset.cc;
    if(a==="add")addKey();else if(a==="delk"){if(ES.key==null)return toast("Select a keyframe on the timeline first.");edit(d2=>{const l=d2.keys[ES.part];l.splice(ES.key,1);if(!l.length)delete d2.keys[ES.part]});ES.key=null;drawKeyPanel();drawTimeline()}
    else if(a==="undo")undo();else if(a==="redo")redo();else if(a==="new"){newDraft();drawEmoteCreator(b)}
    else if(a==="export"){if(!curDraft()||ES.cerr)return toast("Fix the problem shown before exporting.");saveBlob(curDraft().id+".json",new Blob([VX.emoteFileText(curDraft())],{type:"application/json"}))}
    else if(a==="save"){if(ES.cerr)return toast("Fix the problem shown before saving.");try{await storeEmote(ES.draft);toast("Saved “"+ES.draft.name+"”"+(isDesk()?" for "+cur().name:""));ES.sel=ES.draft.id;drawWheel()}catch(err){ES.cerr=errMsg(err);drawCreatorHead()}}};
  $("#ec-imp").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{if(f.size>65536)throw new Error("That file is too large to be an emote.");const em=VX.parseEmoteFile(await f.text());loadDraft({...VX.emoteToJson(em),category:"Custom"});drawEmoteCreator(b);toast("Imported “"+em.name+"”. Save it to keep it.")}catch(x){toast(errMsg(x))}};
  const tl=$("#ec-tl");tl.onclick=e=>{const r=tl.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,L=tlLayout(tl);const row=Math.floor((y-L.top)/L.rowH);
    if(row>=0&&row<EPARTS.length){const p=EPARTS[row],ks=ES.draft.keys[p]||[];const hit=ks.findIndex(k=>Math.abs(L.x(k.t)-x)<6);if(hit>=0){ES.part=p;ES.key=hit;ES.head=ks[hit].t;document.querySelectorAll("#ec-parts .chip").forEach(c=>c.setAttribute("aria-pressed",c.dataset.part===p));drawTimeline();drawKeyPanel();return}}
    ES.head=Math.max(0,Math.min(curDraft()?curDraft().duration:ES.draft.duration,(x-L.left)/L.w*(curDraft()?curDraft().duration:ES.draft.duration)));ES.key=null;drawTimeline();drawKeyPanel()};
  drawCreatorHead();drawTimeline();drawKeyPanel()}
function drawCreatorHead(){const h=$("#ec-err");if(h)h.textContent=ES.cerr?"Can’t use this emote yet: "+ES.cerr:""}
function addKey(){const p=ES.part,d=curDraft(),pi=EPARTS.indexOf(p),tmp=new Float64Array(28);if(d)VX.emotePose(d,ES.head,tmp);const t=Math.round(ES.head*100)/100;
  const ks=partKeys();if(ks.some(k=>Math.abs(k.t-t)<0.005))return toast("There’s already a keyframe here for "+EPART_LABEL[p].toLowerCase()+".");
  const k=p==="root"?{t,oy:Math.round(tmp[pi*4+3]*10)/10}:{t,p:Math.round(tmp[pi*4]),y:Math.round(tmp[pi*4+1]),r:Math.round(tmp[pi*4+2])};for(const f of["p","y","r","oy"])if(k[f]===0)delete k[f];
  edit(d2=>{const l=d2.keys[p]||(d2.keys[p]=[]);l.push(k);l.sort((a,b)=>a.t-b.t)});ES.key=(ES.draft.keys[p]||[]).findIndex(x=>x.t===t);drawTimeline();drawKeyPanel()}
function drawKeyPanel(){const el=$("#ec-key");if(!el)return;const ks=partKeys(),k=ES.key!=null?ks[ES.key]:null;
  if(!k){el.innerHTML=`<small>${ks.length?ks.length+" keyframe"+(ks.length>1?"s":"")+" on "+EPART_LABEL[ES.part].toLowerCase()+". Click one on the timeline to edit it.":"No keyframes on "+EPART_LABEL[ES.part].toLowerCase()+" yet. Move the playhead and add one."}</small>`;return}
  // Shared slider rows (filled track plus a typed value, clamped to the range), like every other settings panel.
  const sl=(f,lab,min,max,step)=>{const v=k[f]||0;return `<div class="srow sl" data-row="${f}"><div class="lab"><label for="ek-${f}">${lab}</label></div><div class="ctl"><input class="num" type="number" min="${min}" max="${max}" step="${step}" value="${esc(fmtNum(v,step))}" aria-label="${lab} value" data-numfor="ek-${f}"></div><input type="range" class="rng" id="ek-${f}" data-kf="${f}" min="${min}" max="${max}" step="${step}" value="${v}" style="--fill:${fillPct(v,min,max)}%" aria-label="${lab}"></div>`};
  const dur=curDraft()?curDraft().duration:+ES.draft.duration||30;
  el.innerHTML=`<div class="panel">${ES.part==="root"?sl("oy","Height (pixels, negative is up)",-16,16,0.5):sl("p","Pitch (°)",-180,180,1)+sl("y","Yaw (°)",-180,180,1)+sl("r","Roll (°)",-180,180,1)}
  <div class="srow"><div class="lab"><label for="ek-t">Time (s)</label></div><div class="ctl"><input class="num" type="number" id="ek-t" data-kf="t" min="0" max="${dur}" step="0.01" value="${k.t}" style="width:72px"></div></div>
  <div class="srow"><div class="lab"><label for="ek-e">Easing into this keyframe</label></div><div class="ctl"><select class="f" id="ek-e" data-kf="e">${VX.EASINGS.map(x=>`<option${(k.e||"linear")===x?" selected":""}>${x}</option>`).join("")}</select></div></div></div>`;
  // One undo step per drag (or per typed value). While a value changes, the preview jumps to this keyframe and pauses,
  // so what you see is the pose you're editing.
  let pushed=false;
  kitWire(el,r=>{const f=r.dataset.kf;if(!f)return;const v=+r.value;if(!Number.isFinite(v))return;const kk=partKeys()[ES.key];if(!kk)return;
    if(!pushed){ES.hist.push(JSON.stringify(ES.draft));if(ES.hist.length>100)ES.hist.shift();ES.fut=[];pushed=true}
    if(v)kk[f]=v;else delete kk[f];if(ES.cplay){ES.cplay=false;drawEmCtrls()}ES.head=kk.t;validateDraft();drawCreatorHead();drawTimeline()});
  el.querySelectorAll("input.rng").forEach(r=>r.addEventListener("change",()=>{pushed=false}));
  el.onchange=e=>{const t=e.target.closest("[data-kf]");if(!t)return;const f=t.dataset.kf;
    if(f==="e")edit(()=>{const kk=partKeys()[ES.key];if(t.value==="linear")delete kk.e;else kk.e=t.value});
    else if(f==="t"){let v=+t.value;if(!Number.isFinite(v)){t.value=k.t;return}v=Math.round(Math.max(0,Math.min(dur,v))*100)/100;
      if(partKeys().some((x,i)=>i!==ES.key&&Math.abs(x.t-v)<0.005)){toast("There’s already a keyframe at "+v+" s for "+EPART_LABEL[ES.part].toLowerCase()+".");t.value=k.t;return}
      edit(d2=>{const l=d2.keys[ES.part],kk=l[ES.key];kk.t=v;l.sort((a,b)=>a.t-b.t);ES.key=l.indexOf(kk)});ES.head=v;drawTimeline();drawKeyPanel()}}}
const tlLayout=c=>{const left=86,right=12,top=8,rowH=(c.height-top-6)/EPARTS.length,d=curDraft()?curDraft().duration:Math.max(0.1,+ES.draft.duration||1),w=c.width-left-right;return{left,top,rowH,w,d,x:t=>left+t/d*w}};
function drawTimeline(){const c=$("#ec-tl");if(!c)return;const W=c.clientWidth|0,H=c.clientHeight|0;if(c.width!==W||c.height!==H){c.width=W;c.height=H}const x=c.getContext("2d"),L=tlLayout(c),cs=getComputedStyle(document.body);
  x.clearRect(0,0,W,H);x.font="11px system-ui,sans-serif";x.textBaseline="middle";
  EPARTS.forEach((p,i)=>{const y=L.top+i*L.rowH;if(p===ES.part){x.fillStyle="rgba(111,227,255,.08)";x.fillRect(0,y,W,L.rowH)}x.fillStyle=p===ES.part?cs.getPropertyValue("--text")||"#fff":cs.getPropertyValue("--mute")||"#999";x.fillText(EPART_LABEL[p].replace(" (height)",""),8,y+L.rowH/2);
    x.strokeStyle="rgba(255,255,255,.08)";x.beginPath();x.moveTo(L.left,y+L.rowH/2);x.lineTo(L.left+L.w,y+L.rowH/2);x.stroke();
    (ES.draft.keys[p]||[]).forEach((k,j)=>{const kx=L.x(Math.min(k.t,L.d)),ky=y+L.rowH/2,sel=p===ES.part&&j===ES.key;x.fillStyle=sel?"#6fe3ff":"#b58cff";x.beginPath();x.moveTo(kx,ky-5);x.lineTo(kx+5,ky);x.lineTo(kx,ky+5);x.lineTo(kx-5,ky);x.closePath();x.fill()})});
  for(let s=0;s<=L.d+1e-9;s+=L.d>6?1:0.5){const sx=L.x(s);x.fillStyle="rgba(255,255,255,.25)";x.fillRect(sx,H-5,1,5)}drawPlayhead()}
function drawPlayhead(){const c=$("#ec-tl");if(!c)return;const x=c.getContext("2d"),L=tlLayout(c),px=L.x(Math.min(ES.head,L.d));x.fillStyle="#ffffff";x.fillRect(Math.round(px),0,1.5,c.height)}
