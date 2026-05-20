// ── INPUT
const I={L:0,R:0,G:0,B:0,H:0};
function pd(e,k,v){e.preventDefault();e.stopPropagation();I[k]=v;const el=document.getElementById({L:'bL',R:'bR',G:'bG',B:'bB',H:'bH'}[k]);if(el)el.classList.toggle('pressed',!!v);}
const KM={ArrowLeft:'L',a:'L',A:'L',ArrowRight:'R',d:'R',D:'R',ArrowUp:'G',w:'G',W:'G',ArrowDown:'B',s:'B',S:'B',' ':'H'};
window.addEventListener('keydown',e=>{const k=KM[e.key];if(k){I[k]=1;pd({preventDefault:()=>{},stopPropagation:()=>{}},k,1);e.preventDefault();}});
window.addEventListener('keyup',e=>{const k=KM[e.key];if(k){I[k]=0;pd({preventDefault:()=>{},stopPropagation:()=>{}},k,0);}});

// ── CANVAS
const canvas=document.getElementById('gc');
const ctx=canvas.getContext('2d');
let W,H;
function resize(){applyCanvasDPR();}
window.addEventListener('resize',()=>{applyCanvasDPR();if(GS==='playing')genLevel();});

// ── STATE
let GS='start',LVL=1,SCORE=0,LIVES=3,TIMER=60,tInt=null;
let parts=[],tmarks=[],AF=0,cflash=0,pflash=0;
let OBS=[],PS=null,NPCS=[],BONUS_COINS=[];
let KEYS_ON_MAP=[],KEYS_COLLECTED=0,REWARD=null;
let laneWarningTimer=0,laneOutTimer=0;
let floatMsgs=[];
const FLOAT_DUR=90;
let COMBO=0,COMBO_TIMER=0;
let CHOSEN_COLOR='#e8304a';
let GAME_MODE='park';

// Drift config (set in menu)
let DRIFT_MAP='open';
let DRIFT_TOD='night';
let DRIFT_DT='rwd';

// Drivetrain physics presets
const DT_PRESETS={
  fwd:{
    frontGrip:0.28, rearGrip:0.72, gasEffect:'front',
    steerMult:0.85, accelMult:1.0, maxSpeedMult:0.9,
    desc:'Ön lastikler döner. Gaz basınca ön kayar, direksiyon etkisi azalır. Understeer!'
  },
  rwd:{
    frontGrip:0.80, rearGrip:0.18, gasEffect:'rear',
    steerMult:1.10, accelMult:1.1, maxSpeedMult:1.0,
    desc:'Arka lastikler döner. Gaz basınca arka kaymaya başlar. En iyi drift için!'
  },
  awd:{
    frontGrip:0.50, rearGrip:0.50, gasEffect:'all',
    steerMult:1.00, accelMult:1.2, maxSpeedMult:1.15,
    desc:'4 lastik birden. Yüksek hızda tüm lastikler kayar. Dengeli güçlü drift.'
  },
  '4wd':{
    frontGrip:0.32, rearGrip:0.32, gasEffect:'all',
    steerMult:0.70, accelMult:1.35, maxSpeedMult:1.05,
    desc:'Kilitli dört teker. Maksimum güç, minimal direksiyon. Brütal kayış!'
  }
};

// Drift state
let DRIFT_SCORE=0,DRIFT_ACTIVE=false,DRIFT_TIMER=0,DRIFT_TOTAL=0;
let car_vx=0,car_vy=0;
let DRIFT_ZONES=[];
let DRIFT_ZONE_HITS=0;
let lastDriftBarPct=-1;
let lastDriftLabel='';
let lastDriftBadgeColor='';

// Car
const CW=22,CH=36;
const car={x:0,y:0,angle:0,speed:0,
  accel:.095,brake:.15,fric:.965,maxF:3.0,maxR:1.3,steer:.050,
  color:'#e8304a',roof:'#c01030',crashed:false,parked:false};

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

function shade(h,a){let n=parseInt(h.slice(1),16);const r=Math.min(255,Math.max(0,((n>>16)&255)+a)),g=Math.min(255,Math.max(0,((n>>8)&255)+a)),b=Math.min(255,Math.max(0,(n&255)+a));return`#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`;}
function dist(ax,ay,bx,by){return Math.hypot(bx-ax,by-ay);}
function rcorners(cx,cy,ang,w,h){
  const hw=w/2,hh=h/2,cos=Math.cos(ang),sin=Math.sin(ang);
  return[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x,y])=>({x:cx+x*cos-y*sin,y:cy+x*sin+y*cos}));
}
function sat(A,B){
  for(const poly of[A,B]){
    const n=poly.length;
    for(let i=0;i<n;i++){
      const a=poly[i],b=poly[(i+1)%n];
      const nx=-(b.y-a.y),ny=b.x-a.x;
      let mnA=1e9,mxA=-1e9,mnB=1e9,mxB=-1e9;
      for(const p of A){const d=p.x*nx+p.y*ny;if(d<mnA)mnA=d;if(d>mxA)mxA=d;}
      for(const p of B){const d=p.x*nx+p.y*ny;if(d<mnB)mnB=d;if(d>mxB)mxB=d;}
      if(mxA<mnB||mxB<mnA)return false;
    }
  }
  return true;
}

function pr(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(~~x,~~y,Math.ceil(w),Math.ceil(h));}

