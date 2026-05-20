// ── PARKING MODE
// Level configuration, level generation, drawing, physics, events specific to parking mode

const MODE_NAMES=['SERBEST ALAN','OTOPARK','SÜRÜCÜ KURSU','L-PARK','GERİ GİRİŞ','ÇİFT PARK','YEŞİL DALGA','GECE MODU','ZİGZAG','DAR KORIDOR','VIP PARK','KAYGAN ZEMİN','🔥 DRİFT MODU'];
const MODE_ICONS=['🚗','🏢','🛣','↔','🔄','🅿🅿','🟢','🌙','〰','🚧','👑','❄','🔥'];

function getLevelMode(l){
  if(GAME_MODE==='drift') return 12;
  if(l===1)return 0;
  if(l===2)return 3;
  if(l===3)return 2;
  if(l===4)return 1;
  if(l===5)return 4;
  const patterns=[
    [0,3,2,1,4,5,7,3,2,8,1,4,9,0,5,6,7,11,3,10],
    [1,4,8,3,0,9,2,5,7,1,11,4,10,2,6,3,8,0,5,4],
    [9,2,5,0,7,3,11,1,4,6,2,8,0,5,10,3,7,4,9,1]
  ];
  const tier=Math.floor((l-1)/20);
  const pat=patterns[tier%patterns.length];
  return pat[(l-1)%pat.length];
}

function cfg(l){
  const mode=getLevelMode(l);
  const tier=Math.floor((l-1)/5);
  const spotShrink=Math.max(1.0, 1.75 - tier*0.075);
  const base={
    time:Math.max(20,70-tier*5-(l%4)*2),
    sm:Math.max(1.0,spotShrink),
    mf:3.0+tier*.25,
    obs:2+tier*2+(l%4),
    npc:Math.max(0,tier-1+(l%4>2?1:0)),
    mode,
    needKey:l>=2,
    numKeys:l>=4?(l>=8?3:2):1,
    slippery:mode===11,
    dark:mode===7,
    speedLimit:mode===6?1.2+tier*.1:999,
    isDrift:mode===12,
  };
  if(mode===2||mode===8){base.time=Math.max(30,85-tier*8);}
  if(mode===1||mode===9){base.obs=Math.max(2,base.obs-2);base.npc+=1;}
  if(mode===5){base.numKeys=Math.max(1,base.numKeys-1);}
  if(mode===11){base.mf=Math.max(2.5,base.mf*.85);}
  if(mode===12){
    base.time=999;
    base.obs=1+tier;
    base.npc=0;
    base.needKey=false;
    base.speedLimit=999;
  }
  return base;
}

function driftSel(cat,val){
  if(cat==='map'){
    DRIFT_MAP=val;
    document.querySelectorAll('#map-open,#map-carpark').forEach(b=>b.classList.remove('active'));
    document.getElementById('map-'+val).classList.add('active');
  } else if(cat==='tod'){
    DRIFT_TOD=val;
    document.querySelectorAll('#tod-day,#tod-night').forEach(b=>b.classList.remove('active'));
    document.getElementById('tod-'+val).classList.add('active');
  } else if(cat==='dt'){
    DRIFT_DT=val;
    document.querySelectorAll('.dtbtn').forEach(b=>b.classList.remove('active'));
    document.getElementById('dt-'+val).classList.add('active');
    const desc=DT_PRESETS[val]?.desc||'';
    document.getElementById('dtdesc').textContent=desc;
  }
}

function launchDrift(){
  showScreen('driftmenu',false);
  startGame('drift');
}

function _baseGoToMenu(){
  GS='start';SCORE=0;LIVES=3;LVL=1;COMBO=0;
  if(raf){cancelAnimationFrame(raf);raf=null;}
  clearInterval(tInt);
  ['luo','cro','goo','rwo','driftmenu'].forEach(x=>showScreen(x,false));
  showScreen('sto',true);
}

function goToMenu(){
  if(POLIS_MODE){
    POLIS_MODE=false;POLIS_ALIVE=false;
    if(POLIS_RAF){cancelAnimationFrame(POLIS_RAF);POLIS_RAF=null;}
    document.getElementById('polis-hud').classList.remove('show');
    document.getElementById('polis-ctrl').classList.remove('show');
    document.getElementById('siren-overlay').className='';
    document.getElementById('polis-alert').classList.remove('show');
    document.getElementById('polis-combo-badge').classList.remove('show');
    document.getElementById('polis-intro').classList.remove('show');
    showScreen('polis-go',false);
    document.getElementById('hud').style.display='flex';
    document.getElementById('ctrl').style.display='flex';
  }
  _baseGoToMenu();
}

function startGame(mode){
  GAME_MODE=mode||'park';
  SCORE=0;LIVES=3;LVL=1;GS='playing';
  car.color=CHOSEN_COLOR;car.roof=shade(CHOSEN_COLOR,-42);
  showScreen('sto',false);
  const dtel=document.getElementById('dtbadge');
  if(GAME_MODE==='drift'){
    dtel.textContent=DRIFT_DT.toUpperCase();dtel.classList.add('show');
    const dt=document.getElementById('daytint');
    dt.classList.toggle('show',DRIFT_TOD==='day');
  } else {
    dtel.classList.remove('show');
    document.getElementById('daytint').classList.remove('show');
  }
  resize();genLevel();startTimer();if(!raf)loop();
}

function nextLevel(){
  LVL++;GS='playing';
  ['luo','cro','goo','rwo'].forEach(x=>showScreen(x,false));
  document.getElementById('lanewarn').classList.remove('show');
  genLevel();startTimer();
}

function restartLevel(){
  GS='playing';
  showScreen('cro',false);
  document.getElementById('lanewarn').classList.remove('show');
  genLevel();startTimer();
}

function restartGame(){
  SCORE=0;LIVES=3;LVL=1;GS='playing';COMBO=0;
  ['luo','cro','goo','rwo'].forEach(x=>showScreen(x,false));
  document.getElementById('lanewarn').classList.remove('show');
  resize();genLevel();startTimer();
}

function closeReward(){
  showScreen('rwo',false);
  GS='playing';
  startTimer();
}

function updHUD(){
  document.getElementById('sd').textContent=SCORE;
  document.getElementById('ld').textContent=LVL;
  document.getElementById('livd').textContent='❤'.repeat(Math.max(0,LIVES))+'🖤'.repeat(Math.max(0,3-LIVES));
  document.getElementById('gom').textContent=`Skor: ${SCORE} | LVL: ${LVL}`;
  if(COMBO>1){
    const cb=document.getElementById('combobadge');
    cb.textContent=`🔥 COMBO x${COMBO}`;
    cb.classList.add('show');
    COMBO_TIMER=180;
  }
}

let LANE_PATH=[];
let LANE_WIDTH=52;
let laneScore=0;
let PS2=null;

function genLanePath(zigzag=false){
  LANE_PATH=[];
  const margin=60;
  const steps=14+Math.floor(LVL/3)*2;
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    const x=margin+(W-margin*2)*t;
    let y;
    if(zigzag){
      const seg=Math.floor(t*8);
      const frac=t*8-seg;
      const amp=H*.20+Math.floor(LVL/5)*10;
      y=H*.45+(seg%2===0?frac:1-frac)*amp*2-amp;
    } else {
      const freq=2+Math.floor(LVL/3)*.5;
      const amp=(H*.18)+Math.floor(LVL/5)*8;
      y=H*.45+Math.sin(t*Math.PI*freq)*amp+Math.sin(t*Math.PI*freq*1.7)*(amp*.4);
    }
    LANE_PATH.push({x:~~x,y:~~Math.max(80,Math.min(H-80,y))});
  }
}

function distToLane(px,py){
  let minD=1e9;
  for(let i=0;i<LANE_PATH.length-1;i++){
    const a=LANE_PATH[i],b=LANE_PATH[i+1];
    const dx=b.x-a.x,dy=b.y-a.y;
    const len2=dx*dx+dy*dy;
    if(len2===0)continue;
    let t=((px-a.x)*dx+(py-a.y)*dy)/len2;
    t=Math.max(0,Math.min(1,t));
    const cx=a.x+t*dx,cy=a.y+t*dy;
    const d=Math.hypot(px-cx,py-cy);
    if(d<minD)minD=d;
  }
  return minD;
}

let CARPARK_WALLS=[];
let CARPARK_SPOTS=[];
let CARPARK_TYPE=0;

