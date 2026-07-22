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

  document$.subscribe(() => {
    MathJax.typesetPromise()
  })
