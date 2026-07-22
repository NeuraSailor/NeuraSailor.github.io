window.MathJax = {
  tex: {
    inlineMath: [
      ["\\(", "\\)"],
      ["$", "$"]
    ],
    displayMath: [
      ["\\[", "\\]"],
      ["$$", "$$"]
    ],
    processEscapes: true,
    processEnvironments: true
  },

  options: {
    ignoreHtmlClass: "no-mathjax",
    processHtmlClass: "arithmatex",
    // Process only visible elements for speed
    skipHtmlTags: { '[+]': ['mjx-container'] }
  }
};

// Fix HTML entities (&amp; → & etc.) in arithmatex containers so
// LaTeX alignment commands (cases, matrix, aligned) are not broken.
// Runs before each typeset pass.
function fixArithmatexEntities(root) {
  root.querySelectorAll('.arithmatex').forEach(function (el) {
    var s = el.textContent;
    if (s.indexOf('&') === -1) return;
    var t = document.createElement('template');
    // Assign to innerHTML so the browser decodes entities, then read back
    t.innerHTML = el.innerHTML;
    if (t.innerHTML !== el.innerHTML) {
      el.innerHTML = t.innerHTML;
    }
  });
}

// Typeset current page content
function typeset() {
  fixArithmatexEntities(document);
  MathJax.typesetPromise();
}

// Hook into MkDocs instant navigation
if (typeof document$ !== 'undefined') {
  document$.subscribe(typeset);
}
