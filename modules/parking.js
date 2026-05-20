// ── PARKING MODE
// Level configuration, level generation, drawing, physics, events specific to parking mode

// Level mode mapping
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

// Drift menu selector
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

// Game start/restart functions
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

// Placeholder for genLevel - import from script.js
// Placeholder for draw/update functions
