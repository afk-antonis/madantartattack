/* script.js — cleaned & modularized from original single-file HTML
   Behavior preserved; overlay handling and resize fixed. */

// script.js — integrated egg types + realistic shell fragments + DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM references (single source of truth) ---
  const canvas = document.getElementById('paint');
  const overlay = document.getElementById('overlay');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const octx = overlay.getContext('2d');

  const modeSel = document.getElementById('mode');
  const colorIn = document.getElementById('color');
  const sizeIn = document.getElementById('size');
  const sizeLabel = document.getElementById('sizeLabel');
  const dropEggBtn = document.getElementById('dropEgg');
  const toggleRainBtn = document.getElementById('toggleRain');
  const clearBtn = document.getElementById('clear');
  const saveBtn = document.getElementById('save');
  const penControls = document.getElementById('penControls');
  const uiBar = document.querySelector('.ui');
// --- Toggle Toolbar System ---
const toolbarNav = document.getElementById('toolbarNav');
const toolbarIcon = document.getElementById('toolbarIcon');

const toolbarIcons = [
    'assets/icons/egg1.png',
    'assets/icons/egg2.png',
    'assets/icons/egg3.png',
    'assets/icons/egg4.png',
    'assets/icons/egg5.png',
    'assets/icons/egg6.png',
    'assets/icons/egg7.png'
];

let currentIconIndex = 0;

document.getElementById('toolbarToggle').addEventListener('click', () => {
    // toggle collapse
    toolbarNav.classList.toggle('collapsed');

    // pick a different random icon
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * toolbarIcons.length);
    } while (newIndex === currentIconIndex);

    currentIconIndex = newIndex;
    toolbarIcon.src = toolbarIcons[currentIconIndex];
});

  // device pixel ratio
  let DPR = Math.max(1, window.devicePixelRatio || 1);

  // keep lists
  let eggs = [];
  let ants = [];
  let shellFragments = []; // moving fragments
  let eggRain = false;
  let rainInterval = null;

  let realisticYolk = false;
const toggleYolkBtn = document.getElementById('toggleYolk');

