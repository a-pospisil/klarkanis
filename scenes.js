/* klarkanis.cz
   Scény řízené načtením a scrollem: třídění chaosu v hero, „Z chaosu vznikne
   systém“, mapa provozu v postupu a magnetická výzva. Bez závislostí.
   Hýbe se jen transform a opacity, výpočty běží v jednom requestAnimationFrame
   a jen když se scrolluje nebo když je scéna ve fázi chaosu. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffle = (arr, rnd) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();

  /* Společná smyčka: scény dostanou scrollY a výšku okna při scrollu a po změně rozměrů */
  const scenes = [];
  let queued = false;
  const tick = () => {
    queued = false;
    const y = scrollY;
    const vh = innerHeight;
    scenes.forEach((s) => s.update(y, vh));
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(tick);
  };
  const relayout = () => {
    scenes.forEach((s) => s.layout && s.layout());
    schedule();
  };
  addEventListener('scroll', schedule, { passive: true });
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(relayout, 90);
  });

  initSorter();
  initChaos();
  initProcess();
  initMagnetic();
  schedule();
  fontsReady.then(relayout);
  addEventListener('load', relayout);

  /* Hero: útržky provozu poletují v poli chaosu a po načtení se jeden po druhém
     zařadí do vrstev systému (FLIP na skryté zástupce v řádcích). Scroll dokreslí
     páteř systému; kdo scrolluje dřív, dostane třídění zrychleně. */
  function initSorter() {
    const sorter = document.querySelector('.sorter');
    if (!sorter) return;
    const hero = sorter.closest('.hero');
    const field = sorter.querySelector('.sorter-field');
    const chips = [...field.querySelectorAll('.chip')];
    const rows = [...sorter.querySelectorAll('.srow')];
    const decision = sorter.querySelector('.srow-out');
    const chaosCount = sorter.querySelector('.js-chaos-count');
    const systemCount = sorter.querySelector('.js-system-count');
    const docks = new Map([...sorter.querySelectorAll('.dock')].map((d) => [d.dataset.dock, d]));

    const items = chips.map((chip) => ({
      chip,
      dock: docks.get(chip.dataset.chip),
      fx: parseFloat(chip.style.getPropertyValue('--x')) / 100,
      fy: parseFloat(chip.style.getPropertyValue('--y')) / 100,
      rot: chip.style.getPropertyValue('--r').trim() || '0deg',
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      docked: false,
    }));
    const setCounts = () => {
      const left = items.filter((it) => !it.docked).length;
      chaosCount.textContent = `${left} ${plural(left, 'položka', 'položky', 'položek')}`;
      const active = rows.filter((r) => r.classList.contains('is-active')).length;
      systemCount.textContent = `${active} / 4 vrstvy`;
    };

    if (reduceMotion) {
      items.forEach((it) => { it.docked = true; });
      rows.forEach((r) => r.classList.add('is-active'));
      setCounts();
      return;
    }

    const place = (it) => {
      const p = it.docked ? it.to : it.from;
      it.chip.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${it.docked ? '0deg' : it.rot})`;
    };
    let lastW = 0;
    let lastH = 0;
    const layout = () => {
      const S = sorter.getBoundingClientRect();
      const F = field.getBoundingClientRect();
      items.forEach((it) => {
        const D = it.dock.getBoundingClientRect();
        it.from.x = F.left - S.left + (F.width - it.chip.offsetWidth) * it.fx;
        it.from.y = F.top - S.top + (F.height - it.chip.offsetHeight) * it.fy;
        it.to.x = D.left - S.left;
        it.to.y = D.top - S.top;
      });
      sorter.classList.add('no-t');
      items.forEach(place);
      void sorter.offsetWidth;
      sorter.classList.remove('no-t');
      lastW = S.width;
      lastH = S.height;
    };
    const dockOne = (it) => {
      if (it.docked) return;
      it.docked = true;
      place(it);
      it.chip.classList.remove('is-chaos');
      it.chip.classList.add('is-docked');
      it.dock.closest('.srow').classList.add('is-active');
      setCounts();
    };
    const timers = [];
    let started = false;
    const run = (stagger) => {
      if (started) return;
      started = true;
      timers.forEach(clearTimeout);
      items.forEach((it, i) => timers.push(setTimeout(() => dockOne(it), i * stagger)));
      timers.push(setTimeout(() => { decision.classList.add('is-active'); setCounts(); }, items.length * stagger + 600));
    };

    fontsReady.then(() => {
      layout();
      chips.forEach((c, i) => timers.push(setTimeout(() => c.classList.add('is-on'), 150 + i * 70)));
      timers.push(setTimeout(() => run(170), 1650));
    });
    new ResizeObserver(() => {
      const r = sorter.getBoundingClientRect();
      if (Math.abs(r.width - lastW) > 1 || Math.abs(r.height - lastH) > 1) layout();
    }).observe(sorter);

    scenes.push({
      update(y) {
        const p = clamp(y / Math.max(1, hero.offsetHeight * 0.55), 0, 1);
        if (p > 0.03) run(60);
        sorter.style.setProperty('--sp', p.toFixed(3));
      },
    });
  }

  /* Z chaosu vznikne systém: 24 útržků (na mobilu 12) ve třech stavech.
     S0 chaos: rozhozené, natočené, lehce plují a uhýbají kurzoru.
     S1 struktura: řádky podle druhu (data, workflow, reporting, decision), spoje.
     S2 systém: na desktopu sloupce jako tok dat → workflow → reporting → decision
     v jednom rámu, na mobilu totéž po řádcích shora dolů. Scroll řídí průběh (p). */
  function initChaos() {
    const track = document.querySelector('[data-scene="chaos"]');
    if (!track) return;
    const stage = track.querySelector('.scene-stage');
    const copy = track.querySelector('.scene-copy');
    const field = track.querySelector('.scene-field');
    const svg = field.querySelector('.scene-links');
    const frame = field.querySelector('.sys-frame');
    const frameCount = field.querySelector('.js-frame-count');
    const roPhase = track.querySelector('.js-ro-phase');
    const roBar = track.querySelector('.js-ro-bar');
    const roPct = track.querySelector('.js-ro-pct');
    const CATS = ['data', 'workflow', 'reporting', 'decision'];
    const NS = 'http://www.w3.org/2000/svg';
    const rnd = seeded(20260911);

    const items = [...field.querySelectorAll('.frag')].map((el) => ({
      el,
      cat: el.dataset.cat,
      ci: CATS.indexOf(el.dataset.cat),
      onMobile: el.dataset.m === '1',
      d: rnd(),
      rot: (rnd() * 2 - 1) * 14,
      sc: 0.88 + rnd() * 0.2,
      ph: rnd() * Math.PI * 2,
      fr: 0.5 + rnd() * 0.5,
      jx: rnd(),
      jy: rnd(),
      k: 0,
      s0: { x: 0, y: 0 },
      s1: { x: 0, y: 0 },
      s2: { x: 0, y: 0 },
      clean: false,
    }));
    const labels = [...field.querySelectorAll('.rl')].map((el) => ({ el, ci: CATS.indexOf(el.dataset.cat), a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }));
    const heads = [...field.querySelectorAll('.ch')].map((el) => ({ el, ci: CATS.indexOf(el.dataset.cat) }));

    let W = 0;
    let H = 0;
    let fw = 150;
    let fh = 56;
    let mobile = false;
    let act = [];
    let paths = [];
    let s2scale = 0.9;
    let trackTop = 0;
    let trackH = 0;
    let p = -1;
    let visible = false;
    let raf = 0;
    let phase = '';
    let lastPct = -1;
    const pointer = { x: -1e4, y: -1e4 };

    const layout = () => {
      const r = field.getBoundingClientRect();
      W = r.width;
      H = r.height;
      const tr = track.getBoundingClientRect();
      trackTop = tr.top + scrollY;
      trackH = tr.height;
      mobile = W < 720;
      act = items.filter((it) => !mobile || it.onMobile);
      items.forEach((it) => it.el.classList.toggle('is-off', !act.includes(it)));
      fw = act[0].el.offsetWidth;
      fh = act[0].el.offsetHeight;
      const per = act.length / CATS.length;

      /* S0: rozhozená mřížka s náhodným posunem, aby se útržky nepřekrývaly do nečitelnosti */
      const cols = mobile ? 3 : 6;
      const rows = Math.ceil(act.length / cols);
      const cw = W / cols;
      const ch = H / rows;
      const slots = shuffle(act.map((_, i) => i), seeded(11));
      act.forEach((it, i) => {
        const s = slots[i];
        it.s0.x = (s % cols) * cw + (cw - fw) * (0.08 + 0.84 * it.jx);
        it.s0.y = Math.floor(s / cols) * ch + (ch - fh) * (0.08 + 0.84 * it.jy);
      });

      /* S1: řádky podle druhu */
      const gx = mobile ? 8 : 14;
      const gy = mobile ? 24 : 14;
      const labelW = mobile ? 0 : 124;
      const g1w = per * fw + (per - 1) * gx;
      const g1h = CATS.length * fh + (CATS.length - 1) * gy;
      const g1x = (W - g1w + labelW) / 2;
      const g1y = (H - g1h) / 2 + (mobile ? 10 : 0);
      const idx = [0, 0, 0, 0];
      act.forEach((it) => {
        it.k = idx[it.ci]++;
        it.s1.x = g1x + it.k * (fw + gx);
        it.s1.y = g1y + it.ci * (fh + gy);
      });

      /* S2: rám systému */
      let fr = { x: 0, y: 0, w: 0, h: 0 };
      const headH = 40;
      if (!mobile) {
        s2scale = 0.9;
        const cw2 = fw * s2scale;
        const ch2 = fh * s2scale;
        const g2 = 12;
        const g2w = CATS.length * cw2 + (CATS.length - 1) * g2;
        const g2h = per * ch2 + (per - 1) * g2;
        const g2x = W - g2w - 32;
        const g2y = (H - g2h) / 2 + 30;
        act.forEach((it) => {
          it.s2.x = g2x + it.ci * (cw2 + g2) - (fw - cw2) / 2;
          it.s2.y = g2y + it.k * (ch2 + g2) - (fh - ch2) / 2;
        });
        heads.forEach((h) => { h.el.style.transform = `translate3d(${(g2x + h.ci * (cw2 + g2)).toFixed(1)}px,${(g2y - 28).toFixed(1)}px,0)`; });
        labels.forEach((l) => {
          const rowY = g1y + l.ci * (fh + gy);
          l.a.x = g1x - l.el.offsetWidth - 20;
          l.a.y = rowY + fh / 2 - l.el.offsetHeight / 2;
          l.b.x = l.a.x;
          l.b.y = l.a.y;
        });
        fr = { x: g2x - 22, y: g2y - 28 - headH - 4, w: g2w + 44, h: g2h + 28 + headH + 4 + 22 };
      } else {
        const copyH = copy.offsetHeight;
        const top2 = copyH + 68;
        const avail = H - top2 - 6;
        s2scale = clamp(avail / g1h, 0.6, 1);
        const gw2 = g1w * s2scale;
        const left2 = g1x + (g1w - gw2) / 2;
        act.forEach((it) => {
          const L = left2 + (it.s1.x - g1x) * s2scale;
          const T = top2 + (it.s1.y - g1y) * s2scale;
          it.s2.x = L - (fw - fw * s2scale) / 2;
          it.s2.y = T - (fh - fh * s2scale) / 2;
        });
        labels.forEach((l) => {
          const rowY = g1y + l.ci * (fh + gy);
          l.a.x = g1x;
          l.a.y = rowY - 19;
          l.b.x = left2;
          l.b.y = top2 + l.ci * (fh + gy) * s2scale - 19;
        });
        fr = { x: left2 - 10, y: top2 - 22 - headH, w: gw2 + 20, h: g1h * s2scale + 22 + headH + 10 };
      }
      frame.style.transform = `translate3d(${fr.x.toFixed(1)}px,${fr.y.toFixed(1)}px,0)`;
      frame.style.width = `${fr.w.toFixed(1)}px`;
      frame.style.height = `${fr.h.toFixed(1)}px`;
      frameCount.textContent = `${act.length} záznamů`;

      /* Spoje ve struktuře: kmen a linka každého řádku */
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.innerHTML = '';
      paths = [];
      const trunkX = g1x - (mobile ? 4 : 10);
      const rowsY = CATS.map((_, ci) => g1y + ci * (fh + gy) + fh / 2);
      const addPath = (d) => {
        const el = document.createElementNS(NS, 'path');
        el.setAttribute('d', d);
        el.setAttribute('pathLength', '1');
        svg.appendChild(el);
        paths.push(el);
      };
      addPath(`M${trunkX} ${rowsY[0]}V${rowsY[rowsY.length - 1]}`);
      rowsY.forEach((yy) => addPath(`M${trunkX} ${yy}H${g1x + g1w - fw / 2}`));
    };

    const setPhase = (t) => { if (t !== phase) { phase = t; roPhase.textContent = t; } };
    const apply = (now) => {
      const chaosK = 1 - smooth(clamp(p / 0.14, 0, 1));
      const t = now / 1000;
      const usePointer = finePointer && chaosK > 0 && pointer.x > -1e3;
      act.forEach((it) => {
        const t1 = easeInOut(clamp((p - 0.12 - it.d * 0.18) / 0.26, 0, 1));
        const t2 = easeInOut(clamp((p - 0.66 - it.d * 0.1) / 0.18, 0, 1));
        let x = lerp(it.s0.x, it.s1.x, t1);
        let y = lerp(it.s0.y, it.s1.y, t1);
        let r = it.rot * (1 - t1);
        let s = lerp(it.sc, 1, t1);
        if (t2 > 0) {
          x = lerp(x, it.s2.x, t2);
          y = lerp(y, it.s2.y, t2);
          s = lerp(s, s2scale, t2);
        }
        if (chaosK > 0) {
          x += Math.sin(t * it.fr + it.ph) * 7 * chaosK;
          y += Math.cos(t * it.fr * 0.8 + it.ph) * 6 * chaosK;
          r += Math.sin(t * 0.6 + it.ph) * 1.6 * chaosK;
          if (usePointer) {
            const dx = x + fw / 2 - pointer.x;
            const dy = y + fh / 2 - pointer.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 240) {
              const push = (1 - dist / 240) * 24 * chaosK;
              x += (dx / dist) * push;
              y += (dy / dist) * push;
            }
          }
        }
        it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
        const clean = t1 > 0.5;
        if (clean !== it.clean) {
          it.clean = clean;
          it.el.classList.toggle('is-clean', clean);
        }
      });

      const draw = clamp((p - 0.5) / 0.12, 0, 1);
      const fade = 1 - clamp((p - 0.66) / 0.1, 0, 1);
      paths.forEach((el) => {
        el.style.strokeDashoffset = (1 - draw).toFixed(3);
        el.style.opacity = (draw > 0 ? fade : 0).toFixed(3);
      });

      const tl = easeInOut(clamp((p - 0.66) / 0.24, 0, 1));
      const labelOn = clamp((p - 0.42) / 0.1, 0, 1) * (mobile ? 1 : fade);
      labels.forEach((l) => {
        l.el.style.opacity = labelOn.toFixed(3);
        l.el.style.transform = `translate3d(${lerp(l.a.x, l.b.x, tl).toFixed(1)}px,${lerp(l.a.y, l.b.y, tl).toFixed(1)}px,0)`;
      });
      const headOn = mobile ? 0 : clamp((p - 0.88) / 0.08, 0, 1);
      heads.forEach((h) => { h.el.style.opacity = headOn.toFixed(3); });

      stage.classList.toggle('is-going', p > 0.03);
      stage.classList.toggle('is-final', p > 0.8);
      stage.classList.toggle('is-light', p > 0.84);
      setPhase(p < 0.12 ? 'Fáze 01 · chaos' : p < 0.64 ? 'Fáze 02 · struktura' : 'Fáze 03 · systém');
      const pct = Math.round(p * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        roPct.textContent = `${pct} %`;
        roBar.style.setProperty('--v', (Math.round(p * 10) / 10).toFixed(1));
      }
    };

    /* Ve fázi chaosu útržky plují, smyčka běží jen dokud je scéna vidět */
    const loop = (now) => {
      raf = 0;
      if (!visible || p >= 0.14 || document.hidden) return;
      apply(now);
      raf = requestAnimationFrame(loop);
    };
    const sync = () => {
      const run = visible && p < 0.14 && !reduceMotion && !document.hidden;
      if (run && !raf) raf = requestAnimationFrame(loop);
      if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    document.addEventListener('visibilitychange', sync);
    if (finePointer) {
      field.addEventListener('pointermove', (e) => {
        const r = field.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
      });
      field.addEventListener('pointerleave', () => { pointer.x = -1e4; pointer.y = -1e4; });
    }

    scenes.push({
      layout() { layout(); apply(performance.now()); },
      update(y, vh) {
        const np = reduceMotion ? 1 : clamp((y - trackTop) / Math.max(1, trackH - vh), 0, 1);
        visible = y + vh > trackTop && y < trackTop + trackH;
        if (np !== p) {
          p = np;
          apply(performance.now());
        }
        const underHeader = y + 40 >= trackTop && y + 40 < trackTop + trackH;
        document.documentElement.classList.toggle('hdr-dark-scene', underHeader && !stage.classList.contains('is-light'));
        sync();
      },
    });
    layout();
    p = reduceMotion ? 1 : 0;
    apply(performance.now());
  }

  /* Postup: mapa provozu se přepíná podle kroku, který je právě uprostřed okna */
  function initProcess() {
    const section = document.querySelector('.process');
    if (!section) return;
    const board = section.querySelector('.pboard');
    const steps = [...section.querySelectorAll('.pstep')];
    const state = section.querySelector('.js-pstate');
    const logs = [...section.querySelectorAll('.plog li')];
    const hubVersion = section.querySelector('.js-hub-ver');
    const LABELS = ['', 'krok 1/4 · poznávám', 'krok 2/4 · navrhuji', 'krok 3/4 · stavím', 'krok 4/4 · spravuji'];
    let tops = [];
    let current = 0;
    const setStep = (n) => {
      if (n === current) return;
      current = n;
      board.dataset.step = String(n);
      steps.forEach((s) => s.classList.toggle('is-active', +s.dataset.step === n));
      state.textContent = LABELS[n];
      logs.forEach((l) => l.classList.toggle('is-on', +l.dataset.s <= n));
      hubVersion.textContent = n >= 4 ? 'v1.3' : 'v1.0';
    };
    const layout = () => { tops = steps.map((s) => s.getBoundingClientRect().top + scrollY); };
    scenes.push({
      layout,
      update(y, vh) {
        const line = y + vh * 0.5;
        let n = 1;
        tops.forEach((t, i) => { if (line >= t) n = i + 1; });
        setStep(n);
      },
    });
    layout();
    setStep(1);
  }

  /* Výzva v kontaktu: tlačítko se v dosahu kurzoru přitáhne k němu */
  function initMagnetic() {
    const btn = document.querySelector('[data-magnetic]');
    if (!btn || !finePointer || reduceMotion) return;
    const zone = btn.parentElement;
    let active = false;
    zone.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const reachX = r.width * 0.85;
      const reachY = r.height * 2.2;
      if (Math.abs(dx) < reachX && Math.abs(dy) < reachY) {
        if (!active) { active = true; btn.classList.add('is-tracking'); }
        btn.style.transform = `translate3d(${(dx * 0.2).toFixed(1)}px,${(dy * 0.2).toFixed(1)}px,0)`;
      } else if (active) {
        active = false;
        btn.classList.remove('is-tracking');
        btn.style.transform = '';
      }
    });
    zone.addEventListener('pointerleave', () => {
      active = false;
      btn.classList.remove('is-tracking');
      btn.style.transform = '';
    });
  }
})();
