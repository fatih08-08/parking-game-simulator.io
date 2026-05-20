// ── DRIFT MODULE
// Drift-specific background & zone drawing and helpers

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

function drawDriftBG_day_carpark(){ drawDriftBG_night_carpark(); }
function drawDriftBG_night_open(){ drawDriftBG_night_carpark(); }
function drawDriftBG_day_open(){ drawDriftBG_night_carpark(); }

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
// ── DRIFT MODE
// Drift physics, presets, zones, drawing, scoring

// Drift config presets (already in common, but referenced here)
// Drift state variables (already in common)

// Drift physics-specific functions
// Placeholder for drift update logic
// Placeholder for drift drawing logic
// Placeholder for drift zone handling

// Game loop integration point
// Load from script.js and split out
