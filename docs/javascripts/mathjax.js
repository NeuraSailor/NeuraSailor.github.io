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
    processHtmlClass: "arithmatex",
    renderActions: {
      find: [10, function (doc) {
        for (var _i = 0, _a = doc.math; _i < _a.length; _i++) {
          var math = _a[_i];
          if (math.start && math.start.parentNode) {
            math.start.parentNode.classList.add('mjx-inflight');
          }
        }
      }, function (doc) {
        for (var _i = 0, _a = doc.math; _i < _a.length; _i++) {
          var math = _a[_i];
          if (math.start && math.start.parentNode) {
            math.start.parentNode.classList.remove('mjx-inflight');
          }
        }
      }]
    }
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