function genCarparkLayout(narrow=false){
  CARPARK_WALLS=[];
  CARPARK_SPOTS=[];
  CARPARK_TYPE=narrow?1:0;
  const pillarW=narrow?8:10,pillarH=narrow?14:18;
  const rows=narrow?4:3;
  const cols=narrow?5:4;
  const startY=H*.10;
  const endY=H*.62;
  const rowH=(endY-startY)/rows;
  const colW=W/cols;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      CARPARK_WALLS.push({x:c*colW+colW*.42,y:startY+r*rowH+rowH*.3,w:pillarW,h:pillarH,isPillar:true});
    }
  }
  const spotColors=['#3355cc','#cc5533','#44aa44','#886622','#888899','#aa33cc','#ee8833','#33aacc'];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if(Math.random()<(narrow?0.8:0.6)){
        const bx=c*colW+colW*.08+Math.random()*colW*.15;
        const by=startY+r*rowH+rowH*.05;
        CARPARK_SPOTS.push({x:bx,y:by,color:spotColors[~~(Math.random()*spotColors.length)],angle:(Math.random()-.5)*.04});
      }
    }
  }
  if(narrow){
    for(let r=0;r<rows-1;r++){
      CARPARK_WALLS.push({x:W*.1,y:startY+r*rowH+rowH*.75,w:W*.8,h:5,isPillar:false,isBarrier:true,bar:true,angle:0,color:'#ff8800',roof:'#cc6600'});
    }
  }
}

function genBonusCoins(){
  BONUS_COINS=[];
  const n=2+Math.floor(LVL/3);
  for(let i=0;i<n;i++){
    let cx,cy,att=0;
    do{cx=60+Math.random()*(W-120);cy=60+Math.random()*(H-200);att++;}
    while(dist(cx,cy,car.x,car.y)<80&&att<30);
    BONUS_COINS.push({x:cx,y:cy,collected:false,pulse:0,val:50+LVL*10});
  }
}

