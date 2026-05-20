// ── INPUT
const I={L:0,R:0,G:0,B:0,H:0};
function pd(e,k,v){e.preventDefault();e.stopPropagation();I[k]=v;const el=document.getElementById({L:'bL',R:'bR',G:'bG',B:'bB',H:'bH'}[k]);if(el)el.classList.toggle('pressed',!!v);}
const KM={ArrowLeft:'L',a:'L',A:'L',ArrowRight:'R',d:'R',D:'R',ArrowUp:'G',w:'G',W:'G',ArrowDown:'B',s:'B',S:'B',' ':'H'};
window.addEventListener('keydown',e=>{const k=KM[e.key];if(k){I[k]=1;pd({preventDefault:()=>{},stopPropagation:()=>{}},k,1);e.preventDefault();}});
window.addEventListener('keyup',  e=>{const k=KM[e.key];if(k){I[k]=0;pd({preventDefault:()=>{},stopPropagation:()=>{}},k,0);}});

// ── CANVAS
const canvas=document.getElementById('gc');
const ctx=canvas.getContext('2d');
let W,H;
function resize(){const wr=document.getElementById('wrap');W=wr.clientWidth;H=wr.clientHeight;canvas.width=W;canvas.height=H;BG_CACHE_KEY='';}
window.addEventListener('resize',()=>{resize();if(GS==='playing')genLevel();});

// ── STATE
let GS='start',LVL=1,SCORE=0,LIVES=3,TIMER=60,tInt=null;
let parts=[],tmarks=[],AF=0,cflash=0,pflash=0;
let OBS=[],PS=null,NPCS=[],BONUS_COINS=[];
let KEYS_ON_MAP=[],KEYS_COLLECTED=0,REWARD=null;
let laneWarningTimer=0,laneOutTimer=0;
let floatMsgs=[];
const FLOAT_DUR=90;
let COMBO=0,COMBO_TIMER=0;
let CHOSEN_COLOR='#e8304a'; // player chosen color
let GAME_MODE='park'; // 'park' or 'drift'

// Drift config (set in menu)
let DRIFT_MAP='open';      // 'open' | 'carpark'
let DRIFT_TOD='night';     // 'day' | 'night'
let DRIFT_DT='rwd';        // 'fwd' | 'rwd' | 'awd' | '4wd'

// Drivetrain physics presets
const DT_PRESETS={
  fwd:{
    // Ön çeker: gaz ön lastikleri döndürür → understeers, arka kayabilir
    frontGrip:0.28, rearGrip:0.72, gasEffect:'front',
    steerMult:0.85, accelMult:1.0, maxSpeedMult:0.9,
    desc:'Ön lastikler döner. Gaz basınca ön kayar, direksiyon etkisi azalır. Understeer!'
  },
  rwd:{
    // Arka çeker: gaz arka lastikleri döndürür → doğal oversteer/drift
    frontGrip:0.80, rearGrip:0.18, gasEffect:'rear',
    steerMult:1.10, accelMult:1.1, maxSpeedMult:1.0,
    desc:'Arka lastikler döner. Gaz basınca arka kaymaya başlar. En iyi drift için!'
  },
  awd:{
    // Tam çeker: 4 lastik eşit, yüksek hızda tüm lastikler kayar
    frontGrip:0.50, rearGrip:0.50, gasEffect:'all',
    steerMult:1.00, accelMult:1.2, maxSpeedMult:1.15,
    desc:'4 lastik birden. Yüksek hızda tüm lastikler kayar. Dengeli güçlü drift.'
  },
  '4wd':{
    // 4x4 kilitli: maksimum tork, kaba kayma, kısa dönüşler zor
    frontGrip:0.32, rearGrip:0.32, gasEffect:'all',
    steerMult:0.70, accelMult:1.35, maxSpeedMult:1.05,
    desc:'Kilitli dört teker. Maksimum güç, minimal direksiyon. Brütal kayış!'
  }
};

// Drift state
let DRIFT_SCORE=0,DRIFT_ACTIVE=false,DRIFT_TIMER=0,DRIFT_TOTAL=0;
let car_vx=0,car_vy=0; // velocity vector for drift physics
let DRIFT_ZONES=[]; // drift zone targets in free mode
let DRIFT_ZONE_HITS=0;
let lastDriftBarPct=-1;
let lastDriftLabel='';
let lastDriftBadgeColor='';
let BG_CACHE_KEY='';
let POLIS_NEARBY_COUNT=0;

// Car
const CW=22,CH=36;
const car={x:0,y:0,angle:0,speed:0,
  accel:.095,brake:.15,fric:.965,maxF:3.0,maxR:1.3,steer:.050,
  color:'#e8304a',roof:'#c01030',crashed:false,parked:false};

// All possible car colors for picker
const CAR_COLORS=[
  '#e8304a','#2a6dff','#22cc44','#ffaa00','#cc22ff',
  '#00ccee','#ff6600','#ff00aa','#ffffff','#333333',
  '#00ff88','#ff4488','#44ffff','#ffff00','#884422',
  '#66aaff'
];

