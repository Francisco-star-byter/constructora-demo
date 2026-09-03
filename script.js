/* =========================================================
   PÓRTICO CONSTRUCTORA — script.js
   JavaScript vanilla. Sin dependencias.

   Un único listener de scroll alimenta un bucle
   requestAnimationFrame compartido (rAFLoop) para evitar
   layout thrashing. Cada módulo registra un "ticker".
   ========================================================= */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionOK = function () { return !reduced.matches; };

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };

  /* ─────────────────────────────────────────────────────
     BUCLE COMPARTIDO
     ───────────────────────────────────────────────────── */
  var tickers = [];
  var running = false;
  var scrollY = window.scrollY || 0;
  var vh = window.innerHeight;
  var vw = window.innerWidth;

  function addTicker(fn) { tickers.push(fn); }

  function frame() {
    running = false;
    for (var i = 0; i < tickers.length; i++) tickers[i](scrollY, vh);
  }

  function request() {
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  window.addEventListener('scroll', function () {
    scrollY = window.scrollY;
    request();
  }, { passive: true });

  var resizers = [];
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      vh = window.innerHeight;
      vw = window.innerWidth;
      for (var i = 0; i < resizers.length; i++) resizers[i]();
      request();
    }, 150);
  }, { passive: true });

  function addResizer(fn) { resizers.push(fn); fn(); }

  /* Cachea posición y alto de un elemento: se lee en el arranque y en
     cada resize, nunca dentro del bucle de scroll. */
  function metrics(el) {
    var m = { top: 0, height: 0 };
    addResizer(function () {
      var r = el.getBoundingClientRect();
      m.top = r.top + (window.scrollY || 0);
      m.height = el.offsetHeight;
    });
    window.addEventListener('load', function () {
      var r = el.getBoundingClientRect();
      m.top = r.top + (window.scrollY || 0);
      m.height = el.offsetHeight;
      request();
    });
    return m;
  }

  /* Llama a fn() en el momento en que el elemento acaba de salir entero de
     la pantalla. Lo usan los dos acordeones —Servicios y Preguntas— para
     volver solos a su estado cerrado.

     Es importante que dispare por transición y no por estado: los enlaces
     de servicios del pie abren un panel con la sección todavía fuera de
     vista, y si esto reaccionara al estado, ese panel se cerraría antes de
     que el scroll llegara a mostrarlo. Al mirar solo el cambio, la sección
     ya estaba fuera antes y después del clic, así que no pasa nada y el
     panel sobrevive el viaje. */
  function alSalirDePantalla(el, fn) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (!e.isIntersecting) fn(); });
      }, { threshold: 0 }).observe(el);
      return;
    }

    // Respaldo sin IntersectionObserver: mismo disparo por transición.
    var m = metrics(el);
    var dentro = true;
    addTicker(function (y) {
      var top = m.top - y;                       // top relativo al viewport
      var visible = !(top + m.height < 0 || top > vh);
      if (dentro && !visible) fn();
      dentro = visible;
    });
  }

  /* ─────────────────────────────────────────────────────
     1 · SISTEMA DE ANIMACIONES  [data-animation]
     ───────────────────────────────────────────────────── */
  function initReveals() {
    if (!('IntersectionObserver' in window)) {
      document.documentElement.classList.add('no-motion');
      $$('[data-animation]').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    // Elementos declarativos
    $$('[data-animation]').forEach(function (el) {
      var d = el.getAttribute('data-delay');
      if (d) el.style.setProperty('--d', d + 'ms');
      io.observe(el);
    });

    // Titulares construidos con .ln (línea a línea)
    var titles = [];
    $$('.ln').forEach(function (ln) {
      var p = ln.parentElement;
      if (p && titles.indexOf(p) === -1) titles.push(p);
    });
    titles.forEach(function (t) {
      if (t.classList.contains('hero__title')) return; // se dispara al cargar
      io.observe(t);
    });

    // Etapas del proceso
    $$('.paso').forEach(function (p, i) {
      p.style.transitionDelay = (i * 90) + 'ms';
      io.observe(p);
    });
  }

  /* ─────────────────────────────────────────────────────
     2 · NAVBAR + MENÚ MÓVIL
     ───────────────────────────────────────────────────── */
  function initNav() {
    var nav = $('#nav');
    var toggle = $('#navToggle');
    var menu = $('#menu');
    if (!nav) return;

    /* La barra queda siempre visible: solo cambia de fondo al despegarse
       del hero. Antes se escondía al bajar y volvía al subir, lo que dejaba
       la navegación fuera de alcance durante todo el recorrido. */
    addTicker(function (y) {
      nav.classList.toggle('is-stuck', y > 40);
    });

    if (!toggle || !menu) return;

    function open() {
      menu.hidden = false;
      // fuerza reflow para que la transición de clip-path se aplique
      void menu.offsetWidth;
      menu.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Cerrar menú');
      document.body.classList.add('is-locked');
    }

    function close() {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menú');
      document.body.classList.remove('is-locked');
      var hide = function () { menu.hidden = true; };
      if (motionOK()) setTimeout(hide, 700); else hide();
    }

    toggle.addEventListener('click', function () {
      if (menu.classList.contains('is-open')) close(); else open();
    });

    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });

    // Cierra el menú si se pasa a escritorio
    var mq = window.matchMedia('(min-width: 900px)');
    var onMQ = function () { if (mq.matches && menu.classList.contains('is-open')) close(); };
    if (mq.addEventListener) mq.addEventListener('change', onMQ);
    else if (mq.addListener) mq.addListener(onMQ);
  }

  /* ─────────────────────────────────────────────────────
     3 · HERO: carga orquestada + parallax
     ───────────────────────────────────────────────────── */
  function initHero() {
    var hero = $('#inicio');
    var title = $('.hero__title');
    var media = $('#heroMedia');
    var body = $('#heroBody');
    var veil = $('#heroVeil');
    if (!hero) return;

    if (title) {
      setTimeout(function () { title.classList.add('is-in'); }, 180);
    }

    if (!motionOK() || !media) return;

    var m = metrics(hero);

    addTicker(function (y) {
      var h = m.height || vh;
      if (y > h) return;
      var p = clamp(y / h, 0, 1);
      media.style.transform = 'translate3d(0,' + (p * 14).toFixed(2) + 'vh,0) scale(' + (1 + p * 0.06).toFixed(4) + ')';
      if (body) {
        body.style.transform = 'translate3d(0,' + (p * -5).toFixed(2) + 'vh,0)';
        body.style.opacity = (1 - p * 0.85).toFixed(3);
      }
      if (veil) veil.style.opacity = (1 + p * 0.35).toFixed(3);
    });
  }

  /* ─────────────────────────────────────────────────────
     4 · PROYECTOS: galería a pantalla completa, avance manual

     Mismo patrón de control que Testimonios: flechas, puntos y gesto
     táctil. La lámina siguiente entra desde la derecha mientras la
     anterior se retira y se oscurece, pero lo dispara el índice, no el
     scroll: la transición la hace el CSS. La sección no registra ningún
     ticker de scroll, así que la página se desplaza con total
     normalidad de principio a fin.
     ───────────────────────────────────────────────────── */
  function initProyectos() {
    var stage = $('#proStage');
    var deck = $('#proDeck');
    if (!stage || !deck) return;

    var panels = $$('.pro__panel', deck);
    var n = panels.length;
    if (!n) return;

    var cajaDots = $('#proDots');
    var dots = cajaDots ? $$('button', cajaDots) : [];
    var atras = $('#proPrev');
    var alante = $('#proNext');
    var cuenta = $('#proCount');
    var aviso = $('#proLive');

    var indice = 0;
    var dos = function (v) { return (v < 10 ? '0' : '') + v; };

    /* Posición continua: entera en reposo, fraccionaria mientras se
       arrastra. Cada unidad es una lámina. La transición la hace el CSS. */
    function pinta(p) {
      for (var i = 0; i < n; i++) {
        var d = p - i;      // <=-1 espera a la derecha; 0 en pantalla; >=1 ya salió
        var x, velo = 0;
        if (d <= -1)     { x = 100; }
        else if (d < 0)  { x = -d * 100; }
        else if (d < 1)  { x = -d * 18; velo = d * 0.55; }
        else             { x = -18; velo = 0.55; }
        panels[i].style.transform = 'translate3d(' + x.toFixed(2) + '%,0,0)';
        panels[i].style.setProperty('--dim', velo.toFixed(3));
      }
    }

    function marca() {
      for (var i = 0; i < n; i++) {
        var activa = i === indice;
        // Fuera de la lámina visible no debe quedar nada tabulable
        if (activa) panels[i].removeAttribute('inert');
        else panels[i].setAttribute('inert', '');
        if (dots[i]) dots[i].setAttribute('aria-current', activa ? 'true' : 'false');
      }
      if (cuenta) cuenta.textContent = dos(indice + 1) + ' / ' + dos(n);
      /* Los extremos topan en vez de dar la vuelta: con láminas apiladas,
         saltar de la última a la primera barre tres imágenes por pantalla.
         El botón deshabilitado además comunica dónde está el final. */
      if (atras) atras.disabled = indice === 0;
      if (alante) alante.disabled = indice === n - 1;
      if (aviso) {
        var t = $('.pro__name', panels[indice]);
        aviso.textContent = 'Proyecto ' + (indice + 1) + ' de ' + n +
                            (t ? ': ' + t.textContent.trim() : '');
      }
    }

    function ir(i) {
      indice = clamp(i, 0, n - 1);
      pinta(indice);
      marca();
    }

    dots.forEach(function (b, i) {
      b.addEventListener('click', function () { ir(i); });
    });
    if (atras) atras.addEventListener('click', function () { ir(indice - 1); });
    if (alante) alante.addEventListener('click', function () { ir(indice + 1); });

    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { ir(indice + 1); }
      if (e.key === 'ArrowLeft') { ir(indice - 1); }
    });

    /* Gesto táctil: solo toma el control si el movimiento es horizontal,
       igual que en Testimonios, para no robarle el scroll vertical. */
    var x0 = null, y0 = 0, dx = 0, siguiendo = false, arrastrando = false;

    function empieza(e) {
      if (e.pointerType === 'mouse') return;
      x0 = e.clientX; y0 = e.clientY;
      dx = 0; siguiendo = true; arrastrando = false;
    }
    function mueve(e) {
      if (!siguiendo || x0 === null) return;
      var ax = e.clientX - x0;
      var ay = e.clientY - y0;
      if (!arrastrando) {
        if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return;
        if (Math.abs(ay) > Math.abs(ax)) { siguiendo = false; return; }  // scroll vertical
        arrastrando = true;
        deck.classList.add('is-dragging');
      }
      dx = ax;
      var w = deck.clientWidth || 1;
      pinta(clamp(indice - dx / w, 0, n - 1));
    }
    function termina() {
      siguiendo = false;
      if (!arrastrando) return;
      arrastrando = false;
      deck.classList.remove('is-dragging');
      var umbral = (deck.clientWidth || 300) * 0.18;
      if (dx > umbral) ir(indice - 1);
      else if (dx < -umbral) ir(indice + 1);
      else pinta(indice);
      x0 = null; dx = 0;
    }

    if (window.PointerEvent) {
      deck.addEventListener('pointerdown', empieza, { passive: true });
      deck.addEventListener('pointermove', mueve, { passive: true });
      deck.addEventListener('pointerup', termina);
      deck.addEventListener('pointercancel', termina);
      deck.addEventListener('pointerleave', termina);
    }

    ir(0);
  }

  /* ─────────────────────────────────────────────────────
     5 · SERVICIOS: imagen al hover + acordeón táctil
     ───────────────────────────────────────────────────── */
  function initServicios() {
    var list = $('#serv');
    var media = $('#servMedia');
    if (!list) return;

    var rows = $$('.serv__row', list);

    // Solo puede haber uno abierto a la vez; se guarda aquí para no consultar el DOM.
    var abierto = null;

    function cerrar() {
      if (!abierto) return;
      abierto.classList.remove('is-open');
      var b = $('.serv__row', abierto);
      if (b) b.setAttribute('aria-expanded', 'false');
      abierto = null;
    }

    function abrir(item) {
      cerrar();
      item.classList.add('is-open');
      var b = $('.serv__row', item);
      if (b) b.setAttribute('aria-expanded', 'true');
      abierto = item;
    }

    // Al perder de vista la sección, el acordeón vuelve al estado normal.
    alSalirDePantalla($('#servicios') || list, cerrar);

    // Acordeón (funciona en cualquier dispositivo)
    rows.forEach(function (row) {
      row.addEventListener('click', function () {
        var item = row.parentElement;
        if (item === abierto) cerrar();
        else abrir(item);
      });
    });

    /* Enlaces del pie: abren su servicio y dejan que el salto a #servicios
       lo haga el navegador (scroll-behavior + scroll-padding-top del CSS). */
    $$('a[data-serv]').forEach(function (a) {
      a.addEventListener('click', function () {
        var row = list.querySelector('.serv__row[aria-controls="' + a.getAttribute('data-serv') + '"]');
        if (!row) return;
        abrir(row.parentElement);
        try { row.focus({ preventScroll: true }); } catch (err) { /* navegador viejo */ }
      });
    });

    // Marca visual de fila activa (hover o foco)
    rows.forEach(function (row) {
      ['mouseenter', 'focus'].forEach(function (ev) {
        row.addEventListener(ev, function () { row.parentElement.classList.add('is-active'); });
      });
      ['mouseleave', 'blur'].forEach(function (ev) {
        row.addEventListener(ev, function () { row.parentElement.classList.remove('is-active'); });
      });
    });

    /* Foto que sigue al cursor: es un detalle de escritorio y pide pantalla
       ancha, puntero fino y movimiento permitido. Este gate tiene que ser el
       complemento exacto de .serv__thumb en style.css; si se desincronizan,
       o se ven las dos imágenes a la vez o no se ve ninguna. */
    if (!media) return;

    var floatMQ = window.matchMedia('(min-width: 1100px) and (pointer: fine)');
    var floatOK = function () { return floatMQ.matches && motionOK(); };

    var imgs = $$('img', media);
    var wrap = list.parentElement; // .wrap
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null, shown = false;

    /* Se reevalúa en cada resize. Antes se decidía una sola vez al cargar y
       el display:block en línea no se revocaba nunca: al angostar la ventana
       la foto seguía activa sobre una columna de texto de 400px. */
    addResizer(function () {
      var on = floatOK();
      media.style.display = on ? 'block' : 'none';
      if (on) return;
      media.classList.remove('is-visible');
      shown = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    });

    function loop() {
      cx = lerp(cx, tx, 0.12);
      cy = lerp(cy, ty, 0.12);
      media.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) raf = requestAnimationFrame(loop);
      else raf = null;
    }

    /* La foto se esconde sobre el texto de la izquierda —el nombre del
       servicio y, si está desplegado, su párrafo— y se ve en todo lo demás:
       el número, la descripción de la derecha, la flecha y el negro.

       Quién está debajo del puntero lo resuelve el navegador, no una cuenta
       de coordenadas nuestra. Es deliberado: esta zona se mueve sola. Al
       entrar en una fila su padding-left se desplaza durante medio segundo,
       y al abrir un servicio el panel crece durante otro medio segundo
       arrastrando todo lo de abajo. Midiendo rectángulos a mano solo se
       acierta mientras llegan eventos de movimiento; con el ratón quieto el
       texto sigue deslizándose por debajo y el estado se queda viejo. El
       hit-testing del navegador se reevalúa con cada cambio de maquetación
       y avisa por mouseover aunque el puntero no se haya movido.

       Las cajas se ciñen a su texto desde el CSS (ver .serv__name y
       .serv__panel p); sin eso, esto acertaría el elemento pero el elemento
       ocuparía de más. */
    var TEXTO = '.serv__name, .serv__panel p';

    function pinta(destino) {
      var item = destino && destino.closest ? destino.closest('.serv__item') : null;
      if (!item || destino.closest(TEXTO)) {
        media.classList.remove('is-visible');
        return;
      }
      var row = $('.serv__row', item);
      var idx = row ? parseInt(row.getAttribute('data-img'), 10) || 0 : 0;
      imgs.forEach(function (im, i) { im.classList.toggle('is-shown', i === idx); });
      media.classList.add('is-visible');
    }

    function move(e) {
      if (!floatOK()) return;

      /* La posición se actualiza siempre, también mientras está escondida:
         así al salir del texto reaparece bajo el cursor y no viajando desde
         donde se apagó. */
      var r = wrap.getBoundingClientRect();
      var mw = media.offsetWidth;
      var mh = media.offsetHeight;
      tx = clamp(e.clientX - r.left - mw / 2, 0, Math.max(0, r.width - mw));
      ty = clamp(e.clientY - r.top - mh / 2, 0, Math.max(0, r.height - mh));
      if (!shown) { cx = tx; cy = ty; shown = true; }
      if (!raf) raf = requestAnimationFrame(loop);

      pinta(e.target);
    }

    list.addEventListener('mousemove', move);

    // Cubre el caso del ratón quieto: es el que dispara al moverse la página
    list.addEventListener('mouseover', function (e) {
      if (floatOK()) pinta(e.target);
    });

    list.addEventListener('mouseleave', function () {
      media.classList.remove('is-visible');
      shown = false;
    });
  }

  /* ─────────────────────────────────────────────────────
     6 · PROCESO: la línea se dibuja con el scroll
     ───────────────────────────────────────────────────── */
  function initProceso() {
    var wrap = $('#pasos');
    var line = $('#pasosLine');
    if (!wrap || !line) return;

    if (!motionOK()) { line.style.transform = 'none'; return; }

    // Debe coincidir con el breakpoint de .pasos en style.css
    var horizontal = window.matchMedia('(min-width: 1100px)');
    var m = metrics(wrap);

    addTicker(function (y) {
      var top = m.top - y;                       // top relativo al viewport
      if (top + m.height < 0 || top > vh) return;
      var p = clamp((vh * 0.85 - top) / (m.height * 0.75), 0, 1);
      line.style.transform = horizontal.matches
        ? 'scaleX(' + p.toFixed(4) + ')'
        : 'scaleY(' + p.toFixed(4) + ')';
    });
  }

  /* ─────────────────────────────────────────────────────
     7 · CONTADORES
     ───────────────────────────────────────────────────── */
  function initCounters() {
    var nums = $$('.num');
    if (!nums.length) return;

    var fmt = function (n, sep) {
      return sep ? n.toLocaleString('es-CO') : String(n);
    };

    function run(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var prefix = el.getAttribute('data-prefix') || '';
      var sep = el.getAttribute('data-sep') === '1';

      if (!motionOK()) { el.textContent = prefix + fmt(target, sep); return; }

      var dur = 1600;
      var t0 = null;

      function step(ts) {
        if (t0 === null) t0 = ts;
        var p = clamp((ts - t0) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 4);           // easeOutQuart
        el.textContent = prefix + fmt(Math.round(target * eased), sep);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });

    nums.forEach(function (n) { io.observe(n); });
  }

  /* ─────────────────────────────────────────────────────
     8 · TESTIMONIOS
     ───────────────────────────────────────────────────── */
  function initTestimonios() {
    var track = $('#testiTrack');
    var dotsBox = $('#testiDots');
    var prev = $('#testiPrev');
    var next = $('#testiNext');
    if (!track) return;

    var slides = $$('.quote', track);
    var total = slides.length;
    var index = 0;
    var dots = [];

    function render() {
      track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';
      slides.forEach(function (s, i) {
        s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
        $$('a, button', s).forEach(function (f) {
          if (i === index) f.removeAttribute('tabindex'); else f.setAttribute('tabindex', '-1');
        });
      });
      dots.forEach(function (d, i) {
        d.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }

    function go(i) {
      index = (i + total) % total;
      render();
    }

    if (dotsBox) {
      slides.forEach(function (s, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Ver testimonio ' + (i + 1) + ' de ' + total);
        b.addEventListener('click', function () { go(i); });
        dotsBox.appendChild(b);
        dots.push(b);
      });
    }

    if (prev) prev.addEventListener('click', function () { go(index - 1); });
    if (next) next.addEventListener('click', function () { go(index + 1); });

    // Teclado
    var stage = $('#testiStage');
    if (stage) {
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { go(index + 1); }
        if (e.key === 'ArrowLeft') { go(index - 1); }
      });
    }

    // Gesto táctil: solo se toma el control si el gesto es horizontal,
    // para no robarle el scroll vertical al usuario.
    var x0 = null, y0 = 0, dx = 0, tracking = false, dragging = false;

    function start(e) {
      if (e.pointerType === 'mouse') return;
      x0 = e.clientX; y0 = e.clientY;
      dx = 0; tracking = true; dragging = false;
    }
    function move(e) {
      if (!tracking || x0 === null) return;
      var ax = e.clientX - x0;
      var ay = e.clientY - y0;
      if (!dragging) {
        if (Math.abs(ax) < 8 && Math.abs(ay) < 8) return;
        if (Math.abs(ay) > Math.abs(ax)) { tracking = false; return; }  // scroll vertical
        dragging = true;
        track.classList.add('is-dragging');
      }
      dx = ax;
      var w = track.clientWidth || 1;
      var pct = (-index * 100) + (dx / w) * 100;
      track.style.transform = 'translate3d(' + pct.toFixed(2) + '%,0,0)';
    }
    function end() {
      tracking = false;
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      var threshold = (track.clientWidth || 300) * 0.18;
      if (dx > threshold) go(index - 1);
      else if (dx < -threshold) go(index + 1);
      else render();
      x0 = null; dx = 0;
    }

    if (window.PointerEvent) {
      track.addEventListener('pointerdown', start, { passive: true });
      track.addEventListener('pointermove', move, { passive: true });
      track.addEventListener('pointerup', end);
      track.addEventListener('pointercancel', end);
      track.addEventListener('pointerleave', end);
    }

    render();
  }

  /* ─────────────────────────────────────────────────────
     9 · PREGUNTAS FRECUENTES

     A diferencia de Servicios, aquí se pueden tener varias abiertas
     a la vez: son respuestas que se leen y se comparan, no un índice
     del que basta una entrada. Lo que sí comparten es el regreso al
     estado cerrado cuando la sección se pierde de vista, y por eso
     el cierre se apoya en alSalirDePantalla().

     El despliegue lo hace el CSS con grid-template-rows (0fr→1fr):
     el JS solo mueve la clase y el aria-expanded, no mide alturas.
     ───────────────────────────────────────────────────── */
  function initFaq() {
    var list = $('#faq-list');
    if (!list) return;

    $$('.faq__q', list).forEach(function (q) {
      var item = q.closest('.faq__item');
      if (!item) return;
      q.addEventListener('click', function () {
        var abierta = q.getAttribute('aria-expanded') === 'true';
        q.setAttribute('aria-expanded', abierta ? 'false' : 'true');
        item.classList.toggle('is-open', !abierta);
      });
    });

    /* Se consulta el DOM aquí y no se lleva un registro aparte porque esto
       corre una sola vez por salida de pantalla, no en cada fotograma. */
    function cerrarTodas() {
      $$('.faq__item.is-open', list).forEach(function (item) {
        item.classList.remove('is-open');
        var q = $('.faq__q', item);
        if (q) q.setAttribute('aria-expanded', 'false');
      });
    }

    alSalirDePantalla($('#faq') || list, cerrarTodas);
  }

  /* ─────────────────────────────────────────────────────
     10 · PARALLAX DEL CTA
     ───────────────────────────────────────────────────── */
  function initParallax() {
    if (!motionOK()) return;
    var media = $('#ctaMedia');
    var section = $('#contacto');
    if (!media || !section) return;

    var m = metrics(section);

    addTicker(function (y) {
      var top = m.top - y;
      if (top + m.height < 0 || top > vh) return;
      var p = (top + m.height / 2 - vh / 2) / vh;   // -1 … 1
      media.style.transform = 'translate3d(0,' + (p * -6).toFixed(2) + 'vh,0)';
    });
  }

  /* ─────────────────────────────────────────────────────
     11 · CURSOR PERSONALIZADO (solo escritorio con ratón)
     ───────────────────────────────────────────────────── */
  function initCursor() {
    var cur = $('#cursor');
    /* Hace falta (hover) además de (pointer: fine): un portátil táctil
       declara puntero fino, así que antes se colaba y la bolita quedaba
       clavada donde el usuario había tocado la pantalla. */
    var raton = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!cur || !raton.matches || !motionOK()) return;

    var dot = $('.cursor__dot', cur);
    var ring = $('.cursor__ring', cur);
    var raiz = document.documentElement;
    raiz.classList.add('has-cursor');

    var mx = vw / 2, my = vh / 2, rx = mx, ry = my, raf = null, vivo = true;

    function loop() {
      if (!vivo) { raf = null; return; }
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px) translate(-50%,-50%)';
      raf = requestAnimationFrame(loop);
    }

    /* Al primer toque real se desmonta y no vuelve: en un equipo híbrido
       el ratón ha dejado de ser el modo de entrada en uso, y una bolita
       clavada en la pantalla es peor que no tener efecto. */
    function apagar() {
      if (!vivo) return;
      vivo = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      cur.style.opacity = '0';
      cur.classList.remove('is-hot');
      raiz.classList.remove('has-cursor');   // devuelve el cursor nativo
    }

    document.addEventListener('mousemove', function (e) {
      if (!vivo) return;
      mx = e.clientX; my = e.clientY;
      cur.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    document.addEventListener('mouseover', function (e) {
      if (!vivo) return;
      var hot = e.target.closest('a, button');
      cur.classList.toggle('is-hot', !!hot);
    }, { passive: true });

    document.addEventListener('mouseout', function (e) {
      if (!vivo) return;
      if (!e.relatedTarget) cur.style.opacity = '0';
    }, { passive: true });

    if (window.PointerEvent) {
      document.addEventListener('pointerdown', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') apagar();
      }, { passive: true });
    } else {
      document.addEventListener('touchstart', apagar, { passive: true });
    }

    // Si el equipo se queda sin ratón (tableta desacoplada), también se apaga
    var alCambiar = function () { if (!raton.matches) apagar(); };
    if (raton.addEventListener) raton.addEventListener('change', alCambiar);
    else if (raton.addListener) raton.addListener(alCambiar);
  }

  /* ─────────────────────────────────────────────────────
     12 · DETALLES
     ───────────────────────────────────────────────────── */
  function initMisc() {
    var y = $('#year');
    if (y) y.textContent = new Date().getFullYear();

    if (!motionOK()) document.documentElement.classList.add('no-motion');
  }

  /* ─────────────────────────────────────────────────────
     13 · FORMULARIO DE CONTACTO

     El sitio es estático: no hay backend que reciba un POST.
     El formulario valida en cliente, arma el mensaje y lo abre
     en WhatsApp o en el cliente de correo del visitante.

     PARA RECIBIRLO EN UN SERVIDOR: dale action y method al
     <form> en index.html y quita el e.preventDefault() de abajo.
     La validación y los mensajes siguen sirviendo igual.

     Recibe el formulario por parámetro y busca sus campos por
     name, nunca por id: en la página hay dos —el de la sección y
     el clon del modal—, y sus id tienen que diferenciarse para no
     romper los <label for>. El name sí es el mismo en ambos, que
     además es el nombre con el que viajaría el dato al servidor.
     ───────────────────────────────────────────────────── */
  function initForm(form) {
    if (!form) return;

    var status = $('.form__st', form);
    var consent = form.querySelector('[name="consent"]');
    var WA = '573001234567';
    var MAIL = 'hola@porticoconstructora.co';

    // El orden es también el orden en que se arma el mensaje
    var campos = [
      { n: 'nombre',      et: 'Nombre',           req: 'Escribe tu nombre.' },
      { n: 'telefono',    et: 'WhatsApp',         req: 'Escribe un número de contacto.', tipo: 'tel' },
      { n: 'correo',      et: 'Correo',           req: 'Escribe tu correo.', tipo: 'correo' },
      { n: 'tipo',        et: 'Tipo de proyecto', req: 'Elige el tipo de proyecto.' },
      { n: 'ciudad',      et: 'Ciudad' },
      { n: 'presupuesto', et: 'Presupuesto' },
      { n: 'mensaje',     et: 'Mensaje' }
    ];

    var campo = function (c) { return form.querySelector('[name="' + c.n + '"]'); };
    var caja  = function (el) { return el.closest('.f'); };

    function marcar(el, msg) {
      var box = caja(el);
      var err = box && $('.f__e', box);
      if (box) box.classList.toggle('is-bad', !!msg);
      if (err) err.textContent = msg || '';
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    function valida(c) {
      var el = campo(c);
      if (!el) return true;
      var v = (el.value || '').trim();

      if (c.req && !v) { marcar(el, c.req); return false; }
      if (v && c.tipo === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        marcar(el, 'Revisa el correo: parece incompleto.');
        return false;
      }
      if (v && c.tipo === 'tel' && v.replace(/\D/g, '').length < 7) {
        marcar(el, 'Revisa el número: faltan dígitos.');
        return false;
      }
      marcar(el, '');
      return true;
    }

    function validaConsent() {
      if (!consent) return true;
      var ok = consent.checked;
      marcar(consent, ok ? '' : 'Necesitamos tu autorización para contactarte.');
      return ok;
    }

    // El error se limpia en cuanto el visitante corrige, no al reenviar
    campos.forEach(function (c) {
      var el = campo(c);
      if (!el) return;
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () {
        var box = caja(el);
        if (box && box.classList.contains('is-bad')) valida(c);
      });
    });
    if (consent) {
      consent.addEventListener('change', function () {
        var box = caja(consent);
        if (box && box.classList.contains('is-bad')) validaConsent();
      });
    }

    function mensaje() {
      var l = ['Nuevo proyecto — desde porticoconstructora.co', ''];
      campos.forEach(function (c) {
        var el = campo(c);
        var v = el ? (el.value || '').trim() : '';
        if (v) l.push(c.et + ': ' + v);
      });
      return l.join('\n');
    }

    function decir(txt, malo) {
      if (!status) return;
      status.textContent = txt;
      status.classList.toggle('is-bad', !!malo);
    }

    // event.submitter no existe en Safari < 15.4: se guarda el último clic
    var ultimo = null;
    $$('button[type="submit"]', form).forEach(function (b) {
      b.addEventListener('click', function () { ultimo = b; });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var malos = campos.filter(function (c) { return !valida(c); });
      var okConsent = validaConsent();

      if (malos.length || !okConsent) {
        decir('Faltan datos por revisar. Corrige los campos marcados e inténtalo de nuevo.', true);
        var primero = malos.length ? campo(malos[0]) : consent;
        if (primero && primero.focus) primero.focus();
        return;
      }

      var via = (e.submitter || ultimo || {}).value || 'whatsapp';
      var txt = mensaje();
      var elNombre = campo(campos[0]);
      var nombre = elNombre ? (elNombre.value || '').trim() : '';

      if (via === 'correo') {
        decir('Abrimos tu correo con el mensaje listo. Si no se abrió, escríbenos a ' + MAIL + '.');
        window.location.href = 'mailto:' + MAIL +
          '?subject=' + encodeURIComponent('Nuevo proyecto — ' + nombre) +
          '&body=' + encodeURIComponent(txt);
      } else {
        decir('Abrimos WhatsApp con el mensaje listo para enviar. Si no se abrió, escríbenos al +57 300 123 4567.');
        window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(txt), '_blank', 'noopener');
      }
    });
  }

  /* ─────────────────────────────────────────────────────
     14 · MODAL DE CONTACTO

     Los CTA de acción —el del navbar, el del hero y los "Quiero
     algo así" de la galería— abren el formulario encima de la
     página en vez de mandar al visitante hasta el final. Los
     enlaces de navegación que dicen "Contacto" siguen llevando a
     la sección, igual que antes.

     El formulario no se escribe dos veces: se clona el de la
     sección y se le renumeran los id. Con dos copias en el HTML,
     cualquier cambio futuro habría que hacerlo en las dos y
     tarde o temprano se separan.

     Todo esto es mejora progresiva: los CTA conservan su
     href="#contacto" y aquí solo se intercepta el clic. Si falla
     el JS o el navegador no trae <dialog>, siguen funcionando
     como el ancla que siempre fueron.
     ───────────────────────────────────────────────────── */
  function initModal() {
    var dlg = $('#modalContacto');
    var cuerpo = $('#modalCuerpo');
    var original = $('#contactoForm');
    if (!dlg || !cuerpo || !original || !dlg.showModal) return;

    /* Dos elementos con el mismo id romperían los <label for> y los
       aria-describedby de AMBOS formularios: el navegador resuelve
       siempre al primero que encuentra en el documento. */
    var copia = original.cloneNode(true);
    copia.id = original.id + '-modal';
    $$('[id]', copia).forEach(function (el) {
      var viejo = el.id;
      el.id = viejo + '-modal';
      $$('[for="' + viejo + '"]', copia).forEach(function (l) { l.setAttribute('for', el.id); });
      $$('[aria-describedby="' + viejo + '"]', copia).forEach(function (d) {
        d.setAttribute('aria-describedby', el.id);
      });
    });
    cuerpo.appendChild(copia);
    initForm(copia);

    function abrir() {
      if (dlg.open) return;            // showModal() sobre uno ya abierto lanza
      dlg.showModal();
      /* showModal() ya bloquea la interacción con el fondo, pero no el
         scroll: sin esto la página sigue corriendo detrás del diálogo.
         Es la misma clase que usa el menú móvil. */
      document.body.classList.add('is-locked');
      // Devuelve el puntero del sistema mientras dure el modal (ver style.css)
      document.documentElement.classList.add('modal-abierto');
    }

    // Esc y el botón de cerrar terminan los dos aquí ('close' es nativo)
    dlg.addEventListener('close', function () {
      document.body.classList.remove('is-locked');
      document.documentElement.classList.remove('modal-abierto');
    });

    var x = $('#modalCerrar');
    if (x) x.addEventListener('click', function () { dlg.close(); });

    /* Clic fuera de la caja. El <dialog> cubre toda la pantalla para poder
       centrar (ver .modal en style.css), así que todo lo que quede alrededor
       de .modal__caja llega con el propio diálogo como target. */
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) dlg.close();
    });

    $$('a[data-modal]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        abrir();
      });
    });
  }

  /* ─────────────────────────────────────────────────────
     ARRANQUE
     ───────────────────────────────────────────────────── */
  function init() {
    initMisc();
    initReveals();
    initNav();
    initHero();
    initProyectos();
    initServicios();
    initProceso();
    initCounters();
    initTestimonios();
    initFaq();
    initParallax();
    initForm($('#contactoForm'));
    initModal();
    initCursor();
    request();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