function genLevel(){
  const c=cfg(LVL);
  car.maxF=c.mf; car.maxR=c.mf*.42;
  car.fric=c.slippery?.985:.965;
  car.steer=c.slippery?.038:.050;
  TIMER=c.time;
  car.speed=0; car.angle=0;
  car.crashed=false; car.parked=false;
  parts=[]; tmarks=[]; cflash=0; pflash=0; AF=0;
  KEYS_ON_MAP=[]; KEYS_COLLECTED=0; REWARD=null;
  floatMsgs=[]; laneWarningTimer=0; laneOutTimer=0; laneScore=0;
  COMBO=0;COMBO_TIMER=0;
  PS2=null;
  DRIFT_SCORE=0;DRIFT_ACTIVE=false;DRIFT_TIMER=0;DRIFT_TOTAL=0;
  car_vx=0;car_vy=0;DRIFT_ZONES=[];DRIFT_ZONE_HITS=0;lastDriftBarPct=-1;lastDriftLabel='';lastDriftBadgeColor='';
  car.color=CHOSEN_COLOR; car.roof=shade(CHOSEN_COLOR,-42);
  LANE_PATH=[]; CARPARK_WALLS=[]; CARPARK_SPOTS=[];
  const mode=c.mode;
  document.getElementById('modebadge').textContent=MODE_ICONS[mode]+' '+MODE_NAMES[mode];
  document.getElementById('keybadge').textContent=c.needKey?`🔑×${c.numKeys}`:'';
  document.getElementById('combobadge').classList.remove('show');
  const isDriftMode=mode===12;
  document.getElementById('driftbar-wrap').className=isDriftMode?'show':'';
  document.getElementById('driftmode-overlay').className=isDriftMode?'show':'';
  if(!isDriftMode){
    document.getElementById('driftbadge').classList.remove('show');
    document.getElementById('driftscore').classList.remove('show');
  }
  if(mode===2){
    genLanePath(false);
    const sp=LANE_PATH[0];
    car.x=sp.x+30; car.y=sp.y;
    car.angle=Math.PI/2;
    const ep=LANE_PATH[LANE_PATH.length-1];
    const sw=CW*c.sm*1.6,sh=CH*c.sm*1.3;
    PS={x:ep.x-sw/2,y:ep.y-sh/2,w:sw,h:sh};
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        const kpt=LANE_PATH[Math.floor((LANE_PATH.length-2)*(ki+1)/(c.numKeys+1))+1];
        KEYS_ON_MAP.push({x:kpt.x,y:kpt.y,collected:false,pulse:0});
      }
    }
    OBS=[]; NPCS=[];
    for(let i=0;i<Math.min(c.npc,4);i++){
      const npt=LANE_PATH[2+i*2];
      if(npt)NPCS.push({x:npt.x,y:npt.y,angle:Math.PI/2,speed:.28+i*.08,color:CAR_COLORS[(i+4)%CAR_COLORS.length],laneMode:true});
    }
  } else if(mode===8){
    genLanePath(true);
    LANE_WIDTH=42;
    const sp=LANE_PATH[0];
    car.x=sp.x+30; car.y=sp.y;
    car.angle=Math.PI/2;
    const ep=LANE_PATH[LANE_PATH.length-1];
    const sw=CW*c.sm*1.5,sh=CH*c.sm*1.2;
    PS={x:ep.x-sw/2,y:ep.y-sh/2,w:sw,h:sh};
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        const kpt=LANE_PATH[Math.floor((LANE_PATH.length-2)*(ki+1)/(c.numKeys+1))+1];
        KEYS_ON_MAP.push({x:kpt.x,y:kpt.y,collected:false,pulse:0});
      }
    }
    OBS=[]; NPCS=[];
    for(let i=0;i<Math.min(c.npc+1,5);i++){
      const npt=LANE_PATH[1+i*3];
      if(npt)NPCS.push({x:npt.x,y:npt.y,angle:Math.PI/2,speed:.22+i*.06,color:CAR_COLORS[(i+6)%CAR_COLORS.length],laneMode:true});
    }
  } else if(mode===1){
    genCarparkLayout(false);
    car.x=W*.5; car.y=H*.82;
    car.angle=0;
    const sw=CW*c.sm*1.6,sh=CH*c.sm*1.3;
    const sx=W*.1+Math.random()*W*.6, sy=H*.08+Math.random()*H*.08;
    PS={x:sx,y:sy,w:sw,h:sh};
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        const kx=W*.1+Math.random()*W*.5, ky=H*.2+Math.random()*H*.4;
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
    OBS=[];
    for(const w of CARPARK_WALLS){
      OBS.push({x:w.x,y:w.y,w:w.w,h:w.h,angle:w.angle||0,color:'#667799',roof:'#445566',bar:w.isBarrier||false,isPillar:w.isPillar});
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++){
      NPCS.push({x:W*.1+Math.random()*W*.6,y:H*.2+Math.random()*H*.35,angle:Math.random()*Math.PI*2,speed:.35+Math.random()*.4,color:CAR_COLORS[(i+3)%CAR_COLORS.length]});
    }
  } else if(mode===9){
    genCarparkLayout(true);
    car.x=W*.5; car.y=H*.82;
    car.angle=0;
    const sw=CW*c.sm*1.4,sh=CH*c.sm*1.2;
    const sx=W*.05+Math.random()*W*.5, sy=H*.08+Math.random()*H*.08;
    PS={x:sx,y:sy,w:sw,h:sh};
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        const kx=W*.05+Math.random()*W*.4, ky=H*.15+Math.random()*H*.4;
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
    OBS=[];
    for(const w of CARPARK_WALLS){
      OBS.push({x:w.x,y:w.y,w:w.w,h:w.h,angle:w.angle||0,color:'#667799',roof:'#445566',bar:w.isBarrier||false,isPillar:w.isPillar});
    }
    NPCS=[];
    for(let i=0;i<c.npc+1;i++){
      NPCS.push({x:W*.1+Math.random()*W*.5,y:H*.2+Math.random()*H*.3,angle:Math.random()*Math.PI*2,speed:.3+Math.random()*.3,color:CAR_COLORS[(i+5)%CAR_COLORS.length]});
    }
  } else if(mode===3){
    car.x=W*.5; car.y=H*.8;
    car.angle=0;
    const gapW=CW*c.sm*1.9,gapH=CH*c.sm*1.4;
    const sx=W*.5-gapW/2, sy=H*.12+Math.random()*H*.1;
    PS={x:sx,y:sy,w:gapW,h:gapH};
    OBS=[];
    const lColor=CAR_COLORS[3],rColor=CAR_COLORS[4];
    OBS.push({x:sx-CW-8,y:sy,w:CW,h:CH,angle:0,color:lColor,roof:shade(lColor,-35),bar:false});
    OBS.push({x:sx+gapW+8,y:sy,w:CW,h:CH,angle:0,color:rColor,roof:shade(rColor,-35),bar:false});
    for(let i=0;i<c.obs-2;i++){
      let ox,oy,ow=CW,oh=CH,t2=0;
      do{ox=44+Math.random()*(W-88);oy=H*.18+Math.random()*(H*.55);t2++;}
      while((dist(ox+ow/2,oy+oh/2,car.x,car.y)<60||dist(ox+ow/2,oy+oh/2,sx+gapW/2,sy+gapH/2)<80)&&t2<40);
      OBS.push({x:ox,y:oy,w:ow,h:oh,angle:(Math.random()-.5)*.2,color:CAR_COLORS[i%CAR_COLORS.length],roof:shade(CAR_COLORS[i%CAR_COLORS.length],-35),bar:false});
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++){
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.35+H*.15,angle:Math.random()*Math.PI*2,speed:.4+Math.random()*.45,color:CAR_COLORS[(i+2)%CAR_COLORS.length]});
    }
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=H*.15+Math.random()*H*.6;t3++;}
        while(dist(kx,ky,car.x,car.y)<50&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
  } else if(mode===4){
    car.x=W*.5; car.y=H*.72;
    car.angle=0;
    const sw=CW*c.sm*1.8,sh=CH*c.sm*1.4;
    const sx=W*.5-sw/2, sy=H*.08+Math.random()*H*.08;
    PS={x:sx,y:sy,w:sw,h:sh};
    OBS=[];
    OBS.push({x:PS.x-14,y:PS.y,w:10,h:PS.h+10,angle:0,color:'#556677',roof:'#334455',bar:true});
    OBS.push({x:PS.x+PS.w+4,y:PS.y,w:10,h:PS.h+10,angle:0,color:'#556677',roof:'#334455',bar:true});
    for(let i=0;i<c.obs;i++){
      let ox,oy,ow=CW+Math.random()*10,oh=CH+Math.random()*12,t2=0;
      do{ox=44+Math.random()*(W-88);oy=H*.18+Math.random()*(H*.5);t2++;}
      while((dist(ox+ow/2,oy+oh/2,car.x,car.y)<55||dist(ox+ow/2,oy+oh/2,sx+sw/2,sy+sh/2)<65)&&t2<40);
      const col=CAR_COLORS[i%CAR_COLORS.length];
      OBS.push({x:ox,y:oy,w:ow,h:oh,angle:(Math.random()-.5)*.5,color:col,roof:shade(col,-35),bar:false});
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++){
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.4+H*.05,angle:Math.random()*Math.PI*2,speed:.4+Math.random()*.5,color:CAR_COLORS[(i+5)%CAR_COLORS.length]});
    }
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=H*.2+Math.random()*H*.55;t3++;}
        while(dist(kx,ky,car.x,car.y)<50&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
  } else if(mode===5){
    car.x=W*.5; car.y=H*.78;
    car.angle=0;
    const sw=CW*c.sm*1.7,sh=CH*c.sm*1.35;
    const sx1=W*.15, sy1=H*.10+Math.random()*H*.08;
    const sx2=W*.55+Math.random()*W*.15, sy2=H*.10+Math.random()*H*.08;
    PS={x:sx1,y:sy1,w:sw,h:sh,parked1:false};
    PS2={x:sx2,y:sy2,w:sw,h:sh,parked1:false};
    OBS=[];
    for(let i=0;i<c.obs;i++){
      let ox,oy,ow=CW,oh=CH,t2=0;
      do{ox=44+Math.random()*(W-88);oy=H*.2+Math.random()*(H*.5);t2++;}
      while((dist(ox+ow/2,oy+oh/2,car.x,car.y)<55||dist(ox+ow/2,oy+oh/2,sx1+sw/2,sy1+sh/2)<65||dist(ox+ow/2,oy+oh/2,sx2+sw/2,sy2+sh/2)<65)&&t2<40);
      const col=CAR_COLORS[i%CAR_COLORS.length];
      OBS.push({x:ox,y:oy,w:ow,h:oh,angle:(Math.random()-.5)*.5,color:col,roof:shade(col,-35),bar:false});
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++){
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.35+H*.15,angle:Math.random()*Math.PI*2,speed:.4+Math.random()*.5,color:CAR_COLORS[(i+1)%CAR_COLORS.length]});
    }
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=H*.2+Math.random()*H*.5;t3++;}
        while(dist(kx,ky,car.x,car.y)<55&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
  } else if(mode===6||mode===7||mode===10||mode===11){
    car.x=W*.5; car.y=H*.78;
    car.angle=0;
    const sw=CW*c.sm*1.75,sh=CH*c.sm*1.38,mg=52;
    let sx,sy,att=0;
    do{sx=mg+Math.random()*(W-mg*2-sw);sy=mg+Math.random()*(H*.52-mg-sh);att++;}
    while(dist(sx+sw/2,sy+sh/2,car.x,car.y)<130&&att<40);
    PS={x:sx,y:sy,w:sw,h:sh};
    OBS=[];
    for(let i=0;i<c.obs;i++){
      let ox,oy,ow=CW+Math.random()*10,oh=CH+Math.random()*16,t2=0;
      do{ox=44+Math.random()*(W-88);oy=44+Math.random()*(H-220);t2++;}
      while((dist(ox+ow/2,oy+oh/2,car.x,car.y)<55||dist(ox+ow/2,oy+oh/2,sx+sw/2,sy+sh/2)<65)&&t2<40);
      const col=CAR_COLORS[i%CAR_COLORS.length];
      OBS.push({x:ox,y:oy,w:ow,h:oh,angle:(Math.random()-.5)*.9,color:col,roof:shade(col,-35),bar:Math.random()<.22});
    }
    if(mode===10){
      for(let i=0;i<3;i++){
        const bx=W*.2+i*W*.2, by=H*.3+Math.random()*H*.2;
        OBS.push({x:bx-5,y:by,w:10,h:50,angle:0,color:'#ff6600',roof:'#cc4400',bar:true});
      }
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++){
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.4+H*.05,angle:Math.random()*Math.PI*2,speed:.45+Math.random()*.6,color:CAR_COLORS[(i+3)%CAR_COLORS.length]});
    }
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=44+Math.random()*(H-220);t3++;}
        while(dist(kx,ky,car.x,car.y)<55&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
  } else if(mode===12){
    car.angle=Math.PI*.15;
    OBS=[];NPCS=[];PS=null;TIMER=999;
    if(DRIFT_MAP==='carpark'){
      genCarparkLayout(false);
      car.x=W*.5; car.y=H*.82;
      for(const w of CARPARK_WALLS){
        OBS.push({x:w.x,y:w.y,w:w.w,h:w.h,angle:w.angle||0,color:'#223344',roof:'#112233',bar:w.isBarrier||false,isPillar:w.isPillar});
      }
    } else {
      car.x=W*.5; car.y=H*.75;
      const barrierCount=2+Math.floor(LVL/5);
      for(let i=0;i<barrierCount;i++){
        let ox,oy,t2=0;
        do{ox=60+Math.random()*(W-120);oy=60+Math.random()*(H-240);t2++;}
        while(dist(ox,oy,car.x,car.y)<120&&t2<30);
        OBS.push({x:ox,y:oy,w:12,h:40,angle:(Math.random()-.5)*0.5,color:'#ff6600',roof:'#cc4400',bar:true,isPillar:false});
      }
    }
    const zoneCount=3+Math.floor(LVL/3);
    for(let i=0;i<zoneCount;i++){
      let zx,zy,zt=0;
      do{zx=W*.12+Math.random()*W*.76;zy=H*.10+Math.random()*H*.58;zt++;}
      while(dist(zx,zy,car.x,car.y)<90&&zt<30);
      DRIFT_ZONES.push({x:zx,y:zy,r:28+Math.random()*22,hit:false,pulse:Math.random()*Math.PI*2,val:200+LVL*30});
    }
    DRIFT_ZONE_HITS=0;
  } else {
    car.x=W*.5; car.y=H*.78;
    car.angle=0;
    const sw=CW*c.sm*1.75,sh=CH*c.sm*1.38,mg=52;
    let sx,sy,att=0;
    do{sx=mg+Math.random()*(W-mg*2-sw);sy=mg+Math.random()*(H*.52-mg-sh);att++;}
    while(dist(sx+sw/2,sy+sh/2,car.x,car.y)<130&&att<40);
    PS={x:sx,y:sy,w:sw,h:sh};
    OBS=[];
    for(let i=0;i<c.obs;i++){
      let ox,oy,ow=CW+Math.random()*10,oh=CH+Math.random()*16,t2=0;
      do{ox=44+Math.random()*(W-88);oy=44+Math.random()*(H-220);t2++;}
      while((dist(ox+ow/2,oy+oh/2,car.x,car.y)<55||dist(ox+ow/2,oy+oh/2,sx+sw/2,sy+sh/2)<65)&&t2<40);
      const col=CAR_COLORS[i%CAR_COLORS.length];
      OBS.push({x:ox,y:oy,w:ow,h:oh,angle:(Math.random()-.5)*.9,color:col,roof:shade(col,-35),bar:Math.random()<.22});
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++){
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.4+H*.05,angle:Math.random()*Math.PI*2,speed:.45+Math.random()*.6,color:CAR_COLORS[(i+3)%CAR_COLORS.length]});
    }
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=44+Math.random()*(H-220);t3++;}
        while(dist(kx,ky,car.x,car.y)<55&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
  }
  genBonusCoins();
  LANE_WIDTH=getLevelMode(LVL)===8?42:52;
  updTimerBar(); updHUD();
}

