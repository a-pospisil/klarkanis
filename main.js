/* klarkanis.cz
   Hlavička (linka průchodu, poloha v dokumentu), mobilní menu, odhalení
   bloků při scrollu, scénáře služeb, kontaktní formulář (Web3Forms).
   Scény řízené scrollem jsou ve scenes.js. */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hlavička: linka po odscrollování a 1px ukazatel průchodu stránkou */
  const header = document.querySelector('.site-header');
  const progress = header.querySelector('.scroll-line i');
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      header.classList.toggle('is-scrolled', scrollY > 4);
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--sp', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : '0');
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
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

  /* Poloha v dokumentu: index sekce v hlavičce a zvýraznění odkazu v navigaci */
  const sections = [...document.querySelectorAll('main [data-title]')];
  const posN = document.querySelector('.nav-pos-n');
  const posT = document.querySelector('.nav-pos-t');
  const posTotal = document.querySelector('.nav-pos-total');
  const navLinks = [...nav.querySelectorAll('.nav-link')];
  if (posTotal) posTotal.textContent = String(sections.length - 1).padStart(2, '0');
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const i = sections.indexOf(entry.target);
        if (posN) posN.textContent = String(i).padStart(2, '0');
        if (posT) posT.textContent = entry.target.dataset.title;
        navLinks.forEach((a) => {
          if (a.hash === '#' + entry.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* Hlavička ztmavne nad tmavými sekcemi (kontakt, patička); scénu „Z chaosu systém“ hlídá scenes.js */
  const darkEls = document.querySelectorAll('[data-dark]');
  if ('IntersectionObserver' in window && darkEls.length) {
    const under = new Set();
    const shade = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) under.add(entry.target); else under.delete(entry.target); });
      document.documentElement.classList.toggle('hdr-dark-contact', under.size > 0);
    }, { rootMargin: '0px 0px -96% 0px' });
    darkEls.forEach((el) => shade.observe(el));
  }

  /* Nadpis hero: odhalení řádků, jakmile jsou písma připravená */
  const heroTitle = document.getElementById('hero-title');
  const revealTitle = () => heroTitle && heroTitle.classList.add('is-in');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(revealTitle);
  setTimeout(revealTitle, 900);

  /* Odhalení bloků při scrollu; scénář služby se spustí s odhalením */
  const revealEls = document.querySelectorAll('[data-reveal],[data-align]');
  const show = (el) => {
    el.classList.add('is-in');
    const flow = el.querySelector('.flow');
    if (flow) flow.classList.add('is-run');
  };
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        show(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach(show);
  }

  /* Číslo služby: najetím se scénář vstup → proces → výstup přehraje znovu */
  document.querySelectorAll('.svc-n').forEach((n) => {
    n.addEventListener('mouseenter', () => {
      const flow = n.parentElement.querySelector('.flow');
      if (!flow || reduceMotion || !flow.classList.contains('is-run')) return;
      flow.classList.remove('is-run');
      void flow.offsetWidth;
      flow.classList.add('is-run');
    });
  });

  /* Výzva v kontaktu vede na formulář a zaměří první pole */
  const cta = document.querySelector('.cta-btn');
  if (cta) {
    cta.addEventListener('click', () => {
      const first = document.getElementById('f-name');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), reduceMotion ? 0 : 650);
    });
  }

  /* Vtipná poznámka o cookies (kterých web nemá) */
  const cookieJar = document.getElementById('cookie-jar');
  if (cookieJar) {
    const dismissed = (() => { try { return localStorage.getItem('cookie-jar-seen') === '1'; } catch { return false; } })();
    if (!dismissed) {
      cookieJar.hidden = false;
      setTimeout(() => cookieJar.classList.add('is-in'), reduceMotion ? 0 : 600);
    }
    cookieJar.querySelector('[data-cookie-dismiss]').addEventListener('click', () => {
      cookieJar.classList.remove('is-in');
      cookieJar.classList.add('is-gone');
      setTimeout(() => { cookieJar.hidden = true; }, reduceMotion ? 0 : 500);
      try { localStorage.setItem('cookie-jar-seen', '1'); } catch {}
    });
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
})();
