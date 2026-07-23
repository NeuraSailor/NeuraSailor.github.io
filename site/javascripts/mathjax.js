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
    processHtmlClass: "arithmatex"
  }
};

// Fix HTML entities (&amp; &lt; &gt;) in arithmatex containers
// MkDocs escapes & in LaTeX alignment environments, breaking them.
// Use textContent → textarea decode → innerHTML for safe decoding.
function fixArithmatexEntities(root) {
  var els = root.querySelectorAll('.arithmatex');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var raw = el.textContent;
    // Only process if there are HTML entities to decode
    if (raw.indexOf('&') === -1) continue;
    var ta = document.createElement('textarea');
    ta.innerHTML = el.innerHTML;
    el.innerHTML = ta.value;
  }
}

function typesetCurrentPage() {
  fixArithmatexEntities(document);
  MathJax.typesetPromise([document.body]);
}

if (typeof document$ !== 'undefined') {
  document$.subscribe(typesetCurrentPage);
}