function drawObs(o){
  if(o.isPillar){
    ctx.save();ctx.translate(o.x+o.w/2,o.y+o.h/2);
    ctx.fillStyle='#445566';ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h);
    ctx.fillStyle='#667788';ctx.fillRect(-o.w/2,-o.h/2,o.w,4);
    ctx.fillStyle='#334455';ctx.fillRect(-o.w/2,o.h/2-4,o.w,4);
    ctx.fillStyle='#ffffff44';ctx.font='5px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('▐',0,0);
    ctx.restore();
    return;
  }
  ctx.save();ctx.translate(o.x+o.w/2,o.y+o.h/2);
  if(o.bar){
    ctx.rotate(o.angle||0);const hw=o.w/2,hh=o.h/2;
    pr(-hw,-hh,o.w,o.h,'#7a7a88');
    for(let i=-hh;i<hh;i+=10){ctx.globalAlpha=.45;pr(-hw,i,o.w,5,'#ff3300');ctx.globalAlpha=1;}
    pr(-hw+2,hh-6,7,4,'#ffffaa');pr(hw-9,hh-6,7,4,'#ffffaa');
  } else {
    ctx.rotate(0);ctx.translate(-o.w/2,-o.h/2);
    drawCar(o.w/2,o.h/2,o.angle,o.color,o.roof);
  }
  ctx.restore();
}

function drawSpot(spot,label,locked){
  if(!spot)return;
  const blink=pflash>0&&Math.floor(AF/5)%2===0;
  const bc=blink?'#00ffcc':locked?'#ff3e6c':'#f5c518';
  const near=dist(car.x,car.y,spot.x+spot.w/2,spot.y+spot.h/2)<130;
  ctx.save();
  ctx.fillStyle=locked?'#ff3e6c08':'#ffffff06';ctx.fillRect(spot.x,spot.y,spot.w,spot.h);
  ctx.strokeStyle=bc+'cc';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(spot.x+1,spot.y+1,spot.w-2,spot.h-2);ctx.setLineDash([]);
  const cs=8;
  for(const[cx2,cy2]of[[spot.x,spot.y],[spot.x+spot.w-cs,spot.y],[spot.x,spot.y+spot.h-cs],[spot.x+spot.w-cs,spot.y+spot.h-cs]]){
    ctx.fillStyle=bc;ctx.fillRect(cx2,cy2,cs,cs);
  }
  const lbl=locked?'🔒':(label||'P');
  ctx.fillStyle=bc+'88';ctx.font=`bold ${~~Math.min(spot.w,spot.h)*.50}px 'Press Start 2P'`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbl,spot.x+spot.w/2,spot.y+spot.h/2);
  if(near||blink){ctx.shadowColor=bc;ctx.shadowBlur=16;ctx.strokeStyle=bc+'44';ctx.lineWidth=3;ctx.strokeRect(spot.x-3,spot.y-3,spot.w+6,spot.h+6);ctx.shadowBlur=0;}
  ctx.restore();
}

function drawKeys(){
  for(const k of KEYS_ON_MAP){
    if(k.collected)continue;
    k.pulse=(k.pulse||0)+0.08;
    const px=k.x,py=k.y;
    const glow=Math.sin(k.pulse)*0.4+0.6;
    ctx.save();
    ctx.globalAlpha=glow;
    ctx.shadowColor='#f5c518';ctx.shadowBlur=18;
    ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🔑',px,py);
    ctx.shadowBlur=0;
    ctx.strokeStyle='#f5c51888';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(px,py,16+Math.sin(k.pulse)*3,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=1;
    ctx.restore();
  }
}

function drawBonusCoins(){
  for(const coin of BONUS_COINS){
    if(coin.collected)continue;
    coin.pulse=(coin.pulse||0)+0.1;
    const glow=Math.sin(coin.pulse)*0.3+0.7;
    ctx.save();
    ctx.globalAlpha=glow;
    ctx.shadowColor='#00ff88';ctx.shadowBlur=12;
    ctx.font='16px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('💰',coin.x,coin.y);
    ctx.shadowBlur=0;
    ctx.globalAlpha=1;
    ctx.restore();
  }
}

function drawLanePath(zigzag=false){
  if(!LANE_PATH.length)return;
  ctx.save();
  ctx.strokeStyle=zigzag?'#3a3a4a':'#555566';
  ctx.lineWidth=LANE_WIDTH*2.2;
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y);
  ctx.stroke();
  ctx.strokeStyle=zigzag?'#ff6600aa':'#f5c518aa';ctx.lineWidth=2;ctx.setLineDash([14,10]);
  ctx.beginPath();ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y-LANE_WIDTH*.55);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y-LANE_WIDTH*.55);
  ctx.stroke();
  ctx.beginPath();ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y+LANE_WIDTH*.55);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y+LANE_WIDTH*.55);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1.5;ctx.setLineDash([8,12]);
  ctx.beginPath();ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawArrow(fx,fy,tx,ty,color='#00ffcc'){
  const dx=tx-fx,dy=ty-fy,d=Math.hypot(dx,dy);if(d<70)return;
  const nx=dx/d,ny=dy/d,bl=Math.floor(AF/12)%2===0;
  ctx.globalAlpha=bl?.85:.38;ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash([10,8]);
  ctx.beginPath();ctx.moveTo(fx+nx*28,fy+ny*28);ctx.lineTo(tx-nx*24,ty-ny*24);ctx.stroke();ctx.setLineDash([]);
  const ex=tx-nx*24,ey=ty-ny*24;
  ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-nx*14-ny*7,ey-ny*14+nx*7);ctx.lineTo(ex-nx*14+ny*7,ey-ny*14-nx*7);ctx.closePath();ctx.fillStyle=color;ctx.fill();
  ctx.globalAlpha=1;
}

function drawKeyArrow(){
  const c=cfg(LVL);
  if(!c.needKey||KEYS_COLLECTED>=c.numKeys)return;
  const nearest=KEYS_ON_MAP.filter(k=>!k.collected).sort((a,b)=>dist(car.x,car.y,a.x,a.y)-dist(car.x,car.y,b.x,b.y))[0];
  if(!nearest)return;
  const d=dist(car.x,car.y,nearest.x,nearest.y);
  if(d>90)drawArrow(car.x,car.y,nearest.x,nearest.y,'#f5c518');
}

