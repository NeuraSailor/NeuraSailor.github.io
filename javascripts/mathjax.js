window.MathJax = {
  tex: {
    inlineMath: [["\\(", "\\)"], ["$", "$"]],
    displayMath: [["\\[", "\\]"], ["$$", "$$"]],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    ignoreHtmlClass: "tex2jax_ignore",
    processHtmlClass: "tex2jax_process"
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
  MathJax.typesetPromise([document.body]).then(function () {
    document.querySelectorAll('.arithmatex').forEach(function (el) {
      el.classList.add('mjx-done');
    });
  });
});
