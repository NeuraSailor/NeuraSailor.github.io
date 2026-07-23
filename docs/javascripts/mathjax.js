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

  chtml: {
    // Use CSS font for faster rendering (no webfont download)
    mathmlSpacing: false
  },

  options: {
    ignoreHtmlClass: "no-mathjax",
    processHtmlClass: "arithmatex"
  }
};

// Fix HTML entities (&amp; → & etc.) in arithmatex containers
function fixArithmatexEntities(root) {
  root.querySelectorAll('.arithmatex').forEach(function (el) {
    var s = el.textContent;
    if (s.indexOf('&') === -1) return;
    var t = document.createElement('template');
    t.innerHTML = el.innerHTML;
    if (t.innerHTML !== el.innerHTML) {
      el.innerHTML = t.innerHTML;
    }
  });
}

// Mark all arithmatex elements on the page as "done" so CSS opacity
// flips from 0 to 1, revealing the rendered math.
function markDone(root) {
  root.querySelectorAll('.arithmatex').forEach(function (el) {
    el.classList.add('mjx-done');
  });
}

function typesetCurrentPage() {
  fixArithmatexEntities(document);
  MathJax.typesetPromise([document.body]).then(function () {
    markDone(document);
  });
}

if (typeof document$ !== 'undefined') {
  document$.subscribe(typesetCurrentPage);
}
