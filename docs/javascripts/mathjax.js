window.MathJax = {
  startup: {
    ready: function () {
      // Fix HTML entities in LaTeX formulas caused by MkDocs HTML escaping:
      //   &amp;  →  &  (column separators in cases, matrix, aligned, etc.)
      //   &lt;   →  <  (less-than signs)
      //   &gt;   →  >  (greater-than signs)
      //   &quot; →  "  (rarely used in math)
      const fixEntities = function (element) {
        const divs = element.querySelectorAll('.arithmatex');
        divs.forEach(function (div) {
          const html = div.innerHTML;
          let cleaned = html
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');
          if (cleaned !== html) {
            div.innerHTML = cleaned;
          }
        });
      };

      // Fix entities before MathJax typesets
      fixEntities(document);

      // Re-fix after each instant navigation page load
      if (typeof document$ !== 'undefined') {
        document$.subscribe(function () {
          fixEntities(document);
        });
      }

      // Proceed with MathJax's normal startup
      MathJax.startup.defaultReady();
      MathJax.startup.promise.then(function () {
        // Initial typeset is handled by the ready hook
      });
    }
  },

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

// Trigger typesetting on every page navigation (MkDocs instant navigation)
document$.subscribe(function () {
  MathJax.typesetPromise();
});