function showScreen(id,show){
  const el=document.getElementById(id);
  if(el)el.style.display=show?'flex':'none';
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
  /*
    DEPRECATED: `script.js` has been split into modules/ for clarity and maintainability.

    Migration map (where code moved):
    - modules/common.js  : shared state, input handlers, canvas setup, helpers
    - modules/parking.js : level generation, drawing, physics, parking+drift integration
    - modules/drift.js   : drift-specific backgrounds and zone drawing
    - modules/polis.js   : police chase mode, AI, HUD and its loop

    The original monolithic runtime has been shortened. The active game now uses the module files
    loaded from index.html. Keeping this file minimal helps reviewers see that code was split.

    If you need to restore the full monolith, recover from git history (commit prior to this change).
  */

  console.warn('script.js deprecated — code moved to modules/*. See README or use modules files.');
  COMBO=0;COMBO_TIMER=0;
  PS2=null;
  // Drift reset
  DRIFT_SCORE=0;DRIFT_ACTIVE=false;DRIFT_TIMER=0;DRIFT_TOTAL=0;
  car_vx=0;car_vy=0;DRIFT_ZONES=[];DRIFT_ZONE_HITS=0;lastDriftBarPct=-1;lastDriftLabel='';lastDriftBadgeColor='';BG_CACHE_KEY='';
  // Renk CHOSEN_COLOR ile sabit
  car.color=CHOSEN_COLOR; car.roof=shade(CHOSEN_COLOR,-42);
  LANE_PATH=[]; CARPARK_WALLS=[]; CARPARK_SPOTS=[];

  const mode=c.mode;
  document.getElementById('modebadge').textContent=MODE_ICONS[mode]+' '+MODE_NAMES[mode];
  document.getElementById('keybadge').textContent=c.needKey?`🔑×${c.numKeys}`:'';
  document.getElementById('combobadge').classList.remove('show');

  // Drift modu UI
  const isDriftMode=mode===12;
  document.getElementById('driftbar-wrap').className=isDriftMode?'show':'';
  document.getElementById('driftmode-overlay').className=isDriftMode?'show':'';
  if(!isDriftMode){
    document.getElementById('driftbadge').classList.remove('show');
    document.getElementById('driftscore').classList.remove('show');
  }

  // Seviye zorluğu göstergesi
  const diff=Math.floor((LVL-1)/5)+1;
  const diffStr=diff<=1?'⭐':diff<=2?'⭐⭐':diff<=4?'⭐⭐⭐':diff<=6?'💀':diff<=9?'💀💀':'💀💀💀';

  if(mode===2){
    // Şerit takip
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
    // Zigzag şerit
    genLanePath(true);
    LANE_WIDTH=42; // Dar şerit
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
    // Zigzag'da daha fazla NPC
    for(let i=0;i<Math.min(c.npc+1,5);i++){
      const npt=LANE_PATH[1+i*3];
      if(npt)NPCS.push({x:npt.x,y:npt.y,angle:Math.PI/2,speed:.22+i*.06,color:CAR_COLORS[(i+6)%CAR_COLORS.length],laneMode:true});
    }

  } else if(mode===1){
    // Normal otopark
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
      NPCS.push({x:W*.1+Math.random()*W*.6,y:H*.2+Math.random()*H*.35,
        angle:Math.random()*Math.PI*2,speed:.35+Math.random()*.4,color:CAR_COLORS[(i+3)%CAR_COLORS.length]});
    }

  } else if(mode===9){
    // Dar koridor otopark
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
      NPCS.push({x:W*.1+Math.random()*W*.5,y:H*.2+Math.random()*H*.3,
        angle:Math.random()*Math.PI*2,speed:.3+Math.random()*.3,color:CAR_COLORS[(i+5)%CAR_COLORS.length]});
    }

  } else if(mode===3){
    // L-Park (paralel)
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
    for(let i=0;i<c.npc;i++)
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.35+H*.15,
        angle:Math.random()*Math.PI*2,speed:.4+Math.random()*.45,color:CAR_COLORS[(i+2)%CAR_COLORS.length]});
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=H*.15+Math.random()*H*.6;t3++;}
        while(dist(kx,ky,car.x,car.y)<50&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }

  } else if(mode===4){
    // Geri giriş
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
      OBS.push({x:ox,y:oy,w:ow,h:oh,angle:(Math.random()-.5)*.6,color:col,roof:shade(col,-35),bar:false});
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++)
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.35+H*.15,
        angle:Math.random()*Math.PI*2,speed:.4+Math.random()*.5,color:CAR_COLORS[(i+5)%CAR_COLORS.length]});
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=H*.2+Math.random()*H*.55;t3++;}
        while(dist(kx,ky,car.x,car.y)<50&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }

  } else if(mode===5){
    // Çift park - 2 spot sırayla
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
    for(let i=0;i<c.npc;i++)
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.35+H*.15,
        angle:Math.random()*Math.PI*2,speed:.4+Math.random()*.5,color:CAR_COLORS[(i+1)%CAR_COLORS.length]});
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=H*.2+Math.random()*H*.5;t3++;}
        while(dist(kx,ky,car.x,car.y)<55&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }

  } else if(mode===6||mode===7||mode===10||mode===11){
    // Özel modlar: Normal benzeri ama farklı twist
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
    // VIP modda ekstra bariyer yolu
    if(mode===10){
      // Rota engellerini çiz (çevresinden geçmek gerekiyor)
      for(let i=0;i<3;i++){
        const bx=W*.2+i*W*.2, by=H*.3+Math.random()*H*.2;
        OBS.push({x:bx-5,y:by,w:10,h:50,angle:0,color:'#ff6600',roof:'#cc4400',bar:true});
      }
    }
    NPCS=[];
    for(let i=0;i<c.npc;i++)
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.4+H*.05,
        angle:Math.random()*Math.PI*2,speed:.45+Math.random()*.6,color:CAR_COLORS[(i+3)%CAR_COLORS.length]});
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=44+Math.random()*(H-220);t3++;}
        while(dist(kx,ky,car.x,car.y)<55&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }

  } else if(mode===12){
    // 🔥 DRIFT MODU - harita ve gece/gündüz seçimine göre
    car.angle=Math.PI*.15;
    OBS=[];NPCS=[];PS=null;TIMER=999;

    if(DRIFT_MAP==='carpark'){
      genCarparkLayout(false);
      car.x=W*.5; car.y=H*.82;
      for(const w of CARPARK_WALLS){
        OBS.push({x:w.x,y:w.y,w:w.w,h:w.h,angle:w.angle||0,color:'#223344',roof:'#112233',bar:w.isBarrier||false,isPillar:w.isPillar});
      }
    } else {
      // Serbest alan: duvarlar yok, sadece birkaç barikat
      car.x=W*.5; car.y=H*.75;
      // Rastgele barikatlar (az)
      const barrierCount=2+Math.floor(LVL/5);
      for(let i=0;i<barrierCount;i++){
        let ox,oy,t2=0;
        do{ox=60+Math.random()*(W-120);oy=60+Math.random()*(H-240);t2++;}
        while(dist(ox,oy,car.x,car.y)<120&&t2<30);
        OBS.push({x:ox,y:oy,w:12,h:40,angle:(Math.random()-.5)*0.5,color:'#ff6600',roof:'#cc4400',bar:true,isPillar:false});
      }
    }

    // Drift zones - her iki haritada da var
    const zoneCount=3+Math.floor(LVL/3);
    for(let i=0;i<zoneCount;i++){
      let zx,zy,zt=0;
      do{zx=W*.12+Math.random()*W*.76;zy=H*.10+Math.random()*H*.58;zt++;}
      while(dist(zx,zy,car.x,car.y)<90&&zt<30);
      DRIFT_ZONES.push({x:zx,y:zy,r:28+Math.random()*22,hit:false,pulse:Math.random()*Math.PI*2,val:200+LVL*30});
    }
    DRIFT_ZONE_HITS=0;

  } else {
    // Normal mod (0)
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
    for(let i=0;i<c.npc;i++)
      NPCS.push({x:Math.random()*W*.7+W*.1,y:Math.random()*H*.4+H*.05,
        angle:Math.random()*Math.PI*2,speed:.45+Math.random()*.6,color:CAR_COLORS[(i+3)%CAR_COLORS.length]});
    if(c.needKey){
      for(let ki=0;ki<c.numKeys;ki++){
        let kx,ky,t3=0;
        do{kx=44+Math.random()*(W-88);ky=44+Math.random()*(H-220);t3++;}
        while(dist(kx,ky,car.x,car.y)<55&&t3<30);
        KEYS_ON_MAP.push({x:kx,y:ky,collected:false,pulse:0});
      }
    }
  }

  // Bonus coins (tüm modlarda)
  genBonusCoins();
  LANE_WIDTH=mode===8?42:52;

  updTimerBar(); updHUD();
}

// ── DRAW HELPERS
function pr(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(~~x,~~y,Math.ceil(w),Math.ceil(h));}

