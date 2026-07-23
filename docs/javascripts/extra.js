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
     2. MkDocs Instant Navigation Hook
     ---------------------------------------------------------- */

  function initAll() {
    initProgressBar();
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
