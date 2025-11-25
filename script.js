document.addEventListener('DOMContentLoaded', () => {

  /* -------------------------------------------------------
   * DOM REFERENCES
   * ------------------------------------------------------- */
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
  const toggleYolkBtn = document.getElementById('toggleYolk');

  /* -------------------------------------------------------
   * TOOLBAR TOGGLE SYSTEM
   * ------------------------------------------------------- */
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
    toolbarNav.classList.toggle('collapsed');

    // choose a different icon
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * toolbarIcons.length);
    } while (newIndex === currentIconIndex);

    currentIconIndex = newIndex;
    toolbarIcon.src = toolbarIcons[currentIconIndex];
  });

  /* -------------------------------------------------------
   * GLOBAL STATE / CONSTANTS
   * ------------------------------------------------------- */
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let eggs = [];
  let ants = [];
  let shellFragments = [];
  let eggRain = false;
  let rainInterval = null;
  let realisticYolk = false;
  let antsEnabled = true; // global flag

  // gravity px/s²
  const gravity = 1200;

  /* -------------------------------------------------------
   * EGG TYPE DEFINITIONS
   * ------------------------------------------------------- */
  const eggTypes = {
    brown:   { name: 'brown',   shell: '#ffbd82',   yolk: '#FFC107', r: 18 },
    white:   { name: 'white',   shell: '#fff6f6ff', yolk: '#FFD700', r: 18 },
    quail:   { name: 'quail',   shell: '#d7bf8fff', yolk: '#FFA500', speckles: true, r: 12 },
    duck:    { name: 'duck',    shell: '#d7e9caff', yolk: '#FF8C00', r: 20 },
    goose:   { name: 'goose',   shell: '#f5f5dc',   yolk: '#FFE066', r: 25 },
    turkey:  { name: 'turkey',  shell: '#eadfcb',   yolk: '#FFC107', speckles: true, r: 20 },
    emu:     { name: 'emu',     shell: '#4a887b',   yolk: '#e5d739ff', speckles: true, r: 30 },
    ostrich: { name: 'ostrich', shell: '#faf0e6',   yolk: '#FFD966', r: 35 }

  };

  /* -------------------------------------------------------
   * YOLK MODE TOGGLE
   * ------------------------------------------------------- */
  toggleYolkBtn.addEventListener('click', () => {
    realisticYolk = !realisticYolk;
    toggleYolkBtn.textContent = realisticYolk ? ' yolk' : ' color';
  });

  /* -------------------------------------------------------
   * EGG TYPE SELECTOR (auto-inserted)
   * ------------------------------------------------------- */
  const eggTypeSelect = document.createElement('select');
  eggTypeSelect.id = 'eggType';
  eggTypeSelect.title = 'Egg variety';

  Object.keys(eggTypes).forEach(key => {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = eggTypes[key].name;
    eggTypeSelect.appendChild(o);
  });

  const dropGroup = dropEggBtn.parentElement;
  const wrapper = document.createElement('div');
  wrapper.className = 'group';
  wrapper.appendChild(document.createElement('label'));
  wrapper.appendChild(eggTypeSelect);
  uiBar.insertBefore(wrapper, dropGroup);

  const getSelectedEggType = () => eggTypeSelect.value || 'brown';

  /* -------------------------------------------------------
   * UTILS
   * ------------------------------------------------------- */
  const randRange = (a, b) => a + Math.random() * (b - a);
  const getRectSize = () => canvas.getBoundingClientRect();

  /* -------------------------------------------------------
   * CANVAS / OVERLAY RESIZE
   * ------------------------------------------------------- */
  function resizeCanvases() {
    DPR = Math.max(1, window.devicePixelRatio || 1);
    const rect = getRectSize();

    canvas.width = Math.round(rect.width * DPR);
    canvas.height = Math.round(rect.height * DPR);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.width = canvas.style.width;
    overlay.style.height = canvas.style.height;
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function resetCanvas() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function initStage() {
    resizeCanvases();
    resetCanvas();
  }

  window.addEventListener('resize', resizeCanvases);
  initStage();

  /* -------------------------------------------------------
   * UI BINDINGS
   * ------------------------------------------------------- */
  sizeIn.addEventListener('input', () => {
    sizeLabel.textContent = sizeIn.value;
  });

  modeSel.addEventListener('change', () => {
    const pen = modeSel.value === 'pen';
    penControls.style.display = pen ? 'flex' : 'none';
    canvas.style.cursor = pen ? 'crosshair' : 'cell';
  });

  modeSel.dispatchEvent(new Event('change'));

  /* -------------------------------------------------------
   * POINTER / PEN DRAWING
   * ------------------------------------------------------- */
  let drawing = false;

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX ?? 0;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY ?? 0;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', e => {
    if (modeSel.value !== 'pen') return;
    drawing = true;

    const p = getPointerPos(e);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = colorIn.value;
    ctx.lineWidth = sizeIn.value;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = getPointerPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });

  ['pointerup', 'pointercancel'].forEach(ev =>
    canvas.addEventListener(ev, () => {
      if (drawing) ctx.closePath();
      drawing = false;
    })
  );

  /* -------------------------------------------------------
   * CLICK → DROP SINGLE EGG
   * ------------------------------------------------------- */
  canvas.addEventListener('click', e => {
      if (modeSel.value !== 'egg') return; 
    const rect = canvas.getBoundingClientRect();
    spawnEgg({
      x: e.clientX - rect.left,
      impactY: e.clientY - rect.top,
      type: getSelectedEggType()
    });
  });

  /* -------------------------------------------------------
   * SPAWN EGG
   * ------------------------------------------------------- */
  function spawnEgg({ x = null, type = 'brown', vx = 0, impactY = null } = {}) {
    const eggDef = eggTypes[type] || eggTypes.brown;
    const rect = canvas.getBoundingClientRect();

    eggs.push({
      x: x ?? randRange(eggDef.r, rect.width - eggDef.r),
      y: -eggDef.r * 1.2,
      impactY: impactY ?? randRange(50, rect.height - 50),
      vx: vx + randRange(-60, 60),
      vy: randRange(60, 180),
      r: eggDef.r,
      shellColor: eggDef.shell,
      yolk: eggDef.yolk,
      speckles: !!eggDef.speckles,
      rotation: randRange(-0.6, 0.6),
      rotationSpeed: randRange(-3, 3),
      alive: true
    });
  }

  dropEggBtn.addEventListener('click', () =>
    spawnEgg({ type: getSelectedEggType() })
  );

  /* -------------------------------------------------------
   * EGG RAIN
   * ------------------------------------------------------- */
  toggleRainBtn.addEventListener('click', () => {
    eggRain = !eggRain;
    toggleRainBtn.textContent = eggRain ? 'stop egg rain!' : 'start egg rain!';

    if (eggRain) {
      rainInterval = setInterval(() => {
        const n = Math.random() > 0.85
          ? Math.floor(randRange(3, 8))
          : Math.floor(randRange(1, 2));

        for (let i = 0; i < n; i++) {
          const types = Object.keys(eggTypes);
          const type = Math.random() < 0.6
            ? getSelectedEggType()
            : types[Math.floor(Math.random() * types.length)];

          spawnEgg({ type });
        }
      }, 350);
    } else {
      clearInterval(rainInterval);
      rainInterval = null;
    }
  });

  /* -------------------------------------------------------
   * DRAWING HELPERS (EGGS / SMUDGES / BLOBS)
   * ------------------------------------------------------- */

  function drawEggOnOverlay(octx, egg) {
    octx.save();
    octx.translate(egg.x, egg.y);
    octx.rotate(egg.rotation * 0.2);

    octx.beginPath();
    octx.ellipse(0, 0, egg.r, egg.r * 1.25, 0, 0, Math.PI * 2);
    octx.fillStyle = egg.shellColor;
    octx.fill();

    octx.lineWidth = Math.max(1, egg.r * 0.04);
    octx.strokeStyle = 'rgba(0,0,0,0.1)';
    octx.stroke();

    if (egg.speckles) {
      octx.fillStyle = 'rgba(60,40,30,0.5)';
      const speckles = Math.floor(egg.r / 3) + 6;
      for (let i = 0; i < speckles; i++) {
        octx.beginPath();
        octx.ellipse(
          randRange(-egg.r * 0.6, egg.r * 0.6),
          randRange(-egg.r * 0.4, egg.r * 0.6),
          Math.max(1, egg.r * 0.04),
          Math.max(1, egg.r * 0.03),
          0, 0, Math.PI * 2
        );
        octx.fill();
      }
    }

    octx.restore();
  }

  function drawOrganicSmudge(ctx, x, y, radius, steps = 12) {
    ctx.beginPath();
    let px = x, py = y;

    for (let i = 0; i < steps; i++) {
      px += randRange(-radius * 0.4, radius * 0.4);
      py += randRange(-radius * 0.3, radius * 0.5);

      ctx.ellipse(
        px, py,
        randRange(radius * 0.3, radius * 0.7),
        randRange(radius * 0.25, radius * 0.6),
        randRange(0, Math.PI * 2),
        0, Math.PI * 2
      );
    }

    ctx.fill();
  }

  function drawEggWhite(ctx, x, y, radius) {
    const g = ctx.createRadialGradient(x, y, radius * 0.9, x, y, radius);
    g.addColorStop(0.65, 'rgba(241,237,237,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = g;

    drawOrganicSmudge(ctx, x, y, radius * 1.3, Math.floor(randRange(5, 8)));
  }

  function drawIrregularBlob(ctx, x, y, radius, points = 5) {
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius * randRange(0.5, 1.3);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r * randRange(0.7, 1.3);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* -------------------------------------------------------
   * SPLATTER / SHELL CREATION
   * ------------------------------------------------------- */
  function createSplatter(x, y, color, radius) {
    if (realisticYolk) drawEggWhite(ctx, x, y, radius);

    ctx.fillStyle = color;
    drawOrganicSmudge(
      ctx,
      x,
      y - randRange(0, radius * 0.3),
      randRange(radius * 0.8, radius * 1.2),
      Math.floor(randRange(2, 5))
    );

    const drops = Math.floor(randRange(2, 7));
    for (let i = 0; i < drops; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = randRange(radius * 0.3, radius * 2);
      const dropR = randRange(radius * 0.06, radius * 0.4);
      drawOrganicSmudge(
        ctx,
        x + Math.cos(ang) * dist,
        y + Math.sin(ang) * dist,
        dropR,
        Math.floor(randRange(3, 6))
      );
    }
  }

  function createShellFragments(x, y, egg) {
    const count = Math.floor(randRange(4, 10));

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = randRange(egg.r * 0.2, egg.r * 1.2);
      const size = randRange(egg.r * 0.1, egg.r * 0.3);

      ctx.save();
      ctx.fillStyle = egg.shellColor;
      ctx.filter = 'blur(0.5px)';
      drawIrregularBlob(
        ctx,
        x + Math.cos(ang) * dist,
        y + Math.sin(ang) * dist,
        size,
        Math.floor(randRange(4, 6))
      );
      ctx.restore();
    }
  }

  function shatterEgg(egg) {
    const count = Math.floor(randRange(6, 12) * (egg.r / 18));

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = randRange(200, 620) * (egg.r / 20);
      const upward = randRange(0.35, 1.05);

      shellFragments.push({
        x: egg.x + randRange(-egg.r * 0.2, egg.r * 0.2),
        y: egg.impactY - randRange(0, egg.r * 0.25),
        vx: Math.cos(a) * speed,
        vy: -Math.abs(Math.sin(a) * speed) * upward,
        rot: randRange(-6, 6),
        life: randRange(0.15, 0.3),
        size: Math.max(1, Math.round(egg.r * randRange(0.06, 0.28))),
        color: egg.shellColor,
        settled: false,
        groundY: egg.impactY
      });
    }
  }

  function handleEggHit(egg) {
    const x = egg.x;
    const y = egg.impactY;
    const radius = egg.r * randRange(0.9, 2.0);
    const color = realisticYolk ? egg.yolk : colorIn.value;

    createSplatter(x, y, color, radius);
    createShellFragments(x, y, egg);
    shatterEgg(egg);
  }

  /* -------------------------------------------------------
   * ANT SYSTEM
   * ------------------------------------------------------- */
  antsEnabled = false; // turn ants off, 'true'= on

  function spawnAnt(x = null, y = null) {
      if (!antsEnabled) return; // don't spawn any ants
    const rect = canvas.getBoundingClientRect();
    const ax = x ?? (Math.random() > 0.5 ? -20 : rect.width + 20);
    const ay = y ?? randRange(20, rect.height - 20);

    ants.push({
      x: ax,
      y: ay,
      vx: ax < 0 ? randRange(80, 180) : randRange(-180, -80),
      vy: randRange(-50, 50),
      life: randRange(2, 6),
      t: 0,
      jitter: Math.random() * 400,
      size: randRange(3, 7)
    });
  }

  function scheduleAntFrenzy() {
    const next = randRange(5000, 22000);
    setTimeout(() => {
      startFrenzy(Math.floor(randRange(20, 80)));
      scheduleAntFrenzy();
    }, next);
  }

  function startFrenzy(count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => spawnAnt(), i * 50 + Math.random() * 400);
    }
  }

  function antDisturb(ant) {
    if (Math.random() < 0.06) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(ant.x, ant.y, ant.size * 1.6, ant.size * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  setInterval(() => {
    if (Math.random() < 0.25) spawnAnt();
  }, 3000);

  scheduleAntFrenzy();

  /* -------------------------------------------------------
   * OVERLAY DRAW LOOP
   * ------------------------------------------------------- */
  function drawAntOnOverlay(octx, a) {
    const s = a.size;
    octx.save();
    octx.fillStyle = 'rgba(15,15,15,0.95)';

    octx.beginPath();
    octx.ellipse(a.x - s * 0.6, a.y, s * 0.6, s * 0.5, 0, 0, Math.PI * 2);
    octx.ellipse(a.x + s * 0.1, a.y, s * 0.7, s * 0.45, 0, 0, Math.PI * 2);
    octx.ellipse(a.x + s * 0.9, a.y, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
    octx.fill();
    octx.restore();
  }

  function drawOverlay() {
    octx.clearRect(0, 0, overlay.width, overlay.height);

    eggs.forEach(e => drawEggOnOverlay(octx, e));
 if (antsEnabled) {
    ants.forEach(a => drawAntOnOverlay(octx, a));
  }
    shellFragments.forEach(f => {
      if (!f.settled) {
        octx.save();
        octx.translate(f.x, f.y);
        octx.rotate(f.rot);
        octx.fillStyle = f.color;
        octx.fillRect(-f.size / 2, -f.size / 3, f.size, Math.max(1, f.size / 1.4));
        octx.restore();
      }
    });

    requestAnimationFrame(drawOverlay);
  }

  drawOverlay();

  /* -------------------------------------------------------
   * PHYSICS TICK
   * ------------------------------------------------------- */
  let lastTS = performance.now();

  function tick(ts) {
    const dt = Math.min(0.04, (ts - lastTS) / 1000);
    lastTS = ts;

    // Eggs
    for (let i = eggs.length - 1; i >= 0; i--) {
      const e = eggs[i];

      if (!e.alive) {
        eggs.splice(i, 1);
        continue;
      }

      e.vy += gravity * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rotation += e.rotationSpeed * dt;

      if (e.y >= e.impactY) {
        handleEggHit(e);
        e.alive = false;
      }
    }

    // Shell fragments (top-down)
    for (let i = shellFragments.length - 1; i >= 0; i--) {
      const f = shellFragments[i];

      const friction = Math.pow(0.9, dt * 60);
      f.vx *= friction;
      f.vy *= friction;

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += randRange(-0.05, 0.05);
      f.life -= dt;

      const stopped = Math.abs(f.vx) < 5 && Math.abs(f.vy) < 5;
      const done = f.life <= 0;

      if (stopped || done) {
        stampFragmentToCanvas(f);
        shellFragments.splice(i, 1);
      }
    }

    // Ants
    const rect = canvas.getBoundingClientRect();

    for (let i = ants.length - 1; i >= 0; i--) {
        if (!antsEnabled) break;
      const a = ants[i];
      a.t += dt;

      a.vx += Math.sin(a.t * 20 + a.jitter) * randRange(-30, 30) * dt;
      a.vy += Math.cos(a.t * 16 + a.jitter * 0.5) * randRange(-30, 30) * dt;

      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;

      if (
        a.x < -60 || a.x > rect.width + 60 ||
        a.y < -60 || a.y > rect.height + 60 ||
        a.life <= 0
      ) {
        ants.splice(i, 1);
        continue;
      }

      antDisturb(a);
    }

    requestAnimationFrame(tick);
  }

  tick(performance.now());

  /* -------------------------------------------------------
   * STAMP SHELL PIECE TO CANVAS
   * ------------------------------------------------------- */
  function stampFragmentToCanvas(f) {
    ctx.save();

    const y = typeof f.groundY === 'number' ? Math.min(f.y, f.groundY) : f.y;

    ctx.translate(f.x, y);
    ctx.rotate(f.rot);
    ctx.fillStyle = f.color;
    ctx.filter = 'blur(0.5px)';

    const w = Math.max(1, f.size);
    const h = Math.max(1, Math.round(f.size * 0.6));

    ctx.beginPath();
    ctx.moveTo(-w / 2 + randRange(-1, 1), -h / 2 + randRange(-1, 1));
    ctx.lineTo(w / 2 + randRange(-1, 1), -h / 3 + randRange(-1, 1));
    ctx.lineTo(w / 4 + randRange(-1, 1), h / 2 + randRange(-1, 1));
    ctx.lineTo(-w / 3 + randRange(-1, 1), h / 3 + randRange(-1, 1));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /* -------------------------------------------------------
   * CLEAR & SAVE
   * ------------------------------------------------------- */
  clearBtn.addEventListener('click', () => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  });

  saveBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'mad-ant-art-attack.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  /* -------------------------------------------------------
   * KEYBOARD SHORTCUTS
   * ------------------------------------------------------- */
  window.addEventListener('keydown', e => {
    if (e.key === 'e') {
      modeSel.value = 'egg';
      modeSel.dispatchEvent(new Event('change'));
    }
    if (e.key === 'p') {
      modeSel.value = 'pen';
      modeSel.dispatchEvent(new Event('change'));
    }
  });

  /* -------------------------------------------------------
   * END DOMContentLoaded
   * ------------------------------------------------------- */
});
