// ── POLIS MODE
// Police chase mode, AI, HUD, drawing, game loop

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
  const visL=POLIS_PLAYER.x-W/zoom, visR=POLIS_PLAYER.x+W/zoom;
  const visT=POLIS_PLAYER.y-H/zoom, visB=POLIS_PLAYER.y+H/zoom;
  ctx.fillStyle='#1a1a28'; ctx.fillRect(visL,visT,visR-visL,visB-visT);
  ctx.strokeStyle='#ffffff07'; ctx.lineWidth=1;
  const lineSpacing=230;
  const lx0=Math.floor(visL/lineSpacing)*lineSpacing;
  const ly0=Math.floor(visT/lineSpacing)*lineSpacing;
  ctx.beginPath();
  for(let lx=lx0;lx<visR+lineSpacing;lx+=lineSpacing){ctx.moveTo(lx,visT);ctx.lineTo(lx,visB);}
  for(let ly=ly0;ly<visB+lineSpacing;ly+=lineSpacing){ctx.moveTo(visL,ly);ctx.lineTo(visR,ly);}
  ctx.stroke();
  for(const t of POLIS_TMARKS){if(t.l<0.08)continue;ctx.globalAlpha=t.l*0.5;ctx.fillStyle='#222';ctx.fillRect(~~t.x-2,~~t.y-2,5,5);} 
  ctx.globalAlpha=1;
  for(const p of POLIS_CARS){drawPolisCarWorld(p);} 
  for(const p of POLIS_PARTS){ctx.globalAlpha=p.l;ctx.fillStyle=p.c;ctx.fillRect(~~p.x-p.s/2,~~p.y-p.s/2,p.s,p.s);} 
  ctx.globalAlpha=1;
  drawPolisPlayer();
  ctx.restore();
}

