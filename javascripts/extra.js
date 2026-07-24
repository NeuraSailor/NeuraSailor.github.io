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
        原生汉堡按钮在 ≥76.25em 全屏下被 Material CSS
        display:none。我们用 JS 强制让它行为正常：
       监听原生按钮 click，直控 __drawer checkbox。
     ---------------------------------------------------------- */

  function initNativeDrawer() {
    var drawer = document.getElementById('__drawer');
    // 找到原生 header 中的 <label for="__drawer">
    var label = document.querySelector('.md-header__button[for="__drawer"]');
    if (!drawer) return;

    // 如果用户没有通过 CSS 让 label 可见，JS 在桌面端也能兜底——但主要由 CSS 负责 display。
    // 这里负责确保 label 点击能 toggle drawer
    if (!label) return;

    // 移除 Material 可能绑定的事件干扰，重新监听
    var newLabel = label.cloneNode(true);
    label.parentNode.replaceChild(newLabel, label);

    newLabel.addEventListener('click', function (e) {
      e.preventDefault();
      drawer.checked = !drawer.checked;
      drawer.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ----------------------------------------------------------
     3. MkDocs Instant Navigation Hook
     ---------------------------------------------------------- */

  function initAll() {
    initProgressBar();
    initNativeDrawer();
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