toggleYolkBtn.addEventListener('click', () => {
    realisticYolk = !realisticYolk;
    toggleYolkBtn.textContent = ` ${realisticYolk ? 'yolk' : 'color'}`;
});


  // gravity (px/s^2) — tuned for visible fall speed
  const gravity = 1200;

  // --- Egg types (Option B: each has its own paint / yolk color) ---
  const eggTypes = {
    white:   { img: 'egg-white.png', name: 'white', shell: '#fff6f6ff', yolk: '#FFD700', r: 18 },
    brown:   { name: 'brown', shell: '#ffbd82', yolk: '#FFC107', r: 18 },
    quail:   { name: 'quail', shell: '#f0e6d2', yolk: '#FFA500', speckles: true, r: 12 },
    duck:    { name: 'duck', shell: '#dbe9d0', yolk: '#FF8C00', r: 20 },
    goose:   { name: 'goose', shell: '#f5f5dc', yolk: '#FFE066', r: 25 },
    turkey:  { name: 'turkey', shell: '#eadfcb', yolk: '#FFC107', speckles: true, r: 20 },
    emu:     { name: 'emu', shell: '#4a887b', yolk: '#DAE87C', speckles: true, r: 30 },
    ostrich: { name: 'ostrich', shell: '#faf0e6', yolk: '#FFD966', r: 35 }
};


  // Create egg type selector in the UI (keeps HTML unchanged)
  const eggTypeSelect = document.createElement('select');
  eggTypeSelect.id = 'eggType';
  eggTypeSelect.title = 'Egg variety';
  Object.keys(eggTypes).forEach(k => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = eggTypes[k].name;
    eggTypeSelect.appendChild(o);
  });
  
  // insert before dropEgg button group for convenience
  const dropGroup = dropEggBtn.parentElement;
  const wrapper = document.createElement('div');
  wrapper.className = 'group';
  const label = document.createElement('label');
  label.htmlFor = 'eggType';
  label.textContent = '';
  wrapper.appendChild(label);
  wrapper.appendChild(eggTypeSelect);
  uiBar.insertBefore(wrapper, dropGroup);

  // helper: get selected egg type
  function getSelectedEggType() {
    return eggTypeSelect.value || 'white';
  }

  // --- utilities ---
  function randRange(a,b){ return a + Math.random()*(b-a); }
  function getRectSize(){ return canvas.getBoundingClientRect(); }

  // Resize both canvases to cover viewport (CSS pixels scaled by DPR)
  function resizeCanvases(){
    DPR = Math.max(1, window.devicePixelRatio || 1);
    const rect = getRectSize();
    // permanent canvas resolution
    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.height * DPR);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);

    // overlay matches same pixel dimensions and transform
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width;
    overlay.style.height = canvas.style.height;
    octx.setTransform(DPR,0,0,DPR,0,0);
  }

  // Stage fill once (white background)
  function resetCanvas(){
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
  }

  // initialize sizes
  function initStage(){
    resizeCanvases();
    resetCanvas();
  }

  window.addEventListener('resize', ()=>{ resizeCanvases(); });

  // --- UI wiring ---
  sizeIn.addEventListener('input', ()=> sizeLabel.textContent = sizeIn.value );
  modeSel.addEventListener('change', ()=>{
    penControls.style.display = modeSel.value === 'pen' ? 'flex' : 'none';
    canvas.style.cursor = modeSel.value === 'pen' ? 'crosshair' : 'cell';
  });
  modeSel.dispatchEvent(new Event('change'));

  // --- Pointer helpers ---
  function getPointerPos(e){
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // --- Drawing (Pen) ---
  let drawing = false;
  let last = {x:0,y:0};

  canvas.addEventListener('pointerdown', (e)=>{
    if(modeSel.value !== 'pen') return;
    drawing = true;
    const p = getPointerPos(e);
    last = p;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = colorIn.value;
    ctx.lineWidth = sizeIn.value;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e)=>{
    if(!drawing) return;
    const p = getPointerPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  });
  canvas.addEventListener('pointerup', ()=>{ if(drawing) { drawing=false; ctx.closePath(); } });
  canvas.addEventListener('pointercancel', ()=>{ drawing=false; ctx.closePath(); });

  // Click/tap to spawn egg at click location (preserve original behavior)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spawnEgg({ x, impactY: y, type: getSelectedEggType() });
  });

  // --- Eggs: spawn, physics, splatter & shell fragments ---
  function spawnEgg({x=null, type='white', vx=0, impactY=null} = {}) {
    const eggData = eggTypes[type] || eggTypes.white;
    const rect = canvas.getBoundingClientRect();
    const egg = {
        x: x===null ? randRange(eggData.r, rect.width - eggData.r) : x,
        y: -eggData.r*1.2,
        impactY: impactY ?? randRange(50, rect.height - 50),
        vx: vx + randRange(-60,60),
        vy: randRange(60,180),
        r: eggData.r,
        color: eggData.shell,
        shellColor: eggData.shell,
        yolk: eggData.yolk,
        speckles: eggData.speckles || false,
        rotation: randRange(-0.6,0.6),
        rotationSpeed: randRange(-3,3),
        alive: true
    };
    eggs.push(egg);
}