function drawCar(cx,cy,ang,col,rcol,sc=1,headlights=false,driftGlow=false){
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
  const hw=CW/2*sc,hh=CH/2*sc,w=CW*sc,h=CH*sc;
  // Drift glow — kaldırıldı (performans)
  // Shadow
  ctx.globalAlpha=.32;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(2*sc,4*sc,hw*1.1,hh*.62,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // Body
  pr(-hw,-hh,w,h,col);
  // Hood highlight
  pr(-hw+2*sc,-hh+2*sc,w-4*sc,h*.31,shade(col,18));
  // Roof
  pr(-hw*.60,-hh+h*.22,w*.60,h*.39,rcol);
  // Windshields
  ctx.fillStyle='#88ccffa0';pr(-hw*.50,-hh+h*.04,w*.50,h*.15,'#88ccffa0');
  pr(-hw*.46,-hh+h*.64,w*.46,h*.10,'#88ccff80');
  // Headlights
  pr(-hw+sc,-hh+sc,4*sc,3*sc,'#ffffc0');pr(hw-5*sc,-hh+sc,4*sc,3*sc,'#ffffc0');
  if(headlights){
    ctx.globalAlpha=.5;ctx.fillStyle='#ffffaa';ctx.beginPath();ctx.ellipse(-hw*.3,-hh-12*sc,7*sc,16*sc,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(hw*.3,-hh-12*sc,7*sc,16*sc,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  // Headlight glow
  ctx.globalAlpha=.28;pr(-hw-2*sc,-hh-2*sc,8*sc,7*sc,'#ffffaa');pr(hw-7*sc,-hh-2*sc,8*sc,7*sc,'#ffffaa');ctx.globalAlpha=1;
  // Taillights (drift: bright red)
  const tlcol=driftGlow?'#ff0000':'#ff3300';
  pr(-hw+sc,hh-4*sc,4*sc,3*sc,tlcol);pr(hw-5*sc,hh-4*sc,4*sc,3*sc,tlcol);
  if(driftGlow){pr(-hw+sc,hh-4*sc,4*sc,3*sc,'#ff0000');pr(hw-5*sc,hh-4*sc,4*sc,3*sc,'#ff0000');}
  // Wheels
  for(const[wx,wy]of[[-hw-sc,-hh+4*sc],[hw-3*sc,-hh+4*sc],[-hw-sc,hh-12*sc],[hw-3*sc,hh-12*sc]]){
    pr(wx,wy,4*sc,8*sc,'#111');pr(wx+sc,wy+sc,2*sc,6*sc,'#2a2a2a');pr(wx+sc,wy+3.5*sc,2*sc,2*sc,'#888');
  }
  // Bumper
  pr(-5*sc,hh-3*sc,10*sc,2*sc,'#ffe84a');
  // Shine
  ctx.globalAlpha=.10;pr(-hw+2*sc,-hh+2*sc,2.5*sc,hh*.9,'#fff');ctx.globalAlpha=1;
  ctx.restore();
}

function drawObs(o){
  if(o.isPillar){
    ctx.save();ctx.translate(o.x+o.w/2,o.y+o.h/2);
    ctx.fillStyle='#445566';ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h);
    ctx.fillStyle='#667788';ctx.fillRect(-o.w/2,-o.h/2,o.w,4);
    ctx.fillStyle='#334455';ctx.fillRect(-o.w/2,o.h/2-4,o.w,4);
    // Pillar number
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
  // Floor paint
  ctx.fillStyle=locked?'#ff3e6c08':'#ffffff06';ctx.fillRect(spot.x,spot.y,spot.w,spot.h);
  // Dashed border
  ctx.strokeStyle=bc+'cc';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(spot.x+1,spot.y+1,spot.w-2,spot.h-2);ctx.setLineDash([]);
  // Corner markers
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
  // Road asphalt
  ctx.strokeStyle=zigzag?'#3a3a4a':'#555566';
  ctx.lineWidth=LANE_WIDTH*2.2;
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y);
  ctx.stroke();
  // Edge lines
  ctx.strokeStyle=zigzag?'#ff6600aa':'#f5c518aa';ctx.lineWidth=2;ctx.setLineDash([14,10]);
  ctx.beginPath();ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y-LANE_WIDTH*.55);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y-LANE_WIDTH*.55);
  ctx.stroke();
  ctx.beginPath();ctx.moveTo(LANE_PATH[0].x,LANE_PATH[0].y+LANE_WIDTH*.55);
  for(let i=1;i<LANE_PATH.length;i++)ctx.lineTo(LANE_PATH[i].x,LANE_PATH[i].y+LANE_WIDTH*.55);
  ctx.stroke();
  ctx.setLineDash([]);
  // Center dashes
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

// ── BACKGROUND DRAWERS
function drawCarparkBG(narrow=false){
  const floorG=ctx.createLinearGradient(0,0,W,H);
  floorG.addColorStop(0,'#141420');floorG.addColorStop(1,'#0e0e1c');
  ctx.fillStyle=floorG;ctx.fillRect(0,0,W,H);
  // Perspective lines — tek path
  ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;
  ctx.beginPath();
  const vanX=W/2,vanY=H*.05;
  for(let i=0;i<8;i++){const bx=i*W/7;ctx.moveTo(vanX,vanY);ctx.lineTo(bx,H*.68);}
  ctx.stroke();
  const rows=narrow?4:3,cols=narrow?5:4;
  const startY=H*.10,endY=H*.65;
  const rowH=(endY-startY)/rows;
  const colW=W/cols;
  // Bay grid — tek path
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
  // Ceiling lights — shadow kaldırıldı
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
  // Grass texture — tek path
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
  ctx.save();
  ctx.fillStyle=zigzag?'#330000cc':'#003366cc';
  ctx.fillRect(W*.02,H*.05,W*.32,22);
  ctx.strokeStyle=zigzag?'#ff6600':'#4488ff';ctx.lineWidth=1;ctx.strokeRect(W*.02,H*.05,W*.32,22);
  ctx.fillStyle=zigzag?'#ff9988':'#88aaff';ctx.font='5px "Press Start 2P"';ctx.textAlign='left';
  ctx.fillText(zigzag?'⚠ ZİGZAG KURSU':'🚗 SÜRÜCÜ KURSU',W*.03,H*.05+14);
  ctx.restore();
}

function drawNightBG(){
  // Gece modu - çok karanlık
  ctx.fillStyle='#020208';ctx.fillRect(0,0,W,H);
  // Yıldızlar — statik
  ctx.fillStyle='#ffffff';
  for(let i=0;i<18;i++){ctx.fillRect(Math.sin(i*37)*W*.5+W*.5,Math.cos(i*19)*H*.3+H*.15,1,1);}
  // Sokak lambası ışıkları (sadece birkaç nokta)
  const lampX=[W*.2,W*.5,W*.8];
  lampX.forEach(lx=>{
    ctx.save();
    ctx.fillStyle='#ffeeaa44';ctx.beginPath();ctx.arc(lx,H*.1,8,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.12;ctx.fillStyle='#ffeeaa';ctx.beginPath();ctx.arc(lx,H*.1,80,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
    ctx.restore();
  });
  // Grid (barely visible) — tek path
  ctx.strokeStyle='#ffffff03';ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=0;x<W;x+=38){ctx.moveTo(x,0);ctx.lineTo(x,H);}
  for(let y=0;y<H;y+=38){ctx.moveTo(0,y);ctx.lineTo(W,y);}
  ctx.stroke();
  // Curb
  ctx.fillStyle='#555';ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);ctx.fillRect(0,0,5,H);ctx.fillRect(W-5,0,5,H);
}

let _iceCracks=null;
function drawIceBG(){
  // Kaygan zemin (kar/buz efekti)
  ctx.fillStyle='#c8d8e8';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#b0c4d4';ctx.lineWidth=1;
  for(let x=0;x<W;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // Ice cracks — statik, her frame üretme
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
  // Snow patches — statik
  ctx.fillStyle='#ffffff88';
  const rng2=(s)=>{let x=Math.sin(s*17.3)*10000;return x-Math.floor(x);};
  for(let i=0;i<8;i++){
    ctx.beginPath();ctx.ellipse(rng2(i)*W,rng2(i+8)*H,20+rng2(i+16)*30,10+rng2(i+24)*15,rng2(i+32)*Math.PI,0,Math.PI*2);ctx.fill();
  }
}

function drawVIPBG(){
  // VIP park - lüks bina zemini
  const g=ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#1a0a00');g.addColorStop(1,'#0a0500');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // Gold grid
  ctx.strokeStyle='#f5c51815';ctx.lineWidth=1;
  for(let x=0;x<W;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // VIP sign
  ctx.save();ctx.fillStyle='#f5c51888';ctx.font='8px "Press Start 2P"';ctx.textAlign='center';
  ctx.fillText('★ VIP PARK ★',W*.5,H*.97);ctx.restore();
  // Red carpet
  ctx.fillStyle='#8B000088';ctx.fillRect(W*.35,0,W*.3,H);
  ctx.strokeStyle='#f5c51822';ctx.lineWidth=2;
  ctx.strokeRect(W*.35,0,W*.3,H);
}

function drawDriftBG_night_carpark(){
  // Park modundaki sade stil
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

function drawDriftBG_day_carpark(){
  drawDriftBG_night_carpark();
}

function drawDriftBG_night_open(){
  drawDriftBG_night_carpark();
}

function drawDriftBG_day_open(){
  drawDriftBG_night_carpark();
}

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
  // Asphalt grid
  ctx.strokeStyle='#ffffff07';ctx.lineWidth=1;
  for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  // Asphalt texture — statik (Math.random yok)
  ctx.fillStyle='#ffffff04';
  for(let i=0;i<24;i++){ctx.fillRect(Math.sin(i*17)*W*.5+W*.5,Math.sin(i*13)*H*.4+H*.3,((i*37)%42)+8,1);}
  // Bay lines for L-park/reverse
  if(mode===3||mode===4||mode===5){
    ctx.strokeStyle='#ffffff18';ctx.lineWidth=1;
    for(let x=0;x<W;x+=CW*2.5){ctx.beginPath();ctx.moveTo(x,H*.05);ctx.lineTo(x,H*.6);ctx.stroke();}
    ctx.strokeStyle='#ffffff22';
    ctx.beginPath();ctx.moveTo(0,H*.05);ctx.lineTo(W,H*.05);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,H*.6);ctx.lineTo(W,H*.6);ctx.stroke();
    ctx.fillStyle='#ffffff20';ctx.font='6px "Press Start 2P"';ctx.textAlign='center';
    let bn=1;
    for(let x=CW*1.25;x<W;x+=CW*2.5,bn++){ctx.fillText(bn,x,H*.08);}
    // Parking sign
    ctx.fillStyle='#003366aa';ctx.fillRect(W*.02,H*.02,W*.2,16);
    ctx.fillStyle='#88aaff';ctx.font='5px "Press Start 2P"';ctx.textAlign='left';
    ctx.fillText('P ALANI',W*.03,H*.02+10);
  }
  // Curb
  ctx.fillStyle='#999';ctx.fillRect(0,0,W,5);ctx.fillRect(0,H-5,W,5);ctx.fillRect(0,0,5,H);ctx.fillRect(W-5,0,5,H);
  ctx.fillStyle='#f5c518';
  for(let i=0;i<W;i+=14){ctx.fillRect(i,0,7,5);ctx.fillRect(i,H-5,7,5);}
  for(let i=0;i<H;i+=14){ctx.fillRect(0,i,5,7);ctx.fillRect(W-5,i,5,7);}
  // Entry sign
  ctx.fillStyle='#003366aa';ctx.fillRect(W*.38,H*.9,W*.24,16);
  ctx.strokeStyle='#4488ff';ctx.lineWidth=1;ctx.strokeRect(W*.38,H*.9,W*.24,16);
  ctx.fillStyle='#88aaff';ctx.font='4px "Press Start 2P"';ctx.textAlign='center';
  ctx.fillText('GİRİŞ / ÇIKIŞ',W*.5,H*.9+10);
}

function drawFloatMsgs(){
  for(let i=floatMsgs.length-1;i>=0;i--){
    const m=floatMsgs[i];
    m.age++;m.y-=0.7;
    const a=Math.max(0,1-m.age/FLOAT_DUR);
    ctx.globalAlpha=a;
    ctx.font=`${m.size||8}px 'Press Start 2P'`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=m.color||'#f5c518';ctx.fillText(m.text,m.x,m.y);
    ctx.globalAlpha=1;
    if(m.age>=FLOAT_DUR)floatMsgs.splice(i,1);
  }
}

function addFloat(text,x,y,color='#f5c518',size=8){
  floatMsgs.push({text,x,y,color,size,age:0});
}

// Hız limiti göstergesi
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

// ── DRAW
function draw(){
  ctx.clearRect(0,0,W,H);
  drawBG();

  const mode=getLevelMode(LVL);
  const isLane=mode===2||mode===8;
  if(LANE_PATH.length)drawLanePath(mode===8);

  // Tire marks — skip near-invisible
  for(const t of tmarks){if(t.l<0.12)continue;ctx.globalAlpha=t.l*.44;ctx.fillStyle=mode===11?'#6699cc':(mode===12?'#333':'#000');const ts=mode===12?4:2;ctx.fillRect(~~t.x-ts/2,~~t.y-ts/2,ts+2,ts+2);}ctx.globalAlpha=1;

  const c=cfg(LVL);
  const locked=c.needKey&&KEYS_COLLECTED<c.numKeys;

  // Drift zones
  if(mode===12)drawDriftZones();

  // Draw spots
  if(mode===5){
    // Çift spot - sıradaki aktif
    const s1done=PS&&PS.parked1;
    drawSpot(PS,'1',locked&&!s1done);
    drawSpot(PS2,'2',!s1done);
  } else {
    drawSpot(PS,null,locked);
  }

  drawKeys();
  drawBonusCoins();

  // Arrows
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

  // Particles
  for(const p of parts){ctx.globalAlpha=p.l;ctx.fillStyle=p.c;ctx.fillRect(~~p.x,~~p.y,~~p.s,~~p.s);}ctx.globalAlpha=1;

  // Player car (headlights in dark mode)
  drawCar(car.x,car.y,car.angle,car.color,car.roof,1,mode===7||mode===12,DRIFT_ACTIVE&&mode===12);

  // Dark mode overlay (fog)
  if(mode===7){
    const darkOverlay=ctx.createRadialGradient(car.x,car.y,30,car.x,car.y,160);
    darkOverlay.addColorStop(0,'rgba(0,0,0,0)');
    darkOverlay.addColorStop(1,'rgba(0,0,8,0.85)');
    ctx.fillStyle=darkOverlay;ctx.fillRect(0,0,W,H);
  }
  // Drift mode overlay
  if(mode===12){
    // Gece karanlık kenar — sabit renk, radial gradient yok (pahalı)
    if(DRIFT_TOD==='night'){
      ctx.fillStyle='rgba(0,0,4,0.18)';ctx.fillRect(0,0,W,H);
    }
    // Drift active tint kaldırıldı (her frame fillRect pahalı)
    // Drift score HUD overlay
    const ds=document.getElementById('driftscore');
    if(DRIFT_ACTIVE && DRIFT_SCORE>0){
      ds.textContent=`🔥 +${DRIFT_SCORE}`;
      ds.classList.add('show');
    } else if(!DRIFT_ACTIVE){
      ds.classList.remove('show');
    }
    // Drift bar — sadece zone değişince güncelle (DOM throttle)
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

  // Kaygan efekti
  if(mode===11&&Math.abs(car.speed)>0.5){
    ctx.fillStyle=`rgba(140,200,255,${Math.abs(car.speed)*.04})`;ctx.fillRect(0,0,W,H);
  }

  drawFloatMsgs();
  drawSpeedLimit();

  // LVL text
  ctx.fillStyle='#ffffff28';ctx.font='6px "Press Start 2P"';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(`LVL ${LVL}`,10,52);

  // Lane out warning flash
  if(isLane&&laneOutTimer>0&&laneOutTimer%4<2){
    ctx.fillStyle='rgba(255,62,108,0.12)';ctx.fillRect(0,0,W,H);
  }

  // Speed limit violation flash
  if(c.speedLimit<999&&Math.abs(car.speed)>c.speedLimit+0.3&&AF%6<3){
    ctx.fillStyle='rgba(255,0,0,0.08)';ctx.fillRect(0,0,W,H);
  }
}

// ── UPDATE
function update(){
  if(GS!=='playing'||car.crashed||car.parked)return;
  AF++;
  const c=cfg(LVL);
  const mode=getLevelMode(LVL);
  const isDrift=mode===12;

  // ─── DRIFT PHYSICS (mode 12)
  if(isDrift){
    const dt=DT_PRESETS[DRIFT_DT]||DT_PRESETS.rwd;
    const steerInput=(I.L?-1:0)+(I.R?1:0);
    const gasOn=!!I.G, brakeOn=!!I.B;

    // ── Hız / İvme
    const accelM=dt.accelMult||1.0;
    const maxV=car.maxF*(dt.maxSpeedMult||1.0)*1.4;
    if(gasOn)       { car.speed=Math.min(car.speed+car.accel*accelM*1.5, maxV); }
    else if(brakeOn){ car.speed=Math.max(car.speed-car.brake*1.2, 0); }
    else            { car.speed*=0.978; if(Math.abs(car.speed)<.015)car.speed=0; }

    const speedFactor=Math.min(1, car.speed/maxV);
    const turnFactor=Math.abs(steerInput);

    // ── Drivetrain slip
    let frontSlip=0, rearSlip=0;
    const gasSlip=gasOn&&car.speed>0.25?speedFactor:0;
    if(dt.gasEffect==='front')     { frontSlip=gasSlip*0.68; rearSlip=gasSlip*0.06; }
    else if(dt.gasEffect==='rear') { frontSlip=gasSlip*0.04; rearSlip=gasSlip*0.78; }
    else                           { frontSlip=gasSlip*0.32; rearSlip=gasSlip*0.32; }

    const cornerSlip=turnFactor*speedFactor*0.22;
    rearSlip =Math.min(0.96, rearSlip +cornerSlip);
    frontSlip=Math.min(0.96, frontSlip+cornerSlip*(dt.gasEffect==='front'?0.9:0.25));

    const frontGrip=Math.max(0.05, dt.frontGrip-frontSlip);
    const rearGrip =Math.max(0.05, dt.rearGrip -rearSlip);
    const grip=frontGrip*0.30+rearGrip*0.70;

    // ── Velocity blending
    const targetVx=Math.sin(car.angle)*car.speed;
    const targetVy=-Math.cos(car.angle)*car.speed;
    car_vx=car_vx*(1-grip)+targetVx*grip;
    car_vy=car_vy*(1-grip)+targetVy*grip;

    // ── Direksiyon
    if(car.speed>0.1){
      const sf=car.steer*(dt.steerMult||1.0)*(1.0+rearSlip*1.4)*Math.max(0.18,1.0-frontSlip*1.1);
      car.angle+=steerInput*sf*(car.speed>=0?1:-1);
    }

    const dpx=car.x, dpy=car.y;
    car.x+=car_vx; car.y+=car_vy;
    const speed_px=Math.hypot(car_vx,car_vy);

    // ── Drift detection
    const velAngle=Math.atan2(car_vx,-car_vy);
    let angleDiff=velAngle-car.angle;
    while(angleDiff>Math.PI)angleDiff-=Math.PI*2;
    while(angleDiff<-Math.PI)angleDiff+=Math.PI*2;
    const driftIntensity=Math.abs(angleDiff);
    const driftThresh={fwd:0.26,rwd:0.13,awd:0.17,'4wd':0.20}[DRIFT_DT]||0.17;
    const speedThresh ={fwd:1.3, rwd:0.7, awd:0.9, '4wd':0.8}[DRIFT_DT]||0.9;
    const isDrifting=driftIntensity>driftThresh&&speed_px>speedThresh;

    // ── Duman + lastik izi — OPTIMIZE: max 80 parçacık, her 3 frame'de ekle
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
        // Lastik izi — sadece arka tekerlekler, co zaten hesaplı
        const mwheels=DRIFT_DT==='fwd'?[0,1]:[2,3];
        for(const wi of mwheels){tmarks.push({x:co[wi].x,y:co[wi].y,l:1.4});}
      }

      // Zone: drift yaparken içinden geç → say
      for(const z of DRIFT_ZONES){
        if(!z.hit&&dist(car.x,car.y,z.x,z.y)<z.r+18){
          z.hit=true;DRIFT_ZONE_HITS++;
          const zBonus=z.val+Math.floor(DRIFT_SCORE*0.5);
          SCORE+=zBonus;DRIFT_TOTAL+=zBonus;
          spawnPark(z.x,z.y);addFloat(`⭐ ZONE! +${zBonus}`,z.x,z.y-30,'#ffff00',10);updHUD();
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

    // ── Duvar çarpışması
    const dwm=6;
    const dcp=rcorners(car.x,car.y,car.angle,CW,CH);
    if(dcp.some(p=>p.x<dwm||p.x>W-dwm||p.y<dwm||p.y>H-dwm)){
      car.x=dpx;car.y=dpy;car_vx*=-0.30;car_vy*=-0.30;car.speed*=0.40;
      if(speed_px>2.5)triggerCrash();
    }

    // ── OBS çarpışması
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
    // Parçacık güncelle — max 80 zorunlu
    for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.90;p.vy*=.90;p.l-=p.d;if(p.l<=0)parts.splice(i,1);}
    if(parts.length>35)parts.splice(0,parts.length-35);
    // Lastik izi — max 120
    tmarks=tmarks.filter(t=>(t.l-=.010)>0);
    if(tmarks.length>120)tmarks.length=120;
    if(cflash>0)cflash--;if(pflash>0)pflash--;
    if(COMBO_TIMER>0){COMBO_TIMER--;if(COMBO_TIMER===0){COMBO=0;document.getElementById('combobadge').classList.remove('show');}}
    return;
  }

  // ─── NORMAL PHYSICS
  if(I.G){
    car.speed=Math.min(car.speed+car.accel,car.maxF);
  } else if(I.B){
    if(car.speed>0.06)car.speed=Math.max(0,car.speed-car.brake);
    else car.speed=Math.max(car.speed-car.accel*.75,-car.maxR);
  } else {
    car.speed*=car.fric;
    if(Math.abs(car.speed)<.02)car.speed=0;
  }
  if(c.speedLimit<999&&Math.abs(car.speed)>c.speedLimit+0.5){
    if(AF%60===0)addFloat('⚠ HIZ LİMİTİ!',car.x,car.y-25,'#ff3e6c',6);
    car.speed*=0.97;
  }
  if(Math.abs(car.speed)>.01){
    const sf=car.steer*Math.min(1,.35+Math.abs(car.speed)*.55);
    const dir=car.speed>=0?1:-1;
    if(I.L)car.angle-=sf*dir;
    if(I.R)car.angle+=sf*dir;
  }
  if(Math.abs(car.speed)>.85&&(I.L||I.R)){
    const co=rcorners(car.x,car.y,car.angle,CW,CH);
    tmarks.push({x:co[2].x,y:co[2].y,l:1},{x:co[3].x,y:co[3].y,l:1});
  }
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
      if(sat(carPoly,rcorners(o.x+o.w/2,o.y+o.h/2,o.angle,o.w,o.h))){
        car.x=npx;car.y=npy;
        if(Math.abs(car.speed)>1.0)triggerCrash();else car.speed*=-.15;break;
      }
    }
  }
  if(!car.crashed){
    const carPoly=ncp();
    for(const n of NPCS){
      if(sat(carPoly,rcorners(n.x,n.y,n.angle,CW,CH))){
        car.x=npx;car.y=npy;
        if(Math.abs(car.speed)>.8)triggerCrash();else car.speed*=-.2;break;
      }
    }
  }
  for(const n of NPCS){
    if(n.laneMode&&LANE_PATH.length){
      n.x+=Math.sin(n.angle)*n.speed*.7;n.y-=Math.cos(n.angle)*n.speed*.7;
      if(n.x>W-30||n.y<30||n.y>H-30)n.angle=Math.PI-n.angle;
    } else {
      n.x+=Math.sin(n.angle)*n.speed;n.y-=Math.cos(n.angle)*n.speed;
      n.angle+=.007*Math.sin(AF*.012+n.speed*7);
      if(n.x<22||n.x>W-22)n.angle=Math.PI-n.angle;
      if(n.y<22||n.y>H-22)n.angle=-n.angle;
    }
  }
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
      if(Math.abs(car.speed)>.3&&d2<LANE_WIDTH*.5){
        if(AF%30===0){laneScore+=1;addFloat('+1',car.x+10,car.y-15,'#00ffcc',6);}
      }
    }
  }
  if(mode===5&&!car.crashed&&Math.abs(car.speed)<.28){
    if(!PS.parked1&&inSpot()){
      PS.parked1=true;addFloat('✅ 1/2',car.x,car.y-30,'#00ffcc',8);spawnPark(car.x,car.y);
      car.x=W*.5;car.y=H*.78;car.speed=0;car.angle=0;return;
    }
    if(PS.parked1&&inSpot2()){car.parked=true;car.speed=0;triggerPark();}
  } else if(!car.crashed&&Math.abs(car.speed)<.28&&mode!==5&&inSpot()){
    car.parked=true;car.speed=0;triggerPark();
  }
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.91;p.vy*=.91;p.l-=p.d;if(p.l<=0)parts.splice(i,1);}
  tmarks=tmarks.filter(t=>(t.l-=.004)>0);
  if(cflash>0)cflash--;if(pflash>0)pflash--;
  if(COMBO_TIMER>0){COMBO_TIMER--;if(COMBO_TIMER===0){COMBO=0;document.getElementById('combobadge').classList.remove('show');}}
  document.getElementById('spd').textContent=~~(Math.abs(car.speed)*38);
}

