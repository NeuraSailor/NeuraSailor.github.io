window.MathJax = {
  startup: {
    ready: function () {
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
      // Add .mjx-inflight class while MathJax is working on an element,
      // so CSS opacity rule can keep raw text hidden until rendering completes.
      find: [10, function (doc) {
        for (var i = 0; i < doc.math.length; i++) {
          var p = doc.math[i].start && doc.math[i].start.parentNode;
          if (p) p.classList.add('mjx-inflight');
        }
      }, function (doc) {
        for (var i = 0; i < doc.math.length; i++) {
          var p = doc.math[i].start && doc.math[i].start.parentNode;
          if (p) p.classList.remove('mjx-inflight');
        }
      }]
    }
  }
};

document$.subscribe(function () {
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
  MathJax.typesetPromise().then(function () {
    // After typesetting completes, mark all processed arithmatex
    // elements so CSS opacity reveals them. renderActions' cleanup
    // removes mjx-inflight during find phase, not typeset phase.
    document.querySelectorAll('.arithmatex').forEach(function (el) {
      el.classList.add('mjx-done');
    });
  });
});
