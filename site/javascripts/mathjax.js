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
      addInFlight: [16, function (doc) {
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
    document.querySelectorAll('.arithmatex').forEach(function (el) {
      el.classList.add('mjx-done');
    });
  });
});