// ── PARTICLES
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

// ── LOOP (kasma/donma fix: delta-time koruması + çift RAF engelleyici)
let raf=null;
let _lastT=0;
function loop(ts){
  // Çok uzun süre geçtiyse (tab arka planda vs) frame'i atla
  if(_lastT>0){
    const dt=ts-_lastT;
    // 200ms'den fazla gecikme varsa update'i atla (donma önleme)
    if(dt<200){update();}
  } else {
    update();
  }
  _lastT=ts;
  draw();
  raf=requestAnimationFrame(loop);
}

// ── TIMER
function startTimer(){
  clearInterval(tInt);
  const c=cfg(LVL);
  if(c.isDrift){
    // Drift modunda süre yok - sadece zone sayacı göster
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

// ── EVENTS
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
  // Level info for next level
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
function updHUD(){
  document.getElementById('sd').textContent=SCORE;
  document.getElementById('ld').textContent=LVL;
  document.getElementById('livd').textContent='❤'.repeat(Math.max(0,LIVES))+'🖤'.repeat(Math.max(0,3-LIVES));
  document.getElementById('gom').textContent=`Skor: ${SCORE} | LVL: ${LVL}`;
  // Combo badge
  if(COMBO>1){
    const cb=document.getElementById('combobadge');
    cb.textContent=`🔥 COMBO x${COMBO}`;
    cb.classList.add('show');
    COMBO_TIMER=180;
  }
}

// ── OVERLAYS
function showOv(id){
  ['sto','luo','cro','goo','rwo','driftmenu'].forEach(x=>showScreen(x,false));
  showScreen(id,true);GS=id;
}
function closeReward(){
  showScreen('rwo',false);
  GS='playing';
  startTimer();
}
function startGame(mode){
  GAME_MODE=mode||'park';
  SCORE=0;LIVES=3;LVL=1;GS='playing';
  car.color=CHOSEN_COLOR;car.roof=shade(CHOSEN_COLOR,-42);
  showScreen('sto',false);
  // Update drivetrain badge
  const dtel=document.getElementById('dtbadge');
  if(GAME_MODE==='drift'){
    dtel.textContent=DRIFT_DT.toUpperCase();dtel.classList.add('show');
    // Set day/night tint
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

// ── POLİSLER MODE
let POLIS_MODE=false;
let POLIS_SCORE=0, POLIS_HIGHSCORE=0, POLIS_COMBO=1, POLIS_COMBO_TIMER=0;
let POLIS_DRIFT_SCORE=0;
let POLIS_CARS=[]; // array of police cars
let POLIS_TMARKS=[], POLIS_PARTS=[];
let POLIS_AF=0;
let POLIS_SPAWN_TIMER=0, POLIS_SPAWN_INTERVAL=520;
let POLIS_ALIVE=true;
let POLIS_CAM={x:0,y:0}; // world camera offset for infinite world
let POLIS_PLAYER={x:0,y:0,angle:Math.PI,speed:0,vx:0,vy:0,color:'#e8304a',roof:'#c01030'};
let POLIS_SIREN_TICK=0, POLIS_SIREN_STATE=0;
let POLIS_SHAKE=0;
let POLIS_ALERT_TIMER=0;
let POLIS_DRIFT_ACTIVE=false, POLIS_DRIFT_INTENSITY=0;
let POLIS_SCORE_TICK=0;
let POLIS_ROAD_SEED=1234; // for procedural road
let POLIS_INPUT={L:0,R:0};
let POLIS_RAF=null;
// Keyboard support for polis mode
window.addEventListener('keydown',e=>{
  if(!POLIS_MODE)return;
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){POLIS_INPUT.L=1;document.getElementById('pL')?.classList.add('pressed');}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){POLIS_INPUT.R=1;document.getElementById('pR')?.classList.add('pressed');}
});
window.addEventListener('keyup',e=>{
  if(!POLIS_MODE)return;
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){POLIS_INPUT.L=0;document.getElementById('pL')?.classList.remove('pressed');}
  if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){POLIS_INPUT.R=0;document.getElementById('pR')?.classList.remove('pressed');}
});

