# NeuraSailor 知识花园

个人知识花园：Obsidian vault 的内容同步到 `docs/` 后，由 **Astro 5** 构建为纯静态站点，发布在 [neurasailor.github.io](https://neurasailor.github.io/)。

- 内容层一字不动：保留 `[[wikilink]]`、`![[图片]]`、`> [!callout]` 等 Obsidian 原生语法，构建期统一转换
- 表现层可插拔：一套语义 DOM × 六套皮肤——liquid-glass（默认）/ neumorphic / latex-paper / anti-design / hogwarts / developer-terminal，访客可实时切换
- 明暗双模式、Pagefind 全文搜索（⌘K）、KaTeX 构建期预渲染、mermaid 客户端渲染

## 常用命令

```bash
npm run dev        # 开发服务器（自动先同步 docs/assets → public/assets）
npm run build      # 生产构建 → dist/
npm run preview    # 预览 dist
npm run linkcheck  # 全站断链审计（要求 0 断链）
npm run deploy     # build + linkcheck + 推送 gh-pages
```

## 仓库导览

| 位置 | 内容 |
|---|---|
| `docs/` | 内容层（Obsidian 同步产物，一字不动） |
| `src/` | 站点源码（页面 / 布局 / 组件 / 皮肤 / 交互脚本） |
| `src/themes/_contract.md` | 皮肤契约（新增或修改皮肤前必读） |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 架构全景：管线、主题系统、交互生命周期、问题登记簿 |
| [AGENTS.md](AGENTS.md) | AI 协作操作守则 |
| `DESIGN_SPEC.md` | 历史文档（V2 / MkDocs 时代，仅供考古） |

## 发布

- 日常开发在 `source` 分支；push 到 main/master 时 GitHub Actions 自动构建并推 gh-pages
- 手动发布：`npm run deploy`
