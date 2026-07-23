window.MathJax = {
  startup: {
    ready: function () {
      // Decode HTML entities in .arithmatex elements
      // MkDocs escapes & → &amp; in display math, breaking cases/matrix/aligned
      document.querySelectorAll('.arithmatex').forEach(function (el) {
        if (el.innerHTML.indexOf('&amp;') !== -1) {
          var ta = document.createElement('textarea');
          ta.innerHTML = el.innerHTML;
          el.innerHTML = ta.value;
        }
      });
      MathJax.startup.defaultReady();
    }
  },
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    ignoreHtmlClass: ".*|",
    processHtmlClass: "arithmatex"
  }
};

document$.subscribe(function () {
  // Clean arithmatex before typesetting on each nav
  document.querySelectorAll('.arithmatex').forEach(function (el) {
    if (el.innerHTML.indexOf('&amp;') !== -1) {
      var ta = document.createElement('textarea');
      ta.innerHTML = el.innerHTML;
      el.innerHTML = ta.value;
    }
  });
  MathJax.startup.output.clearCache();
  MathJax.typesetClear();
  MathJax.texReset();
  MathJax.typesetPromise();
});