function drawCarparkBG(narrow=false){
  const floorG=ctx.createLinearGradient(0,0,W,H);
  floorG.addColorStop(0,'#141420');floorG.addColorStop(1,'#0e0e1c');
  ctx.fillStyle=floorG;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;
  ctx.beginPath();
  const vanX=W/2,vanY=H*.05;
  for(let i=0;i<8;i++){const bx=i*W/7;ctx.moveTo(vanX,vanY);ctx.lineTo(bx,H*.68);}
  ctx.stroke();
  const rows=narrow?4:3,cols=narrow?5:4;
  const startY=H*.10,endY=H*.65;
  const rowH=(endY-startY)/rows;
  const colW=W/cols;
  ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;
  ctx.beginPath();
  for(let r=0;r<=rows;r++){ctx.moveTo(0,startY+r*rowH);ctx.lineTo(W,startY+r*rowH);}
  for(let c=0;c<=cols;c++){ctx.moveTo(c*colW,startY);ctx.lineTo(c*colW,endY);}
  ctx.stroke();
  ctx.fillStyle='#ffffff22';ctx.font='5px "Press Start 2P"';ctx.textAlign='center';
  for(let c=0;c<cols;c++){for(let r=0;r<rows;r++){ctx.fillText(`${String.fromCharCode(65+r)}${c+1}`,c*colW+colW*.5,startY+r*rowH+10);}}
  ctx.strokeStyle='#f5c51830';ctx.lineWidth=1.5;ctx.setLineDash([12,8]);
  ctx.beginPath();ctx.moveTo(0,H*.67);ctx.lineTo(W,H*.67);ctx.stroke();
  ctx.setLineDash([]);
  for(let i=0;i<cols;i++){
    const lx=i*colW+colW*.5;
    for(let j=0;j<2;j++){
      const ly=startY+j*(rowH*1.5)+rowH*.3;
      ctx.fillStyle='#ffffee44';ctx.fillRect(lx-colW*.22,ly-3,colW*.44,4);
      ctx.globalAlpha=.06;ctx.fillStyle='#ffffcc';
      ctx.beginPath();ctx.moveTo(lx-colW*.22,ly);ctx.lineTo(lx+colW*.22,ly);ctx.lineTo(lx+colW*.4,ly+rowH*.9);ctx.lineTo(lx-colW*.4,ly+rowH*.9);ctx.closePath();ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  ctx.fillStyle='#00cc4488';ctx.font='6px "Press Start 2P"';ctx.textAlign='center';
  ctx.fillText('▲ GİRİŞ',W*.5,H*.93);
  ctx.fillStyle='#cc004488';ctx.fillText('EXIT →',W*.88,H*.93);
  ctx.fillStyle='#4488ffaa';ctx.font='5px "Press Start 2P"';
  ctx.fillText('🏢 OTOPARK B1',W*.5,H*.97);
  ctx.font='bold 14px monospace';ctx.fillStyle='#2266cc';
  ctx.fillText('P',W*.92,H*.12);
}

function drawLaneFollowBG(zigzag=false){
  const grassG=ctx.createLinearGradient(0,0,0,H);
  grassG.addColorStop(0,'#0e2a0e');grassG.addColorStop(1,'#1a3a1a');
  ctx.fillStyle=grassG;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#1f4a1f';ctx.lineWidth=1;
  ctx.beginPath();
  for(let i=0;i<W;i+=10){ctx.moveTo(i,0);ctx.lineTo(i,H);}
  ctx.stroke();
  const treeX=[W*.04,W*.96,W*.02,W*.98];
  treeX.forEach((tx,i)=>{
    const ty=H*.15+i*H*.18;
    ctx.fillStyle='#0d4a0d';ctx.beginPath();ctx.arc(tx,ty,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#0a3a0a';ctx.beginPath();ctx.arc(tx,ty-8,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#5a3a1a';ctx.fillRect(tx-3,ty+12,6,12);
  });
  ctx.fillStyle='#ccc';ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);
  ctx.fillStyle=zigzag?'#ff6600':'#f5c518';
  for(let i=0;i<W;i+=14){ctx.fillRect(i,0,7,5);ctx.fillRect(i,H-5,7,5);}
  for(let i=0;i<H;i+=14){ctx.fillRect(0,i,5,7);ctx.fillRect(W-5,i,5,7);}
  ctx.save();
  ctx.fillStyle=zigzag?'#ff9988':'#88aaff';ctx.font='5px "Press Start 2P"';ctx.textAlign='left';
  ctx.fillText(zigzag?'⚠ ZİGZAG KURSU':'🚗 SÜRÜCÜ KURSU',W*.03,H*.05+14);
  ctx.restore();
}

function drawNightBG(){
  ctx.fillStyle='#020208';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#ffffff';
  for(let i=0;i<18;i++){ctx.fillRect(Math.sin(i*37)*W*.5+W*.5,Math.cos(i*19)*H*.3+H*.15,1,1);}
  const lampX=[W*.2,W*.5,W*.8];
  lampX.forEach(lx=>{
    ctx.save();
    ctx.fillStyle='#ffeeaa44';ctx.beginPath();ctx.arc(lx,H*.1,8,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.12;ctx.fillStyle='#ffeeaa';ctx.beginPath();ctx.arc(lx,H*.1,80,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
  });
  ctx.strokeStyle='#ffffff03';ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=0;x<W;x+=38){ctx.moveTo(x,0);ctx.lineTo(x,H);}
  for(let y=0;y<H;y+=38){ctx.moveTo(0,y);ctx.lineTo(W,y);}
  ctx.stroke();
  ctx.fillStyle='#555';ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);ctx.fillRect(0,0,5,H);ctx.fillRect(W-5,0,5,H);
}

function drawIceBG(){
  ctx.fillStyle='#c8d8e8';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#b0c4d4';ctx.lineWidth=1;
  for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  if(!_iceCracks||_iceCracks.W!==W){
    _iceCracks={W,lines:[]};
    const rng=(s)=>{let x=Math.sin(s)*10000;return x-Math.floor(x);};
    for(let i=0;i<12;i++){
      const sx=rng(i*3.1)*W,sy=rng(i*1.7)*H;
      const pts=[{x:sx,y:sy}];
      for(let j=0;j<4;j++){pts.push({x:sx+(rng(i*7+j)-.5)*60,y:sy+(rng(i*5+j)-.5)*60});}
      _iceCracks.lines.push(pts);
    }
  }
  ctx.strokeStyle='#a0b4c4';ctx.lineWidth=0.5;
  for(const pts of _iceCracks.lines){
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
    for(let j=1;j<pts.length;j++)ctx.lineTo(pts[j].x,pts[j].y);
    ctx.stroke();
  }
  ctx.fillStyle='#ffffff88';
  const rng2=(s)=>{let x=Math.sin(s*17.3)*10000;return x-Math.floor(x);};
  for(let i=0;i<8;i++){
    ctx.beginPath();ctx.ellipse(rng2(i)*W,rng2(i+8)*H,20+rng2(i+16)*30,10+rng2(i+24)*15,rng2(i+32)*Math.PI,0,Math.PI*2);ctx.fill();
  }
}

function drawVIPBG(){
  const g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#1a0a00');g.addColorStop(1,'#0a0500');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#f5c51815';ctx.lineWidth=1;
  for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.fillStyle='#f5c51888';ctx.font='8px "Press Start 2P"';ctx.textAlign='center';
  ctx.fillText('★ VIP PARK ★',W*.5,H*.97);
  ctx.fillStyle='#8B000088';ctx.fillRect(W*.35,0,W*.3,H);
  ctx.strokeStyle='#f5c51822';ctx.lineWidth=2;
  ctx.strokeRect(W*.35,0,W*.3,H);
}

function drawDriftBG_night_carpark(){
  const g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#1a1a28');g.addColorStop(1,'#0f0f1c');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#ffffff07';ctx.lineWidth=1;
  for(let x=0;x<W;x+=52){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=52){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.fillStyle='#999';ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);ctx.fillRect(0,0,5,H);ctx.fillRect(W-5,0,5,H);
  ctx.fillStyle='#f5c518';for(let i=0;i<W;i+=14){ctx.fillRect(i,0,7,5);ctx.fillRect(i,H-5,7,5);}
  for(let i=0;i<H;i+=14){ctx.fillRect(0,i,5,7);ctx.fillRect(W-5,i,5,7);}
}

function drawDriftBG_day_carpark(){drawDriftBG_night_carpark();}
function drawDriftBG_night_open(){drawDriftBG_night_carpark();}
function drawDriftBG_day_open(){drawDriftBG_night_carpark();}

function drawBG(){
  const mode=getLevelMode(LVL);
  if(mode===1){drawCarparkBG(false);return;}
  if(mode===9){drawCarparkBG(true);return;}
  if(mode===2){drawLaneFollowBG(false);return;}
  if(mode===8){drawLaneFollowBG(true);return;}
  if(mode===7){drawNightBG();return;}
  if(mode===11){drawIceBG();return;}
  if(mode===10){drawVIPBG();return;}
  if(mode===12){
    const isNight=DRIFT_TOD==='night';
    const isCarpark=DRIFT_MAP==='carpark';
    if(isNight&&isCarpark)drawDriftBG_night_carpark();
    else if(!isNight&&isCarpark)drawDriftBG_day_carpark();
    else if(isNight&&!isCarpark)drawDriftBG_night_open();
    else drawDriftBG_day_open();
    return;
  }
  drawNormalBG(mode);
}

function drawDriftZones(){
  for(const z of DRIFT_ZONES){
    z.pulse+=0.05;
    const glow=Math.sin(z.pulse)*0.4+0.6;
    ctx.save();
    ctx.strokeStyle=z.hit?`rgba(0,255,100,${glow})`:`rgba(255,80,0,${glow})`;
    ctx.lineWidth=z.hit?3:2;
    ctx.setLineDash([8,6]);ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=.07*glow;ctx.fillStyle=z.hit?'#00ff88':'#ff6600';ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.font='14px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(z.hit?'✅':'🔥',z.x,z.y);
    if(!z.hit){ctx.font='5px "Press Start 2P"';ctx.fillStyle='#ff8800aa';ctx.fillText('+'+z.val,z.x,z.y+z.r+10);}
    ctx.restore();
  }
}

function drawNormalBG(mode){
  const g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#1a1a28');g.addColorStop(1,'#0f0f1c');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#ffffff07';ctx.lineWidth=1;
  for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.fillStyle='#ffffff04';
  for(let i=0;i<24;i++){ctx.fillRect(Math.sin(i*17)*W*.5+W*.5,Math.sin(i*13)*H*.4+H*.3,((i*37)%42)+8,1);}
  if(mode===3||mode===4||mode===5){
    ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;
    for(let x=0;x<W;x+=CW*2.5){ctx.beginPath();ctx.moveTo(x,H*.05);ctx.lineTo(x,H*.6);ctx.stroke();}
    ctx.strokeStyle='#ffffff22';
    ctx.beginPath();ctx.moveTo(0,H*.05);ctx.lineTo(W,H*.05);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,H*.6);ctx.lineTo(W,H*.6);ctx.stroke();
    ctx.fillStyle='#ffffff20';ctx.font='6px "Press Start 2P"';ctx.textAlign='center';
    let bn=1;
    for(let x=CW*1.25;x<W;x+=CW*2.5,bn++){ctx.fillText(bn,x,H*.08);}
    ctx.fillStyle='#003366aa';ctx.fillRect(W*.02,H*.02,W*.2,16);
    ctx.fillStyle='#88aaff';ctx.font='5px "Press Start 2P"';ctx.textAlign='left';
    ctx.fillText('P ALANI',W*.03,H*.02+10);
  }
  ctx.fillStyle='#999';ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);ctx.fillRect(0,0,5,H);ctx.fillRect(W-5,0,5,H);
  ctx.fillStyle='#f5c518';
  for(let i=0;i<W;i+=14){ctx.fillRect(i,0,7,5);ctx.fillRect(i,H-5,7,5);}
  for(let i=0;i<H;i+=14){ctx.fillRect(0,i,5,7);ctx.fillRect(W-5,i,5,7);}
  ctx.fillStyle='#003366aa';ctx.fillRect(W*.38,H*.9,W*.24,16);
  ctx.strokeStyle='#4488ff';ctx.lineWidth=1;ctx.strokeRect(W*.38,H*.9,W*.24,16);
  ctx.fillStyle='#88aaff';ctx.font='4px "Press Start 2P"';ctx.textAlign='center';
  ctx.fillText('GİRİŞ / ÇIKIŞ',W*.5,H*.9+10);
}

