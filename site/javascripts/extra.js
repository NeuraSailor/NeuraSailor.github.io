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
      btn.textContent = '📖'; // open book
    }

    btn.addEventListener('click', function () {
      const isHidden = document.body.classList.toggle('sidebar-hidden');
      localStorage.setItem('hw-sidebar-hidden', isHidden);
      btn.textContent = isHidden ? '📖' : '📚';

      // Also toggle MkDocs' own sidebar state
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
     3. Theme Toggle (Light / Dark)
     ---------------------------------------------------------- */

  function initThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    // Restore saved theme
    const saved = localStorage.getItem('hw-color-scheme');
    if (saved) {
      document.body.setAttribute('data-md-color-scheme', saved);
    }
    updateThemeIcon(btn);

    btn.addEventListener('click', function () {
      const current = document.body.getAttribute('data-md-color-scheme');
      const next = (current === 'slate') ? 'default' : 'slate';
      document.body.setAttribute('data-md-color-scheme', next);
      localStorage.setItem('hw-color-scheme', next);
      updateThemeIcon(btn);
    });
  }

  function updateThemeIcon(btn) {
    const scheme = document.body.getAttribute('data-md-color-scheme');
    if (scheme === 'slate') {
      btn.textContent = '☀️'; // sun for switching to light
      btn.title = '切换到亮色模式';
    } else {
      btn.textContent = '🌙'; // moon for switching to dark
      btn.title = '切换到暗色模式';
    }
  }

  /* ----------------------------------------------------------
     4. MkDocs Instant Navigation Hook
        Re-initialize everything on each page load
     ---------------------------------------------------------- */

  function initAll() {
    initProgressBar();
    initSidebarToggle();
    initThemeToggle();
  }

  if (typeof document$ !== 'undefined') {
    document$.subscribe(function () {
      // Small delay to ensure DOM is ready after instant navigation
      setTimeout(initAll, 50);
    });
  } else {
    // Fallback: DOMContentLoaded (for non-instant navigation)
    document.addEventListener('DOMContentLoaded', initAll);
  }

  // Also run on first load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof document$ === 'undefined') {
        initAll();
      }
    });
  } else {
    // DOM already loaded, but document$ might still fire later
    setTimeout(function () {
      if (typeof document$ === 'undefined') {
        initAll();
      }
    }, 100);
  }
})();
