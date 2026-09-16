/* AMORA — интерактив: плавный скролл, переходы, формы */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

  if (!hasGsap) {
    // Библиотеки не загрузились — показываем сайт без анимаций
    document.body.classList.remove('is-loading');
    $('.loader')?.remove();
    initForms(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Плавный скролл ---------- */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  window.amoraLenis = lenis;

  const scrollToTarget = (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  };

  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href.length < 2) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(href === '#top' ? document.body : href);
    });
  });

  /* ---------- Прелоадер и вход ---------- */
  const loader = $('.loader');
  const countEl = $('[data-count]');
  const counter = { v: 0 };

  const heroLines = $$('.hero__title .line__in');
  const heroFades = $$('[data-hero-fade]');
  gsap.set(heroLines, { yPercent: 110, rotate: 4 });
  gsap.set(heroFades, { y: 30, opacity: 0 });
  gsap.set('.header', { yPercent: -120 });

  const intro = gsap.timeline({ paused: true });
  intro
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' })
    .add(() => {
      document.body.classList.remove('is-loading');
      lenis?.start();
      window.dispatchEvent(new CustomEvent('amora:ready'));
    }, '-=0.6')
    .to(heroLines, { yPercent: 0, rotate: 0, duration: 1.3, stagger: .1, ease: 'expo.out' }, '-=0.55')
    .to('.header', { yPercent: 0, duration: 1, ease: 'expo.out' }, '<0.2')
    .to(heroFades, { y: 0, opacity: 1, duration: 1, stagger: .08, ease: 'expo.out' }, '<0.15')
    .add(() => loader.remove());

  gsap.set(loader, { clipPath: 'inset(0 0 0% 0)' });
  const loadTween = gsap.to(counter, {
    v: 90, duration: reduced ? .2 : .7, ease: 'power2.out',
    onUpdate: () => (countEl.textContent = Math.round(counter.v))
  });
  const finishLoading = () => {
    loadTween.kill();
    gsap.to(counter, {
      v: 100, duration: .35, ease: 'power1.out',
      onUpdate: () => (countEl.textContent = Math.round(counter.v)),
      onComplete: () => intro.play()
    });
  };
  const minTime = new Promise(r => setTimeout(r, reduced ? 100 : 700));
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  // не ждём картинки и 3D — только шрифты, максимум 1,5 с
  Promise.all([minTime, Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))])]).then(finishLoading);

  /* ---------- Смена темы между блоками ---------- */
  const setTheme = (t) => {
    document.body.classList.toggle('theme-light', t === 'light');
    document.body.classList.toggle('theme-accent', t === 'accent');
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = t === 'light' ? '#f2ece3' : t === 'accent' ? '#ff3d2e' : '#0f0e0d';
  };
  $$('[data-theme]').forEach(sec => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: self => self.isActive && setTheme(sec.dataset.theme)
    });
  });

  /* ---------- Шапка ---------- */
  const header = $('[data-header]');
  let lastY = 0;
  const onScrollHeader = (y) => {
    header.classList.toggle('is-scrolled', y > 40);
    const menuOpen = $('[data-menu]').classList.contains('is-open');
    if (!menuOpen) header.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScrollHeader(scroll));
  else addEventListener('scroll', () => onScrollHeader(scrollY), { passive: true });

  /* ---------- Мобильное меню ---------- */
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  function closeMenu() {
    if (!menu.classList.contains('is-open')) return;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    lenis?.start();
  }
  burger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    if (!open) return closeMenu();
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    header.classList.remove('is-hidden');
    lenis?.stop();
    gsap.fromTo($$('.menu__nav a'), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .06, duration: .9, delay: .15, ease: 'expo.out' });
  });

  /* ---------- Разбивка текста на слова ---------- */
  const splitWords = (el, wrapClass) => {
    const walk = (node) => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p.includes(' ') ? ' ' : ' ')); return; }
            // неразрывные пробелы оставляем внутри слова
            const outer = document.createElement('span');
            outer.className = wrapClass;
            if (wrapClass === 'split-word') {
              const inner = document.createElement('span');
              inner.textContent = p;
              outer.appendChild(inner);
            } else outer.textContent = p;
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
  };

  $$('[data-split]').forEach(el => {
    splitWords(el, 'split-word');
    if (reduced) return;
    gsap.from($$('.split-word > span', el), {
      yPercent: 105, rotate: 3, duration: 1.2, stagger: .06, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%' }
    });
  });

  $$('[data-scrub-text]').forEach(el => {
    splitWords(el, 'w');
    if (reduced) return;
    gsap.to($$('.w', el), {
      opacity: 1, stagger: .1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
    });
  });

  if (!reduced) {
    const perks = $('[data-perks]');
    if (perks) {
      const tl = gsap.timeline({ scrollTrigger: { trigger: perks, start: 'top 82%' } });
      tl.from(perks, { clipPath: 'inset(0 0 100% 0 round 32px)', duration: 1.2, ease: 'expo.inOut' })
        .from($$('.perk__icon', perks), { scale: .4, rotateY: -120, opacity: 0, duration: 1.1, stagger: .1, ease: 'back.out(1.6)', clearProps: 'transform,opacity' }, '-=0.6')
        .from($$('.perk__num', perks), { yPercent: 60, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out' }, '<')
        .from($$('.perk__title, .perk__text', perks), { y: 24, opacity: 0, duration: .9, stagger: .06, ease: 'expo.out' }, '<0.15');
    }

    $$('[data-reveal]').forEach(el => {
      gsap.from(el, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
    });

    $$('[data-reveal-img]').forEach(el => {
      gsap.fromTo(el, { clipPath: 'inset(18% 12% 18% 12% round 28px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: true }
      });
    });

    $$('[data-parallax]').forEach(img => {
      gsap.fromTo(img, { yPercent: 0 }, {
        yPercent: parseFloat(img.dataset.parallax), ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------- Бегущая строка с ускорением от скролла ---------- */
  const track = $('[data-marquee]');
  if (track) {
    track.innerHTML += track.innerHTML;
    let x = 0, speed = 1, velBoost = 0;
    if (lenis) lenis.on('scroll', ({ velocity }) => (velBoost = gsap.utils.clamp(-40, 40, velocity)));
    gsap.ticker.add((t, dt) => {
      if (reduced) return;
      velBoost *= 0.92;
      const half = track.scrollWidth / 2;
      x -= (speed + Math.abs(velBoost) * 0.35) * (dt / 16.67);
      if (-x >= half) x += half;
      track.style.transform = `translate3d(${x}px,0,0)`;
    });
  }

  /* ---------- «Мы любим свою работу» ---------- */
  const love = $('[data-love]');
  if (love && !reduced) {
    const words = $$('.love__row > span', love);
    const tl = gsap.timeline({ scrollTrigger: { trigger: love, start: 'top top', end: 'bottom bottom', scrub: 1 } });
    tl.from('.love__kicker', { opacity: 0, y: 20, duration: .3 })
      .from(words, { yPercent: 120, opacity: 0, rotateX: -70, transformOrigin: '50% 100%', stagger: .12, duration: .6, ease: 'power3.out' }, '<')
      .from('.love__heart', { scale: 0, rotate: -40, duration: .5, ease: 'back.out(2)' }, '-=0.3')
      .to('.love__title', { scale: 1.04, duration: .6 })
      .to('.love__sticky', { opacity: 0.15, duration: .3 });
  }

  /* ---------- Услуги: горизонтальный 3D-скролл / стопка на мобильных ---------- */
  const mm = gsap.matchMedia();
  const pin = $('[data-services-pin]');
  const sTrack = $('[data-services-track]');
  const cards = $$('[data-card]');
  const progressBar = $('[data-services-progress]');

  mm.add('(min-width: 901px)', () => {
    if (reduced) {
      sTrack.style.width = 'auto'; sTrack.style.flexWrap = 'wrap';
      return () => { sTrack.style.width = ''; sTrack.style.flexWrap = ''; };
    }
    const dist = () => Math.max(0, sTrack.scrollWidth - innerWidth);
    const updateCards = () => {
      const cx = innerWidth / 2;
      cards.forEach(card => {
        const r = card.getBoundingClientRect();
        const d = (r.left + r.width / 2 - cx) / innerWidth; // -1..1
        const rot = gsap.utils.clamp(-28, 28, d * -34);
        const z = -Math.abs(d) * 180;
        card.style.transform = `translate3d(0,${Math.abs(d) * 30}px,${z}px) rotateY(${rot}deg)`;
      });
    };
    const tween = gsap.to(sTrack, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: pin, start: 'top top', end: () => '+=' + dist() * 1.1, pin: true, scrub: 1, refreshPriority: 1,
        invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: self => { progressBar.style.transform = `scaleX(${self.progress})`; }
      },
      onUpdate: updateCards
    });
    updateCards();
    return () => { tween.kill(); cards.forEach(c => (c.style.transform = '')); };
  });

  mm.add('(max-width: 900px)', () => {
    if (reduced) return;
    const tweens = cards.slice(0, -1).map((card, i) =>
      gsap.fromTo(card.firstElementChild, { scale: 1, filter: 'brightness(1)' }, {
        scale: .9, filter: 'brightness(0.82)', ease: 'none', transformOrigin: '50% 0%',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 20%', scrub: true }
      })
    );
    return () => tweens.forEach(t => t.kill());
  });

  /* ---------- Буквы в подвале ---------- */
  if (!reduced) {
    gsap.from('[data-footer-word] span', {
      yPercent: 70, rotateX: -80, opacity: 0, stagger: .08, ease: 'power3.out',
      scrollTrigger: { trigger: '[data-footer-word]', start: 'top 100%', end: 'bottom 90%', scrub: 1 }
    });
  }

  /* ---------- 3D-наклон карточек ---------- */
  if (finePointer && !reduced) {
    $$('[data-tilt]').forEach(el => {
      const max = el.classList.contains('card__inner') ? 7 : 10;
      const qx = gsap.quickTo(el, 'rotateX', { duration: .6, ease: 'power3.out' });
      const qy = gsap.quickTo(el, 'rotateY', { duration: .6, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        qy((px - .5) * max * 2);
        qx((.5 - py) * max * 2);
        el.style.setProperty('--mx', px * 100 + '%');
        el.style.setProperty('--my', py * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });

    /* Преимущества: 3D-иконка и подсветка следуют за курсором */
    $$('.perk').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--px', (px - .5).toFixed(3));
        el.style.setProperty('--py', (py - .5).toFixed(3));
        el.style.setProperty('--mx', px * 100 + '%');
        el.style.setProperty('--my', py * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--px', 0); el.style.setProperty('--py', 0); });
    });

    /* Магнитные кнопки */
    $$('.btn--magnetic').forEach(btn => {
      const qx = gsap.quickTo(btn, 'x', { duration: .5, ease: 'power3.out' });
      const qy = gsap.quickTo(btn, 'y', { duration: .5, ease: 'power3.out' });
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        qx((e.clientX - r.left - r.width / 2) * .25);
        qy((e.clientY - r.top - r.height / 2) * .35);
      });
      btn.addEventListener('pointerleave', () => { qx(0); qy(0); });
    });

    /* Курсор */
    const cursor = $('.cursor');
    const dot = $('.cursor__dot'), ring = $('.cursor__ring');
    const dx = gsap.quickTo(dot, 'x', { duration: .1 }), dy = gsap.quickTo(dot, 'y', { duration: .1 });
    const rx = gsap.quickTo(ring, 'x', { duration: .45, ease: 'power3.out' }), ry = gsap.quickTo(ring, 'y', { duration: .45, ease: 'power3.out' });
    addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('a, button, input, textarea, select, label, [data-tilt]');
      cursor.classList.toggle('is-hover', !!t);
    });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
  }

  /* ---------- Формы и модалка ---------- */
  initForms({ lenis, scrollToTarget });

  // пересчёт после загрузки картинок
  // триггеры созданы не сверху вниз — сортируем с учётом закрепления блока услуг
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  addEventListener('load', () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });

  function initForms(ctx) {
    const lenisRef = ctx?.lenis;

    /* Маска телефона */
    $$('[data-phone]').forEach(input => {
      const format = (v) => {
        let d = v.replace(/\D/g, '');
        if (d.startsWith('8')) d = '7' + d.slice(1);
        if (!d.startsWith('7')) d = '7' + d;
        d = d.slice(0, 11);
        const p = d.slice(1);
        let out = '+7';
        if (p.length) out += ' (' + p.slice(0, 3);
        if (p.length >= 3) out += ')';
        if (p.length > 3) out += ' ' + p.slice(3, 6);
        if (p.length > 6) out += '-' + p.slice(6, 8);
        if (p.length > 8) out += '-' + p.slice(8, 10);
        return out;
      };
      input.addEventListener('input', () => {
        if (input.value.replace(/\D/g, '') === '' ) { input.value = ''; return; }
        input.value = format(input.value);
      });
      input.addEventListener('focus', () => { if (!input.value) input.value = '+7 ('; });
      input.addEventListener('blur', () => { if (input.value.replace(/\D/g, '').length <= 1) input.value = ''; });
    });

    const validate = (form) => {
      let ok = true;
      $$('.field', form).forEach(f => {
        const input = f.querySelector('input, textarea');
        if (!input || input.closest('[hidden]')) return;
        let valid = true;
        if (input.hasAttribute('data-phone')) valid = input.value.replace(/\D/g, '').length === 11;
        else if (input.type === 'email') valid = !input.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
        else if (input.required) valid = input.value.trim().length >= (+input.getAttribute('minlength') || 1);
        f.classList.toggle('is-invalid', !valid);
        if (!valid && ok) { input.focus({ preventScroll: true }); ok = false; }
      });
      const consent = form.querySelector('[name="consent"]');
      if (consent && !consent.checked) { ok = false; consent.parentElement.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], 300); }
      return ok;
    };

    $$('.field input, .field textarea').forEach(i => i.addEventListener('input', () => i.closest('.field').classList.remove('is-invalid')));

    const send = async (form) => {
      const data = new FormData(form);
      // не отправляем поля из скрытой вкладки
      $$('[hidden] [name]', form).forEach(el => data.delete(el.name));
      const services = data.getAll('service');
      data.delete('service');
      if (services.length) data.append('service', services.join(', '));

      // Netlify Forms (если сайт размещён на Netlify)
      if (/netlify\.app$/.test(location.hostname) || window.AMORA_NETLIFY) {
        try {
          const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
          if (res.ok) return;
          console.warn('Netlify Forms не включены в настройках проекта — заявка сохранена локально');
        } catch (e) { /* сеть недоступна — сохраняем локально */ }
      }
      // Внешний обработчик, если задан
      if (window.AMORA_FORM_ENDPOINT) {
        const res = await fetch(window.AMORA_FORM_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
        if (!res.ok) throw new Error('Ошибка отправки');
        return;
      }
      // Демо-режим: сохраняем заявку в браузере
      await new Promise(r => setTimeout(r, 900));
      try {
        const list = JSON.parse(localStorage.getItem('amora-requests') || '[]');
        list.push({ ...Object.fromEntries(data), date: new Date().toISOString() });
        localStorage.setItem('amora-requests', JSON.stringify(list));
      } catch (e) { /* хранилище недоступно */ }
    };

    $$('[data-form]').forEach(form => {
      const card = form.parentElement;
      const success = card.querySelector('[data-success]');
      const btn = form.querySelector('[data-submit]');
      const lbl = form.querySelector('[data-submit-label]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validate(form)) return;
        const orig = lbl.textContent;
        btn.classList.add('is-loading'); lbl.textContent = 'Отправляем…';
        try {
          await send(form);
          form.hidden = true;
          const tabs = card.querySelector('.tabs'); if (tabs) tabs.hidden = true;
          success.hidden = false;
          if (window.gsap) gsap.from(success.children, { y: 24, opacity: 0, stagger: .07, duration: .8, ease: 'expo.out' });
          form.reset();
        } catch (err) {
          lbl.textContent = 'Не удалось. Позвоните нам';
          setTimeout(() => (lbl.textContent = orig), 3000);
        } finally {
          btn.classList.remove('is-loading');
          if (lbl.textContent === 'Отправляем…') lbl.textContent = orig;
        }
      });
    });

    $$('[data-success-reset]').forEach(b => b.addEventListener('click', () => {
      const card = b.closest('.form-card');
      card.querySelector('[data-success]').hidden = true;
      card.querySelector('form').hidden = false;
      card.querySelector('.tabs').hidden = false;
    }));

    /* Вкладки: заказ / звонок */
    const tabs = $('.tabs');
    const orderForm = $('.form-card [data-form]');
    const setTab = (name) => {
      const call = name === 'call';
      tabs.classList.toggle('is-call', call);
      $$('[data-tab]', tabs).forEach(b => { const a = b.dataset.tab === name; b.classList.toggle('is-active', a); b.setAttribute('aria-selected', a); });
      $$('.order-only', orderForm).forEach(el => (el.hidden = call));
      $$('.call-only', orderForm).forEach(el => (el.hidden = !call));
      $('[data-form-type]', orderForm).value = call ? 'Заказать звонок' : 'Предварительный заказ';
      $('[data-submit-label]', orderForm).textContent = call ? 'Заказать звонок' : 'Отправить заказ';
    };
    $$('[data-tab]', tabs).forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

    /* Кнопки «Заказать» в карточках услуг */
    $$('[data-order]').forEach(b => b.addEventListener('click', () => {
      setTab('order');
      const card = $('.form-card');
      card.querySelector('[data-success]').hidden = true;
      orderForm.hidden = false; tabs.hidden = false;
      $$('input[name="service"]', orderForm).forEach(c => (c.checked = c.value === b.dataset.order));
      if (ctx?.scrollToTarget) ctx.scrollToTarget('#order'); else $('#order').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => $('#f-name').focus({ preventScroll: true }), 1400);
    }));

    /* Модалка обратного звонка */
    const modal = $('[data-modal]');
    let lastFocus = null;
    const openModal = () => {
      lastFocus = document.activeElement;
      const f = modal.querySelector('form'); const s = modal.querySelector('[data-success]');
      f.hidden = false; s.hidden = true;
      modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
      lenisRef?.stop();
      setTimeout(() => $('#m-name').focus(), 300);
    };
    const closeModal = () => {
      modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
      lenisRef?.start();
      lastFocus?.focus?.({ preventScroll: true });
    };
    $$('[data-open-callback]').forEach(b => b.addEventListener('click', openModal));
    $$('[data-close-modal]', modal).forEach(b => b.addEventListener('click', closeModal));
    addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
  }
})();
