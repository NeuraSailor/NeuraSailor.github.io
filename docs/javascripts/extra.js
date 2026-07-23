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
     2. Sidebar Toggle
        操控 MkDocs 原生 __drawer checkbox，统管全屏/半屏
     ---------------------------------------------------------- */

  function initSidebarToggle() {
    var btn = document.getElementById('sidebarToggleBtn');
    var drawer = document.getElementById('__drawer');
    if (!btn || !drawer) return;

    // 恢复保存的状态
    var saved = localStorage.getItem('hw-sidebar-hidden');
    if (saved === 'true') {
      drawer.checked = false;
      btn.textContent = '📖';
    } else {
      drawer.checked = true;
      btn.textContent = '📚';
    }

    btn.addEventListener('click', function () {
      var hidden = !drawer.checked;  // 即将隐藏（click 在 before toggle）
      drawer.checked = hidden;
      dispatchChange(drawer);
      localStorage.setItem('hw-sidebar-hidden', hidden);
      btn.textContent = hidden ? '📖' : '📚';
    });
  }

  function dispatchChange(el) {
    if ('createEvent' in document) {
      var evt = document.createEvent('HTMLEvents');
      evt.initEvent('change', true, true);
      el.dispatchEvent(evt);
    } else {
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /* ----------------------------------------------------------
     3. MkDocs Instant Navigation Hook
     ---------------------------------------------------------- */

  function initAll() {
    initProgressBar();
    initSidebarToggle();
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
