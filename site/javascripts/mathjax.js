window.MathJax = {
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    processEnvironments: true
  },
  options: {
    ignoreHtmlClass: ".*",
    processHtmlClass: "arithmatex"
  }
};

// Fix HTML entities (&amp; → & etc.) that MkDocs inserts into
// LaTeX alignment environments (cases, matrix, aligned).
// Use the textarea trick: innerHTML → browser entity-decode → value.
function fixArithmatexEntities(root) {
  var ta = document.createElement('textarea');
  var els = root.querySelectorAll('.arithmatex');
  for (var i = 0; i < els.length; i++) {
    ta.innerHTML = els[i].innerHTML;
    if (ta.value !== els[i].textContent) {
      els[i].innerHTML = ta.value;
    }
  }
}

function typeset() {
  fixArithmatexEntities(document);
  MathJax.typesetPromise([document.body]);
}

if (typeof document$ !== 'undefined') {
  document$.subscribe(typeset);
}

