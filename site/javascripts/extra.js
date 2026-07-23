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
     2. Sidebar Drawer Toggle
        JS 直控 __drawer checkbox，全屏/半屏统一行为
     ---------------------------------------------------------- */

  function initSidebarDrawer() {
    var btn = document.getElementById('sidebarDrawerBtn');
    var drawer = document.getElementById('__drawer');
    if (!btn || !drawer) return;

    // 恢复状态：默认侧边栏关闭
    if (localStorage.getItem('hw-drawer-open') === 'true') {
      drawer.checked = true;
      btn.textContent = '📖';
    } else {
      drawer.checked = false;
      btn.textContent = '📚';
    }

    btn.addEventListener('click', function () {
      drawer.checked = !drawer.checked;
      drawer.dispatchEvent(new Event('change', { bubbles: true }));
      var isOpen = drawer.checked;
      localStorage.setItem('hw-drawer-open', isOpen);
      btn.textContent = isOpen ? '📖' : '📚';
    });
  }

  /* ----------------------------------------------------------
     3. MkDocs Instant Navigation Hook
     ---------------------------------------------------------- */

  function initAll() {
    initProgressBar();
    initSidebarDrawer();
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
