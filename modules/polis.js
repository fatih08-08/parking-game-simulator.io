// ── POLİSLER MODE
// Police AI, game loop, input, drawing, events

// Polis state
let POLIS_MODE=false;
let POLIS_SCORE=0, POLIS_HIGHSCORE=0, POLIS_COMBO=1, POLIS_COMBO_TIMER=0;
let POLIS_DRIFT_SCORE=0;
let POLIS_CARS=[];
let POLIS_TMARKS=[], POLIS_PARTS=[];
let POLIS_AF=0;
let POLIS_SPAWN_TIMER=0, POLIS_SPAWN_INTERVAL=520;
let POLIS_ALIVE=true;
let POLIS_CAM={x:0,y:0};
let POLIS_PLAYER={x:0,y:0,angle:Math.PI,speed:0,vx:0,vy:0,color:'#e8304a',roof:'#c01030'};
let POLIS_SIREN_TICK=0, POLIS_SIREN_STATE=0;
let POLIS_SHAKE=0;
let POLIS_ALERT_TIMER=0;
let POLIS_DRIFT_ACTIVE=false, POLIS_DRIFT_INTENSITY=0;
let POLIS_SCORE_TICK=0;
let POLIS_ROAD_SEED=1234;
let POLIS_INPUT={L:0,R:0};
let POLIS_RAF=null;

// Polis input handlers
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

// Polis mode functions
function startPolisMode(){
  // Initialize polis mode
  // Load from script.js
}

function restartPolisMode(){
  showScreen('polis-go',false);
  if(POLIS_RAF){cancelAnimationFrame(POLIS_RAF);POLIS_RAF=null;}
  startPolisMode();
}

function triggerPolisCaught(){
  // Handle game over in polis mode
  // Load from script.js
}

// Polis drawing
// Load from script.js

// Polis update/AI
// Load from script.js

// Polis game loop
// Load from script.js
