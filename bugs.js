// A few bugs crawl along the grass. Click or tap one to squash it. A new bug appears after a moment.
(() => {
  const footer = document.getElementById('grass-footer');
  if (!footer) return;
  const layer = document.createElement('div');
  layer.className = 'bug-layer';
  layer.setAttribute('aria-hidden', 'true');
  footer.append(layer);

  const score = document.createElement('span');
  score.className = 'bug-score';
  const slot = footer.querySelector('.grass-footer-content');
  if (slot) slot.append(score);
  let squashed = 0;
  const showScore = () => { score.textContent = `Bugs squashed: ${squashed} · 73 bug reports filed for Daintree`; };
  showScore();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SVG = '<svg viewBox="0 0 26 26"><ellipse cx="13" cy="15" rx="8" ry="9" fill="#c0392b"/><path d="M13 6v18" stroke="#2a1a14" stroke-width="1.5"/><circle cx="13" cy="6" r="4" fill="#2a1a14"/><circle cx="9.5" cy="13" r="1.6" fill="#2a1a14"/><circle cx="16.5" cy="13" r="1.6" fill="#2a1a14"/><circle cx="10" cy="19" r="1.4" fill="#2a1a14"/><circle cx="16" cy="19" r="1.4" fill="#2a1a14"/></svg>';
  const bugs = [];

  function spawn() {
    const el = document.createElement('div');
    el.className = 'bug';
    el.innerHTML = SVG;
    const bug = {
      el, x: Math.random(), y: 0.45 + Math.random() * 0.4,
      speed: (0.02 + Math.random() * 0.03) * (Math.random() < 0.5 ? -1 : 1), pause: 0,
    };
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (el.classList.contains('squashed')) return;
      el.classList.add('squashed');
      bugs.splice(bugs.indexOf(bug), 1);
      squashed++; showScore();
      setTimeout(() => { el.remove(); spawn(); }, 1400);
    });
    layer.append(el);
    bugs.push(bug);
    place(bug);
  }
  function place(b) {
    b.el.style.left = (b.x * 100) + '%';
    b.el.style.top = (b.y * 100) + '%';
    b.el.firstChild.style.transform = `scaleX(${b.speed < 0 ? -1 : 1})`;
  }
  for (let i = 0; i < 4; i++) spawn();
  if (reduce) return;                       // reduced motion: bugs stay still but can be squashed

  let last = performance.now(), visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(footer);
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (visible) for (const b of bugs) {
      if (b.pause > 0) { b.pause -= dt; continue; }
      b.x += b.speed * dt;
      if (b.x < 0.02 || b.x > 0.98) { b.speed = -b.speed; b.x = Math.min(Math.max(b.x, 0.02), 0.98); }
      if (Math.random() < dt * 0.4) { b.pause = 0.4 + Math.random() * 1.2; }
      if (Math.random() < dt * 0.15) b.speed = -b.speed;
      place(b);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
