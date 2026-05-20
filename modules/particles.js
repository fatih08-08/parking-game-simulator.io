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
