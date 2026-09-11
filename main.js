/* klarkanis.cz
   Hlavička, mobilní menu, aktivní sekce, odhalení při scrollu,
   kontaktní formulář (Web3Forms). Efekty v hero sekci jsou v hero-effects.js. */
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
})();
