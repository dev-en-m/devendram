(() => {
  if (!matchMedia('(pointer: fine)').matches) {          // touch devices: no custom cursor
    for (const id of ['puff-cursor', 'puff-trail', 'swatter-cursor', 'caret-cursor']) document.getElementById(id).remove();
    return;
  }
  document.documentElement.classList.add('puff-cursor');
  const cur = document.getElementById('puff-cursor');       // wind stroke: the default cursor
  const swat = document.getElementById('swatter-cursor');   // fly swatter: over the grass
  const caret = document.getElementById('caret-cursor');    // block caret: over the terminal card
  const root = document.documentElement;
  let mode = 'wind';
  const cvs = document.getElementById('puff-trail');
  const ctx = cvs.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let dpr = 1;
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr;
  }
  size(); addEventListener('resize', size);

  // Pointer state; the cursor turns smoothly toward the direction of movement.
  let x = -100, y = -100, lx = 0, ly = 0, angle = 0, targetAngle = 0, travel = 0, has = false;
  const pollen = [];

  // Pollen specks: small golden dots that drift up, sway and fade.
  function spawn(px, py, vx, vy, n, power) {
    for (let i = 0; i < n && pollen.length < 160; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * 0.7 * power;
      pollen.push({
        x: px, y: py,
        vx: vx * 0.05 + Math.cos(a) * sp, vy: vy * 0.05 + Math.sin(a) * sp - 0.35,
        r: 1.7 + Math.random() * 2, ph: Math.random() * 6.28,
        life: 0, max: 0.9 + Math.random() * 0.9,
      });
    }
  }

  // Pick the cursor for the element under the pointer.
  function pickMode(t) {
    if (!t || !t.closest) return 'wind';
    if (t.closest('a, button')) return 'pointer';        // native pointer
    if (t.closest('.terminal')) return 'caret';
    if (t.closest('#grass-footer')) return 'swat';
    return 'wind';
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    const nx = e.clientX, ny = e.clientY;
    if (!has) { lx = nx; ly = ny; has = true; }
    const dx = nx - lx, dy = ny - ly, d = Math.hypot(dx, dy);
    if (d > 1.5) targetAngle = Math.atan2(dy, dx);
    travel += d;
    if (!reduce && travel > 14) { travel = 0; spawn(nx, ny, dx, dy, 1, 1); }
    x = nx; y = ny; lx = nx; ly = ny;
    mode = pickMode(e.target);
    root.dataset.cursor = mode;
    cur.classList.add('on'); swat.classList.add('on'); caret.classList.add('on');
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (reduce) return;
    // A small burst of pollen on click. Capture phase: the bug game stops the event from bubbling.
    spawn(e.clientX, e.clientY, 0, 0, 12, 2.2);
    if (mode === 'swat') { swat.classList.remove('hit'); void swat.getBoundingClientRect(); swat.classList.add('hit'); }
  }, true);
  const hideAll = () => { for (const c of [cur, swat, caret]) c.classList.remove('on'); };
  document.addEventListener('pointerleave', hideAll);
  addEventListener('blur', hideAll);

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;

    // Smooth turn toward movement; mirror when blowing left so curls stay upright.
    let da = targetAngle - angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    angle += da * Math.min(dt * 10, 1);
    const flip = Math.cos(angle) < 0 ? -1 : 1;
    cur.style.transform = `translate(${x - 4}px, ${y - 16}px) rotate(${angle}rad) scaleY(${flip})`;
    swat.style.transform = `translate(${x - 22}px, ${y - 17}px) rotate(-18deg)`;
    caret.style.transform = `translate(${x - 1}px, ${y - 9}px)`;

    // Trail of pollen specks.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = pollen.length - 1; i >= 0; i--) {
      const p = pollen[i];
      p.life += dt;
      if (p.life >= p.max) { pollen.splice(i, 1); continue; }
      const k = p.life / p.max, f = dt * 60;
      p.x += (p.vx + Math.sin(p.life * 7 + p.ph) * 0.3) * f; p.y += p.vy * f;
      p.vx *= 0.97; p.vy = p.vy * 0.97 - 0.012 * f;
      const a = (1 - k * k) * (0.75 + 0.25 * Math.sin(p.life * 12 + p.ph));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, `rgba(255,212,59,${0.7 * a})`);
      g.addColorStop(1, 'rgba(255,212,59,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(232,163,12,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
