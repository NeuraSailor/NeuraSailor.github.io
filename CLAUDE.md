# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal knowledge garden/blog site using **Obsidian + MkDocs** for publishing notes publicly. Content originates from a Quartz vault and gets converted to MkDocs format for deployment.

## Key Commands

### Local Development
```bash
# Serve the site locally with live reload
mkdocs serve

# Build the static site to ./site/
mkdocs build
```

### Content Sync & Conversion
```bash
# Sync content from Quartz vault and convert to MkDocs syntax
python convert_obsidian_to_mkdocs.py

# Convert MkDocs admonitions back to Obsidian callout format
python convert_callouts.py
```

### Deployment
```bash
# Deploy to GitHub Pages (handled by CI on push to main)
mkdocs gh-deploy --force
```

## Architecture

### Content Pipeline
1. **Source**: Obsidian vault in `C:/Users/WUZHO/Desktop/quartz/content`
2. **Sync**: `convert_obsidian_to_mkdocs.py` copies files from Quartz to `docs/` and converts syntax
3. **Build**: MkDocs compiles `docs/` into static HTML in `site/`
4. **Deploy**: GitHub Actions deploys `site/` to GitHub Pages via `mkdocs gh-deploy`

### Conversion Scripts

**`convert_obsidian_to_mkdocs.py`** - One-way sync from Obsidian to MkDocs:
- Copies files from Quartz source directory to `docs/`
- Converts `[[wikilinks]]` to standard Markdown links
- Converts Obsidian callouts (`>[!note]+`) to MkDocs admonitions (`!!! note`)
- Fixes image paths for relative asset references
- Cleans Obsidian-specific frontmatter fields

**`convert_callouts.py`** - Bidirectional callout conversion:
- Converts MkDocs admonition syntax back to Obsidian callout format
- Loads Quartz callout metadata to preserve fold state and content counts

### MkDocs Configuration (`mkdocs.yml`)
- **Theme**: Material for MkDocs with Chinese language support
- **Features**: Instant navigation, expandable sections, integrated TOC
- **Plugins**: `callouts` (with aliases), `ezlinks` (for wikilinks), `statistics`, search (zh/en/ja)
- **Extra**: MathJax for LaTeX math, Mermaid diagrams, LXGW WenKai font

### Directory Structure
```
docs/           - Published Markdown content (synced from Quartz)
site/          - Built static HTML output
docs/assets/    - Images and media
docs/javascripts/ - MathJax configuration
docs/stylesheets/ - Custom CSS
mkdocs.yml     - Site configuration
```

### Content Organization
```
docs/
├── index.md           - Home page
├── 大一上/            - Freshman year notes
├── 大一下/            - Sophomore year notes
├── 大二上/            - Junior year notes
├── 学习笔记/          - Study notes (Calculus, Physics, etc.)
├── 机械臂blog/        - Robotic arm blog
└── 其他/              - Miscellaneous
```
