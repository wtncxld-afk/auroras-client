/* ----- HUD editor: the game's HUD laid out with the game's own maths (visuals.js mirrors Hud.java / HudKit.java) ----- */
// Widgets are drawn like the game's (Inter text, glass cards, HudSkin sizes mirrored in visuals.js); positions, anchors,
// clamping, snapping and scale use exactly the game's rules. mcWidth is still used for the module list's length sort.
const MCW=ch=>"i!.,:;|'".includes(ch)?2:ch==="l"||ch==="`"?3:"It[]\" ".includes(ch)?4:"fk<>*()".includes(ch)?5:ch.charCodeAt(0)>255?9:6;
const mcWidth=s=>{let w=0;for(const ch of String(s))w+=MCW(ch);return Math.max(0,w-1)};
const SCREENS=[["1920x1080",1920,1080],["2560x1440",2560,1440],["1366x768",1366,768],["1280x720",1280,720],["3440x1440",3440,1440],["1024x768",1024,768]];
const HE={open:false,screen:"1920x1080",gui:0,sel:null,snap:true,preview:false,draft:null,orig:null,drag:null,guides:[null,null],t0:0,raf:0,layouts:{}};
const hudMods=()=>REG.modules.filter(m=>m.settings.some(s=>s.key==="anchor"));
/** Minecraft's "Auto" GUI scale: the largest scale that keeps at least 320x240 GUI pixels. */
function autoGui(w,h){let s=1;while(s<6&&Math.floor(w/(s+1))>=320&&Math.floor(h/(s+1))>=240)s++;return s}
function guiSize(){const sc=SCREENS.find(x=>x[0]===HE.screen),g=HE.gui||autoGui(sc[1],sc[2]);return{w:Math.floor(sc[1]/g),h:Math.floor(sc[2]/g),g}}
const dv=(id,k)=>HE.draft[id+"."+k];
/** Sample content per element, built with the game's formatters. Returns lines of text, or a fixed-size widget. */
function hudSample(id,t){const st=dv(id,"style"),b=k=>dv(id,k)==="true";
switch(id){
case"fps":return[VX.H.fps(144,138.2,6.94,b("showAverage"),b("showFrameTime"),st)];
case"coords":return[VX.H.coords(128.42,64,-311.7,+dv(id,"decimals"),b("showX"),b("showY"),b("showZ"),b("showDirection")?"NW":null)];
case"cps":return[VX.H.cps(11,4,b("showRight"),st)];
case"clock":{const d=new Date();return[Calc_clock(d.getHours(),d.getMinutes(),d.getSeconds(),b("h24"),b("seconds"))]}
case"ping":return[VX.H.ping(42)];
case"armor":{const f=dv(id,"format"),rows=[["Helmet",363,40],["Chestplate",528,300],["Leggings",495,0],["Boots",429,410]].map(([n,m,d])=>n+"  "+(f==="bar"?"█".repeat(Math.max(1,Math.round((m-d)/m*6))):VX.H.durability(m,d,f)));if(b("showHeld"))rows.push("Sword  "+VX.H.durability(1561,200,f==="bar"?"percent":f));return dv(id,"layout")==="horizontal"?[rows.map(r=>r.split("  ")[1]).join("   ")]:rows}
case"potions":{const n=["Speed","Night Vision","Absorption"],tk=[3600,-1,400],o=VX.H.potionOrder(n,tk,dv(id,"order"));return o.map(i=>VX.H.potionName(n[i],i===0?1:0)+"  "+VX.H.potionTime(tk[i]))}
case"target":return[VX.H.target("Zombie",12.5,20,4.2,b("showHealth"),b("showDistance"))];
case"sessioninfo":return[VX.H.sessionInfo(cur().mc,cur().loader,cur().name,"play.example.net",754000,b("showVersion"),b("showLoader"),b("showInstance"),b("showServer"),b("showDuration"))];
case"spotify":return[VX.H.spotify("Example Track","Example Artist",true,65000,200000,b("showProgress"),null)];
case"modulelist":{const en=REG.modules.filter(m=>m.available&&HE.draft[m.id+".enabled"]==="true"&&m.id!=="modulelist").map(m=>({id:m.id,name:m.name,category:m.category,width:mcWidth(m.name)}));return VX.H.moduleList(en.length?en:[{id:"x",name:"No modules on",category:"",width:60}],dv(id,"sort")).map(e=>e.name)}
case"brandinghud":return["Auroras Client"];
case"keystrokes":return null;
default:return[REG.modules.find(m=>m.id===id).name]}}
function Calc_clock(h,m,s,h24,sec){const p=n=>String(n).padStart(2,"0");if(h24)return sec?`${p(h)}:${p(m)}:${p(s)}`:`${p(h)}:${p(m)}`;const hh=h%12===0?12:h%12,ap=h<12?"AM":"PM";return sec?`${hh}:${p(m)}:${p(s)} ${ap}`:`${hh}:${p(m)} ${ap}`}
/** Element box in GUI pixels at scale 1 (before the element's own scale). */
/** Measures text in the HUD's font (Inter, like the game's widgets). */
const HUD_MEASURE=document.createElement("canvas").getContext("2d");
const hudWidth=(s,size,weight=600)=>{HUD_MEASURE.font=`${weight} ${size}px 'Inter',system-ui,sans-serif`;return HUD_MEASURE.measureText(s).width};
/** Element box in GUI pixels at scale 1 (before the element's own scale), sized by HudSkin like the game. */
function hudBase(id){const sty=dv(id,"style"),cd=VX.SKIN.card(sty);if(id==="spotify"){const c=VX.H.spotifyCard(dv(id,"layout"),dv(id,"showArt")==="true",dv(id,"showProgress")==="true");return{w:c.w,h:c.h,lines:null,card:c}}
if(id==="keystrokes"){const ks=ksLayout(id),pad=dv(id,"keyStyle")==="creamy"?3:2;return{w:ks.w+pad*2,h:ks.h+pad*2,lines:null,ks}}
const lines=hudSample(id),label=VX.styleOf(sty).label?REG.modules.find(m=>m.id===id).name.toUpperCase():null,tw=Math.max(...lines.map(l=>hudWidth(l,cd.text))),lw=label?hudWidth(label,cd.label,500)*1.08:0,bx=VX.SKIN.size(cd,tw,lines.length,lw,cd.icon>0);return{w:bx[0],h:bx[1],lines,label}}
function hudRect(id,sw,sh){const b=hudBase(id),sc=+dv(id,"scale"),w=VX.scaledPx(b.w,sc),h=VX.scaledPx(b.h,sc),p=VX.resolve(dv(id,"anchor"),+dv(id,"offX"),+dv(id,"offY"),w,h,sw,sh);return{x:p[0],y:p[1],w,h,b,sc}}
/** Keystrokes layout from the game's own rules (Keystrokes.java, mirrored in visuals.js). */
const ksLayout=id=>VX.KS.layout(+dv(id,"keySize"),+dv(id,"gap"),dv(id,"showMouse")==="true",dv(id,"showModifiers")==="true",dv(id,"showSpace")==="true",dv(id,"spaceStyle"));
/** The game's rounded box: the same rectangles HudKit.roundRect / roundOutline draw in game. */
const fillRects=(ctx,x,y,list)=>{for(let i=0;i<list.length;i+=4)ctx.fillRect(x+list[i],y+list[i+1],list[i+2]-list[i],list[i+3]-list[i+1])};
const hexOf=n=>n.toString(16).padStart(6,"0");
const rgba=(hex,a)=>{const n=parseInt(hex,16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
/** Widget icons (visuals/icons, white masks), tinted once per colour and cached. */
const HUD_ICONS={},HUD_TINT={};
function hudIcon(name,hex){const key=name+hex;if(HUD_TINT[key])return HUD_TINT[key];let im=HUD_ICONS[name];if(!im){im=HUD_ICONS[name]=new Image();im.src="../visuals/icons/"+name+".png";im.onload=()=>{if(HE.open!==undefined)heDraw()}}
 if(!im.complete||!im.naturalWidth)return null;const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d");x.drawImage(im,0,0);x.globalCompositeOperation="source-in";x.fillStyle="#"+hex;x.fillRect(0,0,128,128);return HUD_TINT[key]=c}
/** A rounded rectangle path (GUI units). */
const rr=(ctx,x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,Math.max(0,Math.min(r,w/2,h/2)))};
/** The game's HUD look (ui/HudArt.java with core HudSkin, mirrored as VX.SKIN): glass cards, Inter text, icon chips, three key styles. */
function drawHudEl(ctx,id,r,t){const st=dv(id,"style"),cd=VX.SKIN.card(st),op=+dv(id,"opacity")/100,acc=dv(id,"accent"),col=dv(id,"color"),sh=dv(id,"shadow")==="true";
ctx.save();ctx.translate(r.x,r.y);ctx.scale(r.sc,r.sc);const W=r.b.w,Hh=r.b.h;
const bgc=dv(id,"bgColor")||"0C0F16",rad=+(dv(id,"radius")??0),mode=dv(id,"textMode")||"solid",csp=+(dv(id,"chromaSpeed")??1),sec=REDUCED()?0:t/1000,bg=dv(id,"background")==="true",bd=dv(id,"border")==="true",bp=+dv(id,"bgOpacity")/100;
const font=s=>`600 ${s}px 'Inter',system-ui,sans-serif`;ctx.textBaseline="alphabetic";
/** Text in the widget's colour mode, like the game: one run when solid, per character for chroma and gradient. top = cap top. */
const text=(s,x,top,size,c,a,to,k=0,solid=false)=>{ctx.font=font(size);const y=top+size*0.78,one=(ch,cx,cc)=>{if(sh){ctx.fillStyle=`rgba(0,0,0,${0.38*a})`;ctx.fillText(ch,cx,y+Math.max(0.35,size/14))}ctx.fillStyle=rgba(cc,a);ctx.fillText(ch,cx,y)};const blend=n=>k>0?VX.mix(n,parseInt(to,16),k):n;
  if(solid||!VX.H.perChar(mode)){one(s,x,hexOf(blend(parseInt(c,16))));return}let cx=x;for(const ch of s){one(ch,cx,hexOf(blend(VX.H.textColor(mode,parseInt(c,16),parseInt(acc,16),r.x+cx,sec,csp))));cx+=ctx.measureText(ch).width}};
const card=(w,h)=>{const R=VX.SKIN.radius(rad,w,h);if(bg&&bp>0){ctx.save();ctx.shadowColor=`rgba(0,0,0,${0.22*bp*op})`;ctx.shadowBlur=3.5;ctx.shadowOffsetY=0.8;rr(ctx,0,0,w,h,R);ctx.fillStyle=rgba(bgc,bp*op);ctx.fill();ctx.restore();
  const g=ctx.createLinearGradient(0,0,0,Math.min(h*0.55,9));g.addColorStop(0,`rgba(255,255,255,${0.07*bp*op})`);g.addColorStop(1,"rgba(255,255,255,0)");rr(ctx,0,0,w,h,R);ctx.fillStyle=g;ctx.fill()}
 if(bd||bg&&bp>0){rr(ctx,0.25,0.25,w-0.5,h-0.5,R);ctx.strokeStyle=bd?rgba(acc,0.6*op):`rgba(255,255,255,${0.09*bp*op})`;ctx.lineWidth=0.5;ctx.stroke()}};
if(id==="spotify"){card(W,Hh);ctx.font=font(7.5);ctx.textBaseline="top";drawSpotifyCard(ctx,r.b.card,t,op,col,acc,sh);ctx.restore();return}
if(id==="keystrokes"){const ks=r.b.ks,ksty=dv(id,"keyStyle")||"glass",pad=ksty==="creamy"?3:2,mode2=dv(id,"labels"),ss=dv(id,"spaceStyle"),pt=dv(id,"pressedText"),pp=+dv(id,"pressedOpacity"),rest=bg?+dv(id,"bgOpacity"):0,anim=dv(id,"animate")==="true"&&!REDUCED(),cps=dv(id,"showCps")==="true";
 // The preview presses W, A, S, D, then the mouse buttons in turn, fading out like the game (Release fade).
 const order=ks.keys.map(k=>k.input),cyc=(t/1000)%(order.length*0.45),cur=order[Math.floor(cyc/0.45)],into=cyc%0.45,fade=+dv(id,"fadeMs")/1000;
 for(const k of ks.keys){let g=0;if(anim){const idx=order.indexOf(k.input),on=Math.floor(cyc/0.45);if(k.input===cur)g=into<0.2?1:VX.H.keyGlowFade(1,false,into-0.2,fade);else if(idx===on-1||(on===0&&idx===order.length-1))g=VX.H.keyGlowFade(1,false,into+0.25,fade)}
  let x=pad+k.x,y=pad+k.y,w=k.w,h=k.h;const p=VX.SKIN.press(g),bar=k.input===6&&ss!=="text";let tc=col,ptc=pt,gk=g;
  let lab=bar?"":VX.KS.label(mode2,k.input,["W","A","S","D","Left Button","Right Button","Space","Left Shift","Left Control"][k.input],ss),sub=cps&&(k.input===4||k.input===5)?(k.input===4?"11":"4")+" CPS":null;
  if(sub&&!VX.KS.cpsLine(k.h)){lab=sub;sub=null}
  if(ksty==="creamy"){const C=VX.SKIN.CREAM,lip=Math.min(C.lip,h*0.2),tr=Math.min(lip,VX.SKIN.travel(C,g)),R=Math.min(VX.SKIN.radius(Math.max(rad,2),w,h)+1,h/2);
   ctx.save();ctx.shadowColor=`rgba(26,16,8,${(0.34-0.12*p)*op})`;ctx.shadowBlur=3-1.2*p;ctx.shadowOffsetY=1.2-0.6*p;rr(ctx,x,y+lip*0.6,w,h-lip*0.6,R);ctx.fillStyle=rgba(hexOf(C.side),op);ctx.fill();ctx.restore();
   const fy=y+tr,fh=h-lip;rr(ctx,x,fy,w,fh,R);ctx.fillStyle=rgba(hexOf(VX.mix(C.top,C.topPressed,p)),op);ctx.fill();
   rr(ctx,x+w*0.12,fy+0.6,w*0.76,Math.min(fh*0.38,4),Math.min(R,2));ctx.fillStyle=`rgba(255,255,255,${(0.45-0.25*p)*op})`;ctx.fill();
   if(g>0.01){rr(ctx,x+0.25,fy+0.25,w-0.5,fh-0.5,R);ctx.strokeStyle=rgba(acc,0.4*g*op);ctx.lineWidth=0.5;ctx.stroke()}
   y=fy;h=fh;tc=hexOf(C.text);ptc="3A2A1C";gk=p}
  else if(ksty==="classic"){const R=VX.SKIN.radius(rad,w,h),pct=Math.round(rest+(pp-rest)*g);if(pct>0){rr(ctx,x,y,w,h,R);ctx.fillStyle=rgba(hexOf(VX.mix(parseInt(bgc,16),parseInt(acc,16),g)),pct/100*op);ctx.fill()}
   if(bd){rr(ctx,x+0.25,y+0.25,w-0.5,h-0.5,R);ctx.strokeStyle=rgba(acc,0.55*op);ctx.lineWidth=0.5;ctx.stroke()}}
  else{const s=VX.SKIN.squish(g),R0=Math.min(VX.SKIN.radius(rad,w,h)+1,h/2);x+=w*(1-s)/2;y+=h*(1-s)/2;w*=s;h*=s;const R=R0*s,pct=Math.round(rest+(pp-rest)*p);
   ctx.save();if(p>0.01){ctx.shadowColor=rgba(acc,0.38*p*op);ctx.shadowBlur=4}else if(bg){ctx.shadowColor=`rgba(0,0,0,${0.2*bp*op})`;ctx.shadowBlur=2.5;ctx.shadowOffsetY=0.6}
   rr(ctx,x,y,w,h,R);ctx.fillStyle=rgba(hexOf(VX.mix(parseInt(bgc,16),parseInt(acc,16),p)),pct/100*op);ctx.fill();ctx.restore();
   const gr=ctx.createLinearGradient(0,y,0,y+Math.min(h*0.5,7));gr.addColorStop(0,`rgba(255,255,255,${(0.09+0.1*p)*op})`);gr.addColorStop(1,"rgba(255,255,255,0)");rr(ctx,x,y,w,h,R);ctx.fillStyle=gr;ctx.fill();
   rr(ctx,x+0.25,y+0.25,w-0.5,h-0.5,R);ctx.strokeStyle=bd?rgba(acc,(0.6+0.3*p)*op):rgba(hexOf(VX.mix(0xffffff,parseInt(acc,16),p)),(0.1+0.3*p)*op);ctx.lineWidth=0.5;ctx.stroke();gk=p}
  if(bar){const lw=Math.max(4,w*0.4),lh=h>=12?1.6:1.1;rr(ctx,x+(w-lw)/2,y+(h-lh)/2,lw,lh,lh/2);ctx.fillStyle=rgba(hexOf(VX.mix(parseInt(tc,16),parseInt(ptc,16),gk)),op);ctx.fill();continue}
  let ts=VX.SKIN.keyText(Math.min(h,w*1.4));ctx.font=font(ts);let tw=ctx.measureText(lab).width;if(tw>w-4){ts=Math.max(4,ts*(w-4)/tw);ctx.font=font(ts);tw=ctx.measureText(lab).width}
  const block=ts*0.74+(sub?ts*0.62+1.5:0),top=y+(h-block)/2-ts*0.04,keepSh=sh;
  text(lab,x+(w-tw)/2,top-ts*0.04,ts,tc,op,ptc,gk);
  if(sub){const s2=ts*0.62;ctx.font=font(s2);const sw2=ctx.measureText(sub).width;text(sub,x+(w-sw2)/2,top+ts*0.74+1.5,s2,hexOf(VX.mix(parseInt(tc,16),parseInt(bgc,16),0.3)),0.8*op,ptc,gk)}}
 ctx.restore();return}
card(W,Hh);let x0=cd.padX;const block=VX.SKIN.textBlock(cd,r.b.lines.length)+(r.b.label?cd.label+cd.labelGap:0);let y=(Hh-block)/2;
if(cd.icon>0){const S=cd.icon,cx=cd.padX,cy=(Hh-S)/2,R=S*0.3;rr(ctx,cx,cy,S,S,R);ctx.fillStyle=rgba(acc,0.2*op);ctx.fill();rr(ctx,cx+0.25,cy+0.25,S-0.5,S-0.5,R);ctx.strokeStyle=rgba(acc,0.24*op);ctx.lineWidth=0.5;ctx.stroke();
 const ic=hudIcon(VX.SKIN.icon(id),acc);if(ic){ctx.save();ctx.globalAlpha=op;ctx.imageSmoothingEnabled=true;ctx.drawImage(ic,cx+S*0.22,cy+S*0.22,S*0.56,S*0.56);ctx.restore()}x0+=S+cd.iconGap}
if(r.b.label){ctx.save();ctx.font=`500 ${cd.label}px 'Inter',system-ui,sans-serif`;ctx.letterSpacing=(cd.label*0.08)+"px";ctx.fillStyle=rgba(hexOf(VX.mix(parseInt(col,16),parseInt(acc,16),0.55)),0.7*op);ctx.fillText(r.b.label,x0,y+cd.label*0.78);ctx.restore();y+=cd.label+cd.labelGap}
const right=id==="modulelist"&&dv(id,"align")==="right";ctx.font=font(cd.text);
r.b.lines.forEach((ln,i)=>{const lw=ctx.measureText(ln).width,x=right?W-cd.padX-lw:x0;let c=col;
 if(id==="ping"){c=hexs(VX.H.PING_COLORS[VX.H.pingLevel(42,+dv(id,"goodMs"),+dv(id,"okMs"))]).slice(1);text(ln,x,y,cd.text,c,op,null,0,true);y+=cd.line;return}
 if(id==="modulelist"&&!VX.H.perChar(mode))c=i%2?dv(id,"color"):acc;text(ln,x,y,cd.text,c,op);y+=cd.line});ctx.restore()}
/** Spotify card, laid out by VX.H.spotifyCard exactly like the game. The editor shows an example track (labelled as such) and the
    note-glyph cover the game uses when there's no artwork. */
const SP_DEMO={title:"Example Track With A Long Title (Remastered)",artist:"Example Artist",prog:65000,dur:200000};
function drawSpotifyCard(ctx,c,t,op,col,acc,sh){const mono=s=>ctx.measureText(s).width,txt=(s,x,y,cc,a)=>{if(sh){ctx.fillStyle=`rgba(0,0,0,${0.6*a})`;ctx.fillText(s,x+1,y+1)}ctx.fillStyle=rgba(cc,a);ctx.fillText(s,x,y)};
  if(c.art){const x=c.pad,y=c.pad,g=ctx.createLinearGradient(x,y,x+c.art,y+c.art);g.addColorStop(0,`rgba(40,48,66,${op})`);g.addColorStop(1,`rgba(26,31,42,${op})`);ctx.fillStyle=g;ctx.fillRect(x,y,c.art,c.art);
    ctx.fillStyle=rgba(acc,0.9*op);const k=c.art/16;ctx.fillRect(x+9*k,y+3*k,1.4*k,8*k);ctx.fillRect(x+9*k,y+3*k,4*k,1.4*k);ctx.beginPath();ctx.ellipse(x+7.6*k,y+11.2*k,2.2*k,1.7*k,-0.4,0,Math.PI*2);ctx.fill()}
  const sec=REDUCED()?0:t/1000,clip=(x,w,fn)=>{ctx.save();ctx.beginPath();ctx.rect(x,0,w,c.h);ctx.clip();fn();ctx.restore()},mq=dv("spotify","marquee")==="true";
  const line=(s,y,cc,a)=>{const w=mono(s);if(w<=c.textW||mq&&!REDUCED())clip(c.textX,c.textW,()=>txt(s,c.textX-VX.H.marquee(w,c.textW,sec,24,1.5,!mq),y,cc,a));else{let e=s;while(e.length>1&&mono(e+"…")>c.textW)e=e.slice(0,-1);txt(e.trimEnd()+"…",c.textX,y,cc,a)}};
  if(c.expanded){line(SP_DEMO.title,c.titleY,col,op);line(SP_DEMO.artist,c.artistY,"8A93A6",op)}else line(SP_DEMO.title+" · "+SP_DEMO.artist,c.titleY,col,op);
  if(dv("spotify","showProgress")==="true"){const f=VX.H.progressFrac(SP_DEMO.prog,SP_DEMO.dur);
    if(c.expanded){const tl=VX.H.spotify("x","",true,SP_DEMO.prog,SP_DEMO.dur,true,null).split("  ")[1].split(" / "),bx=c.textX+mono(tl[0])+4,bw=c.textW-mono(tl[0])-mono(tl[1])-8;txt(tl[0],c.textX,c.barY-3,"8A93A6",op);txt(tl[1],c.textX+c.textW-mono(tl[1]),c.barY-3,"8A93A6",op);
      ctx.fillStyle=`rgba(255,255,255,${0.14*op})`;ctx.fillRect(bx,c.barY,bw,c.barH);ctx.fillStyle=rgba(acc,op);ctx.fillRect(bx,c.barY,bw*f,c.barH)}
    else{ctx.fillStyle=`rgba(255,255,255,${0.12*op})`;ctx.fillRect(c.pad,c.barY,c.w-c.pad*2,c.barH);ctx.fillStyle=rgba(acc,op);ctx.fillRect(c.pad,c.barY,(c.w-c.pad*2)*f,c.barH)}}}
function heDraw(){const cv=$("#he-cv");if(!cv)return;const{w:sw,h:sh,g}=guiSize(),ctx=cv.getContext("2d"),dpr=Math.min(2,devicePixelRatio||1),boxW=cv.parentElement.clientWidth-28,boxH=cv.parentElement.clientHeight-28,k=Math.min(boxW/sw,boxH/sh);
cv.style.width=Math.floor(sw*k)+"px";cv.style.height=Math.floor(sh*k)+"px";if(cv.width!==Math.floor(sw*k*dpr)){cv.width=Math.floor(sw*k*dpr);cv.height=Math.floor(sh*k*dpr)}HE.k=k;
ctx.setTransform(k*dpr,0,0,k*dpr,0,0);ctx.imageSmoothingEnabled=false;
drawSky(ctx,sw,sh,"vanillaPlus",Object.fromEntries(SKYM().settings.map(x=>[x.key,x.def])),6000,"minecraft:overworld",0,VX.QUALITY.LOW,0.35);
{const hz=Math.round(sh*0.58),gr=ctx.createLinearGradient(0,hz,0,sh);gr.addColorStop(0,"#5d7f49");gr.addColorStop(1,"#30451f");ctx.fillStyle=gr;ctx.fillRect(0,hz,sw,sh-hz);ctx.fillStyle="rgba(120,140,160,.35)";for(let i=0;i<7;i++)ctx.fillRect((i*97)%sw,hz-6-(i%3)*4,60,6+(i%3)*4)}
ctx.fillStyle="rgba(255,255,255,.85)";ctx.fillRect(sw/2-0.5,sh/2-4,1,9);ctx.fillRect(sw/2-4,sh/2-0.5,9,1);
ctx.fillStyle="rgba(0,0,0,.45)";ctx.fillRect(sw/2-91,sh-22,182,22);for(let i=0;i<9;i++){ctx.strokeStyle="rgba(255,255,255,.25)";ctx.strokeRect(sw/2-91+i*20+1.5,sh-20.5,18,18)}
const t=performance.now()-HE.t0,ids=hudMods().map(m=>m.id).filter(id=>HE.draft[id+".enabled"]==="true");HE.rects={};
for(const id of ids){const r=hudRect(id,sw,sh);HE.rects[id]=r;drawHudEl(ctx,id,r,t)}
if(!HE.preview){for(const id of ids){const r=HE.rects[id],on=id===HE.sel,R=Math.min(5,(r.h+3)/2);ctx.save();if(on){ctx.shadowColor="rgba(111,227,255,.45)";ctx.shadowBlur=5}
 ctx.beginPath();ctx.roundRect(r.x-1.5,r.y-1.5,r.w+3,r.h+3,R);ctx.strokeStyle=on?"#6fe3ff":"rgba(255,255,255,.35)";ctx.lineWidth=on?1/k*1.5:1/k;ctx.setLineDash(on?[]:[3/k,2/k]);ctx.stroke();ctx.restore();ctx.setLineDash([]);
 if(on){ctx.beginPath();ctx.arc(r.x+r.w+1.5,r.y+r.h+1.5,3,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();ctx.beginPath();ctx.arc(r.x+r.w+1.5,r.y+r.h+1.5,2.2,0,Math.PI*2);ctx.fillStyle="#6fe3ff";ctx.fill()}}
 ctx.strokeStyle="rgba(181,140,255,.9)";ctx.lineWidth=1/k;const[gx,gy]=HE.guides;if(gx!=null){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,sh);ctx.stroke()}if(gy!=null){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(sw,gy);ctx.stroke()}}
$("#he-info").textContent=`${HE.screen} at GUI scale ${g}${HE.gui?"":" (Auto)"}: ${sw}×${sh} GUI pixels`}
function heHit(e){const cv=$("#he-cv"),r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/HE.k,y=(e.clientY-r.top)/HE.k;let hit=null,handle=false;
for(const[id,q]of Object.entries(HE.rects||{}))if(x>=q.x-2&&y>=q.y-2&&x<=q.x+q.w+2&&y<=q.y+q.h+2){hit=id;handle=id===HE.sel&&x>=q.x+q.w-6&&y>=q.y+q.h-6}return{id:hit,x,y,handle}}
function hePanel(){const p=$("#he-panel");if(!p)return;const id=HE.sel,m=id&&REG.modules.find(x=>x.id===id);
p.innerHTML=!m?`<div class="empty" style="padding:24px"><b>Select an element</b><span>Click an element on the screen to move, resize and style it. Arrow keys nudge by 1 pixel, Shift+arrow by 10. Hold Alt while dragging to turn snapping off.</span></div>`
:`<div class="mtop"><b style="font-weight:500">${esc(m.name)}</b>${availTag(m)}</div><small style="display:block;margin:4px 0 8px">Anchored ${dv(id,"anchor")} · offset ${dv(id,"offX")}, ${dv(id,"offY")}</small>
${(()=>{const content=m.settings.filter(d=>!["enabled","anchor","offX","offY",...HUD_APPEAR,"scale"].includes(d.key)&&d.type!=="KEY");const row=k=>{const d=m.settings.find(x=>x.key===k);return d?ctrlHtml(m,d,dv(id,k)):""};
  return (content.length?UI.sect("Content",content.map(d=>ctrlHtml(m,d,dv(id,d.key))).join(""),{open:true}):"")+UI.sect("Appearance",["style","color","accent","opacity","background","bgOpacity","border","shadow"].map(row).join(""),{open:!content.length})+UI.sect("Size",row("scale"),{open:false})})()}
<div class="row2"><button class="btn" data-he="reset-el">Reset position</button><button class="btn" data-he="hide-el">Hide element</button></div>`;
if(m){wireCtrls(p,()=>{const v=readCtrls(p,m);for(const[k,val]of Object.entries(v))HE.draft[id+"."+k]=val;heDraw()},m)}}
function heList(){const l=$("#he-list");if(!l)return;l.innerHTML=hudMods().map(m=>`<label class="he-row${m.id===HE.sel?" on":""}"><button class="tg" role="switch" aria-checked="${HE.draft[m.id+".enabled"]==="true"}" data-hevis="${m.id}" aria-label="Show ${esc(m.name)}"${m.available?"":" disabled"}></button><span data-hesel="${m.id}" style="flex:1;cursor:pointer">${esc(m.name)}</span>${m.available?"":`<span class="tip left" tabindex="0" data-tip="Not in the game yet: ${esc(m.note)}" aria-label="Not in the game yet">${ic("lock",13)}</span>`}</label>`).join("")}
async function openHudEditor(){await mcLoad();const vals=mcVals();HE.draft={...vals};HE.orig={...vals};HE.sel=null;HE.t0=performance.now();HE.guides=[null,null];
HE.layouts=isDesk()&&auroras.layoutsList?await auroras.layoutsList(cur().id).catch(()=>({})):ls.get("hudLayouts:"+cur().id,{});
const d=document.createElement("div");d.id="hudedit";d.innerHTML=`<div class="he-top"><b style="font-weight:500">HUD editor</b><small id="he-info"></small><span style="flex:1"></span>
<select class="f" id="he-screen" style="width:auto" aria-label="Screen size">${SCREENS.map(s=>`<option${s[0]===HE.screen?" selected":""}>${s[0]}</option>`).join("")}</select>
<select class="f" id="he-gui" style="width:auto" aria-label="GUI scale">${[0,1,2,3,4,5].map(g=>`<option value="${g}"${g===HE.gui?" selected":""}>${g?"GUI scale "+g:"GUI scale Auto"}</option>`).join("")}</select>
<label style="display:flex;gap:6px;align-items:center"><button class="tg" role="switch" id="he-snap" aria-checked="${HE.snap}" aria-label="Snap to guides"></button><small>Snap</small></label>
<label style="display:flex;gap:6px;align-items:center"><button class="tg" role="switch" id="he-prev" aria-checked="${HE.preview}" aria-label="Preview without outlines"></button><small>Preview</small></label>
<button class="btn" data-he="cancel">Cancel</button><button class="btn pri" data-he="apply">Save layout</button></div>
<div class="he-main"><div class="he-side"><h2>Elements</h2><div id="he-list"></div><h2 style="margin-top:14px">Layout presets</h2><div id="he-presets"></div></div><div class="he-stage"><div class="he-badge" id="he-badge"><i></i>Editing layout · nothing is saved until you press Save layout</div><canvas id="he-cv" aria-label="HUD layout"></canvas></div><div class="he-side" id="he-panel"></div></div>
<small class="he-foot">Positions, anchors, scaling, snapping and screen-edge clamping use the game’s own code. Widgets are drawn the way the game draws them, with the same font, sizes and styles. ${esc(whereNote().replace(/<[^>]+>/g,""))}</small>`;
document.body.appendChild(d);heList();hePanel();hePresets();heDraw();
const cv=$("#he-cv");
cv.onpointerdown=e=>{const h=heHit(e);HE.sel=h.id;heList();hePanel();if(h.id){const r=HE.rects[h.id];HE.drag={id:h.id,handle:h.handle,dx:h.x-r.x,dy:h.y-r.y,sx:h.x,sc0:+dv(h.id,"scale"),bw:r.b.w};cv.setPointerCapture(e.pointerId)}heDraw()};
cv.onpointermove=e=>{const h=heHit(e);cv.style.cursor=HE.drag?(HE.drag.handle?"nwse-resize":"grabbing"):h.id?(h.handle?"nwse-resize":"grab"):"default";if(!HE.drag)return;const{w:sw,h:sh}=guiSize(),id=HE.drag.id;
 if(HE.drag.handle){HE.draft[id+".scale"]=String(Math.round(VX.scaleFromDrag(HE.drag.sc0,Math.round(h.x-HE.drag.sx),HE.drag.bw)*20)/20)}
 else{const r=HE.rects[id];let x=Math.round(h.x-HE.drag.dx),y=Math.round(h.y-HE.drag.dy);HE.guides=[null,null];
  if(HE.snap&&!e.altKey){const others=Object.entries(HE.rects).filter(([k])=>k!==id).map(([,q])=>[q.x,q.y,q.w,q.h]),s=VX.snap(x,y,r.w,r.h,sw,sh,4,others);x=s[0];y=s[1];HE.guides=[s[2],s[3]]}
  const p=VX.fromPosition(x,y,r.w,r.h,sw,sh);HE.draft[id+".anchor"]=p.anchor;HE.draft[id+".offX"]=String(p.offX);HE.draft[id+".offY"]=String(p.offY)}heDraw()};
cv.onpointerup=cv.onpointercancel=()=>{if(HE.drag){HE.drag=null;HE.guides=[null,null];hePanel();heDraw()}};
d.onkeydown=e=>{if(!HE.sel||!/^Arrow/.test(e.key)||e.target.closest("input,select"))return;e.preventDefault();const st=e.shiftKey?10:1,{w:sw,h:sh}=guiSize(),r=HE.rects[HE.sel];if(!r)return;
 const x=r.x+(e.key==="ArrowLeft"?-st:e.key==="ArrowRight"?st:0),y=r.y+(e.key==="ArrowUp"?-st:e.key==="ArrowDown"?st:0),c=[Math.max(0,Math.min(x,sw-r.w)),Math.max(0,Math.min(y,sh-r.h))],p=VX.fromPosition(c[0],c[1],r.w,r.h,sw,sh);
 HE.draft[HE.sel+".anchor"]=p.anchor;HE.draft[HE.sel+".offX"]=String(p.offX);HE.draft[HE.sel+".offY"]=String(p.offY);hePanel();heDraw()};d.tabIndex=-1;d.focus();
d.onchange=e=>{if(e.target.id==="he-screen"){HE.screen=e.target.value;heDraw()}if(e.target.id==="he-gui"){HE.gui=+e.target.value;heDraw()}};
d.onclick=async e=>{const t=e.target.closest("[data-he],[data-hevis],[data-hesel],#he-snap,#he-prev,[data-hel],[data-heldel]");if(!t)return;
 if(t.id==="he-snap"){HE.snap=!HE.snap;t.setAttribute("aria-checked",HE.snap)}else if(t.id==="he-prev"){HE.preview=!HE.preview;t.setAttribute("aria-checked",HE.preview);d.classList.toggle("pv",HE.preview);heDraw()}
 else if(t.dataset.hevis){const k=t.dataset.hevis+".enabled";HE.draft[k]=HE.draft[k]==="true"?"false":"true";if(HE.draft[k]==="true")HE.sel=t.dataset.hevis;heList();hePanel();heDraw()}
 else if(t.dataset.hesel){if(HE.draft[t.dataset.hesel+".enabled"]==="true"){HE.sel=t.dataset.hesel;heList();hePanel();heDraw()}}
 else if(t.dataset.hel){const lay=HE.layouts[t.dataset.hel];if(lay){Object.assign(HE.draft,lay);heList();hePanel();heDraw();toast("Loaded layout “"+t.dataset.hel+"”. Save layout to keep it.")}}
 else if(t.dataset.heldel){const n=t.dataset.heldel;confirmDlg(`Delete layout “${n}”?`,"This removes the saved layout preset from this instance.","Delete",async()=>{if(isDesk()&&auroras.layoutsDelete)HE.layouts=await auroras.layoutsDelete({id:cur().id,name:n});else{delete HE.layouts[n];ls.set("hudLayouts:"+cur().id,HE.layouts)}hePresets()})}
 else{const a=t.dataset.he;
  if(a==="reset-el"){const m=REG.modules.find(x=>x.id===HE.sel);for(const k of["anchor","offX","offY","scale"])HE.draft[HE.sel+"."+k]=m.settings.find(s=>s.key===k).def;hePanel();heDraw()}
  else if(a==="hide-el"){HE.draft[HE.sel+".enabled"]="false";HE.sel=null;heList();hePanel();heDraw()}
  else if(a==="reset-all")confirmDlg("Reset the whole HUD layout?","Every element goes back to its default position, size and style. Nothing is saved until you press Save layout.","Reset",()=>{const def=RULES.defaults();for(const k of VX.LAYOUT_KEYS)for(const m of hudMods())if(m.settings.some(s=>s.key===k))HE.draft[m.id+"."+k]=def[m.id+"."+k];HE.sel=null;heList();hePanel();heDraw()});
  else if(a==="save-preset")promptDlg("Save layout preset","Preset name","",async n=>{if(!VX.NAME.test(n))return"Use 1–32 letters, numbers, spaces, dots, dashes or underscores.";const lay=VX.captureLayout(REG,HE.draft);
   if(isDesk()&&auroras.layoutsSave)HE.layouts=await auroras.layoutsSave({id:cur().id,name:n,layout:lay});else{HE.layouts[n]=lay;ls.set("hudLayouts:"+cur().id,HE.layouts)}hePresets()});
  else if(a==="export"){saveBlob("auroras-hud-layout.txt",new Blob([VX.exportLayout("Exported",VX.captureLayout(REG,HE.draft))],{type:"text/plain"}))}
  else if(a==="cancel"){d.remove();cancelAnimationFrame(HE.raf)}
  else if(a==="apply"){const set={};for(const[k,v]of Object.entries(VX.captureLayout(REG,HE.draft)))if(HE.orig[k]!==v)set[k]=v;
   const off=Object.keys(set).filter(k=>k.endsWith(".enabled")&&set[k]==="true"&&!REG.modules.find(m=>m.id===k.split(".")[0]).available);off.forEach(k=>delete set[k]);
   try{if(Object.keys(set).length)await mcSave(set);toast(Object.keys(set).length?"HUD layout saved for "+cur().name:"No changes to save");d.remove();cancelAnimationFrame(HE.raf);if(S.page==="modules")drawModules2()}catch(err){toast(errMsg(err))}}}};
let last=0;const loop=ts=>{if(!document.getElementById("hudedit"))return;HE.raf=requestAnimationFrame(loop);if(document.hidden||ts-last<100)return;last=ts;if(!HE.drag)heDraw()};HE.raf=requestAnimationFrame(loop);
window.addEventListener("resize",heDraw)}
function hePresets(){const p=$("#he-presets");if(!p)return;const names=Object.keys(HE.layouts);
p.innerHTML=`${names.length?names.map(n=>`<div class="he-row"><button class="pbtn" data-hel="${esc(n)}" style="flex:1;text-align:left">${esc(n)}</button><button class="btn" data-heldel="${esc(n)}" aria-label="Delete ${esc(n)}" style="height:24px;padding:0 6px;font-size:11px">Delete</button></div>`).join(""):`<small>No saved layouts yet.</small>`}
<div class="row2" style="flex-direction:column;align-items:stretch;gap:6px"><button class="btn" data-he="save-preset">Save current as preset</button><span style="display:flex;gap:6px"><button class="btn" data-he="export" style="flex:1">Export</button><label class="btn" style="flex:1;cursor:pointer;justify-content:center">Import<input type="file" id="he-imp" accept=".txt,text/plain" hidden></label></span><button class="btn" data-he="reset-all">Reset layout</button></div>`;
const imp=p.querySelector("#he-imp");if(imp)imp.onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{if(f.size>65536)throw new Error("That file is too large to be a HUD layout.");Object.assign(HE.draft,VX.importLayout(REG,RULES,await f.text()));heList();hePanel();heDraw();toast("Layout imported. Save layout to keep it.")}catch(x){toast(errMsg(x))}}}