function drawCar(cx,cy,ang,col,rcol,sc=1,headlights=false,driftGlow=false){
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
  const hw=CW/2*sc,hh=CH/2*sc,w=CW*sc,h=CH*sc;
  ctx.globalAlpha=.32;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(2*sc,4*sc,hw*1.1,hh*.62,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  pr(-hw,-hh,w,h,col);
  pr(-hw+2*sc,-hh+2*sc,w-4*sc,h*.31,shade(col,18));
  pr(-hw*.60,-hh+h*.22,w*.60,h*.39,rcol);
  ctx.fillStyle='#88ccffa0';pr(-hw*.50,-hh+h*.04,w*.50,h*.15,'#88ccffa0');
  pr(-hw*.46,-hh+h*.64,w*.46,h*.10,'#88ccff80');
  pr(-hw+sc,-hh+sc,4*sc,3*sc,'#ffffc0');pr(hw-5*sc,-hh+sc,4*sc,3*sc,'#ffffc0');
  if(headlights){
    ctx.globalAlpha=.5;ctx.fillStyle='#ffffaa';ctx.beginPath();ctx.ellipse(-hw*.3,-hh-12*sc,7*sc,16*sc,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(hw*.3,-hh-12*sc,7*sc,16*sc,0,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.globalAlpha=.28;pr(-hw-2*sc,-hh-2*sc,8*sc,7*sc,'#ffffaa');pr(hw-7*sc,-hh-2*sc,8*sc,7*sc,'#ffffaa');ctx.globalAlpha=1;
  const tlcol=driftGlow?'#ff0000':'#ff3300';
  pr(-hw+sc,hh-4*sc,4*sc,3*sc,tlcol);pr(hw-5*sc,hh-4*sc,4*sc,3*sc,tlcol);
  if(driftGlow){pr(-hw+sc,hh-4*sc,4*sc,3*sc,'#ff0000');pr(hw-5*sc,hh-4*sc,4*sc,3*sc,'#ff0000');}
  for(const[wx,wy]of[[-hw-sc,-hh+4*sc],[hw-3*sc,-hh+4*sc],[-hw-sc,hh-12*sc],[hw-3*sc,hh-12*sc]]){
    pr(wx,wy,4*sc,8*sc,'#111');pr(wx+sc,wy+sc,2*sc,6*sc,'#2a2a2a');pr(wx+sc,wy+3.5*sc,2*sc,2*sc,'#888');
  }
  pr(-5*sc,hh-3*sc,10*sc,2*sc,'#ffe84a');
  ctx.globalAlpha=.10;pr(-hw+2*sc,-hh+2*sc,2.5*sc,hh*.9,'#fff');ctx.globalAlpha=1;
  ctx.restore();
}

function drawFloatMsgs(){
  for(let i=floatMsgs.length-1;i>=0;i--){
    const m=floatMsgs[i];
    m.age++;m.y-=0.7;
    const a=Math.max(0,1-m.age/FLOAT_DUR);
    ctx.globalAlpha=a;
    ctx.font=`${m.size||8}px 'Press Start 2P'`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=m.color||'#f5c518';
    ctx.fillText(m.text,m.x,m.y);
    ctx.globalAlpha=1;
    if(m.age>=FLOAT_DUR)floatMsgs.splice(i,1);
  }
}

function addFloat(text,x,y,color='#f5c518',size=8){
  floatMsgs.push({text,x,y,color,size,age:0});
}

(function(){
  const cp=document.getElementById('colorpicker');
  CAR_COLORS.forEach((c,i)=>{
    const btn=document.createElement('div');
    btn.className='cpbtn'+(i===0?' selected':'');
    btn.style.background=c;
    btn.onclick=()=>{
      CHOSEN_COLOR=c;
      car.color=c;car.roof=shade(c,-42);
      document.querySelectorAll('.cpbtn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
    };
    cp.appendChild(btn);
  });
})();

  // Cache frequently used DOM elements to avoid repeated lookups in render/update loops
  const DOM = {
    sd: document.getElementById('sd'),
    ld: document.getElementById('ld'),
    livd: document.getElementById('livd'),
    td: document.getElementById('td'),
    tfill: document.getElementById('tfill'),
    spd: document.getElementById('spd'),
    driftscore: document.getElementById('driftscore'),
    driftbarLabel: document.getElementById('driftbar-label'),
    driftbarFill: document.getElementById('driftbar-fill'),
    driftbadge: document.getElementById('driftbadge'),
    dtbadge: document.getElementById('dtbadge'),
    daytint: document.getElementById('daytint'),
    lanewarn: document.getElementById('lanewarn'),
    hud: document.getElementById('hud'),
    ctrl: document.getElementById('ctrl'),
    keybadge: document.getElementById('keybadge'),
    combobadge: document.getElementById('combobadge'),
    crm: document.getElementById('crm'),
    tbarFill: document.getElementById('tfill'),
    polisScore: document.getElementById('polis-score-val'),
    polisHi: document.getElementById('polis-hi-val'),
    polisCombo: document.getElementById('polis-combo-val'),
    polisCount: document.getElementById('polis-count-val'),
    polisAlert: document.getElementById('polis-alert'),
    polisComboBadge: document.getElementById('polis-combo-badge')
  };

  // Mobile / performance flags
  const IS_MOBILE = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || window.innerWidth<=720;
  const DPR_CAP = IS_MOBILE? Math.min(window.devicePixelRatio||1, 1.25) : (window.devicePixelRatio||1);
  const MAX_PARTS = IS_MOBILE? 20 : 35;
  const MAX_TMARKS = IS_MOBILE? 60 : 120;

  function applyCanvasDPR(){
    const dpr = DPR_CAP;
    const wr=document.getElementById('wrap');
    W=wr.clientWidth; H=wr.clientHeight;
    canvas.style.width = W+'px';
    canvas.style.height = H+'px';
    canvas.width = Math.floor(W*dpr);
    canvas.height = Math.floor(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function isMobile(){return IS_MOBILE;}
