// Types the terminal lines one by one. Without JS, or with reduced motion, the full text stays visible.
(() => {
  const body = document.getElementById('terminal-body');
  if (!body || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lines = [...body.children];
  const caret = document.createElement('span');
  caret.className = 'caret';
  lines.forEach((l) => { l.dataset.text = l.textContent; l.hidden = true; });

  let i = 0;
  function next() {
    if (i >= lines.length) { lines[lines.length - 1].append(caret); return; }
    const line = lines[i++];
    line.hidden = false;
    if (!line.classList.contains('cmd')) { setTimeout(next, 280); return; }
    const text = line.dataset.text;
    line.textContent = '';
    line.append(caret);
    let n = 0;
    const timer = setInterval(() => {
      caret.before(text[n++]);
      if (n === text.length) { clearInterval(timer); setTimeout(next, 350); }
    }, 38);
  }
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); next(); } }).observe(body);
})();