function drawSpeedLimit(){
  const c=cfg(LVL);
  if(c.speedLimit>=999)return;
  const tooFast=Math.abs(car.speed)>c.speedLimit;
  ctx.save();
  ctx.fillStyle=tooFast?'#ff000088':'#00880044';
  ctx.beginPath();ctx.arc(W*.88,H*.75,16,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=tooFast?'#ff0000':'#00ff44';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='5px "Press Start 2P"';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('MAX',W*.88,H*.73);
  ctx.font='6px "Press Start 2P"';
  ctx.fillText(~~(c.speedLimit*38),W*.88,H*.78);
  ctx.restore();
}

function draw(){
  ctx.clearRect(0,0,W,H);
  drawBG();
  const mode=getLevelMode(LVL);
  const isLane=mode===2||mode===8;
  if(LANE_PATH.length)drawLanePath(mode===8);
  for(const t of tmarks){if(t.l<0.12)continue;ctx.globalAlpha=t.l*.44;ctx.fillStyle=mode===11?'#6699cc':(mode===12?'#333':'#000');const ts=mode===12?4:2;ctx.fillRect(~~t.x-ts/2,~~t.y-ts/2,ts+2,ts+2);}ctx.globalAlpha=1;
  const c=cfg(LVL);
  const locked=c.needKey&&KEYS_COLLECTED<c.numKeys;
  if(mode===12)drawDriftZones();
  if(mode===5){
    const s1done=PS&&PS.parked1;
    drawSpot(PS,'1',locked&&!s1done);
    drawSpot(PS2,'2',!s1done);
  } else {
    drawSpot(PS,null,locked);
  }
  drawKeys();
  drawBonusCoins();
  if(c.needKey&&KEYS_COLLECTED<c.numKeys){
    drawKeyArrow();
  } else if(mode===5&&PS&&!PS.parked1&&PS2){
    const d=dist(car.x,car.y,PS.x+PS.w/2,PS.y+PS.h/2);
    if(d>95)drawArrow(car.x,car.y,PS.x+PS.w/2,PS.y+PS.h/2,'#f5c518');
  } else if(PS&&mode!==5){
    const d=dist(car.x,car.y,PS.x+PS.w/2,PS.y+PS.h/2);
    if(d>95)drawArrow(car.x,car.y,PS.x+PS.w/2,PS.y+PS.h/2,'#00ffcc');
  }
  for(const o of OBS)drawObs(o);
  for(const n of NPCS)drawCar(n.x,n.y,n.angle,n.color,shade(n.color,-35),1,mode===7);
  for(const p of parts){ctx.globalAlpha=p.l;ctx.fillStyle=p.c;ctx.fillRect(~~p.x,~~p.y,~~p.s,~~p.s);}ctx.globalAlpha=1;
  drawCar(car.x,car.y,car.angle,car.color,car.roof,1,mode===7||mode===12,DRIFT_ACTIVE&&mode===12);
  if(mode===7){
    const darkOverlay=ctx.createRadialGradient(car.x,car.y,30,car.x,car.y,160);
    darkOverlay.addColorStop(0,'rgba(0,0,0,0)');
    darkOverlay.addColorStop(1,'rgba(0,0,8,0.85)');
    ctx.fillStyle=darkOverlay;ctx.fillRect(0,0,W,H);
  }
  if(mode===12){
    if(DRIFT_TOD==='night'){
      ctx.fillStyle='rgba(0,0,4,0.18)';ctx.fillRect(0,0,W,H);
    }
    const ds=document.getElementById('driftscore');
    if(DRIFT_ACTIVE && DRIFT_SCORE>0){
      ds.textContent=`🔥 +${DRIFT_SCORE}`;
      ds.classList.add('show');
    } else if(!DRIFT_ACTIVE){
      ds.classList.remove('show');
    }
    const totalZones=Math.max(1,DRIFT_ZONES.length);
    const pct=Math.min(100,(DRIFT_ZONE_HITS/totalZones)*100);
    const label=`ZONE: ${DRIFT_ZONE_HITS}/${totalZones}`;
    if(label!==lastDriftLabel){document.getElementById('driftbar-label').textContent=label;lastDriftLabel=label;}
    if(pct!==lastDriftBarPct){
      const fill=document.getElementById('driftbar-fill');
      fill.style.width=pct+'%';
      fill.style.background=
        pct>=100?'linear-gradient(90deg,#00ff88,#00ffcc)':
        pct>=60 ?'linear-gradient(90deg,#ff9900,#ff3e6c)':
                 'linear-gradient(90deg,#ff6600,#ff3e6c)';
      lastDriftBarPct=pct;
    }
    const dtEl=document.getElementById('dtbadge');
    const dtCol={fwd:'#00ccff',rwd:'#ff3e6c',awd:'#00ff88','4wd':'#f5c518'}[DRIFT_DT]||'#ff6600';
    if(dtCol!==lastDriftBadgeColor){dtEl.style.color=dtCol;dtEl.style.textShadow=`0 0 8px ${dtCol}`;lastDriftBadgeColor=dtCol;}
  }
  if(cflash>0){ctx.fillStyle=`rgba(255,45,20,${cflash*.038})`;ctx.fillRect(0,0,W,H);}  
  if(pflash>0){ctx.fillStyle=`rgba(0,255,175,${pflash*.032})`;ctx.fillRect(0,0,W,H);}  
  if(mode===11&&Math.abs(car.speed)>0.5){
    ctx.fillStyle=`rgba(140,200,255,${Math.abs(car.speed)*.04})`;ctx.fillRect(0,0,W,H);
  }
  drawFloatMsgs();
  drawSpeedLimit();
  ctx.fillStyle='#ffffff28';ctx.font='6px "Press Start 2P"';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(`LVL ${LVL}`,10,52);
  if(isLane&&laneOutTimer>0&&laneOutTimer%4<2){ctx.fillStyle='rgba(255,62,108,0.12)';ctx.fillRect(0,0,W,H);}
  if(c.speedLimit<999&&Math.abs(car.speed)>c.speedLimit+0.3&&AF%6<3){ctx.fillStyle='rgba(255,0,0,0.08)';ctx.fillRect(0,0,W,H);}
}

function update(){
  if(GS!=='playing'||car.crashed||car.parked)return;
  AF++;
  const c=cfg(LVL);
  const mode=getLevelMode(LVL);
  const isDrift=mode===12;
  if(isDrift){
    const dt=DT_PRESETS[DRIFT_DT]||DT_PRESETS.rwd;
    const steerInput=(I.L?-1:0)+(I.R?1:0);
    const gasOn=!!I.G, brakeOn=!!I.B;
    const accelM=dt.accelMult||1.0;
    const maxV=car.maxF*(dt.maxSpeedMult||1.0)*1.4;
    if(gasOn){car.speed=Math.min(car.speed+car.accel*accelM*1.5, maxV);} else if(brakeOn){car.speed=Math.max(car.speed-car.brake*1.2, 0);} else {car.speed*=0.978; if(Math.abs(car.speed)<.015)car.speed=0;}
    const speedFactor=Math.min(1, car.speed/maxV);
    const turnFactor=Math.abs(steerInput);
    let frontSlip=0, rearSlip=0;
    const gasSlip=gasOn&&car.speed>0.25?speedFactor:0;
    if(dt.gasEffect==='front'){frontSlip=gasSlip*0.68;rearSlip=gasSlip*0.06;}
    else if(dt.gasEffect==='rear'){frontSlip=gasSlip*0.04;rearSlip=gasSlip*0.78;}
    else {frontSlip=gasSlip*0.32;rearSlip=gasSlip*0.32;}
    const cornerSlip=turnFactor*speedFactor*0.22;
    rearSlip=Math.min(0.96, rearSlip +cornerSlip);
    frontSlip=Math.min(0.96, frontSlip+cornerSlip*(dt.gasEffect==='front'?0.9:0.25));
    const frontGrip=Math.max(0.05, dt.frontGrip-frontSlip);
    const rearGrip=Math.max(0.05, dt.rearGrip -rearSlip);
    const grip=frontGrip*0.30+rearGrip*0.70;
    const targetVx=Math.sin(car.angle)*car.speed;
    const targetVy=-Math.cos(car.angle)*car.speed;
    car_vx=car_vx*(1-grip)+targetVx*grip;
    car_vy=car_vy*(1-grip)+targetVy*grip;
    if(car.speed>0.1){
      const sf=car.steer*(dt.steerMult||1.0)*(1.0+rearSlip*1.4)*Math.max(0.18,1.0-frontSlip*1.1);
      car.angle+=steerInput*sf*(car.speed>=0?1:-1);
    }
    const dpx=car.x, dpy=car.y;
    car.x+=car_vx; car.y+=car_vy;
    const speed_px=Math.hypot(car_vx,car_vy);
    const velAngle=Math.atan2(car_vx,-car_vy);
    let angleDiff=velAngle-car.angle;
    while(angleDiff>Math.PI)angleDiff-=Math.PI*2;
    while(angleDiff<-Math.PI)angleDiff+=Math.PI*2;
    const driftIntensity=Math.abs(angleDiff);
    const driftThresh={fwd:0.26,rwd:0.13,awd:0.17,'4wd':0.20}[DRIFT_DT]||0.17;
    const speedThresh={fwd:1.3,rwd:0.7,awd:0.9,'4wd':0.8}[DRIFT_DT]||0.9;
    const isDrifting=driftIntensity>driftThresh&&speed_px>speedThresh;
    if(isDrifting){
      DRIFT_TIMER++;
      if(!DRIFT_ACTIVE){DRIFT_ACTIVE=true;DRIFT_SCORE=0;}
      DRIFT_SCORE+=Math.floor(driftIntensity*speed_px*12);
      document.getElementById('driftbadge').classList.add('show');
      document.getElementById('driftbadge').textContent='🔥 DRİFT!';
      if(AF%8===0&&parts.length<35){
        const co=rcorners(car.x,car.y,car.angle,CW,CH);
        const wheels=DRIFT_DT==='fwd'?[0,1]:DRIFT_DT==='rwd'?[2,3]:[0,1,2,3];
        for(const wi of wheels){
          const sp=0.2+Math.random()*0.55;
          const sa=Math.atan2(car_vy,car_vx)+Math.PI+(Math.random()-.5)*1.3;
          parts.push({x:co[wi].x,y:co[wi].y,vx:Math.cos(sa)*sp,vy:Math.sin(sa)*sp,l:0.75,d:0.014,s:(wi>1?7:4)+Math.random()*5,c:['#ddd','#ccc','#eee'][wi%3]});
        }
        const mwheels=DRIFT_DT==='fwd'?[0,1]:[2,3];
        for(const wi of mwheels){tmarks.push({x:co[wi].x,y:co[wi].y,l:1.4});}
      }
      for(const z of DRIFT_ZONES){
        if(!z.hit&&dist(car.x,car.y,z.x,z.y)<z.r+18){
          z.hit=true;DRIFT_ZONE_HITS++;const zBonus=z.val+Math.floor(DRIFT_SCORE*0.5);
          SCORE+=zBonus;DRIFT_TOTAL+=zBonus;spawnPark(z.x,z.y);addFloat(`⭐ ZONE! +${zBonus}`,z.x,z.y-30,'#ffff00',10);updHUD();
        }
      }
    } else {
      if(DRIFT_ACTIVE&&DRIFT_SCORE>120){
        DRIFT_TOTAL+=DRIFT_SCORE;SCORE+=DRIFT_SCORE;
        addFloat('🔥 +'+DRIFT_SCORE,car.x,car.y-38,'#ff6600',9);updHUD();
        COMBO++;if(COMBO>1)addFloat('🔥 COMBO x'+COMBO,car.x,car.y-60,'#ff3e6c',8);
        COMBO_TIMER=200;
      }
      DRIFT_ACTIVE=false;DRIFT_SCORE=0;DRIFT_TIMER=0;
      document.getElementById('driftbadge').classList.remove('show');
    }
    const dwm=6;
    const dcp=rcorners(car.x,car.y,car.angle,CW,CH);
    if(dcp.some(p=>p.x<dwm||p.x>W-dwm||p.y<dwm||p.y>H-dwm)){
      car.x=dpx;car.y=dpy;car_vx*=-0.30;car_vy*=-0.30;car.speed*=0.40;
      if(speed_px>2.5)triggerCrash();
    }
    if(!car.crashed){
      const dcarPoly=rcorners(car.x,car.y,car.angle,CW,CH);
      for(const o of OBS){
        if(sat(dcarPoly,rcorners(o.x+o.w/2,o.y+o.h/2,o.angle,o.w,o.h))){
          car.x=dpx;car.y=dpy;car_vx*=-0.28;car_vy*=-0.28;car.speed*=0.35;
          if(speed_px>1.8)triggerCrash();break;
        }
      }
    }
    if(DRIFT_ZONES.length>0&&DRIFT_ZONES.every(z=>z.hit)){car.parked=true;car.speed=0;triggerPark();}
    document.getElementById('spd').textContent=~~(speed_px*38);
    for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.90;p.vy*=.90;p.l-=p.d;if(p.l<=0)parts.splice(i,1);}
    if(parts.length>35)parts.splice(0,parts.length-35);
    tmarks=tmarks.filter(t=>(t.l-=.010)>0);
    if(tmarks.length>120)tmarks.length=120;
    if(cflash>0)cflash--;if(pflash>0)pflash--;
    if(COMBO_TIMER>0){COMBO_TIMER--;if(COMBO_TIMER===0){COMBO=0;document.getElementById('combobadge').classList.remove('show');}}
    return;
  }
  if(I.G){car.speed=Math.min(car.speed+car.accel,car.maxF);} else if(I.B){if(car.speed>0.06)car.speed=Math.max(0,car.speed-car.brake);else car.speed=Math.max(car.speed-car.accel*.75,-car.maxR);} else {car.speed*=car.fric; if(Math.abs(car.speed)<.02)car.speed=0;}
  if(c.speedLimit<999&&Math.abs(car.speed)>c.speedLimit+0.5){if(AF%60===0)addFloat('⚠ HIZ LİMİTİ!',car.x,car.y-25,'#ff3e6c',6);car.speed*=0.97;}
  if(Math.abs(car.speed)>.01){const sf=car.steer*Math.min(1,.35+Math.abs(car.speed)*.55);const dir=car.speed>=0?1:-1;if(I.L)car.angle-=sf*dir;if(I.R)car.angle+=sf*dir;}
  if(Math.abs(car.speed)>.85&&(I.L||I.R)){const co=rcorners(car.x,car.y,car.angle,CW,CH);tmarks.push({x:co[2].x,y:co[2].y,l:1},{x:co[3].x,y:co[3].y,l:1});}
  const npx=car.x,npy=car.y;
  car.x+=Math.sin(car.angle)*car.speed;
  car.y-=Math.cos(car.angle)*car.speed;
  const ncp=()=>rcorners(car.x,car.y,car.angle,CW,CH);
  const nwm=6;
  if(ncp().some(p=>p.x<nwm||p.x>W-nwm||p.y<nwm||p.y>H-nwm)){
    car.x=npx;car.y=npy;
    if(Math.abs(car.speed)>1.6)triggerCrash();else car.speed*=-.18;
  }
  if(!car.crashed){
    const carPoly=ncp();
    for(const o of OBS){
      if(sat(carPoly,rcorners(o.x+o.w/2,o.y+o.h/2,o.angle,o.w,o.h))){car.x=npx;car.y=npy;if(Math.abs(car.speed)>1.0)triggerCrash();else car.speed*=-.15;break;}
    }
  }
  if(!car.crashed){
    const carPoly=ncp();
    for(const n of NPCS){
      if(sat(carPoly,rcorners(n.x,n.y,n.angle,CW,CH))){car.x=npx;car.y=npy;if(Math.abs(car.speed)>.8)triggerCrash();else car.speed*=-.2;break;}
    }
  }
  for(const n of NPCS){
    if(n.laneMode&&LANE_PATH.length){n.x+=Math.sin(n.angle)*n.speed*.7;n.y-=Math.cos(n.angle)*n.speed*.7;if(n.x>W-30||n.y<30||n.y>H-30)n.angle=Math.PI-n.angle;}else{n.x+=Math.sin(n.angle)*n.speed;n.y-=Math.cos(n.angle)*n.speed;n.angle+=.007*Math.sin(AF*.012+n.speed*7);if(n.x<22||n.x>W-22)n.angle=Math.PI-n.angle;if(n.y<22||n.y>H-22)n.angle=-n.angle;}}
  for(const k of KEYS_ON_MAP){
    if(!k.collected&&dist(car.x,car.y,k.x,k.y)<26){
      k.collected=true;KEYS_COLLECTED++;spawnKeyPickup(k.x,k.y);
      addFloat('🔑 +ANAHTAR!',k.x,k.y-20,'#f5c518',7);
      const badge=document.getElementById('keybadge');
      badge.textContent='🔑×'+(c.numKeys-KEYS_COLLECTED);
      badge.classList.remove('bounce');void badge.offsetWidth;badge.classList.add('bounce');
      if(KEYS_COLLECTED>=c.numKeys){
        badge.textContent='🔑✓';
        document.getElementById('rwm').textContent='Şimdi park yerine git! 🅿';
        GS='reward';document.getElementById('rwo').style.display='flex';
        clearInterval(tInt);setTimeout(closeReward,1800);
      }
    }
  }
  for(const coin of BONUS_COINS){
    if(!coin.collected&&dist(car.x,car.y,coin.x,coin.y)<22){
      coin.collected=true;SCORE+=coin.val;spawnKeyPickup(coin.x,coin.y);
      addFloat('+'+coin.val+'💰',coin.x,coin.y-20,'#00ff88',7);updHUD();
    }
  }
  if((mode===2||mode===8)&&LANE_PATH.length){
    const d2=distToLane(car.x,car.y);
    const warn=document.getElementById('lanewarn');
    if(d2>LANE_WIDTH){
      laneOutTimer++;warn.classList.add('show');
      if(laneOutTimer>80){laneOutTimer=0;triggerCrash();}
    } else {
      if(laneOutTimer>0&&d2<LANE_WIDTH*.8)laneOutTimer=Math.max(0,laneOutTimer-3);
      warn.classList.remove('show');
      if(Math.abs(car.speed)>.3&&d2<LANE_WIDTH*.5){if(AF%30===0){laneScore+=1;addFloat('+1',car.x+10,car.y-15,'#00ffcc',6);}}
    }
  }
  if(mode===5&&!car.crashed&&Math.abs(car.speed)<.28){
    if(!PS.parked1&&inSpot()){PS.parked1=true;addFloat('✅ 1/2',car.x,car.y-30,'#00ffcc',8);spawnPark(car.x,car.y);car.x=W*.5;car.y=H*.78;car.speed=0;car.angle=0;return;}
    if(PS.parked1&&inSpot2()){car.parked=true;car.speed=0;triggerPark();}
  } else if(!car.crashed&&Math.abs(car.speed)<.28&&mode!==5&&inSpot()){car.parked=true;car.speed=0;triggerPark();}
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.91;p.vy*=.91;p.l-=p.d;if(p.l<=0)parts.splice(i,1);}
  tmarks=tmarks.filter(t=>(t.l-=.004)>0);
  if(cflash>0)cflash--;if(pflash>0)pflash--;
  if(COMBO_TIMER>0){COMBO_TIMER--;if(COMBO_TIMER===0){COMBO=0;document.getElementById('combobadge').classList.remove('show');}}
  document.getElementById('spd').textContent=~~(Math.abs(car.speed)*38);
}

