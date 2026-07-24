/* ============================================================
   NeuraSailor Theme — Global Interactive JavaScript
   霍格沃茨主题交互脚本
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     1. Reading Progress Bar
     ---------------------------------------------------------- */

  function initProgressBar() {
    var bar = document.getElementById('readingProgressBar');
    if (!bar) return;

    function update() {
      var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      var scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight <= 0) {
        bar.style.width = '0%';
        return;
      }
      bar.style.width = Math.min((scrollTop / scrollHeight) * 100, 100) + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ----------------------------------------------------------
     2. Make native drawer button work on desktop
     ---------------------------------------------------------- */

  function initNativeDrawer() {
    var drawer = document.getElementById('__drawer');
    var label = document.querySelector('.md-header__button[for="__drawer"]');
    if (!drawer || !label) return;

    var newLabel = label.cloneNode(true);
    label.parentNode.replaceChild(newLabel, label);

    newLabel.addEventListener('click', function (e) {
      e.preventDefault();
      drawer.checked = !drawer.checked;
      drawer.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ----------------------------------------------------------
     3. Magic Particle System
        背景漂浮粒子 + 鼠标拖尾
     ---------------------------------------------------------- */

  function initMagicParticles() {
    var canvas = document.getElementById('magicCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* ---- 状态 ---- */
    var bgParticles = [];
    var trailParticles = [];
    var mouseX = -100, mouseY = -100;
    var mouseActive = false;
    var tick = 0;
    var BG_COUNT = 60;
    var MAX_TRAIL = 80;
    var animId;

    resize();

    /* ---- resize ---- */
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    /* ---- 背景粒子 ---- */
    function createBg() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4 - 0.3,
        op: Math.random() * 0.5 + 0.2,
        hue: Math.random() < 0.5 ? 45 : 260,
        maxAge: Math.random() * 300 + 200,
        age: 0
      };
    }

    function respawnBg(p) {
      p.x = Math.random() * canvas.width;
      p.y = canvas.height + 10;
      p.r = Math.random() * 2 + 0.5;
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = -(Math.random() * 0.6 + 0.2);
      p.op = Math.random() * 0.5 + 0.2;
      p.hue = Math.random() < 0.5 ? 45 : 260;
      p.maxAge = Math.random() * 300 + 200;
      p.age = 0;
    }

    /* ---- 主循环 ---- */
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var i, p, alpha, s;

      /* 背景粒子 */
      for (i = 0; i < bgParticles.length; i++) {
        p = bgParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.age++;

        alpha = p.op * (1 - Math.abs(Math.sin(p.age * 0.03)) * 0.5);
        if (alpha < 0) alpha = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + p.hue + ', 80%, 70%, ' + alpha + ')';
        ctx.fill();

        if (p.r > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = 'hsla(' + p.hue + ', 80%, 70%, ' + (alpha * 0.12) + ')';
          ctx.fill();
        }

        if (p.y < -20 || p.y > canvas.height + 20 ||
            p.x < -20 || p.x > canvas.width + 20 ||
            p.age > p.maxAge) {
          respawnBg(p);
        }
      }

      /* 鼠标拖尾 —— 与背景粒子统一外观，但更亮更多更散更久 */
      if (mouseActive && tick % 1 === 0 && trailParticles.length < MAX_TRAIL) {
        trailParticles.push({
          x: mouseX + (Math.random() - 0.5) * 30,
          y: mouseY + (Math.random() - 0.5) * 30,
          r: Math.random() * 2 + 0.5,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.6,
          op: Math.random() * 0.5 + 0.2,
          hue: Math.random() < 0.55 ? 42 : 265,
          maxAge: Math.random() * 50 + 35,
          age: 0
        });
      }

      for (i = trailParticles.length - 1; i >= 0; i--) {
        p = trailParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.age++;
        p.vx *= 0.97;
        p.vy *= 0.97;

        alpha = p.op * (1 - p.age / p.maxAge);
        if (alpha < 0) alpha = 0;

        if (alpha > 0.01) {
          s = p.r * (1 - p.age / p.maxAge * 0.5);

          /* 亮度增强 25% */
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
          ctx.fillStyle = 'hsla(' + p.hue + ', 94%, 88%, ' + alpha + ')';
          ctx.fill();
        }

        if (p.age >= p.maxAge || alpha <= 0.01) {
          trailParticles.splice(i, 1);
        }
      }

      tick++;
      animId = requestAnimationFrame(draw);
    }

    /* ---- 事件 ---- */
    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseActive = true;
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      mouseActive = false;
    });

    window.addEventListener('resize', resize, { passive: true });

    /* ---- 启动 ---- */
    for (var j = 0; j < BG_COUNT; j++) {
      bgParticles.push(createBg());
    }
    animId = requestAnimationFrame(draw);
  }

  /* ----------------------------------------------------------
     4. Card 3D Tilt Effect
     ---------------------------------------------------------- */

  function initCardTilt() {
    var cards = document.querySelectorAll('.hw-card');
    if (!cards.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        card.addEventListener('mousemove', function (e) {
          var rect = card.getBoundingClientRect();
          var x = e.clientX - rect.left - rect.width / 2;
          var y = e.clientY - rect.top - rect.height / 2;

          var rx = (y / (rect.height / 2)) * -6;
          var ry = (x / (rect.width / 2)) * 6;

          card.style.transform =
            'perspective(800px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px) scale(1.02)';
        });

        card.addEventListener('mouseleave', function () {
          card.style.transform = '';
        });
      })(cards[i]);
    }
  }

  /* ----------------------------------------------------------
     5. Stats Counter Animation
     ---------------------------------------------------------- */

  function initStatsCounters() {
    var counters = document.querySelectorAll('.hw-stats__number[data-count]');
    if (!counters.length) return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (isNaN(target) || el._countAnimated) return;
        el._countAnimated = true;

        if (prefersReduced) {
          el.textContent = target;
          return;
        }

        el.textContent = '0';

        var duration = Math.min(2000, Math.max(800, target * 10));
        var start = performance.now();

        function tick(now) {
          var elapsed = now - start;
          var progress = Math.min(elapsed / duration, 1);
          var eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          el.textContent = Math.round(eased * target);
          if (progress < 1) {
            requestAnimationFrame(tick);
          }
        }

        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.3 });

    counters.forEach(function (el) { observer.observe(el); });
  }

  /* ----------------------------------------------------------
     6. Link Preview — tippy.js powered, Obsidian-style hover popup
        基于 Enveloppe/tooltips-internal-link 开源方案
        ✦ 点击浮窗任意位置 → pin + 可拖动
        ✦ appendTo: body 解决 callout overflow 裁剪
     ---------------------------------------------------------- */

  function initLinkPreview() {
    if (typeof tippy === 'undefined') return;

    /* SPA 导航前清理旧 tippy 实例 */
    var prevLinks = document.querySelectorAll('.md-content a');
    for (var i = 0; i < prevLinks.length; i++) {
      if (prevLinks[i]._tippy) { prevLinks[i]._tippy.destroy(); }
    }

    var siteUrl = document.querySelector('meta[name="site_url"])
      ? document.querySelector('meta[name="site_url"]').content
      : location.origin;

    /* ---- 拖拽逻辑 ---- */
    var dragState = null; // { instance, startX, startY, popper, box }

    function onPointerDown(e, instance) {
      var box = instance.popper.querySelector('.tippy-box');
      if (!box) return;
      var rect = box.getBoundingClientRect();
      dragState = {
        instance: instance,
        startX: e.clientX,
        startY: e.clientY,
        popperX: rect.left,
        popperY: rect.top
      };
      box.style.cursor = 'grabbing';
      instance.popper.setAttribute('data-dragging', 'true');
    }

    function onPointerMove(e) {
      if (!dragState) return;
      e.preventDefault();
      var dx = e.clientX - dragState.startX;
      var dy = e.clientY - dragState.startY;
      var ref = dragState.instance.popper;
      ref.style.transform =
        'translate3d(' + (dragState.popperX + dx) + 'px, ' + (dragState.popperY + dy) + 'px, 0)';
    }

    function onPointerUp() {
      if (!dragState) return;
      var box = dragState.instance.popper.querySelector('.tippy-box');
      if (box) box.style.cursor = 'grab';
      dragState.instance.popper.removeAttribute('data-dragging');
      dragState = null;
    }

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);

    /* ---- 点击外部 => 取消固定 ---- */
    document.addEventListener('click', function (e) {
      for (var k = 0; k < _pinnedInstances.length; k++) {
        var inst = _pinnedInstances[k];
        var box = inst.popper;
        if (box && !box.contains(e.target) && !inst.reference.contains(e.target)) {
          _unpin(inst);
        }
      }
    });

    var _pinnedInstances = [];

    function _pin(instance) {
      if (instance._pinned) return;
      instance._pinned = true;
      _pinnedInstances.push(instance);
      instance.setProps({ hideOnClick: false, trigger: 'manual' });
      var box = instance.popper.querySelector('.tippy-box');
      if (box) {
        box.classList.add('hw-preview-pinned');
        box.style.cursor = 'grab';
        box.addEventListener('pointerdown', function (e) { onPointerDown(e, instance); });
      }
    }

    function _unpin(instance) {
      instance._pinned = false;
      var idx = _pinnedInstances.indexOf(instance);
      if (idx > -1) _pinnedInstances.splice(idx, 1);
      instance.setProps({ hideOnClick: true, trigger: 'mouseenter focus' });
      var box = instance.popper.querySelector('.tippy-box');
      if (box) {
        box.classList.remove('hw-preview-pinned');
        box.style.cursor = '';
      }
      instance.hide();
    }

    function fixImages(el) {
      var imgs = el.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        img.src = decodeURI(decodeURI(img.src));
        img.src = img.src.replace(location.origin, siteUrl);
      }
    }

    try {
      tippy('.md-content a[href^="' + siteUrl + '"], .md-content a[href^="./"], .md-content a[href^="../"]', {
        allowHTML: true,
        animation: 'scale-subtle',
        theme: 'hw-preview',
        arrow: true,
        delay: [300, 0],
        touch: 'hold',
        interactive: true,
        maxWidth: 420,
        appendTo: document.body, // 解决 callout overflow 裁剪
        onShow: function (instance) {
          /* 自身链接不预览 */
          if (location.href.replace(/#.*/, '') === instance.reference.href.replace(/#.*/, '')) {
            return false;
          }
          /* 排除非 HTML 文件 */
          var href = instance.reference.href;
          if (/\.(pdf|png|jpg|jpeg|gif|svg|zip|tar|gz)$/i.test(href.split('?')[0].split('#')[0])) {
            return false;
          }
          return fetch(instance.reference.href)
            .then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            })
            .then(function (html) {
              var doc = new DOMParser().parseFromString(html, 'text/html');
              var article = doc.querySelector('.md-content__inner');
              if (!article) { instance.hide(); return; }

              var clone = article.cloneNode(true);
              var removes = clone.querySelectorAll('.headerlink, div[style*="margin-top: -30px"]');
              for (var i = 0; i < removes.length; i++) { removes[i].remove(); }
              fixImages(clone);

              instance.setContent('<div class="hw-preview-content">' + clone.innerHTML + '</div>');

              /* 绑定点击 = toggle pin */
              instance.popper.addEventListener('click', function (e) {
                /* 拖拽中不触发 pin */
                if (instance.popper.getAttribute('data-dragging') === 'true') return;
                if (instance._pinned) {
                  _unpin(instance);
                } else {
                  _pin(instance);
                }
              });
            })
            .catch(function () { instance.hide(); });
        },
        onHidden: function (instance) {
          if (instance._pinned) {
            _unpin(instance);
          }
        }
      });
    } catch (e) { /* tippy not available */ }
  }

  /* ----------------------------------------------------------
     7. MkDocs Instant Navigation Hook
     ---------------------------------------------------------- */

  function initAll() {
    initProgressBar();
    initNativeDrawer();
    initMagicParticles();
    initCardTilt();
    initStatsCounters();
    initLinkPreview();
  }

  if (typeof document$ !== 'undefined') {
    document$.subscribe(function () {
      setTimeout(initAll, 50);
    });
  } else {
    document.addEventListener('DOMContentLoaded', initAll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof document$ === 'undefined') initAll();
    });
  } else {
    setTimeout(function () {
      if (typeof document$ === 'undefined') initAll();
    }, 100);
  }
})();
