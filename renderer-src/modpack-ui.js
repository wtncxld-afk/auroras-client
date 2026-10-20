/* ===== Import modpack: a Modrinth .mrpack from a file or straight from Modrinth, installed as a new instance =====
   The desktop app does the checking and downloading (modpack.js): this dialog only shows what's in the pack and the progress. */
const PK={tab:"file",step:"pick",q:"",list:[],total:0,off:0,loading:false,err:"",tok:0,pack:null,name:"",perr:"",prog:null,fetching:null,ready:false};
const fmtMB=b=>b>=1048576?(b/1048576).toFixed(b>=104857600?0:1)+" MB":b>=1024?Math.round(b/1024)+" KB":(b||0)+" B";
const pkUnique=n=>{let base=String(n||"Modpack").trim().slice(0,28)||"Modpack",out=base,i=2;while(INST.some(x=>x.name.toLowerCase()===out.toLowerCase()))out=`${base} (${i++})`;return out.slice(0,32)};
function openImport(){closePop();Object.assign(PK,{step:"pick",pack:null,name:"",perr:"",prog:null,fetching:null});
  if(DESK&&!PK.ready&&auroras.onModpackProgress){PK.ready=true;auroras.onModpackProgress(d=>{PK.prog=d;pkProg()})}
  pkDraw();if(PK.tab==="modrinth"&&!PK.list.length&&!PK.loading)pkSearch(true)}
