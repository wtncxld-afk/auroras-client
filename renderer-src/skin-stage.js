/* ----- Canvas skin stage: the same player model and lighting as the studios (visuals/preview3d.js). Used when WebGL or the
   three.js file isn't available, so the skin preview always works. Pauses while hidden or while the game runs. ----- */
const STAGE_POSE=new Float64Array(28);
function canvasSkinStage(cv,o){let tex=null,key="",loading="",raf=0,last=0,drag=null,idleAt=0,stopped=false;const t0=performance.now();
  const load=sk=>{if(sk.key===key||sk.key===loading)return;if(sk.canvas){tex=texOf(sk.canvas);key=sk.key;return}loading=sk.key;const done=img=>{if(loading!==sk.key)return;try{tex=texOf(img?skinCanvas(img):defaultSkin())}catch(e){tex=texOf(defaultSkin())}key=sk.key;loading=""};
    if(sk.src){const im=new Image();im.onload=()=>done(im);im.onerror=()=>done(null);im.src=sk.src}else done(null)};
  cv.style.cursor="grab";cv.onpointerdown=e=>{drag=e.clientX;idleAt=performance.now();cv.setPointerCapture(e.pointerId);cv.style.cursor="grabbing"};
  cv.onpointermove=e=>{if(drag===null)return;o.setYaw(o.yaw()-(e.clientX-drag)*0.012);drag=e.clientX;idleAt=performance.now()};
  cv.onpointerup=cv.onpointercancel=()=>{drag=null;idleAt=performance.now();cv.style.cursor="grab"};
  const frame=ts=>{if(stopped||!cv.isConnected)return;raf=requestAnimationFrame(frame);if(document.hidden||GAME_RUNNING||ts-last<(UNFOCUSED?100:33))return;const dt=last?Math.min(0.1,(ts-last)/1000):0;last=ts;
    const sk=o.skin();load(sk);if(!tex)return;const dpr=Math.min(2,devicePixelRatio||1),W=Math.round(cv.clientWidth*dpr),H=Math.round(cv.clientHeight*dpr);if(!W||!H)return;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
    const t=(ts-t0)/1000,still=REDUCED();STAGE_POSE.fill(0);if(!still&&o.idle!==false){STAGE_POSE[8]=Math.sin(t*1.3)*4;STAGE_POSE[12]=-Math.sin(t*1.3)*4;STAGE_POSE[1]=Math.sin(t*0.6)*7;STAGE_POSE[0]=Math.sin(t*0.9)*2}
    if(!still&&o.rot()&&drag===null&&ts-idleAt>2500)o.setYaw(o.yaw()-dt*0.3);
    const q=PV.posedPlayer(tex,STAGE_POSE,{slim:sk.slim,layer:sk.layer!==false});PV.render(cv.getContext("2d"),W,H,q,{yaw:-o.yaw(),pitch:0.08,dist:o.dist||86,target:[0,o.target||16,0],fov:28},{light:"studio",background:false,shadow:{y:0,r:10}})};
  raf=requestAnimationFrame(frame);return()=>{stopped=true;cancelAnimationFrame(raf)}}
