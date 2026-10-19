/* ----- Friends: real friends through your own Auroras friends server (friends-server/). Nothing here is simulated. ----- */
const FR={data:null,err:"",loading:false,url:"",checked:false,timer:0,seq:0,busy:""};
const frDesk=()=>!!(window.auroras&&auroras.friendsOverview);
const frAcct=()=>{const a=curAcct();return a&&!a.preview?a:null};
/** A friend's status in words, and the dot colour class. */
function frStatus(f){if(f.state==="playing")return[f.server?"Playing on "+f.server:"Playing Minecraft"+(f.instance?" · "+f.instance:""),"play"];if(f.state==="online")return["In the launcher","on"];if(f.state==="away")return["Away","away"];
  if(!f.lastSeen)return["Offline","off"];const m=Math.round((Date.now()-Date.parse(f.lastSeen))/60000);return["Offline · seen "+(m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"),"off"]}
const frHue=u=>parseInt(String(u).slice(0,6),16)%360;
const frAv=(f,dot)=>`<span class="frav" style="--h:${frHue(f.uuid)}">${esc(f.name[0]).toUpperCase()}${dot?`<i class="frdot s-${dot}" aria-hidden="true"></i>`:""}</span>`;
PAGES.friends=()=>`<div class="page friends" style="max-width:900px"><div class="head"><h1>Friends</h1><span class="fr-me" id="fr-me"></span></div><div id="fr-body">${frBody()}</div></div>`;
function frBody(){
  if(!frDesk())return `<div class="panel">${UI.state("unavail","Friends needs the desktop app","Friends signs in with your Minecraft account through the Auroras desktop app.",null,"users")}</div>`;
  if(!FR.checked)return `<div class="panel">${UI.state("loading","Loading friends…","",null)}</div>`;
  if(!FR.url)return `<div class="panel fr-setup"><b>Friends needs an Auroras friends server</b><small>The server is in the <code>friends-server</code> folder of this project: one small Node program with no dependencies. Run it on any host with HTTPS and enter its address here. To build it into every installer, set the <code>FRIENDS_URL</code> repository variable instead.</small>
<form class="fr-form" data-frurl><input class="f" id="fr-url" placeholder="https://friends.example.net" autocomplete="off" spellcheck="false" aria-label="Friends server address"><button class="btn pri" type="submit">Save</button></form><div class="err" id="fr-urlerr" role="alert"></div></div>`;
  const a=frAcct();if(!a)return `<div class="panel">${UI.state("empty","Sign in with Microsoft to use Friends","Friends proves who you are with your Minecraft account, so preview-only accounts can’t use it.",{label:"Add account",attrs:"data-add"},"users")}</div>`;
  if(FR.err&&!FR.data)return `<div class="panel">${UI.state("error","Couldn’t reach your friends",esc(FR.err),{label:"Try again",attrs:"data-frretry"})}</div>`;
  if(!FR.data)return `<div class="panel">${UI.state("loading","Signing in to friends…","Checking your Minecraft account with Mojang.",null)}</div>`;
  const d=FR.data,on=d.friends.filter(f=>f.state!=="offline"),off=d.friends.filter(f=>f.state==="offline"),playing=PL.state==="playing";
  const row=f=>{const[st,dot]=frStatus(f);return `<div class="frrow">${frAv(f,dot)}<span class="min"><b>${esc(f.name)}</b><small>${esc(st)}</small></span><span class="fract">
${f.state==="playing"&&f.server?`<button class="btn pri sm" data-frjoin="${esc(f.server)}">${ic("play",13)}Join</button>`:""}${playing?`<button class="btn sm" data-fract="invite" data-u="${f.uuid}">Invite</button>`:""}<button class="ibtn sm danger" data-frrm="${f.uuid}" data-name="${esc(f.name)}" aria-label="Remove ${esc(f.name)}" data-tt="Remove">${ic("trash",13)}</button></span></div>`};
  return `${FR.err?`<div class="err" role="alert" style="margin-bottom:10px">${esc(FR.err)}</div>`:""}
<form class="panel fr-add" data-fradd><span class="frico">${ic("plus",16)}</span><input class="f" id="fr-name" placeholder="Add a friend by Minecraft username" maxlength="16" autocomplete="off" spellcheck="false" aria-label="Minecraft username"><button class="btn pri" type="submit">Send request</button></form><div class="err" id="fr-adderr" role="alert"></div>
${d.invites.length?`<h2>Invites</h2><div class="panel frlist">${d.invites.map(v=>`<div class="frrow">${frAv(v,"play")}<span class="min"><b>${esc(v.name)} invited you</b><small>to ${esc(v.server)}</small></span><span class="fract"><button class="btn pri sm" data-frjoin="${esc(v.server)}">${ic("play",13)}Join</button></span></div>`).join("")}</div>`:""}
${d.incoming.length?`<h2>Requests <span class="count">${d.incoming.length}</span></h2><div class="panel frlist">${d.incoming.map(r=>`<div class="frrow">${frAv(r)}<span class="min"><b>${esc(r.name)}</b><small>Wants to be friends</small></span><span class="fract"><button class="btn pri sm" data-fract="accept" data-u="${r.uuid}">Accept</button><button class="btn ghost sm" data-fract="decline" data-u="${r.uuid}">Decline</button></span></div>`).join("")}</div>`:""}
<h2>Online <span class="count">${on.length}</span></h2><div class="panel frlist">${on.length?on.map(row).join(""):`<div class="frempty"><small>${d.friends.length?"None of your friends are online right now.":"Add friends by their Minecraft username. They need to open Friends in Auroras once."}</small></div>`}</div>
${off.length?`<h2>Offline <span class="count">${off.length}</span></h2><div class="panel frlist">${off.map(row).join("")}</div>`:""}
${d.outgoing.length?`<h2>Sent</h2><div class="panel frlist">${d.outgoing.map(r=>`<div class="frrow">${frAv(r)}<span class="min"><b>${esc(r.name)}</b><small>Request sent</small></span><span class="fract"><button class="btn ghost sm" data-fract="cancel" data-u="${r.uuid}">Cancel</button></span></div>`).join("")}</div>`:""}`}
function frDraw(){const b=$("#fr-body");if(!b)return;const keep=$("#fr-name")?.value||"";b.innerHTML=frBody();const n=$("#fr-name");if(n&&keep)n.value=keep;const me=$("#fr-me");if(me)me.innerHTML=FR.data?`${frAv(FR.data.me,PL.state==="playing"?"play":"on")}<small>Signed in as <b>${esc(FR.data.me.name)}</b></small>`:""}
async function frLoad(){if(!frDesk())return frDraw();const n=++FR.seq;
  if(!FR.checked){try{const s=await auroras.friendsState();FR.url=s.url}catch(e){FR.url=""}FR.checked=true}
  const a=frAcct();if(!FR.url||!a){FR.data=null;return frDraw()}
  if(FR.acct!==a.uuid){FR.data=null;FR.err="";FR.acct=a.uuid;frDraw()}
  try{const d=await auroras.friendsOverview(a.uuid);if(n!==FR.seq)return;FR.data=d;FR.err=""}catch(e){if(n!==FR.seq)return;const m=errMsg(e);if(/NO_FRIENDS_SERVER/.test(m)){FR.url="";FR.data=null}else FR.err=m}
  frDraw();frBadge()}
/** Incoming requests show as a count on the sidebar. */
function frBadge(){const el=document.querySelector('.nav[data-go="friends"]');if(!el)return;let b=el.querySelector(".frn");const n=FR.data?FR.data.incoming.length+FR.data.invites.length:0;if(!n){b&&b.remove();return}if(!b){b=document.createElement("i");b.className="badge frn";el.appendChild(b)}b.textContent=n}
async function frAct(action,arg){const a=frAcct();if(!a||FR.busy)return false;FR.busy=action;try{const r=await auroras.friendsAct({uuid:a.uuid,action,arg});
  if(action==="request")toast(r.friend?"You and "+r.friend+" are now friends.":"Friend request sent to "+r.sent+".","ok");else if(action==="accept")toast("You and "+r.friend+" are now friends.","ok");else if(action==="invite")toast("Invite sent.","ok");
  FR.busy="";await frLoad();return true}catch(e){const m=errMsg(e);if(action==="request"){const er=$("#fr-adderr");if(er)er.textContent=m}else toast(m,"err");return false}finally{FR.busy=""}}
function initFriends(){frLoad();clearInterval(FR.timer);FR.timer=setInterval(()=>{if(S.page!=="friends")return clearInterval(FR.timer);if(!document.hidden)frLoad()},20000);
  const page=document.querySelector(".page");
  page.onsubmit=async e=>{e.preventDefault();if(e.target.matches("[data-fradd]")){const v=$("#fr-name").value.trim();$("#fr-adderr").textContent="";if(await frAct("request",v)){const n=$("#fr-name");if(n)n.value=""}}
    else if(e.target.matches("[data-frurl]")){const v=$("#fr-url").value.trim(),er=$("#fr-urlerr");er.textContent="";try{await auroras.setSettings({friendsUrl:v});FR.checked=false;await frLoad()}catch(x){er.textContent=errMsg(x)}}};
  page.onclick=e=>{const t=e.target.closest("[data-fract],[data-frjoin],[data-frrm],[data-frretry]");if(!t)return;
    if(t.dataset.fract)frAct(t.dataset.fract,t.dataset.u);else if(t.dataset.frjoin)doPlay({server:t.dataset.frjoin});else if(t.hasAttribute("data-frretry")){FR.err="";FR.data=null;frDraw();frLoad()}
    else if(t.dataset.frrm)confirmDlg(`Remove ${t.dataset.name}?`,"You’ll stop seeing each other online. You can add each other again later.","Remove",()=>frAct("remove",t.dataset.frrm))}}
POST.friends=initFriends;
/* Presence: while the launcher is open with a Microsoft account, tell the friends server you're online (the desktop side
   adds "playing" and the server while a game runs). Only after you've opened Friends once in this session. */
setInterval(()=>{const a=frAcct();if(frDesk()&&FR.url&&a&&FR.acct===a.uuid)auroras.friendsPresence({uuid:a.uuid,state:document.hidden?"away":"online"}).catch(()=>{})},60000);
