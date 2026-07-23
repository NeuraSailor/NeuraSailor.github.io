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
    const bar = document.getElementById('readingProgressBar');
    if (!bar) return;

    function update() {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (scrollHeight <= 0) {
        bar.style.width = '0%';
        return;
      }
      const progress = Math.min((scrollTop / scrollHeight) * 100, 100);
      bar.style.width = progress + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ----------------------------------------------------------
     2. Sidebar Toggle
     ---------------------------------------------------------- */

  function initSidebarToggle() {
    const btn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.querySelector('.md-sidebar--primary');
    if (!btn) return;

    // Restore saved state
    const saved = localStorage.getItem('hw-sidebar-hidden');
    if (saved === 'true') {
      document.body.classList.add('sidebar-hidden');
      btn.textContent = '📖';
    }

    btn.addEventListener('click', function () {
      const isHidden = document.body.classList.toggle('sidebar-hidden');
      localStorage.setItem('hw-sidebar-hidden', isHidden);
      btn.textContent = isHidden ? '📖' : '📚';

      if (sidebar) {
        const mdToggle = sidebar.querySelector('[data-md-toggle="drawer"]');
        if (mdToggle && mdToggle.checked !== !isHidden) {
          mdToggle.checked = !isHidden;
          mdToggle.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
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
      if (typeof document$ === 'undefined') {
        initAll();
      }
    });
  } else {
    setTimeout(function () {
      if (typeof document$ === 'undefined') {
        initAll();
      }
    }, 100);
  }
})();