function spawnCrash(x,y){
  const cols=['#ff4400','#ffaa00','#ff0000','#ffff00','#fff','#555'];
  for(let i=0;i<34;i++){const a=Math.random()*Math.PI*2,sp=1.2+Math.random()*4.8;parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:.022+Math.random()*.03,s:2+Math.random()*5,c:cols[~~(Math.random()*cols.length)]});}
}
function spawnPark(x,y){
  const cols=['#00ffcc','#f5c518','#fff','#00ff88','#ffaaff'];
  for(let i=0;i<40;i++){const a=Math.random()*Math.PI*2,sp=.6+Math.random()*3.5;parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:.012+Math.random()*.016,s:3+Math.random()*7,c:cols[~~(Math.random()*cols.length)]});}
}
function spawnKeyPickup(x,y){
  const cols=['#f5c518','#ffdd55','#fff700','#ffffff'];
  for(let i=0;i<20;i++){const a=Math.random()*Math.PI*2,sp=.8+Math.random()*2.5;parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:.020+Math.random()*.025,s:2+Math.random()*4,c:cols[~~(Math.random()*cols.length)]});}
}

let raf=null;
let _lastT=0;
function loop(ts){
  if(_lastT>0){
    const dt=ts-_lastT;
    if(dt<200){update();}
  } else {
    update();
  }
  _lastT=ts;
  draw();
  raf=requestAnimationFrame(loop);
}