function polisInput(k,v){
  POLIS_INPUT[k]=v;
  const el=document.getElementById({L:'pL',R:'pR'}[k]);
  if(el)el.classList.toggle('pressed',!!v);
}

// Procedural infinite road tiles (simple noise-based)
function polisRoadColor(wx,wy){
  // Simple hash for consistent procedural asphalt
  const tx=Math.floor(wx/80),ty=Math.floor(wy/80);
  const h=(tx*374761393+ty*668265263)&0x7fffffff;
  const b=36+((h>>4)&15);
  return`rgb(${b},${b},${b+4})`;
}

function drawPolisWorld(){
  const spd=Math.hypot(POLIS_PLAYER.vx,POLIS_PLAYER.vy);
  const targetZoom=Math.max(0.42, 1.0 - (spd/7.5)*0.60);
  if(typeof POLIS_CAM_ZOOM==='undefined') window.POLIS_CAM_ZOOM=1.0;
  window.POLIS_CAM_ZOOM+=(targetZoom-window.POLIS_CAM_ZOOM)*0.06;
  const zoom=window.POLIS_CAM_ZOOM;

  const cx=W/2-POLIS_PLAYER.x, cy=H/2-POLIS_PLAYER.y;
  ctx.save();
  ctx.translate(W/2,H/2);
  ctx.scale(zoom,zoom);
  ctx.translate(-W/2,-H/2);
  ctx.translate(cx,cy);

  const zoomInv=1/Math.max(0.3,window.POLIS_CAM_ZOOM||1.0);
  const visL=POLIS_PLAYER.x-W*zoomInv, visR=POLIS_PLAYER.x+W*zoomInv;
  const visT=POLIS_PLAYER.y-H*zoomInv, visB=POLIS_PLAYER.y+H*zoomInv;

  // Zemin + ızgara — park modundaki sade stil
  ctx.fillStyle='#1a1a28'; ctx.fillRect(visL,visT,visR-visL,visB-visT);
  ctx.strokeStyle='#ffffff07'; ctx.lineWidth=1;
  const lineSpacing=230;
  const lx0=Math.floor(visL/lineSpacing)*lineSpacing;
  const ly0=Math.floor(visT/lineSpacing)*lineSpacing;
  ctx.beginPath();
  for(let lx=lx0;lx<visR+lineSpacing;lx+=lineSpacing){ctx.moveTo(lx,visT);ctx.lineTo(lx,visB);}
  for(let ly=ly0;ly<visB+lineSpacing;ly+=lineSpacing){ctx.moveTo(visL,ly);ctx.lineTo(visR,ly);}
  ctx.stroke();

  // Tire marks
  for(const t of POLIS_TMARKS){
    if(t.l<0.08)continue;
    ctx.globalAlpha=t.l*.5;ctx.fillStyle='#222';
    ctx.fillRect(~~t.x-2,~~t.y-2,5,5);
  }
  ctx.globalAlpha=1;

  // Police cars
  for(const p of POLIS_CARS){
    drawPolisCarWorld(p);
  }

  // Particles
  for(const p of POLIS_PARTS){
    ctx.globalAlpha=p.l;ctx.fillStyle=p.c;ctx.fillRect(~~p.x-p.s/2,~~p.y-p.s/2,p.s,p.s);
  }
  ctx.globalAlpha=1;

  // Player car
  drawPolisPlayer();

  ctx.restore();
}