dropEggBtn.addEventListener('click', ()=> spawnEgg({ type: getSelectedEggType() }));

  toggleRainBtn.addEventListener('click', ()=>{
    eggRain = !eggRain;
    toggleRainBtn.textContent = eggRain ? 'stop egg rain!' : 'start egg rain!';
    if(eggRain){
      rainInterval = setInterval(()=>{
        const n = Math.random()>0.85? Math.floor(randRange(3,8)) : Math.floor(randRange(1,2));
        for(let i=0;i<n;i++){
          // randomly pick types during rain (weighted towards selected)
          const t = Math.random() < 0.6 ? getSelectedEggType() : Object.keys(eggTypes)[Math.floor(Math.random()*Object.keys(eggTypes).length)];
          spawnEgg({ type: t });
        }
      }, 350);
    } else {
      clearInterval(rainInterval);
      rainInterval = null;
    }
  });

  // helper: draw egg on overlay (in-flight) with shell color + speckles
  function drawEggOnOverlay(octx, egg, alpha=0.95){
    octx.save();
    octx.translate(egg.x, egg.y);
    octx.rotate(egg.rotation*0.2);
    octx.beginPath();
    octx.ellipse(0,0,egg.r,egg.r*1.25,0,0,Math.PI*2);
    // shell fill using shellColor (we add slight highlight)
    // create simple gradient highlight using shellColor as base
    const base = egg.shellColor;
    // draw body
    octx.fillStyle = base;
    octx.fill();
    // outline
    octx.lineWidth = Math.max(1, egg.r*0.04);
    octx.strokeStyle = 'rgba(0,0,0,0.1)';
    octx.stroke();

    // speckles if applicable
    if(egg.speckles){
      octx.fillStyle = 'rgba(60,40,30,0.5)';
      const speckles = Math.floor(egg.r/3) + 6;
      for(let i=0;i<speckles;i++){
        const sx = randRange(-egg.r*0.6, egg.r*0.6);
        const sy = randRange(-egg.r*0.4, egg.r*0.6);
        octx.beginPath(); octx.ellipse(sx, sy, Math.max(1, egg.r*0.04), Math.max(1, egg.r*0.03), 0, 0, Math.PI*2); octx.fill();
      }
    }
    octx.restore();
  }

  // draw egg visually into permanent ctx — kept for parity but not used per-frame
  function drawEgg(egg){
    const {x,y,r,shellColor} = egg;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(egg.rotation * 0.2);
    ctx.beginPath();
    ctx.ellipse(0,0,r,r*1.25,0,0,Math.PI*2);

    // slight shell shading: use shellColor and a soft highlight
    ctx.fillStyle = shellColor;
    ctx.fill();

    // outline
    ctx.lineWidth = Math.max(1, r*0.05);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.stroke();

    // speckles
    if(egg.speckles){
      ctx.fillStyle = 'rgba(40,30,20,0.18)';
      const speckles = Math.floor(r/4) + 6;
      for(let i=0;i<speckles;i++){
        const sx = randRange(-r*0.6,r*0.6);
        const sy = randRange(-r*0.4,r*0.6);
        ctx.beginPath(); ctx.ellipse(sx,sy,Math.max(1,r*0.03),Math.max(1,r*0.02),0,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawIrregularBlob(ctx, x, y, radius, points=5){
    ctx.beginPath();
    for(let i=0; i<points; i++){
        const angle = (i / points) * Math.PI * 2;
        const r = radius * randRange(0.5, 1.3);
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r * randRange(0.7,1.3);
        if(i===0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}
function drawOrganicSmudge(ctx, x, y, radius, steps = 12) {
    ctx.beginPath();
    let px = x;
    let py = y;
    for (let i = 0; i < steps; i++) {
        // random small offset for a flowing, natural look
        px += randRange(-radius*0.4, radius*0.4);
        py += randRange(-radius*0.3, radius*0.5);

        // random ellipse size
        const rx = randRange(radius*0.3, radius*0.7);
        const ry = randRange(radius*0.25, radius*0.6);
        const angle = randRange(0, Math.PI*2);

        ctx.ellipse(px, py, rx, ry, angle, 0, Math.PI*2);
    }
    ctx.fill();
}

function drawEggWhite(ctx, x, y, radius){
    const grad = ctx.createRadialGradient(x, y, radius*0.9, x, y, radius);
    grad.addColorStop(0.65, 'rgba(241, 237, 237, 0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = grad;
    drawOrganicSmudge(ctx, x, y, radius*1.3, Math.floor(randRange(5,8)));
}

function createSplatter(x, y, color, radius){
    // egg white underlay
    if(realisticYolk){ drawEggWhite(ctx, x, y, radius);
        }

    // central yolk blob
    ctx.fillStyle = color;
    drawOrganicSmudge(ctx, x, y - randRange(0, radius*0.3), randRange(radius*0.8, radius*1.2), Math.floor(randRange(2,5)));

    // small irregular droplets
    const dropletCount = Math.floor(randRange(2,7));
    for(let i=0; i<dropletCount; i++){
        const angle = Math.random()*Math.PI*2;
        const dist = randRange(radius*0.3,radius*2);
        const dropr = randRange(radius*0.06,radius*0.4);
        const dx = x + Math.cos(angle)*dist;
        const dy = y + Math.sin(angle)*dist;
        drawOrganicSmudge(ctx, dx, dy, dropr, Math.floor(randRange(3,6)));
    }
}

  // On impact: splatter using yolkColor AND shatter shell fragments that stay on canvas
  function handleEggHit(egg){
    const x = egg.x;
    const y = egg.impactY;
    const radius = egg.r * randRange(0.9,2.0);
    const color = realisticYolk ? egg.yolk : colorIn.value;
    createSplatter(x, y, color, radius);
    createShellFragments(x, y, egg);
    shatterEgg(egg); // spawn moving fragments
}

function createShellFragments(x, y, egg){
    const count = Math.floor(randRange(4,10));
    for(let i=0;i<count;i++){
        const angle = Math.random()*Math.PI*2;
        const dist = randRange(egg.r*0.2, egg.r*1.2);
        const size = randRange(egg.r*0.1, egg.r*0.3);
        ctx.save();
        ctx.fillStyle = egg.color;
        ctx.globalCompositeOperation = 'source-over';
        drawIrregularBlob(ctx, x + Math.cos(angle)*dist, y + Math.sin(angle)*dist, size, Math.floor(randRange(4,6)));
        ctx.restore();
    }
}



  // create moving shell fragments that will be stamped permanently when they settle
  function shatterEgg(egg){
    const fragCount = Math.floor(randRange(12, 30) * (egg.r/18)); // scale fragment count with egg size
    for(let i=0;i<fragCount;i++){
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(40, 220) * (egg.r / 20) / 60; // px per frame scaled down a bit
      const rot = randRange(-4,4);
      shellFragments.push({
        x: egg.x,
        y: egg.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randRange(0,0.6),
        life: 30 + Math.random()*50,   // frames of motion
        size: Math.max(1, Math.round(egg.r * randRange(0.06, 0.28))),
        color: egg.shellColor,
        rot,
        settled: false
      });
    }
  }

  // --- Ant system (kept as-is) ---
  let antFrenzyTimer = 0;
  function spawnAnt(x=null,y=null){
    const rect = canvas.getBoundingClientRect();
    const ax = x===null ? (Math.random()>0.5? -20 : rect.width+20) : x;
    const ay = y===null ? randRange(20, rect.height-20) : y;
    const ant = {
      x: ax, y: ay,
      vx: (ax<0 ? randRange(80,180) : randRange(-180,-80)),
      vy: randRange(-50,50),
      life: randRange(2,6),
      t:0,
      jitter: Math.random()*400,
      size: randRange(3,7)
    };
    ants.push(ant);
  }

  function scheduleAntFrenzy(){
    const next = randRange(5000, 22000);
    setTimeout(()=>{ startFrenzy(Math.floor(randRange(20,80))); scheduleAntFrenzy(); }, next);
  }

  function startFrenzy(count){
    for(let i=0;i<count;i++){ setTimeout(()=>{ spawnAnt(); }, i*50 + Math.random()*400); }
  }

  function antDisturb(ant){
    if(Math.random() < 0.06){
      ctx.save();
      ctx.beginPath();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.ellipse(ant.x, ant.y, ant.size*1.6, ant.size*0.9, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  setInterval(()=>{ if(Math.random()<0.25) spawnAnt(); }, 3000);
  scheduleAntFrenzy();

  // --- Overlay drawing for transient items (eggs & ants & moving fragments) ---
  function drawOverlay(){
    octx.clearRect(0,0,overlay.width,overlay.height);
    for(const e of eggs){ drawEggOnOverlay(octx, e); }
    for(const a of ants){ drawAntOnOverlay(octx, a); }
    // draw moving shell fragments on overlay so they appear dynamic
    for(const f of shellFragments){
      if(!f.settled){
        octx.save();
        octx.translate(f.x, f.y);
        octx.rotate(f.rot);
        octx.fillStyle = f.color;
        // draw small irregular polygon-ish rectangle
        octx.fillRect(-f.size/2, -f.size/3, f.size, Math.max(1, f.size/1.4));
        octx.restore();
      }
    }
    requestAnimationFrame(drawOverlay);
  }

  function drawAntOnOverlay(octx, a){
    octx.save();
    octx.beginPath();
    const s = a.size;
    octx.fillStyle = 'rgba(15,15,15,0.95)';
    octx.ellipse(a.x - s*0.6, a.y, s*0.6, s*0.5, 0, 0, Math.PI*2);
    octx.ellipse(a.x + s*0.1, a.y, s*0.7, s*0.45, 0, 0, Math.PI*2);
    octx.ellipse(a.x + s*0.9, a.y, s*0.5, s*0.35, 0, 0, Math.PI*2);
    octx.fill();
    octx.restore();
  }

  // --- Main physics tick (updates eggs & ants), rendering permanent results on ctx ---
  let lastTS = performance.now();
  function tick(ts){
    const dt = Math.min(0.04, (ts - lastTS)/1000);
    lastTS = ts;

    // eggs physics
    for(let i=eggs.length-1;i>=0;i--){
      const e = eggs[i];
      if(!e.alive){ eggs.splice(i,1); continue; }
      e.vy += gravity * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rotation += e.rotationSpeed * dt;
      if(e.y >= e.impactY){
        handleEggHit(e);
        e.alive = false;
        eggs.splice(i,1);
        continue;
      }
    }

    // update moving shell fragments
    for(let i=shellFragments.length-1;i>=0;i--){
      const f = shellFragments[i];
      if(f.life > 0){
        // movement
        f.vy += (gravity * 0.0009); // light gravity tuned for fragments
        f.x += f.vx;
        f.y += f.vy;
        // damp velocities
        f.vx *= 0.985;
        f.vy *= 0.99;
        f.rot += randRange(-0.08, 0.08);
        f.life -= 1;
        // small ground-detect: when near bottom or low speed, settle
        const rect = canvas.getBoundingClientRect();
        if(f.y >= rect.height - 1 || (f.life < 6 && Math.abs(f.vx) < 0.2 && Math.abs(f.vy) < 0.2)){
          // stamp fragment permanently and remove from moving list
          stampFragmentToCanvas(f);
          shellFragments.splice(i,1);
        }
      } else {
        // life exhausted — stamp and remove
        stampFragmentToCanvas(f);
        shellFragments.splice(i,1);
      }
    }

    // ants physics
    for(let i=ants.length-1;i>=0;i--){
      const a = ants[i];
      a.t += dt;
      a.vx += Math.sin(a.t*20 + a.jitter) * randRange(-30,30) * dt;
      a.vy += Math.cos(a.t*16 + a.jitter*0.5) * randRange(-30,30) * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      const rect = canvas.getBoundingClientRect();
      if(a.x < -60 || a.x > rect.width + 60 || a.y < -60 || a.y > rect.height + 60 || a.life <= 0){ ants.splice(i,1); continue; }
      antDisturb(a);
    }

    requestAnimationFrame(tick);
  }

  // Stamp fragment permanently onto the main canvas as a small irregular mark
  function stampFragmentToCanvas(f){
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = f.color;
    // draw a small irregular polygon/rect to simulate shell piece
    const w = Math.max(1, f.size);
    const h = Math.max(1, Math.round(f.size*0.6));
    // tiny jitter to make pieces irregular
    ctx.beginPath();
    ctx.moveTo(-w/2 + randRange(-1,1), -h/2 + randRange(-1,1));
    ctx.lineTo(w/2 + randRange(-1,1), -h/3 + randRange(-1,1));
    ctx.lineTo(w/4 + randRange(-1,1), h/2 + randRange(-1,1));
    ctx.lineTo(-w/3 + randRange(-1,1), h/3 + randRange(-1,1));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // --- Clearing & saving ---
  clearBtn.addEventListener('click', ()=>{
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
  });

  saveBtn.addEventListener('click', ()=>{
    const link = document.createElement('a');
    link.download = 'mad-ant-art-attack.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // keyboard shortcuts
  window.addEventListener('keydown',(e)=>{
    if(e.key === 'e') { modeSel.value = 'egg'; modeSel.dispatchEvent(new Event('change')) }
    if(e.key === 'p') { modeSel.value = 'pen'; modeSel.dispatchEvent(new Event('change')) }
    if(e.key === ' ') { if(modeSel.value === 'egg') spawnEgg({ type: getSelectedEggType() }); }
  });

  // --- Start everything ---
  initStage();
  lastTS = performance.now();
  requestAnimationFrame(tick);
  requestAnimationFrame(drawOverlay);
});