function pkClose(){if(PK.step==="busy")return;const m=document.getElementById("pkmodal");if(m)m.remove();if(PK.pack&&DESK&&auroras.modpackDiscard)auroras.modpackDiscard(PK.pack.token).catch(()=>{});PK.pack=null}
async function pkSearch(reset){const tok=++PK.tok;if(reset){PK.off=0;PK.list=[];PK.total=0}PK.loading=true;PK.err="";pkList();
  try{const f=[["project_type:modpack"]],d=await http(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(PK.q)}&facets=${encodeURIComponent(JSON.stringify(f))}&limit=20&offset=${PK.off}&index=${PK.q?"relevance":"downloads"}`);
    if(tok!==PK.tok)return;const items=(d.hits||[]).map(h=>({id:String(h.project_id),slug:h.slug,name:String(h.title||"Modpack"),desc:String(h.description||""),author:h.author,icon:h.icon_url,dl:h.downloads,loaders:(h.categories||[]).filter(x=>["fabric","quilt","forge","neoforge"].includes(x)),mc:(h.versions||[]).slice(-1)[0]||""}));
    PK.list=PK.list.concat(items);PK.total=d.total_hits||0;PK.off+=items.length}
  catch(e){if(tok!==PK.tok)return;PK.err=DESK?errMsg(e):"This web preview can’t reach Modrinth. Run the desktop app to browse modpacks."}
  PK.loading=false;pkList()}
const LNAME={fabric:"Fabric",quilt:"Quilt",forge:"Forge",neoforge:"NeoForge"};
function pkRow(p){const im=p.icon?`<img class="mi" src="${esc(p.icon)}" alt="" loading="lazy" data-fb="${esc(p.name[0]||"?")}">`:`<span class="ico mi">${esc(p.name[0]||"?")}</span>`,busy=PK.fetching===p.id;
  return `<div class="row mrow pk-row">${im}<span class="min" style="flex:1"><b style="font-weight:500">${esc(p.name)} <small>by ${esc(p.author||"unknown")}</small></b><small>${esc(p.desc)}</small><span class="pk-tags">${p.mc?`<span class="tag">${esc(p.mc)}</span>`:""}${p.loaders.map(l=>`<span class="tag">${LNAME[l]||esc(l)}</span>`).join("")}<span class="tag">${fmtN(p.dl)} downloads</span></span></span><button class="btn${busy?"":" pri"}" data-pk="get" data-v="${esc(p.id)}" style="min-width:96px;justify-content:center"${PK.fetching?" disabled":""} aria-label="Import ${esc(p.name)}">${busy?`${PK.prog&&PK.prog.phase==="fetch"?PK.prog.pct+"%":"…"}`:"Import"}</button></div>`}
function pkList(){const el=document.getElementById("pkl");if(!el)return;
  if(PK.err){el.innerHTML=UI.state("error","Couldn’t load modpacks",esc(PK.err),{label:"Try again",attrs:'data-pk="retry"',compact:true});return}
  if(PK.loading&&!PK.list.length){el.innerHTML=Array(5).fill('<div class="skel"></div>').join("");return}
  if(!PK.list.length){el.innerHTML=UI.state("empty","No modpacks found","Try another search.",{compact:true});return}
  el.innerHTML=PK.list.map(pkRow).join("")+(PK.list.length<PK.total?`<button class="btn" data-pk="more" style="margin:8px auto;display:flex">${PK.loading?"Loading…":"Load more"}</button>`:"");
  el.querySelectorAll("img[data-fb]").forEach(i=>i.onerror=()=>{const s=document.createElement("span");s.className="ico mi";s.textContent=i.dataset.fb;i.replaceWith(s)})}
const PHASE={download:"Downloading mods and files",overrides:"Copying configs and resource packs",mods:"Matching mods with Modrinth",done:"Finishing"};
function pkProg(){const p=PK.prog;if(!p)return;if(p.phase==="fetch"){const b=document.querySelector(`[data-pk="get"][data-v="${CSS.escape(p.project||"")}"]`);if(b)b.textContent=p.pct+"%";return}
  const bar=document.getElementById("pkbar"),t=document.getElementById("pkpct"),m=document.getElementById("pkmsg");if(bar)bar.style.width=p.pct+"%";if(bar&&bar.parentElement)bar.parentElement.setAttribute("aria-valuenow",p.pct);if(t)t.textContent=p.pct+"%";if(m)m.textContent=(PHASE[p.phase]||"Working")+(p.msg&&p.phase==="download"&&!/^Downloading/.test(p.msg)?" · "+p.msg:"")}
function pkStat(n,l){return `<div class="pk-stat"><b>${esc(n)}</b><small>${esc(l)}</small></div>`}
function pkBody(){
  if(PK.step==="pick"){const tabs=UI.seg('id="pktab"',[["file","From a file"],["modrinth","Browse Modrinth"]],PK.tab,"Where the modpack comes from");
    if(PK.tab==="file")return `${tabs}<button class="dropzone pk-drop" data-pk="pick" style="width:100%;margin-top:14px;text-align:left">${ic("upload",20)}<span><b>Choose a .mrpack file</b><small>A Modrinth modpack you downloaded. Auroras reads it, shows you what’s inside, then makes a new instance.</small></span></button>
      <ul class="pk-notes"><li>${ic("check",13)}Mods download only from Modrinth, GitHub and GitLab, and each file is checked against the pack’s SHA-512 checksum.</li><li>${ic("check",13)}Server-only files are skipped. Configs and resource packs in the pack are copied in.</li><li>${ic("check",13)}Nothing outside the new instance’s folder is touched.</li></ul>`;
    return `${tabs}<div class="search" style="margin:14px 0 10px">${ic("search")}<input class="f" id="pkq" placeholder="Search Modrinth modpacks" value="${esc(PK.q)}" aria-label="Search Modrinth modpacks" autocomplete="off"></div><div class="panel list pk-list" id="pkl"></div>`}
  const p=PK.pack;if(!p)return"";
  const im=p.icon?`<img class="mi" src="${esc(p.icon)}" alt="" style="width:52px;height:52px">`:`<span class="ico mi" style="width:52px;height:52px;font-size:20px">${esc((p.name||"?")[0])}</span>`;
  const head=`<div class="pk-head">${im}<span class="min"><b>${esc(p.name)}</b><small>${p.versionId?"Version "+esc(p.versionId)+" · ":""}Minecraft ${esc(p.mc)} · ${esc(p.loader)}${p.loaderVersion?" "+esc(p.loaderVersion):""}</small>${p.summary?`<span class="pk-sum">${esc(p.summary)}</span>`:""}</span></div>`;
  if(PK.step==="busy"){const pct=PK.prog&&PK.prog.phase!=="fetch"?PK.prog.pct:0;return `${head}<div class="pk-busy"><div class="pk-track" role="progressbar" aria-label="Import progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i id="pkbar" style="width:${pct}%"></i></div><div class="pk-line"><span id="pkmsg">${esc(PHASE.download)}</span><b id="pkpct">${pct}%</b></div><small>Keep the launcher open. If anything fails, nothing is left behind.</small></div>`}
  return `${head}<div class="pk-stats">${pkStat(p.mods,p.mods===1?"mod":"mods")}${pkStat(p.files,"files to download")}${pkStat(fmtMB(p.downloadBytes),"download size")}${pkStat(p.overrides,"configs and other files")}</div>
    ${p.serverOnly||p.optional?`<small style="display:block;margin-top:8px">${p.serverOnly?`${p.serverOnly} server-only ${p.serverOnly===1?"file is":"files are"} skipped. `:""}${p.optional?`${p.optional} optional ${p.optional===1?"file is":"files are"} included.`:""}</small>`:""}
    ${p.warnings&&p.warnings.length?`<div class="pk-warn" role="note">${ic("alert",15)}<span>${p.warnings.map(esc).join("<br>")}</span></div>`:""}
    <label class="l" for="pkn">Instance name</label><input class="f" id="pkn" maxlength="32" value="${esc(PK.name)}" autocomplete="off">${PK.perr?`<div class="err" role="alert">${esc(PK.perr)}</div>`:""}`}
function pkDraw(){let m=document.getElementById("pkmodal");const n=document.getElementById("pkn");if(n)PK.name=n.value;
  if(!m){m=document.createElement("div");m.id="pkmodal";m.className="mb";m.onclick=pkEv;m.oninput=e=>{if(e.target.id==="pkq"){PK.q=e.target.value;clearTimeout(PK.t);PK.t=setTimeout(()=>pkSearch(true),350)}else if(e.target.id==="pkn"){PK.name=e.target.value}};
    m.onkeydown=e=>{if(e.key==="Escape"){e.stopPropagation();pkClose()}else if(e.key==="Enter"&&e.target.id==="pkn")pkImport()};document.body.appendChild(m)}
  const s=PK.step,foot=s==="pick"?`<button class="btn" data-pk="close">Cancel</button><small class="pk-foot">Modrinth modpacks (.mrpack)</small>`:s==="busy"?`<span></span><button class="btn" data-pk="cancel">Cancel import</button>`:`<button class="btn" data-pk="back">Back</button><button class="btn pri" data-pk="import">${ic("download",14)}Import modpack</button>`;
  m.innerHTML=`<div class="dlg pk-dlg" role="dialog" aria-modal="true" aria-label="Import modpack"><header class="pk-top"><span class="ph-ico" aria-hidden="true">${ic("box")}</span><span class="min"><h1 style="font-size:16px">Import modpack</h1><small>${s==="pick"?"Make a new instance from a Modrinth modpack.":s==="busy"?"Installing into a new instance…":"Check what’s inside, then import."}</small></span>${s==="busy"?"":`<button class="ibtn" data-pk="close" aria-label="Close">${ic("x")}</button>`}</header><div class="body">${pkBody()}</div><footer>${foot}</footer></div>`;
  const tg=m.querySelector("#pktab");if(tg)kitWire(m,g=>{if(g.id==="pktab"&&g.dataset.value!==PK.tab){PK.tab=g.dataset.value;pkDraw();if(PK.tab==="modrinth"&&!PK.list.length&&!PK.loading)pkSearch(true)}});
  if(s==="pick"&&PK.tab==="modrinth"){pkList();m.querySelector("#pkq")?.focus()}else if(s==="preview")m.querySelector("#pkn")?.focus();else m.querySelector("[data-pk=pick]")?.focus()}
function pkShow(r,extra){if(!r)return;PK.pack={...r,...(extra||{})};PK.name=pkUnique(r.name);PK.perr="";PK.step="preview";pkDraw()}
async function pkEv(e){if(e.target.id==="pkmodal")return pkClose();const b=e.target.closest("[data-pk]");if(!b||b.disabled)return;const k=b.dataset.pk;
  if(k==="close")pkClose();
  else if(k==="retry")pkSearch(true);else if(k==="more")pkSearch(false);
  else if(k==="pick"){if(!(DESK&&auroras.modpackPick))return toast("Importing modpacks needs the desktop app.");try{pkShow(await auroras.modpackPick())}catch(x){toast("Couldn’t open the modpack: "+errMsg(x),"err")}}
  else if(k==="get"){if(!(DESK&&auroras.modpackFetch))return toast("Importing modpacks needs the desktop app.");const it=PK.list.find(x=>x.id===b.dataset.v);PK.fetching=b.dataset.v;PK.prog=null;pkList();
    try{const r=await auroras.modpackFetch({project:b.dataset.v});PK.fetching=null;if(!document.getElementById("pkmodal")){if(r&&r.token)auroras.modpackDiscard(r.token).catch(()=>{});return}pkShow(r,{icon:it&&it.icon})}catch(x){PK.fetching=null;pkList();toast("Couldn’t get the modpack: "+errMsg(x),"err")}}
  else if(k==="back"){if(PK.pack&&DESK)auroras.modpackDiscard(PK.pack.token).catch(()=>{});PK.pack=null;PK.step="pick";pkDraw()}
  else if(k==="import")pkImport();
  else if(k==="cancel"){if(PK.pack&&DESK)auroras.modpackCancel(PK.pack.token).catch(()=>{});b.disabled=true;b.textContent="Cancelling…"}}
async function pkImport(){const n=document.getElementById("pkn"),name=(n?n.value:PK.name).trim();PK.name=name;
  if(!name){PK.perr="Give the instance a name.";return pkDraw()}if(INST.some(i=>i.name.toLowerCase()===name.toLowerCase())){PK.perr="An instance with this name already exists.";return pkDraw()}
  const p=PK.pack,id=Date.now();PK.step="busy";PK.prog=null;pkDraw();
  try{const r=await auroras.modpackInstall({token:p.token,inst:{id,name,mem:4}}),o=r.inst;
    const inst={id:o.id,name:o.name,mc:o.mc,loader:o.loader,loaderVersion:o.loaderVersion||null,played:"Not launched yet",c:COLS[(INST.length+1)%COLS.length],mem:o.mem||4,args:"",java:{mode:"auto",path:"",major:null},pack:{name:p.name,version:p.versionId||""}};
    INST.unshift(inst);S.inst=inst.id;PK.pack=null;PK.step="pick";document.getElementById("pkmodal")?.remove();render();
    toast(`Imported “${inst.name}”: ${r.files} ${r.files===1?"file":"files"}${r.overrides?" and "+r.overrides+" configs":""}.`,"ok")}
  catch(x){const msg=errMsg(x);PK.step="preview";PK.perr=/cancelled/i.test(msg)?"Import cancelled. Nothing was kept.":msg;pkDraw()}}