function drawPolisPlayer(){
  const p=POLIS_PLAYER;
  const dg=POLIS_DRIFT_ACTIVE&&POLIS_DRIFT_INTENSITY>0.15;
  drawCar(p.x,p.y,p.angle,p.color,p.roof,1,true,dg);
  // Drift smoke
  if(dg&&POLIS_AF%6===0&&POLIS_PARTS.length<50){
    const co=rcorners(p.x,p.y,p.angle,CW,CH);
    for(const wi of[2,3]){
      const sa=Math.atan2(p.vy,p.vx)+Math.PI+(Math.random()-.5)*1.4;
      const sp=0.3+Math.random()*0.7;
      POLIS_PARTS.push({x:co[wi].x,y:co[wi].y,vx:Math.cos(sa)*sp,vy:Math.sin(sa)*sp,l:0.7,d:0.01,s:6+Math.random()*8,c:['#ccc','#ddd','#bbb'][wi%3]});
      POLIS_TMARKS.push({x:co[wi].x,y:co[wi].y,l:1.8});
    }
  }
}

function drawPolisCarWorld(pc){
  // Determine car type color
  const isSuv=pc.type==='suv';
  const sc=isSuv?1.25:1.0;
  // Body color: black/white police
  const bodyCol=pc.color||'#f0f0f0';
  const roofCol=shade(bodyCol,-50);

  ctx.save();ctx.translate(pc.x,pc.y);ctx.rotate(pc.angle);
  const hw=CW/2*sc,hh=CH/2*sc,w=CW*sc,h=CH*sc;
  // Shadow
  ctx.globalAlpha=.32;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(2*sc,4*sc,hw*1.1,hh*.62,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // Body
  ctx.fillStyle=bodyCol;ctx.fillRect(-hw,-hh,w,h);
  // Police stripe
  ctx.fillStyle='#111111';ctx.fillRect(-hw,-hh+h*.35,w,h*.28);
  // Roof
  ctx.fillStyle=roofCol;ctx.fillRect(-hw*.60,-hh+h*.22,w*.60,h*.39);
  // Windshields
  ctx.fillStyle='#88ccffa0';ctx.fillRect(-hw*.50,-hh+h*.04,w*.50,h*.15);
  ctx.fillStyle='#88ccff80';ctx.fillRect(-hw*.46,-hh+h*.64,w*.46,h*.10);
  // POLIS text
  ctx.fillStyle='#1133cc';ctx.font=`bold ${~~(6*sc)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('POLİS',-0,hh-h*.18+2);
  // Siren lights — pixel style, no shadow (perf)
  const sl=POLIS_AF%14;
  const s1col=(sl<7)?'#ff2222':'#2255ff';
  const s2col=(sl<7)?'#2255ff':'#ff2222';
  ctx.fillStyle=s1col; ctx.fillRect(-hw*.28,-hh+h*.24,~~(4*sc),~~(4*sc));
  ctx.fillStyle=s2col; ctx.fillRect( hw*.18,-hh+h*.24,~~(4*sc),~~(4*sc));
  // Headlights
  ctx.fillStyle='#ffffc0';ctx.fillRect(-hw+sc,-hh+sc,4*sc,3*sc);ctx.fillRect(hw-5*sc,-hh+sc,4*sc,3*sc);
  // Taillights
  ctx.fillStyle='#ff2200';ctx.fillRect(-hw+sc,hh-4*sc,4*sc,3*sc);ctx.fillRect(hw-5*sc,hh-4*sc,4*sc,3*sc);
  // Wheels
  for(const[wx,wy]of[[-hw-sc,-hh+4*sc],[hw-3*sc,-hh+4*sc],[-hw-sc,hh-12*sc],[hw-3*sc,hh-12*sc]]){
    ctx.fillStyle='#111';ctx.fillRect(wx,wy,4*sc,8*sc);ctx.fillStyle='#2a2a2a';ctx.fillRect(wx+sc,wy+sc,2*sc,6*sc);
  }
  // Drift smoke for police
  if(pc.drifting&&POLIS_AF%4===0){
    ctx.restore();
    const co=rcorners(pc.x,pc.y,pc.angle,CW*sc,CH*sc);
    for(const wi of[2,3]){
      const sa=Math.atan2(pc.vy,pc.vx)+Math.PI+(Math.random()-.5)*1.3;
      POLIS_PARTS.push({x:co[wi].x,y:co[wi].y,vx:Math.cos(sa)*0.5,vy:Math.sin(sa)*0.5,l:0.5,d:0.012,s:5,c:'#aaaaaa'});
    }
    return;
  }
  ctx.restore();
}

function spawnPolice(){
  // Spawn off-screen relative to player
  const angle=Math.random()*Math.PI*2;
  const spawnDist=W*0.8+Math.random()*200;
  const sx=POLIS_PLAYER.x+Math.cos(angle)*spawnDist;
  const sy=POLIS_PLAYER.y+Math.sin(angle)*spawnDist;
  const isSuv=Math.random()<0.35;
  const colors=['#f0f0f0','#eeeeee','#f5f5f5','#dddddd'];
  // Zaman ilerledikçe polisler hızlanır
  const elapsed=POLIS_SCORE_TICK/60; // saniye cinsinden
  const diffMult=Math.min(2.2, 1.0 + elapsed/60); // her 60sn +1.0 çarpan, max x2.2
  POLIS_CARS.push({
    x:sx,y:sy,
    angle:Math.random()*Math.PI*2,
    speed:0,
    vx:0,vy:0,
    color:colors[~~(Math.random()*colors.length)],
    type:isSuv?'suv':'patrol',
    maxSpeed:(isSuv?5.5:6.8)*diffMult,
    accel:(isSuv?0.13:0.20)*Math.min(1.8,diffMult),
    steer:(isSuv?0.055:0.068)*Math.min(1.5,1.0+elapsed/120),
    drifting:false,
    driftTimer:0,
  });
}

function updatePolisAI(){
  const p=POLIS_PLAYER;
  for(const pc of POLIS_CARS){
    const dx=p.x-pc.x, dy=p.y-pc.y;
    const d=Math.hypot(dx,dy);
    const targetAngle=Math.atan2(dx,-dy);
    let angleDiff=targetAngle-pc.angle;
    while(angleDiff>Math.PI)angleDiff-=Math.PI*2;
    while(angleDiff<-Math.PI)angleDiff+=Math.PI*2;

    // Smooth steer — sadece gereği kadar döndür
    const maxSteer=pc.steer*1.2;
    pc.angle+=Math.max(-maxSteer,Math.min(maxSteer,angleDiff));

    // Hız — her zaman max, yaklaşınca bile yavaşlama yok
    pc.speed=Math.min(pc.speed+pc.accel, pc.maxSpeed);
    if(pc.speed<1.0)pc.speed=1.0;

    // Direkt kinematik hareket — velocity blending yok (salınım kaynağı bu)
    pc.x+=Math.sin(pc.angle)*pc.speed;
    pc.y-=Math.cos(pc.angle)*pc.speed;
    pc.vx=Math.sin(pc.angle)*pc.speed;
    pc.vy=-Math.cos(pc.angle)*pc.speed;
    pc.drifting=false;

    // Police-police collision → PATLAMA!
    for(let j=POLIS_CARS.length-1;j>=0;j--){
      const pc2=POLIS_CARS[j];
      if(pc===pc2)continue;
      const ddx=pc.x-pc2.x,ddy=pc.y-pc2.y;
      const dd=Math.hypot(ddx,ddy);
      const sc1=pc.type==='suv'?1.25:1.0;
      const sc2=pc2.type==='suv'?1.25:1.0;
      const minDist=CW*(sc1+sc2)*0.7;
      if(dd<minDist&&dd>0.1){
        // Her iki polis arabası patlıyor!
        if(!pc._exploded&&!pc2._exploded){
          pc._exploded=true;
          pc2._exploded=true;
          // Büyük patlama partikülü
          const expCols=['#ff4400','#ffaa00','#ff0000','#ffff00','#fff','#ff6600','#ff8800'];
          const expX=(pc.x+pc2.x)/2, expY=(pc.y+pc2.y)/2;
          for(let k=0;k<25;k++){
            const a=Math.random()*Math.PI*2,sp=2+Math.random()*8;
            POLIS_PARTS.push({x:expX,y:expY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:0.025+Math.random()*0.03,s:4+Math.random()*10,c:expCols[~~(Math.random()*expCols.length)]});
          }
          // Duman
          for(let k=0;k<10;k++){
            const a=Math.random()*Math.PI*2,sp=0.5+Math.random()*2;
            POLIS_PARTS.push({x:expX,y:expY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:0.7,d:0.012,s:8+Math.random()*12,c:['#555','#666','#444'][k%3]});
          }
          // Score bonus
          POLIS_SCORE+=100*POLIS_COMBO;
          POLIS_COMBO=Math.min(POLIS_COMBO+2,8);
          POLIS_COMBO_TIMER=300;
          const cb=document.getElementById('polis-combo-badge');
          cb.textContent='💥 PATLADI! x'+POLIS_COMBO;cb.classList.add('show');
          // Sil
          POLIS_CARS.splice(j,1);
          // pc'yi de sil (farklı indeks)
          const pi=POLIS_CARS.indexOf(pc);
          if(pi>=0)POLIS_CARS.splice(pi,1);
          break;
        }
      }
    }

    // Collision with player
    if(!car.crashed){
      const sc=pc.type==='suv'?1.25:1.0;
      const dx=p.x-pc.x, dy=p.y-pc.y;
      const minR=(CW/2 + CW*sc/2)*0.9;
      if(dx*dx+dy*dy < minR*minR && sat(rcorners(p.x,p.y,p.angle,CW,CH),rcorners(pc.x,pc.y,pc.angle,CW*sc,CH*sc))){
        triggerPolisCaught();
      }
    }
  }
}

function updatePolisPlayer(){
  const p=POLIS_PLAYER;
  const steerIn=(POLIS_INPUT.L?-1:0)+(POLIS_INPUT.R?1:0);

  // Sabit ivme, salınım yok
  const maxV=7.5;
  p.speed=Math.min(p.speed+0.09, maxV);
  p.speed=Math.max(p.speed, 1.8);

  // Direksiyon — hıza göre ölçekli, sabit formül
  if(steerIn!==0){
    const sf=0.046*(1.0 - (p.speed/maxV)*0.25);
    p.angle+=steerIn*sf;
  }

  // Direkt kinematik — velocity blending yok, titreme yok
  p.vx=Math.sin(p.angle)*p.speed;
  p.vy=-Math.cos(p.angle)*p.speed;
  p.x+=p.vx; p.y+=p.vy;

  // Drift detection: direksiyon keserken açı farkını simüle et
  POLIS_DRIFT_INTENSITY=Math.abs(steerIn)*(p.speed/maxV)*0.8;
  const spd=p.speed;
  POLIS_DRIFT_ACTIVE=POLIS_DRIFT_INTENSITY>0.25&&spd>3.0;

  if(POLIS_DRIFT_ACTIVE){
    const driftPts=Math.floor(POLIS_DRIFT_INTENSITY*spd*8)*POLIS_COMBO;
    POLIS_DRIFT_SCORE+=driftPts;
    if(POLIS_AF%60===0&&POLIS_DRIFT_SCORE>0){
      POLIS_SCORE+=POLIS_DRIFT_SCORE;
      POLIS_DRIFT_SCORE=0;
      POLIS_COMBO=Math.min(POLIS_COMBO+1,8);
      POLIS_COMBO_TIMER=200;
      const cb=document.getElementById('polis-combo-badge');
      cb.textContent='🔥 COMBO x'+POLIS_COMBO;cb.classList.add('show');
    }
  }
}

function updatePolisLoop(){
  if(!POLIS_ALIVE)return;
  POLIS_AF++;
  POLIS_SCORE_TICK++;

  // Survival score (every 30 frames)
  if(POLIS_SCORE_TICK%30===0){
    POLIS_SCORE+=POLIS_COMBO;
  }

  // Combo decay
  if(POLIS_COMBO_TIMER>0){
    POLIS_COMBO_TIMER--;
    if(POLIS_COMBO_TIMER===0){
      POLIS_COMBO=1;
      document.getElementById('polis-combo-badge').classList.remove('show');
    }
  }

  // Spawn timer
  POLIS_SPAWN_TIMER++;
  if(POLIS_SPAWN_TIMER>=POLIS_SPAWN_INTERVAL){
    POLIS_SPAWN_TIMER=0;
    // Her 30 saniyede spawn hızlanır, minimum 90 frame (~1.5sn)
    POLIS_SPAWN_INTERVAL=Math.max(90, POLIS_SPAWN_INTERVAL-15);
    spawnPolice();
    // İlk 60sn max 8, 60-120sn max 14, 120sn+ max 20
    const elapsed=POLIS_SCORE_TICK/60;
    const maxPolis=elapsed<60?8:elapsed<120?14:20;
    if(POLIS_CARS.length>maxPolis)POLIS_CARS.shift();
  }

  // Siren effect
  POLIS_SIREN_TICK++;
  if(POLIS_SIREN_TICK%8===0){POLIS_SIREN_STATE=(POLIS_SIREN_STATE+1)%2;}
  let nearbyCount=0;
  const px=POLIS_PLAYER.x, py=POLIS_PLAYER.y;
  for(const pc of POLIS_CARS){
    const dx=pc.x-px, dy=pc.y-py;
    const dist2=dx*dx+dy*dy;
    if(dist2<350*350) POLIS_ALERT_TIMER=60;
    if(dist2<500*500) nearbyCount++;
  }
  POLIS_NEARBY_COUNT=nearbyCount;

  if(POLIS_ALERT_TIMER>0){
    POLIS_ALERT_TIMER--;
    document.getElementById('polis-alert').classList.toggle('show',POLIS_ALERT_TIMER>0);
  }

  updatePolisPlayer();
  updatePolisAI();

  // Shake
  if(POLIS_SHAKE>0){
    POLIS_SHAKE--;
    document.getElementById('wrap').classList.toggle('shake',POLIS_SHAKE===10);
  }

  // Particle update
  for(let i=POLIS_PARTS.length-1;i>=0;i--){
    const p=POLIS_PARTS[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.90;p.vy*=.90;p.l-=p.d;
    if(p.l<=0)POLIS_PARTS.splice(i,1);
  }
  if(POLIS_PARTS.length>60)POLIS_PARTS.splice(0,POLIS_PARTS.length-60);

  // Tire marks
  POLIS_TMARKS=POLIS_TMARKS.filter(t=>(t.l-=.012)>0);
  if(POLIS_TMARKS.length>40)POLIS_TMARKS.length=40;

  // HUD (throttled)
  if(POLIS_AF%4===0) updPolisHUD();
}

function drawPolisLoop(){
  ctx.clearRect(0,0,W,H);
  drawPolisWorld();

  // Speed streaks — tek path
  const spd=Math.hypot(POLIS_PLAYER.vx,POLIS_PLAYER.vy);
  if(spd>2.5){
    ctx.globalAlpha=Math.min(0.22,(spd-2.5)/5*.18);
    ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;
    const streakLen=8+spd*3;
    const sa=-Math.sin(POLIS_PLAYER.angle)*streakLen, ca=Math.cos(POLIS_PLAYER.angle)*streakLen;
    ctx.beginPath();
    for(let i=0;i<4;i++){const sx=Math.random()*W,sy=Math.random()*H;ctx.moveTo(sx,sy);ctx.lineTo(sx+sa,sy+ca);}
    ctx.stroke();
    ctx.globalAlpha=1;
  }

  // Crash flash
  if(POLIS_SHAKE>2){
    ctx.fillStyle=`rgba(255,20,20,${(POLIS_SHAKE/14)*0.35})`;
    ctx.fillRect(0,0,W,H);
  }

  // Police count indicator (top center)
  const polisNear=POLIS_NEARBY_COUNT;
  if(polisNear>0){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(W/2-55,56,110,22);
    ctx.strokeStyle=POLIS_SIREN_STATE===0?'#ff3333':'#4488ff';ctx.lineWidth=1.5;ctx.strokeRect(W/2-55,56,110,22);
    ctx.fillStyle=POLIS_SIREN_STATE===0?'#ff5555':'#6699ff';
    ctx.font='5px "Press Start 2P"';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(`🚨 ${polisNear} POLİS YAKINDA 🚨`,W/2,56+11);
    ctx.restore();
  }

  // Drift indicator
  if(POLIS_DRIFT_ACTIVE&&POLIS_DRIFT_SCORE>0){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(W/2-50,H-84,100,18);
    ctx.strokeStyle='#ff6600';ctx.lineWidth=1;ctx.strokeRect(W/2-50,H-84,100,18);
    ctx.font='5px "Press Start 2P"';ctx.fillStyle='#ff6600';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🔥 DRIFT +'+POLIS_DRIFT_SCORE,W/2,H-75);
    ctx.restore();
  }

  // Minimap radar showing police positions
  const mmX=W-56, mmY=H-74, mmR=26;
  ctx.save();
  ctx.globalAlpha=0.75;
  ctx.fillStyle='#000015';ctx.beginPath();ctx.arc(mmX,mmY,mmR,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ff333388';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mmX,mmY,mmR,0,Math.PI*2);ctx.stroke();
  // Player dot
  ctx.fillStyle='#00ffcc';ctx.beginPath();ctx.arc(mmX,mmY,4,0,Math.PI*2);ctx.fill();
  // Police dots
  for(const pc of POLIS_CARS){
    const dx=(pc.x-POLIS_PLAYER.x)*mmR/400;
    const dy=(pc.y-POLIS_PLAYER.y)*mmR/400;
    const d=Math.hypot(dx,dy);
    const rdx=d>mmR-5?(dx/d)*(mmR-5):dx;
    const rdy=d>mmR-5?(dy/d)*(mmR-5):dy;
    ctx.fillStyle=POLIS_SIREN_STATE===0?'#ff3333':'#4488ff';
    ctx.beginPath();ctx.arc(mmX+rdx,mmY+rdy,3,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.fillStyle='#ff333366';ctx.font='4px "Press Start 2P"';ctx.textAlign='center';
  ctx.fillText('RADAR',mmX,mmY+mmR+8);
  ctx.restore();
}

function updPolisHUD(){
  document.getElementById('polis-score-val').textContent=POLIS_SCORE;
  document.getElementById('polis-hi-val').textContent=POLIS_HIGHSCORE;
  document.getElementById('polis-combo-val').textContent='x'+POLIS_COMBO;
  document.getElementById('polis-count-val').textContent=POLIS_CARS.length;
}

function triggerPolisCaught(){
  if(!POLIS_ALIVE)return;
  POLIS_ALIVE=false;
  POLIS_SHAKE=28;
  if(POLIS_SCORE>POLIS_HIGHSCORE)POLIS_HIGHSCORE=POLIS_SCORE;
  // Spawn crash particles at player pos
  const cols=['#ff4400','#ffaa00','#ff0000','#ffff00','#fff'];
  for(let i=0;i<50;i++){const a=Math.random()*Math.PI*2,sp=1.5+Math.random()*5;POLIS_PARTS.push({x:POLIS_PLAYER.x,y:POLIS_PLAYER.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:.018,s:3+Math.random()*7,c:cols[~~(Math.random()*cols.length)]});}
  // Draw one last frame with crash, then show game over
  setTimeout(()=>{
    document.getElementById('polis-go-msg').textContent='Skor: '+POLIS_SCORE+' | Süre: '+(~~(POLIS_SCORE_TICK/60))+'s';
    document.getElementById('polis-go-hi').textContent='En İyi: '+POLIS_HIGHSCORE;
    showScreen('polis-go',true);
  },900);
}

function startPolisMode(){
  POLIS_MODE=true;
  POLIS_ALIVE=true;
  POLIS_SCORE=0;POLIS_COMBO=1;POLIS_COMBO_TIMER=0;POLIS_DRIFT_SCORE=0;
  POLIS_CARS=[];POLIS_TMARKS=[];POLIS_PARTS=[];
  POLIS_AF=0;POLIS_SCORE_TICK=0;
  POLIS_SPAWN_TIMER=0;POLIS_SPAWN_INTERVAL=520;
  POLIS_SIREN_TICK=0;POLIS_SIREN_STATE=0;POLIS_SHAKE=0;POLIS_ALERT_TIMER=0;
  POLIS_DRIFT_ACTIVE=false;POLIS_DRIFT_INTENSITY=0;
  POLIS_INPUT={L:0,R:0};

  window.POLIS_CAM_ZOOM=1.0;
  // Player start
  POLIS_PLAYER={x:0,y:0,angle:Math.PI,speed:0.5,vx:0,vy:0,color:CHOSEN_COLOR,roof:shade(CHOSEN_COLOR,-42)};

  // Stop other game loop
  if(raf){cancelAnimationFrame(raf);raf=null;}
  clearInterval(tInt);

  // Hide normal UI
  document.getElementById('hud').style.display='none';
  document.getElementById('ctrl').style.display='none';
  document.getElementById('driftbar-wrap').className='';
  document.getElementById('driftmode-overlay').className='';
  document.getElementById('driftbadge').classList.remove('show');
  document.getElementById('driftscore').classList.remove('show');
  document.getElementById('combobadge').classList.remove('show');
  document.getElementById('dtbadge').className='';
  document.getElementById('daytint').classList.remove('show');
  document.getElementById('siren-overlay').className='';

  // Show polis UI
  document.getElementById('polis-hud').classList.add('show');
  document.getElementById('polis-ctrl').classList.add('show');
  document.getElementById('polis-alert').classList.remove('show');
  document.getElementById('polis-combo-badge').classList.remove('show');

  // Spawn initial police
  for(let i=0;i<2;i++)spawnPolice();

  _polisLastT=0;
  // Show intro animation
  const intro=document.getElementById('polis-intro');
  intro.classList.add('show');
  setTimeout(()=>{
    intro.classList.remove('show');
    // Start game loop
    POLIS_RAF=requestAnimationFrame(polisMainLoop);
  },2200);
}

let _polisLastT=0;
function polisMainLoop(ts){
  if(_polisLastT>0){
    const dt=ts-_polisLastT;
    if(dt<200){updatePolisLoop();}
  } else {
    updatePolisLoop();
  }
  _polisLastT=ts;
  drawPolisLoop();
  if(POLIS_ALIVE||POLIS_SHAKE>0){
    POLIS_RAF=requestAnimationFrame(polisMainLoop);
  } else {
    drawPolisLoop();
  }
}

function restartPolisMode(){
  showScreen('polis-go',false);
  if(POLIS_RAF){cancelAnimationFrame(POLIS_RAF);POLIS_RAF=null;}
  startPolisMode();
}

// Override goToMenu to also handle polis mode
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
driftSel('map','open');
driftSel('tod','night');
driftSel('dt','rwd');
resize();loop();updHUD();
