/* klarkanis.cz
   Efekty v hero sekci: driftující síť uzlů na pozadí a deformace nadpisu
   pod kurzorem. Obojí WebGL bez závislostí, text zůstává v DOM a canvasy
   jsou jen vizuální vrstva. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const cssColor = (name) => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(1);
    const n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  const buildProgram = (gl, vertSrc, fragSrc) => {
    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  };

  const hero = document.querySelector('.hero');
  const drift = hero && hero.querySelector('.hero-drift');
  if (drift) initDrift(hero, drift);

  const title = document.getElementById('hero-title');
  const mesh = title && title.querySelector('.hero-mesh');
  if (title && mesh && !reduceMotion && finePointer) initMesh(title, mesh);

  /* Driftující síť uzlů (podle Particle Drift od Originkit, přepsáno bez Reactu).
     Uzly pomalu plují po ploše, blízké se spojují linkou, u kurzoru se rozsvítí
     a napojí. Počet uzlů se odvíjí od plochy sekce, smyčka běží na 30 fps
     a jen pokud je sekce vidět. Při reduced motion se vykreslí jeden statický snímek. */
  function initDrift(section, canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: true });
    if (!gl) return;

    const MAX_LINES = 6000;
    const EDGE = 20;
    const LINK_DIST = 150;
    const REACH = 180;
    const DOT_SIZE = 3.5;
    const LINE_WIDTH = 1;
    const SPEED = 0.4;
    const DIRECTION = (25 * Math.PI) / 180;
    const FRAME_MS = 1000 / 30;
    const BASE = cssColor('--slate');
    const ACCENT = cssColor('--moss');

    const LINE_VERT = `precision highp float;
    attribute vec2 a_p0; attribute vec2 a_p1; attribute vec2 a_corner; attribute vec3 a_shade;
    uniform vec2 uSize;
    varying float v_alpha; varying float v_mix; varying float v_off; varying float v_half;
    void main() {
      vec2 d = a_p1 - a_p0;
      float len = max(length(d), 1e-5);
      vec2 nrm = vec2(-d.y, d.x) / len;
      float half_ = max(a_shade.z * 0.5, 0.35);
      float ext = half_ + 0.75;
      vec2 p = mix(a_p0, a_p1, a_corner.x) + nrm * a_corner.y * ext;
      v_alpha = a_shade.x; v_mix = a_shade.y; v_off = a_corner.y * ext; v_half = half_;
      gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
    }`;
    const LINE_FRAG = `precision mediump float;
    uniform vec3 uBase; uniform vec3 uAccent;
    varying float v_alpha; varying float v_mix; varying float v_off; varying float v_half;
    void main() {
      float cov = clamp((v_half - abs(v_off)) / 0.75 + 0.5, 0.0, 1.0);
      float a = v_alpha * cov;
      gl_FragColor = vec4(mix(uBase, uAccent, v_mix) * a, a);
    }`;
    const DOT_VERT = `precision highp float;
    attribute vec2 a_pos; attribute float a_lit;
    uniform vec2 uSize; uniform float uDot;
    varying float v_lit;
    void main() {
      gl_PointSize = uDot;
      v_lit = a_lit;
      gl_Position = vec4(a_pos.x / uSize.x * 2.0 - 1.0, 1.0 - a_pos.y / uSize.y * 2.0, 0.0, 1.0);
    }`;
    const DOT_FRAG = `precision mediump float;
    uniform vec3 uBase; uniform vec3 uAccent; uniform float uRestAlpha;
    varying float v_lit;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float disc = 1.0 - smoothstep(0.72, 1.0, d);
      float a = disc * mix(uRestAlpha, 1.0, v_lit);
      if (a <= 0.004) discard;
      gl_FragColor = vec4(mix(uBase, uAccent, v_lit) * a, a);
    }`;

    const lineProg = buildProgram(gl, LINE_VERT, LINE_FRAG);
    const dotProg = buildProgram(gl, DOT_VERT, DOT_FRAG);
    if (!lineProg || !dotProg) return;
    const L = {
      p0: gl.getAttribLocation(lineProg, 'a_p0'),
      p1: gl.getAttribLocation(lineProg, 'a_p1'),
      corner: gl.getAttribLocation(lineProg, 'a_corner'),
      shade: gl.getAttribLocation(lineProg, 'a_shade'),
      size: gl.getUniformLocation(lineProg, 'uSize'),
      base: gl.getUniformLocation(lineProg, 'uBase'),
      accent: gl.getUniformLocation(lineProg, 'uAccent'),
    };
    const D = {
      pos: gl.getAttribLocation(dotProg, 'a_pos'),
      lit: gl.getAttribLocation(dotProg, 'a_lit'),
      size: gl.getUniformLocation(dotProg, 'uSize'),
      dot: gl.getUniformLocation(dotProg, 'uDot'),
      rest: gl.getUniformLocation(dotProg, 'uRestAlpha'),
      base: gl.getUniformLocation(dotProg, 'uBase'),
      accent: gl.getUniformLocation(dotProg, 'uAccent'),
    };

    const CORNERS = [[0, -1], [1, -1], [1, 1], [0, -1], [1, 1], [0, 1]];
    const lP0 = new Float32Array(MAX_LINES * 12);
    const lP1 = new Float32Array(MAX_LINES * 12);
    const lCorner = new Float32Array(MAX_LINES * 12);
    const lShade = new Float32Array(MAX_LINES * 18);
    for (let e = 0; e < MAX_LINES; e++) {
      for (let c = 0; c < 6; c++) {
        lCorner[(e * 6 + c) * 2] = CORNERS[c][0];
        lCorner[(e * 6 + c) * 2 + 1] = CORNERS[c][1];
      }
    }
    const makeBuffer = (data, usage) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage);
      return buf;
    };
    const bP0 = makeBuffer(lP0.byteLength, gl.DYNAMIC_DRAW);
    const bP1 = makeBuffer(lP1.byteLength, gl.DYNAMIC_DRAW);
    const bCorner = makeBuffer(lCorner, gl.STATIC_DRAW);
    const bShade = makeBuffer(lShade.byteLength, gl.DYNAMIC_DRAW);
    const bPos = gl.createBuffer();
    const bLit = gl.createBuffer();
    const bind = (loc, buf, size, data) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      if (data) gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };

    let seed = 20260824;
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let count = 0;
    let nx, ny, nSpd, gPos, gLit;
    const dirX = Math.sin(DIRECTION);
    const dirY = Math.cos(DIRECTION);
    const ptr = { x: -1e4, y: -1e4 };

    const buildNodes = (n) => {
      count = n;
      nx = new Float32Array(n);
      ny = new Float32Array(n);
      nSpd = new Float32Array(n);
      gPos = new Float32Array(n * 2);
      gLit = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        nx[i] = random() * width;
        ny[i] = random() * height;
        nSpd[i] = (random() * 0.4 + 0.1) * 60 * SPEED;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos);
      gl.bufferData(gl.ARRAY_BUFFER, gPos.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bLit);
      gl.bufferData(gl.ARRAY_BUFFER, gLit.byteLength, gl.DYNAMIC_DRAW);
    };

    const step = (dt) => {
      for (let i = 0; i < count; i++) {
        nx[i] += nSpd[i] * dirX * dt;
        ny[i] += nSpd[i] * dirY * dt;
        if (nx[i] < -EDGE) { nx[i] = width + EDGE; ny[i] = random() * height; }
        else if (nx[i] > width + EDGE) { nx[i] = -EDGE; ny[i] = random() * height; }
        if (ny[i] < -EDGE) { ny[i] = height + EDGE; nx[i] = random() * width; }
        else if (ny[i] > height + EDGE) { ny[i] = -EDGE; nx[i] = random() * width; }
      }
    };

    const draw = () => {
      let lines = 0;
      const pushLine = (x0, y0, x1, y1, alpha, mixv) => {
        if (lines >= MAX_LINES) return;
        for (let c = 0; c < 6; c++) {
          const k = (lines * 6 + c) * 2;
          const s = (lines * 6 + c) * 3;
          lP0[k] = x0; lP0[k + 1] = y0;
          lP1[k] = x1; lP1[k + 1] = y1;
          lShade[s] = alpha; lShade[s + 1] = mixv; lShade[s + 2] = LINE_WIDTH;
        }
        lines++;
      };
      for (let i = 0; i < count; i++) {
        const d = Math.hypot(ptr.x - nx[i], ptr.y - ny[i]);
        const lit = d < REACH ? 1 : 0;
        if (lit) pushLine(nx[i], ny[i], ptr.x, ptr.y, 0.45 * (1 - d / REACH), 1);
        gPos[i * 2] = nx[i];
        gPos[i * 2 + 1] = ny[i];
        gLit[i] = lit;
      }
      const limit = LINK_DIST * LINK_DIST;
      for (let i = 0; i < count && lines < MAX_LINES; i++) {
        for (let j = i + 1; j < count && lines < MAX_LINES; j++) {
          const dx = nx[i] - nx[j];
          const dy = ny[i] - ny[j];
          const dd = dx * dx + dy * dy;
          if (dd < limit) pushLine(nx[i], ny[i], nx[j], ny[j], 0.16 * (1 - Math.sqrt(dd) / LINK_DIST), 0);
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      if (lines) {
        const verts = lines * 6;
        gl.useProgram(lineProg);
        bind(L.p0, bP0, 2, lP0.subarray(0, verts * 2));
        bind(L.p1, bP1, 2, lP1.subarray(0, verts * 2));
        bind(L.corner, bCorner, 2);
        bind(L.shade, bShade, 3, lShade.subarray(0, verts * 3));
        gl.uniform2f(L.size, width, height);
        gl.uniform3fv(L.base, BASE);
        gl.uniform3fv(L.accent, ACCENT);
        gl.drawArrays(gl.TRIANGLES, 0, verts);
        [L.p0, L.p1, L.corner, L.shade].forEach((loc) => gl.disableVertexAttribArray(loc));
      }

      gl.useProgram(dotProg);
      bind(D.pos, bPos, 2, gPos);
      bind(D.lit, bLit, 1, gLit);
      gl.uniform2f(D.size, width, height);
      gl.uniform1f(D.dot, DOT_SIZE * dpr);
      gl.uniform1f(D.rest, 0.35);
      gl.uniform3fv(D.base, BASE);
      gl.uniform3fv(D.accent, ACCENT);
      gl.drawArrays(gl.POINTS, 0, count);
      [D.pos, D.lit].forEach((loc) => gl.disableVertexAttribArray(loc));
    };

    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (now - lastDraw < FRAME_MS) return;
      step(Math.min(0.05, (now - last) / 1000));
      last = now;
      lastDraw = now;
      draw();
    };
    let visible = true;
    const sync = () => {
      const run = visible && !document.hidden && !reduceMotion;
      if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth));
      const h = Math.max(1, Math.round(canvas.clientHeight));
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const target = Math.round(Math.min(180, Math.max(40, (w * h) / (finePointer ? 9000 : 14000))));
      if (!count) {
        width = w; height = h;
        buildNodes(target);
      } else {
        for (let i = 0; i < count; i++) { nx[i] *= w / width; ny[i] *= h / height; }
        width = w; height = h;
        if (Math.abs(target - count) > count * 0.3) buildNodes(target);
      }
      if (reduceMotion) draw();
    };

    resize();
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(section);
    document.addEventListener('visibilitychange', sync);
    if (finePointer && !reduceMotion) {
      section.addEventListener('pointermove', (e) => {
        const rect = canvas.getBoundingClientRect();
        ptr.x = e.clientX - rect.left;
        ptr.y = e.clientY - rect.top;
      });
      section.addEventListener('pointerleave', () => { ptr.x = -1e4; ptr.y = -1e4; });
    }
    sync();
  }

  /* Deformace nadpisu: WebGL2 síť s texturou textu. Canvas má přesah
     (--mesh-bleed), takže deformace písmen na okrajích není oříznutá.
     Fyzika běží jen při pohybu kurzoru a dokud se síť neuklidní. */
  function initMesh(h1, canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return;

    const GRID_W = 96;
    const GRID_H = 40;
    const DRAG = 1.8;
    const SPRING = 0.08;
    const DAMPING = 0.9;
    const DT = 0.1;
    const CHROMA = 0.005;
    const REST = 0.002;
    const INK = getComputedStyle(h1).color;
    const COLOR_A = cssColor('--lime');
    const COLOR_B = [0.42, 0.49, 0.56];

    const VERT_SRC = `#version 300 es
    in vec2 aPos; in vec2 aUv; in vec2 aDisp;
    out vec2 vUv; out float vMag;
    void main() { gl_Position = vec4(aPos + aDisp, 0.0, 1.0); vUv = aUv; vMag = length(aDisp); }`;
    const FRAG_SRC = `#version 300 es
    precision highp float;
    in vec2 vUv; in float vMag; out vec4 outColor;
    uniform sampler2D uTex; uniform float uChroma; uniform vec3 uColorA; uniform vec3 uColorB;
    void main() {
      vec4 base = texture(uTex, vUv);
      float o = uChroma * clamp(vMag * 8.0, 0.0, 1.0);
      float aOff = texture(uTex, vUv + vec2(o, 0.0)).a;
      float bOff = texture(uTex, vUv - vec2(o, 0.0)).a;
      vec3 col = base.rgb * base.a;
      col += uColorA * max(0.0, aOff - base.a);
      col += uColorB * max(0.0, bOff - base.a);
      outColor = vec4(col, max(base.a, max(aOff, bOff)));
    }`;

    const program = buildProgram(gl, VERT_SRC, FRAG_SRC);
    if (!program) return;
    const loc = {
      pos: gl.getAttribLocation(program, 'aPos'),
      uv: gl.getAttribLocation(program, 'aUv'),
      disp: gl.getAttribLocation(program, 'aDisp'),
      tex: gl.getUniformLocation(program, 'uTex'),
      chroma: gl.getUniformLocation(program, 'uChroma'),
      colorA: gl.getUniformLocation(program, 'uColorA'),
      colorB: gl.getUniformLocation(program, 'uColorB'),
    };

    const vertCount = (GRID_W + 1) * (GRID_H + 1);
    const positions = new Float32Array(vertCount * 2);
    const uvs = new Float32Array(vertCount * 2);
    for (let y = 0; y <= GRID_H; y++) {
      for (let x = 0; x <= GRID_W; x++) {
        const i = (y * (GRID_W + 1) + x) * 2;
        const u = x / GRID_W;
        const v = y / GRID_H;
        positions[i] = u * 2 - 1;
        positions[i + 1] = 1 - v * 2;
        uvs[i] = u;
        uvs[i + 1] = v;
      }
    }
    const indices = new Uint32Array(GRID_W * GRID_H * 6);
    for (let y = 0, k = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const a = y * (GRID_W + 1) + x;
        const b = a + 1;
        const c = a + GRID_W + 1;
        const d = c + 1;
        indices[k++] = a; indices[k++] = c; indices[k++] = b;
        indices[k++] = b; indices[k++] = c; indices[k++] = d;
      }
    }
    const disp = new Float32Array(vertCount * 2);
    const vel = new Float32Array(vertCount * 2);

    const buffer = (target, data, usage) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(target, buf);
      gl.bufferData(target, data, usage);
      return buf;
    };
    const attrib = (location, buf) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    attrib(loc.pos, buffer(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW));
    attrib(loc.uv, buffer(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW));
    const dispBuf = buffer(gl.ARRAY_BUFFER, disp, gl.DYNAMIC_DRAW);
    attrib(loc.disp, dispBuf);
    buffer(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    /* Každý vizuální řádek nadpisu (.w) se vykreslí na místo, kde ho položil
       prohlížeč. Souřadnice jsou vztažené k canvasu včetně přesahu. */
    const renderTexture = (w, h, dpr) => {
      const c2 = document.createElement('canvas');
      c2.width = w;
      c2.height = h;
      const ctx = c2.getContext('2d');
      const origin = canvas.getBoundingClientRect();
      h1.querySelectorAll('.w').forEach((span) => {
        const rect = span.getBoundingClientRect();
        const cs = getComputedStyle(span);
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * dpr}px ${cs.fontFamily}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${parseFloat(cs.letterSpacing) * dpr || 0}px`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = INK;
        const text = cs.textTransform === 'uppercase' ? span.textContent.toUpperCase() : span.textContent;
        ctx.fillText(text, (rect.left - origin.left) * dpr, (rect.top - origin.top + rect.height / 2) * dpr);
      });
      return c2;
    };

    let running = false;
    let raf = 0;
    const cursor = { x: 99, y: 99, px: 99, py: 99 };

    const draw = () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, dispBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, disp);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc.tex, 0);
      gl.uniform1f(loc.chroma, CHROMA);
      gl.uniform3fv(loc.colorA, COLOR_A);
      gl.uniform3fv(loc.colorB, COLOR_B);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
    };

    const step = () => {
      let vx = cursor.x - cursor.px;
      let vy = cursor.y - cursor.py;
      if (Math.hypot(vx, vy) > 0.3) { vx = 0; vy = 0; }
      cursor.px = cursor.x;
      cursor.py = cursor.y;
      const inside = cursor.x < 90;
      /* Po odjetí kurzoru se síť rychleji uklidní, aby smyčka nemusela běžet dál */
      const settle = inside ? 1 : 0.96;

      let energy = 0;
      for (let i = 0; i < vertCount; i++) {
        const i2 = i * 2;
        const dx = disp[i2];
        const dy = disp[i2 + 1];
        const cd = Math.hypot(cursor.x - (positions[i2] + dx), cursor.y - (positions[i2 + 1] + dy));
        const proximity = Math.max(0, 1 / (1 + cd / 0.05) - 0.1);
        const nvx = (vel[i2] + vx * DRAG * proximity - dx * SPRING) * DAMPING * settle;
        const nvy = (vel[i2 + 1] + vy * DRAG * proximity - dy * SPRING) * DAMPING * settle;
        vel[i2] = nvx;
        vel[i2 + 1] = nvy;
        disp[i2] = Math.max(-1, Math.min(1, (dx + nvx * DT) * settle));
        disp[i2 + 1] = Math.max(-1, Math.min(1, (dy + nvy * DT) * settle));
        energy = Math.max(energy, Math.abs(nvx), Math.abs(nvy), Math.abs(disp[i2]), Math.abs(disp[i2 + 1]));
      }
      if (!inside && energy < REST) {
        disp.fill(0);
        vel.fill(0);
        running = false;
      } else {
        raf = requestAnimationFrame(step);
      }
      draw();
    };
    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(step);
    };

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      cursor.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      cursor.y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
      wake();
    });
    canvas.addEventListener('pointerleave', () => { cursor.x = 99; cursor.y = 99; wake(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); running = false; } else wake();
    });

    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(rect.width * dpr));
      canvas.height = Math.max(2, Math.round(rect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, renderTexture(canvas.width, canvas.height, dpr));
      draw();
    };

    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      resize();
      h1.classList.add('is-mesh');
      let pending = 0;
      new ResizeObserver(() => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(resize);
      }).observe(h1);
    });
  }
})();