function drawPolisPlayer(){
  const p=POLIS_PLAYER;
  const dg=POLIS_DRIFT_ACTIVE&&POLIS_DRIFT_INTENSITY>0.15;
  drawCar(p.x,p.y,p.angle,p.color,p.roof,1,true,dg);
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
  const isSuv=pc.type==='suv';
  const sc=isSuv?1.25:1.0;
  const bodyCol=pc.color||'#f0f0f0';
  const roofCol=shade(bodyCol,-50);
  ctx.save();ctx.translate(pc.x,pc.y);ctx.rotate(pc.angle);
  const hw=CW/2*sc, hh=CH/2*sc, w=CW*sc, h=CH*sc;
  ctx.globalAlpha=0.32;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(2*sc,4*sc,hw*1.1,hh*.62,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=bodyCol;ctx.fillRect(-hw,-hh,w,h);
  ctx.fillStyle='#111111';ctx.fillRect(-hw,-hh+h*.35,w,h*.28);
  ctx.fillStyle=roofCol;ctx.fillRect(-hw*.60,-hh+h*.22,w*.60,h*.39);
  ctx.fillStyle='#88ccffa0';ctx.fillRect(-hw*.50,-hh+h*.04,w*.50,h*.15);
  ctx.fillStyle='#88ccff80';ctx.fillRect(-hw*.46,-hh+h*.64,w*.46,h*.10);
  ctx.fillStyle='#1133cc';ctx.font=`bold ${~~(6*sc)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('POLİS',0,hh-h*.18+2);
  const sl=POLIS_AF%14;
  const s1col=(sl<7)?'#ff2222':'#2255ff';
  const s2col=(sl<7)?'#2255ff':'#ff2222';
  ctx.fillStyle=s1col; ctx.fillRect(-hw*.28,-hh+h*.24,~~(4*sc),~~(4*sc));
  ctx.fillStyle=s2col; ctx.fillRect(hw*.18,-hh+h*.24,~~(4*sc),~~(4*sc));
  ctx.fillStyle='#ffffc0';ctx.fillRect(-hw+sc,-hh+sc,4*sc,3*sc);ctx.fillRect(hw-5*sc,-hh+sc,4*sc,3*sc);
  ctx.fillStyle='#ff2200';ctx.fillRect(-hw+sc,hh-4*sc,4*sc,3*sc);ctx.fillRect(hw-5*sc,hh-4*sc,4*sc,3*sc);
  for(const [wx,wy] of [[-hw-sc,-hh+4*sc],[hw-3*sc,-hh+4*sc],[-hw-sc,hh-12*sc],[hw-3*sc,hh-12*sc]]){
    ctx.fillStyle='#111';ctx.fillRect(wx,wy,4*sc,8*sc);ctx.fillStyle='#2a2a2a';ctx.fillRect(wx+sc,wy+sc,2*sc,6*sc);
  }
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
  const angle=Math.random()*Math.PI*2;
  const spawnDist=W*0.8+Math.random()*200;
  const sx=POLIS_PLAYER.x+Math.cos(angle)*spawnDist;
  const sy=POLIS_PLAYER.y+Math.sin(angle)*spawnDist;
  const isSuv=Math.random()<0.35;
  const colors=['#f0f0f0','#eeeeee','#f5f5f5','#dddddd'];
  const elapsed=POLIS_SCORE_TICK/60;
  const diffMult=Math.min(2.2, 1.0 + elapsed/60);
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
  for(let i=POLIS_CARS.length-1;i>=0;i--){
    const pc=POLIS_CARS[i];
    const dx=p.x-pc.x, dy=p.y-pc.y;
    const targetAngle=Math.atan2(dx,-dy);
    let angleDiff=targetAngle-pc.angle;
    while(angleDiff>Math.PI)angleDiff-=Math.PI*2;
    while(angleDiff<-Math.PI)angleDiff+=Math.PI*2;
    const maxSteer=pc.steer*1.2;
    pc.angle+=Math.max(-maxSteer,Math.min(maxSteer,angleDiff));
    pc.speed=Math.min(pc.speed+pc.accel, pc.maxSpeed);
    if(pc.speed<1.0)pc.speed=1.0;
    pc.x+=Math.sin(pc.angle)*pc.speed;
    pc.y-=Math.cos(pc.angle)*pc.speed;
    pc.vx=Math.sin(pc.angle)*pc.speed;
    pc.vy=-Math.cos(pc.angle)*pc.speed;
    pc.drifting=false;
    for(let j=POLIS_CARS.length-1;j>=0;j--){
      if(i===j)continue;
      const pc2=POLIS_CARS[j];
      const ddx=pc.x-pc2.x, ddy=pc.y-pc2.y;
      const dd=Math.hypot(ddx,ddy);
      const sc1=pc.type==='suv'?1.25:1.0;
      const sc2=pc2.type==='suv'?1.25:1.0;
      const minDist=CW*(sc1+sc2)*0.7;
      if(dd<minDist&&dd>0.1){
        if(!pc._exploded&&!pc2._exploded){
          pc._exploded=true;
          pc2._exploded=true;
          const expCols=['#ff4400','#ffaa00','#ff0000','#ffff00','#fff','#ff6600','#ff8800'];
          const expX=(pc.x+pc2.x)/2, expY=(pc.y+pc2.y)/2;
          for(let k=0;k<25;k++){
            const a=Math.random()*Math.PI*2,sp=2+Math.random()*8;
            POLIS_PARTS.push({x:expX,y:expY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:0.025+Math.random()*0.03,s:4+Math.random()*10,c:expCols[~~(Math.random()*expCols.length)]});
          }
          for(let k=0;k<10;k++){
            const a=Math.random()*Math.PI*2,sp=0.5+Math.random()*2;
            POLIS_PARTS.push({x:expX,y:expY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:0.7,d:0.012,s:8+Math.random()*12,c:['#555','#666','#444'][k%3]});
          }
          POLIS_SCORE+=100*POLIS_COMBO;
          POLIS_COMBO=Math.min(POLIS_COMBO+2,8);
          POLIS_COMBO_TIMER=300;
          const cb=document.getElementById('polis-combo-badge');
          cb.textContent='💥 PATLADI! x'+POLIS_COMBO;cb.classList.add('show');
          POLIS_CARS.splice(j,1);
          if(i>j) i--;
          break;
        }
      }
    }
    const dxp=p.x-pc.x, dyp=p.y-pc.y;
    const minR=(CW/2 + CW*(pc.type==='suv'?1.25:1.0)/2)*0.9;
    if(dxp*dxp+dyp*dyp < minR*minR && sat(rcorners(p.x,p.y,p.angle,CW,CH),rcorners(pc.x,pc.y,pc.angle,CW*(pc.type==='suv'?1.25:1.0),CH))){
      triggerPolisCaught();
    }
  }
}

function updatePolisPlayer(){
  const p=POLIS_PLAYER;
  const steerIn=(POLIS_INPUT.L?-1:0)+(POLIS_INPUT.R?1:0);
  const maxV=7.5;
  p.speed=Math.min(p.speed+0.09, maxV);
  p.speed=Math.max(p.speed, 1.8);
  if(steerIn!==0){
    const sf=0.046*(1.0 - (p.speed/maxV)*0.25);
    p.angle+=steerIn*sf;
  }
  p.vx=Math.sin(p.angle)*p.speed;
  p.vy=-Math.cos(p.angle)*p.speed;
  p.x+=p.vx; p.y+=p.vy;
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
  if(POLIS_SCORE_TICK%30===0){POLIS_SCORE+=POLIS_COMBO;}
  if(POLIS_COMBO_TIMER>0){POLIS_COMBO_TIMER--; if(POLIS_COMBO_TIMER===0){POLIS_COMBO=1;document.getElementById('polis-combo-badge').classList.remove('show');}}
  POLIS_SPAWN_TIMER++;
  if(POLIS_SPAWN_TIMER>=POLIS_SPAWN_INTERVAL){
    POLIS_SPAWN_TIMER=0;
    POLIS_SPAWN_INTERVAL=Math.max(90, POLIS_SPAWN_INTERVAL-15);
    spawnPolice();
    const elapsed=POLIS_SCORE_TICK/60;
    const maxPolis=elapsed<60?8:elapsed<120?14:20;
    if(POLIS_CARS.length>maxPolis)POLIS_CARS.shift();
  }
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
  if(POLIS_SHAKE>0){
    POLIS_SHAKE--; document.getElementById('wrap').classList.toggle('shake',POLIS_SHAKE===10);
  }
  for(let i=POLIS_PARTS.length-1;i>=0;i--){
    const p=POLIS_PARTS[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.90;p.vy*=.90;p.l-=p.d; if(p.l<=0)POLIS_PARTS.splice(i,1);
  }
  if(POLIS_PARTS.length>60)POLIS_PARTS.splice(0,POLIS_PARTS.length-60);
  POLIS_TMARKS=POLIS_TMARKS.filter(t=>(t.l-=.012)>0);
  if(POLIS_TMARKS.length>40)POLIS_TMARKS.length=40;
  if(POLIS_AF%4===0) updPolisHUD();
}

function drawPolisLoop(){
  ctx.clearRect(0,0,W,H);
  drawPolisWorld();
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
  if(POLIS_SHAKE>2){
    ctx.fillStyle=`rgba(255,20,20,${(POLIS_SHAKE/14)*0.35})`;
    ctx.fillRect(0,0,W,H);
  }
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
  if(POLIS_DRIFT_ACTIVE&&POLIS_DRIFT_SCORE>0){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(W/2-50,H-84,100,18);
    ctx.strokeStyle='#ff6600';ctx.lineWidth=1;ctx.strokeRect(W/2-50,H-84,100,18);
    ctx.font='5px "Press Start 2P"';ctx.fillStyle='#ff6600';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🔥 DRIFT +'+POLIS_DRIFT_SCORE,W/2,H-75);
    ctx.restore();
  }
  const mmX=W-56, mmY=H-74, mmR=26;
  ctx.save();
  ctx.globalAlpha=0.75;
  ctx.fillStyle='#000015';ctx.beginPath();ctx.arc(mmX,mmY,mmR,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ff333388';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mmX,mmY,mmR,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#00ffcc';ctx.beginPath();ctx.arc(mmX,mmY,4,0,Math.PI*2);ctx.fill();
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
  const cols=['#ff4400','#ffaa00','#ff0000','#ffff00','#fff'];
  for(let i=0;i<50;i++){const a=Math.random()*Math.PI*2,sp=1.5+Math.random()*5;POLIS_PARTS.push({x:POLIS_PLAYER.x,y:POLIS_PLAYER.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,l:1,d:.018,s:3+Math.random()*7,c:cols[~~(Math.random()*cols.length)]});}
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
  POLIS_PLAYER={x:0,y:0,angle:Math.PI,speed:0.5,vx:0,vy:0,color:CHOSEN_COLOR,roof:shade(CHOSEN_COLOR,-42)};
  if(raf){cancelAnimationFrame(raf);raf=null;}
  clearInterval(tInt);
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
  document.getElementById('polis-hud').classList.add('show');
  document.getElementById('polis-ctrl').classList.add('show');
  document.getElementById('polis-alert').classList.remove('show');
  document.getElementById('polis-combo-badge').classList.remove('show');
  for(let i=0;i<2;i++)spawnPolice();
  _polisLastT=0;
  const intro=document.getElementById('polis-intro');
  intro.classList.add('show');
  setTimeout(()=>{
    intro.classList.remove('show');
    POLIS_RAF=requestAnimationFrame(polisMainLoop);
  },2200);
}

let _polisLastT=0;
function polisMainLoop(ts){
  if(_polisLastT>0){
    const dt=ts-_polisLastT;
    if(dt<200){updatePolisLoop();}
  } else {updatePolisLoop();}
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
