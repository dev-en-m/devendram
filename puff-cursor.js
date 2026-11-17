(() => {
  if (!matchMedia('(pointer: fine)').matches) {          // touch devices: no custom cursor
    document.getElementById('puff-cursor').remove();
    document.getElementById('puff-trail').remove();
    return;
  }
  document.documentElement.classList.add('puff-cursor');
  const cur = document.getElementById('puff-cursor');
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
  const puffs = [];

  function spawn(px, py, vx, vy, n, power) {
    for (let i = 0; i < n && puffs.length < 160; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 0.6 * power;
      puffs.push({
        x: px, y: py,
        vx: vx * 0.12 + Math.cos(a) * s, vy: vy * 0.12 + Math.sin(a) * s - 0.15,
        r: 2 + Math.random() * 2.5, grow: 9 + Math.random() * 10 * power,
        life: 0, max: 0.7 + Math.random() * 0.5,
      });
    }
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
    cur.classList.add('on');
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (reduce) return;
    // A small burst of air on click.
    spawn(e.clientX, e.clientY, Math.cos(angle) * 30, Math.sin(angle) * 30, 10, 2.2);
  });
  document.addEventListener('pointerleave', () => cur.classList.remove('on'));
  addEventListener('blur', () => cur.classList.remove('on'));

  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;

    // Smooth turn toward movement; mirror when blowing left so curls stay upright.
    let da = targetAngle - angle;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    angle += da * Math.min(dt * 10, 1);
    const flip = Math.cos(angle) < 0 ? -1 : 1;
    cur.style.transform = `translate(${x - 4}px, ${y - 16}px) rotate(${angle}rad) scaleY(${flip})`;

    // Trail of soft air puffs.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life += dt;
      if (p.life >= p.max) { puffs.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.x += p.vx * dt * 60; p.y += p.vy * dt * 60;
      p.vx *= 0.94; p.vy *= 0.94;
      const r = p.r + p.grow * (1 - Math.pow(1 - k, 2));
      const a = (1 - k) * (1 - k);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.75 * a})`);
      g.addColorStop(0.6, `rgba(230,240,248,${0.45 * a})`);
      g.addColorStop(1, 'rgba(200,220,235,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(91,136,173,${0.22 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