function startTimer(){
  clearInterval(tInt);
  const c=cfg(LVL);
  if(c.isDrift){
    document.getElementById('td').textContent='∞';
    document.getElementById('tfill').style.width='100%';
    document.getElementById('tfill').style.background='linear-gradient(90deg,#ff3e6c,#ff6600)';
    return;
  }
  tInt=setInterval(()=>{
    if(GS!=='playing'||car.crashed||car.parked)return;
    TIMER--;document.getElementById('td').textContent=TIMER;updTimerBar();
    if(TIMER<=0)triggerTimeout();
  },1000);
}

function updTimerBar(){
  const c2=cfg(LVL),pct=Math.max(0,TIMER/c2.time*100);
  const f=document.getElementById('tfill');f.style.width=pct+'%';
  if(pct<25)f.style.background='linear-gradient(90deg,#ff3e6c,#ff6600)';
  else if(pct<50)f.style.background='linear-gradient(90deg,#f5c518,#ff9900)';
  else f.style.background='linear-gradient(90deg,var(--neon),var(--neon3))';
}

function triggerCrash(){
  if(car.crashed)return;
  car.crashed=true;spawnCrash(car.x,car.y);cflash=36;LIVES--;COMBO=0;updHUD();clearInterval(tInt);
  document.getElementById('crm').textContent='Araç hasar gördü!';
  setTimeout(()=>LIVES<=0?showOv('goo'):showOv('cro'),900);
}
function triggerTimeout(){
  clearInterval(tInt);LIVES--;COMBO=0;updHUD();
  document.getElementById('crm').textContent='Süre doldu!';
  setTimeout(()=>LIVES<=0?showOv('goo'):showOv('cro'),400);
}
function triggerPark(){
  pflash=52;spawnPark(car.x,car.y);clearInterval(tInt);
  COMBO++;COMBO_TIMER=0;
  const mode=getLevelMode(LVL);
  const isDrift=mode===12;
  const tb=isDrift?0:TIMER*10,sb=LVL*55,lb=laneScore*5,cb=(COMBO-1)*30;
  const driftBonus=isDrift?DRIFT_TOTAL:0;
  const g=100+tb+sb+lb+cb+(isDrift?driftBonus:0);SCORE+=(isDrift?0:g);updHUD();
  const pct=isDrift?1:(TIMER/cfg(LVL).time),stars=pct>.6?3:pct>.3?2:1;
  addFloat(isDrift?'🔥 DRIFT TAMAMLANDI!':'✅ PARK EDİLDİ!',car.x,car.y-30,isDrift?'#ff6600':'#00ffcc',8);
  if(COMBO>1)addFloat(`🔥 COMBO x${COMBO}!`,car.x,car.y-50,'#ff6600',7);
  const nextMode=getLevelMode(LVL+1);
  document.getElementById('nextlvlinfo').textContent=`Sonraki: ${MODE_ICONS[nextMode]} ${MODE_NAMES[nextMode]}`;
  setTimeout(()=>{
    document.getElementById('luot').textContent=isDrift?`🔥 DRİFT\nTAMAMDI!`:`⭐ SEVİYE ${LVL}\nATLANDI!`;
    document.getElementById('strs').textContent='⭐'.repeat(stars)+'☆'.repeat(3-stars);
    let msg=isDrift?`Drift Skoru: ${DRIFT_TOTAL}`:`+${g} puan! Süre: ${TIMER}s`;
    if(!isDrift&&laneScore>0)msg+=`\nŞerit: +${lb}`;
    if(COMBO>1)msg+=`\nCombo x${COMBO}: +${cb}`;
    document.getElementById('lum').textContent=msg;
    showOv('luo');
  },1100);
}

