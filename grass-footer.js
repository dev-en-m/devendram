import * as THREE from 'three';

const host = document.getElementById('grass-footer');
const isMobile = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Renderer (transparent background) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
host.prepend(renderer.domElement);
host.classList.add('grass-ok');   // grass drawn: hides the CSS fallback background

// ---------- Fixed side-view camera ----------
const VIEW_H = 3.2;          // footer height in world units
let viewW = 20;
const camera = new THREE.OrthographicCamera(-10, 10, VIEW_H, 0, -50, 50);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);
const scene = new THREE.Scene();

// ---------- Light ----------
const sunDir = new THREE.Vector3(-0.45, 0.45, -0.77).normalize();  // low sun behind → rim glow
const keyDir = new THREE.Vector3(-0.5, 0.55, 0.67).normalize();    // soft front light for flower faces
const sunColor = new THREE.Color('#ffd09a').multiplyScalar(2.0);
const skyColor = new THREE.Color('#8fb4e0');

// ---------- Pointer interaction field (1D across the footer width) ----------
const PUSH_RES = 512;
const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
let rtA = new THREE.WebGLRenderTarget(PUSH_RES, 4, rtOpts);
let rtB = new THREE.WebGLRenderTarget(PUSH_RES, 4, rtOpts);
for (const rt of [rtA, rtB]) { renderer.setRenderTarget(rt); renderer.clear(); }
renderer.setRenderTarget(null);

