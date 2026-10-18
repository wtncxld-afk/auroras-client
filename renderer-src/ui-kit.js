/* ----- Auroras UI kit: shared controls and states. Visuals come from the component styles in page.html,
   which use the tokens in visuals/design-tokens.json. Every builder returns HTML; kitWire() attaches behaviour. ----- */
const UI={
  /** Segmented control for a few mutually exclusive choices. opts: [[value,label],...] */
  seg(attrs,opts,value,aria){return `<div class="seg" role="radiogroup" aria-label="${esc(aria||"")}" ${attrs} data-value="${esc(value)}">${opts.map(([v,l])=>`<button type="button" role="radio" aria-checked="${String(v)===String(value)}" tabindex="${String(v)===String(value)?0:-1}" data-v="${esc(v)}">${esc(l)}</button>`).join("")}</div>`},
  /** Slider with an editable number beside it. */
  range(attrs,{min,max,step,value,id,aria,suffix=""}){const f=fillPct(value,min,max);return `<input type="range" class="rng" ${id?`id="${id}"`:""} ${attrs} min="${min}" max="${max}" step="${step}" value="${esc(value)}" style="--fill:${f}%" aria-label="${esc(aria||"")}"><input class="num" type="number" min="${min}" max="${max}" step="${step}" value="${esc(fmtNum(value,step))}" aria-label="${esc((aria||"")+" value")}" tabindex="-1">${suffix?`<small>${esc(suffix)}</small>`:""}`},
  /** Color picker: swatch plus hex field (RRGGBB, no #). */
  color(attrs,hex,id,aria){return `<span class="colorpick"><input type="color" ${id?`id="${id}"`:""} ${attrs} value="#${esc(String(hex).toLowerCase())}" aria-label="${esc(aria||"")}"><input class="hex" value="${esc(String(hex).toUpperCase())}" maxlength="6" spellcheck="false" aria-label="${esc((aria||"")+" hex value")}"></span>`},
  tip(text,cls=""){return text?`<span class="tip ${cls}" tabindex="0" role="note" aria-label="${esc(text)}" data-tip="${esc(text)}">${ic("info")}</span>`:""},
  /** Loading, empty, error, success or unavailable state. */
  state(kind,title,body,action,icon){const ico=icon||({loading:"",error:"alert",ok:"check",unavail:"lock",empty:"search"})[kind]||"info";
    return `<div class="state ${kind}${action&&action.compact?" compact":""}" role="${kind==="error"?"alert":"status"}"><div class="ring">${kind==="loading"?`<span class="spin" aria-hidden="true"></span>`:ic(ico,18)}</div><b>${esc(title)}</b>${body?`<span>${body}</span>`:""}${action&&action.label?`<button class="btn" ${action.attrs||""}>${esc(action.label)}</button>`:""}</div>`},
  /** Collapsible settings section. */
  sect(title,body,{open=true,note="",count}={}){return `<details class="sect"${open?" open":""}><summary>${esc(title)}${count!=null?` <small>${count}</small>`:""}<span class="chev">${ic("down",14)}</span></summary><div class="body">${note?`<div class="note">${note}</div>`:""}${body}</div></details>`},
  /** Module header: icon, name, one-line description, status tags, optional control on the right. */
  head(icon,title,desc,tags,right){return `<div class="mhead"><div class="mic">${ic(icon,18)}</div><div class="mt2"><b>${esc(title)}</b>${desc?`<small>${desc}</small>`:""}${tags?`<div class="tags">${tags}</div>`:""}</div>${right||""}</div>`}
};
const fillPct=(v,min,max)=>Math.max(0,Math.min(100,(+v-min)/((max-min)||1)*100)).toFixed(1);
const fmtNum=(v,step)=>{const s=+step;if(s>=1)return String(Math.round(+v));const d=Math.min(4,(String(step).split(".")[1]||"").length||1);return (+v).toFixed(d)};
/** Attaches behaviour to kit controls inside root: segmented keyboard/mouse, slider fill + number sync, hex sync. */
function kitWire(root,onChange){
  root.querySelectorAll(".seg").forEach(g=>{const pick=b=>{if(!b||b.disabled)return;g.dataset.value=b.dataset.v;g.querySelectorAll("button").forEach(x=>{const on=x===b;x.setAttribute("aria-checked",on);x.tabIndex=on?0:-1});onChange&&onChange(g)};
    g.onclick=e=>pick(e.target.closest("button"));
    g.onkeydown=e=>{const bs=[...g.querySelectorAll("button")],i=bs.findIndex(x=>x.getAttribute("aria-checked")==="true");let n=-1;
      if(e.key==="ArrowRight"||e.key==="ArrowDown")n=(i+1)%bs.length;else if(e.key==="ArrowLeft"||e.key==="ArrowUp")n=(i-1+bs.length)%bs.length;else if(e.key==="Home")n=0;else if(e.key==="End")n=bs.length-1;
      if(n>=0){e.preventDefault();pick(bs[n]);bs[n].focus()}}});
  root.querySelectorAll("input.rng").forEach(r=>{const num=(r.id&&root.querySelector(`[data-numfor="${r.id}"]`))||(r.nextElementSibling&&r.nextElementSibling.classList.contains("num")?r.nextElementSibling:null);
    const sync=()=>{r.style.setProperty("--fill",fillPct(r.value,+r.min,+r.max)+"%");if(num&&document.activeElement!==num)num.value=fmtNum(r.value,r.step)};
    r.addEventListener("input",()=>{sync();onChange&&onChange(r)});
    if(num){num.tabIndex=0;num.addEventListener("change",()=>{let v=+num.value;if(!Number.isFinite(v))v=+r.value;v=Math.max(+r.min,Math.min(+r.max,v));r.value=v;num.value=fmtNum(r.value,r.step);r.style.setProperty("--fill",fillPct(r.value,+r.min,+r.max)+"%");r.dispatchEvent(new Event("input",{bubbles:true}))})}});
  root.querySelectorAll(".colorpick").forEach(c=>{const sw=c.querySelector("input[type=color]"),hx=c.querySelector(".hex");if(!sw||!hx)return;
    sw.addEventListener("input",()=>{hx.value=sw.value.slice(1).toUpperCase();hx.removeAttribute("aria-invalid")});
    hx.addEventListener("input",()=>{const v=hx.value.replace(/^#/,"");if(/^[0-9a-f]{6}$/i.test(v)){hx.removeAttribute("aria-invalid");sw.value="#"+v.toLowerCase();sw.dispatchEvent(new Event("input",{bubbles:true}))}else hx.setAttribute("aria-invalid","true")});
    hx.addEventListener("blur",()=>{hx.value=sw.value.slice(1).toUpperCase();hx.removeAttribute("aria-invalid")})})}

/* ----- Settings, generated from the game's own registry, with a control chosen for each setting's type ----- */
const OPT_LABEL={off:"Off (vanilla)",auto:"Auto",LOW:"Low",BALANCED:"Balanced",HIGH:"High",TL:"Top left",TC:"Top centre",TR:"Top right",CL:"Centre left",C:"Centre",CR:"Centre right",BL:"Bottom left",BC:"Bottom centre",BR:"Bottom right",
  minimal:"Minimal",compact:"Compact",expanded:"Expanded",percent:"Percent",numeric:"Numbers",bar:"Bar",vertical:"Vertical",horizontal:"Horizontal",back:"Back",chest:"Chest",shoulder:"Shoulder",length:"Length",name:"Name",category:"Category",solid:"Solid",chroma:"Chroma",gradient:"Gradient",bound:"My key binds",wasd:"W A S D",arrows:"Arrows",text:"Word"};
const optLabel=o=>OPT_LABEL[o]||(typeof SKY_THEMES!=="undefined"&&SKY_THEMES[o]?SKY_THEMES[o].name:label(o));
const HUD_APPEAR=["style","color","textMode","chromaSpeed","accent","opacity","background","bgColor","bgOpacity","radius","border","shadow"],HUD_POS=["anchor","offX","offY","scale"];
/** Groups a module's settings into named sections. Anything not listed lands in the first section. */
function sectionsFor(m,exclude=[]){const keys=m.settings.map(s=>s.key).filter(k=>k!=="enabled"&&!exclude.includes(k)),has=k=>keys.includes(k);
  const G={sky:[[exclude.includes("theme")?"Other dimensions":"Theme",["theme","netherTheme","endTheme"],!exclude.includes("theme")],["Color and light",["brightness","saturation","contrast","tint","tintStrength"],true],["Animation",["animate","animSpeed","effectsOpacity","shootingStars","aurora","auroraWaves","nebula","nebulaSpeed","clouds","petals"],true],
      ["Stars",["starDensity","starSize","starBrightness","twinkleSpeed","constellations"],false],["Sun and moon",["sunSize","moonSize"],false],["Quality",["skyQuality"],false]],
    particlefx:[["Look",["style","color","size","opacity"],true],["Amount",["density","lifetime","spawnRate","speed","maxDistance","maxCount"],true],["Behaviour",["ambient","events","autoReduce","reducedMotion"],false]],
    totemfx:[["Particles",["particles","particleColor","density","duration","scale","spin"],true],["Screen overlay",["overlay","overlayIntensity","overlayDuration"],false]],
    emotes:[["Playback",["speed","blend","cancelOnMove","thirdPerson"],true],["Controls",["wheelKey"],true]]};
  let g=G[m.id];if(!g&&has("anchor"))g=[["Content",keys.filter(k=>!HUD_APPEAR.includes(k)&&!HUD_POS.includes(k)),true],["Appearance",HUD_APPEAR,true],["Position and size",HUD_POS,false]];
  if(!g)g=[["Settings",keys,true]];
  const used=new Set(),out=g.map(([t,ks,open])=>{const l=ks.filter(k=>has(k)&&!used.has(k));l.forEach(k=>used.add(k));return{title:t,keys:l,open}}).filter(x=>x.keys.length);
  const rest=keys.filter(k=>!used.has(k));if(rest.length){if(out.length)out[0].keys.push(...rest);else out.push({title:"Settings",keys:rest,open:true})}return out}
function ctrlHtml(m,d,v){const id=`set-${m.id}-${d.key}`,lab=label(d.key),tip=UI.tip(HINTS[d.key]||""),changed=String(v)!==String(d.def);
  const row=(ctl,forId)=>`<div class="srow${changed?" changed":""}" data-row="${d.key}"><div class="lab">${forId?`<label for="${forId}">${lab}</label>`:`<span>${lab}</span>`}${tip}</div><div class="ctl">${ctl}<button type="button" class="ibtn sm rst" data-rst="${d.key}" aria-label="Reset ${esc(lab)} to default" title="Reset to default">${ic("reset",14)}</button></div></div>`;
  if(d.type==="BOOL")return row(`<button class="tg" role="switch" aria-checked="${v==="true"}" data-sk="${d.key}" aria-label="${lab}"></button>`);
  if(d.type==="COLOR")return row(UI.color(`data-sk="${d.key}"`,v,id,lab),id);
  if(d.type==="ENUM"){if(d.options.length<=4)return row(UI.seg(`data-sk="${d.key}"`,d.options.map(o=>[o,optLabel(o)]),v,lab));
    return row(`<select class="f" id="${id}" data-sk="${d.key}" style="max-width:200px">${d.options.map(o=>`<option value="${esc(o)}"${o===v?" selected":""}>${esc(optLabel(o))}</option>`).join("")}</select>`,id)}
  if(d.type==="KEY")return row(`<button class="btn sm" data-skey="${d.key}" data-code="${esc(v)}" style="min-width:110px;justify-content:center" aria-label="${lab}: ${esc(keyName2(v))}. Press to change">${esc(keyName2(v))}</button>`);
  const step=d.type==="INT"?1:Math.pow(10,Math.floor(Math.log10((d.max-d.min)/50)));
  const f=fillPct(v,d.min,d.max);
  return `<div class="srow sl${changed?" changed":""}" data-row="${d.key}"><div class="lab"><label for="${id}">${lab}</label>${tip}</div><div class="ctl"><input class="num" type="number" min="${d.min}" max="${d.max}" step="${step}" value="${esc(fmtNum(v,step))}" aria-label="${esc(lab)} value" data-numfor="${id}"><button type="button" class="ibtn sm rst" data-rst="${d.key}" aria-label="Reset ${esc(lab)} to default" title="Reset to default">${ic("reset",14)}</button></div><input type="range" class="rng" id="${id}" data-sk="${d.key}" min="${d.min}" max="${d.max}" step="${step}" value="${esc(v)}" style="--fill:${f}%" aria-label="${esc(lab)}"></div>`}
/** Reads a settings panel back into {key: value} strings in the game's number format. */
function readCtrls(root,m){const out={};root.querySelectorAll("[data-sk]").forEach(el=>{const d=m.settings.find(s=>s.key===el.dataset.sk);if(!d)return;
  if(d.type==="BOOL")out[d.key]=String(el.getAttribute("aria-checked")==="true");else if(d.type==="COLOR")out[d.key]=el.value.slice(1).toUpperCase();
  else if(d.type==="ENUM")out[d.key]=el.classList.contains("seg")?el.dataset.value:el.value;
  else if(d.type==="INT")out[d.key]=String(Math.round(+el.value));else out[d.key]=String(Math.round(+el.value*1e6)/1e6).replace(/^(-?\d+)$/,"$1.0")});
  root.querySelectorAll("[data-skey]").forEach(el=>{out[el.dataset.skey]=el.dataset.code});return out}
function setCtrl(root,m,key,v){const el=root.querySelector(`[data-sk="${key}"]`),kb=root.querySelector(`[data-skey="${key}"]`),d=m.settings.find(s=>s.key===key);if(!d)return;
  if(kb){kb.dataset.code=v;kb.textContent=keyName2(v)}else if(!el)return;else if(d.type==="BOOL")el.setAttribute("aria-checked",v==="true");else if(d.type==="COLOR"){el.value="#"+v.toLowerCase();const hx=el.parentElement.querySelector(".hex");if(hx)hx.value=v.toUpperCase()}
  else if(el.classList.contains("seg")){el.dataset.value=v;el.querySelectorAll("button").forEach(b=>{const on=b.dataset.v===v;b.setAttribute("aria-checked",on);b.tabIndex=on?0:-1})}
  else{el.value=v;if(el.classList.contains("rng")){el.style.setProperty("--fill",fillPct(v,+el.min,+el.max)+"%");const n=root.querySelector(`[data-numfor="${el.id}"]`)||el.nextElementSibling;if(n&&n.classList.contains("num"))n.value=fmtNum(v,el.step)}}}
function markChanged(root,m){const cur=readCtrls(root,m);root.querySelectorAll("[data-row]").forEach(r=>{const d=m.settings.find(s=>s.key===r.dataset.row);if(d)r.classList.toggle("changed",String(cur[d.key])!==String(d.def)&&!(d.type!=="ENUM"&&d.type!=="BOOL"&&d.type!=="KEY"&&+cur[d.key]===+d.def))})}
function wireCtrls(root,onChange,m){const host=root.matches&&root.matches("[data-mod]")?root:root.querySelector("[data-mod]");m=m||(host&&REG.modules.find(x=>x.id===host.dataset.mod));const ch=()=>{if(m)markChanged(root,m);onChange&&onChange()};
  root.querySelectorAll(".tg[data-sk]").forEach(b=>b.onclick=()=>{b.setAttribute("aria-checked",b.getAttribute("aria-checked")!=="true");ch()});
  kitWire(root,ch);
  root.querySelectorAll("select[data-sk],input[type=color][data-sk]").forEach(x=>x.oninput=x.onchange=ch);
  root.querySelectorAll("[data-rst]").forEach(b=>b.onclick=()=>{if(!m)return;const d=m.settings.find(s=>s.key===b.dataset.rst);if(d){setCtrl(root,m,d.key,d.def);ch()}});
  root.querySelectorAll("[data-skey]").forEach(b=>b.onclick=()=>{b.textContent="Press a key…";const h=e=>{e.preventDefault();e.stopPropagation();document.removeEventListener("keydown",h,true);
    const code=e.key==="Escape"?-1:glfwCode(e);b.dataset.code=String(code);b.textContent=keyName2(code);ch()};document.addEventListener("keydown",h,true)})}
