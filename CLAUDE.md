# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal knowledge garden/blog site using **Obsidian + MkDocs** for publishing notes publicly. Content originates from a Quartz vault and gets converted to MkDocs format for deployment.

## Key Commands

### 本地开发

```bash
# 用 serve.ps1 启动（它会先杀旧进程，避免 Windows 端口冲突）
# 严禁直接输入 `mkdocs serve`
./serve.ps1

# 仅构建不发布
mkdocs build
```

### 发布到 GitHub Pages

**完整流程：**

1. 在 `docs/` 下写好 `.md` 文件
2. `./serve.ps1` 本地预览确认无误
3. 在 `source` 分支提交源文件
4. `mkdocs gh-deploy --force -b gh-pages` 构建并推送到发布分支
5. 等 1-2 分钟 CDN 刷新后访问 `https://NeuraSailor.github.io/`

**分支架构：**

- `source` — 源码（markdown/CSS/JS），日常开发在此分支
- `gh-pages` — 仅放构建产物 HTML，GitHub Pages 从此分支的 root 读取

## Architecture

### Content Pipeline

1. **Source**: Obsidian vault in `C:/Users/WUZHO/Desktop/quartz/content`
2. **Sync**: `convert_obsidian_to_mkdocs.py` copies files from Quartz to `docs/` and converts syntax
3. **Build**: MkDocs compiles `docs/` into static HTML in `site/`
4. **Deploy**: `mkdocs gh-deploy --force -b gh-pages` pushes built HTML to `gh-pages` branch, served by GitHub Pages

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