const pushMat = new THREE.ShaderMaterial({
  uniforms: {
    uPrev: { value: rtA.texture }, uMouseX: { value: -10 }, uVel: { value: 0 },
    uRadius: { value: 0.05 }, uActive: { value: 0 }, uDecay: { value: 0.97 }, uGain: { value: 0.1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D uPrev;
    uniform float uMouseX, uVel, uRadius, uActive, uDecay, uGain;
    varying vec2 vUv;
    void main() {
      float push = texture2D(uPrev, vUv).x * uDecay;
      float d = vUv.x - uMouseX;
      float f = smoothstep(uRadius, uRadius * 0.12, abs(d)) * uActive;
      float stamp = sign(d) * (0.55 + 0.45 * smoothstep(0.0, uRadius, abs(d))) + uVel * 0.9;
      push = clamp(push + stamp * f * uGain, -1.0, 1.0);
      gl_FragColor = vec4(push, 0.0, 0.0, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const pushScene = new THREE.Scene();
pushScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pushMat));
const pushCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---------- Shared uniforms + GLSL (wind and pointer are identical for grass and flowers) ----------
const DEPTH = 5.0;
const shared = {
  uTime: { value: 0 },
  uFieldWidth: { value: viewW },
  uWindStrength: { value: reduceMotion ? 0.2 : 0.65 },
  uWindSpeed: { value: reduceMotion ? 0.4 : 1.1 },
  uWindDir: { value: new THREE.Vector2(1, 0.35).normalize() },
  uPush: { value: rtA.texture },
  uDepth: { value: DEPTH },
  uSunDir: { value: sunDir }, uKeyDir: { value: keyDir },
  uSunColor: { value: sunColor }, uSkyColor: { value: skyColor },
};

const GLSL_COMMON = /* glsl */`
  uniform float uTime, uWindStrength, uWindSpeed, uFieldWidth, uDepth;
  uniform vec2 uWindDir;
  uniform sampler2D uPush;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  vec3 rotateAxis(vec3 v, vec3 k, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
  }
  // Returns (bend.x, bend.z, gust) for a plant rooted at wp (world xz).
  vec3 windAt(vec2 wp, float rnd) {
    vec2 wd = normalize(uWindDir);
    vec2 scroll = wd * uTime * uWindSpeed;
    float gust   = smoothstep(0.15, 0.95, vnoise(wp * vec2(0.09, 0.2) - scroll * 0.3));
    float detail = vnoise(wp * 0.5 - scroll * 0.9);
    float phase  = rnd * 6.2831 + dot(wp, wd) * 0.6;
    float flutter = sin(uTime * (2.0 + rnd * 1.4) * (0.6 + 0.4 * uWindSpeed) + phase);
    vec2 b = wd * ((gust * 0.9 + detail * 0.3) * uWindStrength + flutter * 0.06 * (0.3 + uWindStrength));
    return vec3(b, gust);
  }
  float pushAt(float worldX) {
    return texture2D(uPush, vec2(worldX / uFieldWidth + 0.5, 0.5)).x;
  }
  // Bend a point around the root, more toward the top (t = 0 root, 1 top).
  void bendPoint(inout vec3 p, inout vec3 n, vec2 bendVec, float t, float maxAngle) {
    float bl = length(bendVec);
    if (bl < 1e-4) return;
    vec3 b3 = vec3(bendVec.x, 0.0, bendVec.y) / bl;
    vec3 axis = normalize(cross(vec3(0, 1, 0), b3));
    float a = min(bl, maxAngle) * pow(t, 1.5);
    p = rotateAxis(p, axis, a);
    n = rotateAxis(n, axis, a);
  }
`;

// =====================================================================
// GRASS
// =====================================================================
function makeBlade(segments) {
  const verts = [], idx = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const half = 0.5 * Math.pow(1.0 - t, 0.6);
    verts.push(-half, t, 0, half, t, 0);
  }
  verts.push(0, 1, 0);
  for (let i = 0; i < segments - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (segments - 1) * 2;
  idx.push(last, last + 1, segments * 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  return g;
}

const MAX_BLADES = 30000;
const BLADES_PER_UNIT = isMobile ? 380 : 560;
const blade = makeBlade(isMobile ? 6 : 8);
const grassGeo = new THREE.InstancedBufferGeometry();
grassGeo.index = blade.index;
grassGeo.setAttribute('position', blade.attributes.position);
const gOffsets = new Float32Array(MAX_BLADES * 3);
const gParams = new Float32Array(MAX_BLADES * 4);
for (let i = 0; i < MAX_BLADES; i++) {
  gOffsets[i * 3] = Math.random() - 0.5;                       // normalized x, stretched in shader
  gOffsets[i * 3 + 2] = -Math.pow(Math.random(), 0.8) * DEPTH;
  gParams[i * 4] = Math.random() * Math.PI * 2;
  gParams[i * 4 + 1] = 1.3 + Math.random() * 1.0;
  gParams[i * 4 + 2] = 0.11 + Math.random() * 0.08;
  gParams[i * 4 + 3] = Math.random();
}
grassGeo.setAttribute('offset', new THREE.InstancedBufferAttribute(gOffsets, 3));
grassGeo.setAttribute('params', new THREE.InstancedBufferAttribute(gParams, 4));

const grassMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: {
    ...shared,
    uBaseColor: { value: new THREE.Color('#1c360b') },
    uTipColor: { value: new THREE.Color('#9dbb3c') },
    uDryColor: { value: new THREE.Color('#c9b25a') },
  },
  vertexShader: /* glsl */`
    attribute vec3 offset;
    attribute vec4 params;      // x: yaw, y: height, z: width, w: random
    varying float vT, vRand, vGust, vDepth;
    varying vec3 vNormal;
    ${GLSL_COMMON}
    void main() {
      float depth01 = -offset.z / uDepth;
      vec3 base = vec3(offset.x * (uFieldWidth + 2.0), -0.25 + depth01 * 0.35, offset.z);
      float h = params.y * (0.72 + 0.45 * vnoise(vec2(base.x * 0.22, 7.0)));
      float t = position.y;
      vec3 p = vec3(position.x * params.z, t * h, 0.0);
      vec3 n = normalize(vec3(position.x * 2.2, 0.0, 1.0));

      float lean = (0.15 + params.w * 0.4) * t * t;
      p = rotateAxis(p, vec3(1, 0, 0), lean);  n = rotateAxis(n, vec3(1, 0, 0), lean);
      float cy = cos(params.x), sy = sin(params.x);
      mat3 rotY = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
      p = rotY * p;  n = rotY * n;

      vec3 w = windAt(base.xz, params.w);
      float push = pushAt(base.x);
      float wobble = 1.0 + 0.12 * sin(uTime * 7.0 + params.w * 12.0) * abs(push);
      bendPoint(p, n, w.xy + vec2(push * 1.35 * wobble, 0.0), t, 1.4);

      vT = t; vRand = params.w; vDepth = depth01;
      vGust = w.z * uWindStrength + abs(push) * 0.6;
      vNormal = n;
      gl_Position = projectionMatrix * viewMatrix * vec4(base + p, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSunDir, uSunColor, uSkyColor, uBaseColor, uTipColor, uDryColor;
    varying float vT, vRand, vGust, vDepth;
    varying vec3 vNormal;
    void main() {
      vec3 n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
      vec3 V = vec3(0.0, 0.0, 1.0);
      vec3 L = uSunDir;
      vec3 col = mix(uBaseColor, uTipColor, smoothstep(0.0, 1.0, vT));
      col = mix(col, uDryColor, vRand * 0.25 * vT);
      col *= 0.82 + vRand * 0.36;
      col *= 1.0 + vGust * 0.3 * vT;
      col *= mix(1.0, 0.5, vDepth);
      float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0); diff *= diff;
      float ao = mix(0.18, 1.0, pow(vT, 0.8));
      float trans = pow(clamp(dot(-V, L), 0.0, 1.0), 2.0) * vT * (0.6 + 0.4 * vRand);
      float spec = pow(max(dot(n, normalize(L + V)), 0.0), 36.0) * 0.2 * vT;
      vec3 c = col * (uSunColor * diff + uSkyColor * 0.4) * ao
             + col * uSunColor * trans * 1.3
             + uSunColor * spec * (1.0 - vDepth * 0.6);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.frustumCulled = false;
scene.add(grass);

// =====================================================================
// SUNFLOWERS
// =====================================================================
// One sunflower is built from simple parts, merged into one geometry with
// per-vertex colour, a bend weight (0 at root, 1 at the head) and a glow amount.
const STEM_H = 2.25;
function buildSunflower() {
  const pos = [], nor = [], col = [], bend = [], glow = [];
  const C = (hex) => new THREE.Color(hex);
  function addGeo(geo, colorFn, bendFn, glowAmt) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos.push(x, y, z); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const c = colorFn(x, y, z); col.push(c.r, c.g, c.b);
      bend.push(bendFn(x, y, z)); glow.push(glowAmt);
    }
  }
  const stemBottom = C('#2c4a12'), stemTop = C('#4f7d22');
  const byHeight = (y) => Math.min(Math.max(y / STEM_H, 0), 1);

  // Stem
  const stem = new THREE.CylinderGeometry(0.03, 0.05, STEM_H, 6, 12, true);
  stem.translate(0, STEM_H / 2, 0);
  addGeo(stem, (x, y) => stemBottom.clone().lerp(stemTop, byHeight(y)), (x, y) => byHeight(y), 0.15);

  // Leaves: tapered, slightly drooping, on alternating sides
  const leafCol = C('#4c7f20'), leafTip = C('#6f9a2e');
  [[0.75, 1, 0.55], [1.25, -1, 0.5], [1.65, 1, 0.42]].forEach(([y0, side, len]) => {
    const g = new THREE.PlaneGeometry(len, 0.24, 6, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / len + 0.5;                 // 0 at stem, 1 at tip
      p.setY(i, p.getY(i) * Math.sin(Math.PI * Math.min(u * 1.1, 1)) - u * u * 0.18);
      p.setX(i, u * len * side);
      p.setZ(i, 0.05 * Math.sin(u * Math.PI));
    }
    g.rotateY(side * 0.5);
    g.translate(0, y0, 0);
    addGeo(g, (x) => leafCol.clone().lerp(leafTip, Math.min(Math.abs(x) / len, 1)), (x, y) => byHeight(y), 0.6);
  });

  // Head: built facing +z, then moved to the stem top and tilted a little down
  const head = [];
  const headMat = new THREE.Matrix4().makeRotationX(0.22).premultiply(new THREE.Matrix4().makeTranslation(0, STEM_H + 0.04, 0.06));
  function headPart(geo, colorFn, glowAmt) { geo.applyMatrix4(headMat); addGeo(geo, colorFn, () => 1, glowAmt); }

  // Back of head (green)
  const back = new THREE.CircleGeometry(0.21, 24); back.rotateY(Math.PI); back.translate(0, 0, -0.03);
  headPart(back, () => C('#3d5f1a'), 0.2);

  // Petals: two rings of pointed petals
  const petalBase = C('#e89a0c'), petalTip = C('#ffd43b');
  function ring(count, inner, len, wid, z, rot) {
    for (let i = 0; i < count; i++) {
      const g = new THREE.BufferGeometry();
      const v = [ -wid * 0.4, 0, 0,  wid * 0.4, 0, 0,  -wid * 0.5, len * 0.5, 0,
                   wid * 0.4, 0, 0,  wid * 0.5, len * 0.5, 0, -wid * 0.5, len * 0.5, 0,
                  -wid * 0.5, len * 0.5, 0,  wid * 0.5, len * 0.5, 0,  0, len, 0 ];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.rotateX(-0.12);                     // cup the petals slightly forward
      g.translate(0, inner, z);
      g.rotateZ(rot + (i / count) * Math.PI * 2);
      headPart(g, (x, y, z2) => petalBase.clone().lerp(petalTip, 0.4), 1.0);
    }
  }
  ring(20, 0.13, 0.27, 0.085, 0.0, 0);
  ring(20, 0.13, 0.23, 0.08, 0.012, Math.PI / 20);

  // Seed disc: dark centre with a warmer ring
  const disc = new THREE.CircleGeometry(0.155, 28); disc.translate(0, 0, 0.03);
  const cIn = C('#24140a'), cOut = C('#6a3a10');
  headPart(disc, () => cIn, 0.0);
  const discRing = new THREE.RingGeometry(0.1, 0.16, 28); discRing.translate(0, 0, 0.034);
  headPart(discRing, () => cOut, 0.0);

  // Petal colour: fade from base to tip using distance from the head centre
  const headCentre = new THREE.Vector3(0, STEM_H + 0.04, 0.06);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const colArr = new Float32Array(col);
  for (let i = 0; i < glow.length; i++) {
    if (glow[i] === 1.0) {
      const d = Math.hypot(pos[i * 3] - headCentre.x, pos[i * 3 + 1] - headCentre.y);
      const k = THREE.MathUtils.clamp((d - 0.13) / 0.27, 0, 1);
      const c = petalBase.clone().lerp(petalTip, k);
      colArr[i * 3] = c.r; colArr[i * 3 + 1] = c.g; colArr[i * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('aColor', new THREE.BufferAttribute(colArr, 3));
  geo.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
  return geo;
}

const MAX_FLOWERS = 40;
const flowerBase = buildSunflower();
const flowerGeo = new THREE.InstancedBufferGeometry();
for (const name of ['position', 'normal', 'aColor', 'aBend', 'aGlow']) flowerGeo.setAttribute(name, flowerBase.attributes[name]);
const fOffsets = new Float32Array(MAX_FLOWERS * 4);   // world x, unused, z, random
const fParams = new Float32Array(MAX_FLOWERS * 4);    // scale, yaw, unused, unused
flowerGeo.setAttribute('fOffset', new THREE.InstancedBufferAttribute(fOffsets, 4));
flowerGeo.setAttribute('fParams', new THREE.InstancedBufferAttribute(fParams, 4));

const seeded = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
function placeFlowers() {
  // Evenly spread with jitter; one flower about every 3 world units.
  const count = Math.min(MAX_FLOWERS, Math.max(2, Math.round(viewW / 3)));
  for (let i = 0; i < count; i++) {
    const x = (-0.5 + (i + 0.5 + (seeded(i, 1) - 0.5) * 0.7) / count) * viewW;
    fOffsets[i * 4] = x;
    fOffsets[i * 4 + 2] = -0.9 - seeded(i, 2) * 2.4;
    fOffsets[i * 4 + 3] = seeded(i, 3);
    fParams[i * 4] = 0.88 + seeded(i, 4) * 0.22;
    fParams[i * 4 + 1] = (seeded(i, 5) - 0.5) * 0.7;
  }
  flowerGeo.attributes.fOffset.needsUpdate = true;
  flowerGeo.attributes.fParams.needsUpdate = true;
  flowerGeo.instanceCount = count;
}

const flowerMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { ...shared },
  vertexShader: /* glsl */`
    attribute vec3 aColor;
    attribute float aBend, aGlow;
    attribute vec4 fOffset;     // x: world x, z: depth, w: random
    attribute vec4 fParams;     // x: scale, y: yaw
    varying vec3 vColor, vNormal;
    varying float vBend, vGlow, vDepth;
    ${GLSL_COMMON}
    void main() {
      float depth01 = -fOffset.z / uDepth;
      vec3 base = vec3(fOffset.x, -0.25 + depth01 * 0.35, fOffset.z);
      vec3 p = position * fParams.x;
      vec3 n = normal;
      float cy = cos(fParams.y), sy = sin(fParams.y);
      mat3 rotY = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
      p = rotY * p;  n = rotY * n;

      // Sunflower stems are stiffer than grass: smaller bend, slower nod.
      vec3 w = windAt(base.xz, fOffset.w);
      float push = pushAt(base.x);
      float wobble = 1.0 + 0.15 * sin(uTime * 5.0 + fOffset.w * 9.0) * abs(push);
      bendPoint(p, n, w.xy * 0.45 + vec2(push * 0.8 * wobble, 0.0), aBend, 0.9);

      vColor = aColor; vNormal = n; vBend = aBend; vGlow = aGlow; vDepth = depth01;
      gl_Position = projectionMatrix * viewMatrix * vec4(base + p, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSunDir, uKeyDir, uSunColor, uSkyColor;
    varying vec3 vColor, vNormal;
    varying float vBend, vGlow, vDepth;
    void main() {
      vec3 n = normalize(vNormal);
      if (!gl_FrontFacing) n = -n;
      vec3 V = vec3(0.0, 0.0, 1.0);
      float key = clamp(dot(n, uKeyDir) * 0.6 + 0.4, 0.0, 1.0);
      float ao = mix(0.35, 1.0, vBend);
      float trans = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 2.0) * vGlow;
      vec3 c = vColor * (uSunColor * key * 0.75 + uSkyColor * 0.45) * ao
             + vColor * uSunColor * trans * 0.6;
      c *= mix(1.0, 0.6, vDepth);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const flowers = new THREE.Mesh(flowerGeo, flowerMat);
flowers.frustumCulled = false;
scene.add(flowers);

// ---------- Size ----------
const TOUCH_RADIUS = 1.4;
function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  viewW = VIEW_H * (w / h);
  camera.left = -viewW / 2; camera.right = viewW / 2;
  camera.updateProjectionMatrix();
  shared.uFieldWidth.value = viewW;
  grassGeo.instanceCount = Math.min(MAX_BLADES, Math.round(viewW * BLADES_PER_UNIT));
  pushMat.uniforms.uRadius.value = TOUCH_RADIUS / viewW;
  placeFlowers();
}
new ResizeObserver(resize).observe(host);
resize();

// ---------- Pointer ----------
const pointer = { inside: false, x: 0, prevX: 0, depth: 0, moved: false, has: false, vel: 0 };
addEventListener('pointermove', (e) => {
  const r = host.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) { pointer.inside = false; return; }
  const worldY = (1 - v) * VIEW_H;
  const x = (u - 0.5) * viewW;
  if (!pointer.has) pointer.prevX = x;
  pointer.x = x; pointer.has = true; pointer.moved = true;
  pointer.depth = THREE.MathUtils.clamp((2.9 - worldY) / 1.7, 0, 1);  // includes flower heads
  pointer.inside = pointer.depth > 0;
}, { passive: true });
document.addEventListener('pointerleave', () => { pointer.inside = false; });

// ---------- Loop (only while the footer is visible) ----------
let active = 0;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  shared.uTime.value += dt;

  if (pointer.moved) {
    const vx = (pointer.x - pointer.prevX) / Math.max(dt, 1e-3);
    pointer.vel += (THREE.MathUtils.clamp(vx / 20, -1, 1) - pointer.vel) * 0.35;
    pointer.prevX = pointer.x; pointer.moved = false;
  } else pointer.vel *= 0.85;
  active += ((pointer.inside ? pointer.depth : 0) - active) * Math.min(dt * 10, 1);

  const u = pushMat.uniforms;
  u.uPrev.value = rtA.texture;
  u.uMouseX.value = pointer.x / viewW + 0.5;
  u.uVel.value = pointer.vel;
  u.uActive.value = active;
  u.uDecay.value = Math.pow(0.5, dt / 0.45);
  u.uGain.value = Math.min(dt * 9, 0.5);
  renderer.setRenderTarget(rtB);
  renderer.render(pushScene, pushCam);
  renderer.setRenderTarget(null);
  [rtA, rtB] = [rtB, rtA];
  shared.uPush.value = rtA.texture;

  renderer.render(scene, camera);
}
new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) { clock.getDelta(); renderer.setAnimationLoop(frame); }
  else renderer.setAnimationLoop(null);
}).observe(host);
