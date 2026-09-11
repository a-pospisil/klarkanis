/* klarkanis.cz
   Hlavička, mobilní menu, aktivní sekce, odhalení při scrollu,
   kontaktní formulář (Web3Forms) a efekt na nadpisu. Bez závislostí. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hlavička: linka po odscrollování */
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobilní menu */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav-primary');
  const isOpen = () => nav.classList.contains('is-open');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.nav-toggle-label').textContent = open ? 'Zavřít' : 'Menu';
    document.documentElement.classList.toggle('menu-open', open);
  };
  toggle.addEventListener('click', () => setMenu(!isOpen()));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { setMenu(false); toggle.focus(); return; }
    if (e.key !== 'Tab') return;
    const focusables = [toggle, ...nav.querySelectorAll('a')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* Zvýraznění sekce, ve které se čtenář nachází */
  const navLinks = [...nav.querySelectorAll('.nav-link')].filter((a) => document.querySelector(a.hash));
  if ('IntersectionObserver' in window && navLinks.length) {
    const byId = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.removeAttribute('aria-current'));
        byId.get(entry.target.id).setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    byId.forEach((a, id) => spy.observe(document.getElementById(id)));
  }

  /* Odhalení bloků při scrollu */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* Kontaktní formulář: validace polí a odeslání přes Web3Forms */
  const form = document.getElementById('contact-form');
  if (form) {
    const status = document.getElementById('form-status');
    const required = [...form.querySelectorAll('[required]')];
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const isValid = (el) => {
      const value = el.value.trim();
      return el.type === 'email' ? emailRe.test(value) : value.length > 0;
    };
    const mark = (el, ok) => {
      const err = document.getElementById(el.getAttribute('aria-describedby'));
      el.setAttribute('aria-invalid', String(!ok));
      err.hidden = ok;
      err.textContent = ok ? '' : el.dataset.error;
    };
    required.forEach((el) => el.addEventListener('input', () => {
      if (el.getAttribute('aria-invalid') === 'true') mark(el, isValid(el));
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';
      const invalid = required.filter((el) => { const ok = isValid(el); mark(el, ok); return !ok; });
      if (invalid.length) { invalid[0].focus(); return; }
      if (form.elements.botcheck.checked) return;

      const button = form.querySelector('[type="submit"]');
      const label = button.querySelector('.btn-label');
      const original = label.textContent;
      button.disabled = true;
      label.textContent = 'Odesílám…';
      try {
        const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.message || String(res.status));
        form.reset();
        status.classList.add('is-ok');
        status.textContent = 'Děkuji, zpráva odešla. Ozvu se do dvou pracovních dnů.';
      } catch {
        status.classList.add('is-bad');
        status.textContent = 'Odeslání se nepovedlo. Zkuste to prosím za chvíli znovu.';
      } finally {
        button.disabled = false;
        label.textContent = original;
      }
    });
  }

  /* Efekt na nadpisu: WebGL2 deformace textu pod kurzorem.
     Text zůstává v DOM kvůli přístupnosti a vyhledávačům. Canvas má přesah
     (--mesh-bleed), takže deformace písmen na okrajích není oříznutá.
     Fyzika běží jen při pohybu kurzoru a dokud se síť neuklidní. */
  const title = document.getElementById('hero-title');
  const canvas = title && title.querySelector('.hero-mesh');
  if (title && canvas && !reduceMotion && matchMedia('(hover: hover) and (pointer: fine)').matches) initMesh(title, canvas);

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
    const COLOR_A = [0.651, 0.835, 0.137]; /* limetková ze značky */
    const COLOR_B = [0.42, 0.49, 0.56];    /* světlejší břidlicová */

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

    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

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
