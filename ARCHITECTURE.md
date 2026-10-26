# ARCHITECTURE.md — 架构全景（v3.9）

> 生成于 v3.9 架构审计：四路只读审计（内容管线 / 主题系统 / 前端交互 / 构建部署与仓库卫生）后的结构化汇总。
> 分工：**本文**管「是什么、在哪、为什么」；[AGENTS.md](AGENTS.md) 管 AI 协作操作守则；`src/themes/_contract.md` 管皮肤契约。

## 0. 一句话

个人知识花园：Obsidian vault 同步到 `docs/`，**Astro 5** 构建为纯静态站（256 篇 md / 494 张图），一套语义 DOM × 六套可插拔皮肤（liquid-glass 默认 / neumorphic / latex-paper / anti-design / hogwarts / developer-terminal），发布到 GitHub Pages（neurasailor.github.io）。

## 1. 全景分层

```
Obsidian vault（源，仓库外）
        │ 人工同步（内容文件一字不动）
        ▼
docs/*.md + docs/assets/            ← 内容层（Obsidian 原生语法原样保留）
        │ predev/prebuild: scripts/sync-assets.mjs（仅 assets → public/assets）
        ▼
Astro 构建（npm run build，只读消费 docs/）
  ├ content.config.ts     glob loader + 自定义 generateId（URL 保留大小写）
  ├ remark-garden.ts      构建期语法统一转换（见 §2）
  ├ rehype-katex          构建期公式预渲染（strict:false）
  ├ shiki 双主题           构建期代码高亮（全局色板，皮肤不可换）
  └ astro-pagefind        构建后生成搜索索引
        ▼
dist/（纯静态）
  ├ 表现层 = styles/base.css（共享结构层）× themes/<id>/*.css（皮肤，一目录一皮肤）
  └ 交互层 = scripts/site.ts（生命周期）+ components/*（零内嵌样式）+ mermaid@11（CDN 运行时）
        ▼
发布：CI（push main/master）或 npm run deploy → gh-pages → neurasailor.github.io
```

## 2. 内容管线（docs/ → HTML）

### 数据流与责任人

| 步骤 | 责任文件 | 说明 |
|---|---|---|
| vault → docs/ | 人工（仓库外） | 内容层一字不动，`[[wikilink]]`、`![[图片]]`、`> [!callout]` 原样保留 |
| assets 同步 | `scripts/sync-assets.mjs` | `docs/assets` → `public/assets` 整目录复制，挂 predev/prebuild（只增不删；附 basename 重复警告） |
| 内容收集 | `src/content.config.ts` | glob `docs/**/*.md`（排除根 index、`.history`、`.obsidian`）；`generateId` 保留原始大小写与中文路径、折叠 `/index`——entry.id 即路由 |
| remark 管线 | `astro.config.mjs` | 顺序 **remarkMath → remarkGfm → remarkBreaks → remarkGarden**（Math 先于 Breaks，否则 `$` 块公式被 `<br>` 切碎） |
| rehype 管线 | `astro.config.mjs` | `rehype-katex`（strict:false，output:htmlAndMathml）构建期预渲染 + shiki 双主题 |
| 标题/侧栏公式 | `src/lib/katex-text.ts` | 构建期渲染（output:html，无 MathML 副本——标题场景可接受） |
| 运行时增强 | `src/scripts/site.ts` | mermaid@11（CDN）渲染（含 xmind 转出的 mindmap）、源码存档 `dataset.src`、明暗/皮肤切换时重渲染 |
| 收尾审计 | `scripts/linkcheck.mjs` | 本地扫 dist 全部 href/src，0 断链为准（注意：不覆盖 `.garden-missing` span） |

### remark-garden 内部顺序（唯一转换入口）

mermaid 围栏 → MkDocs `!!!` 归一化（仅根级、内容限缩进块）→ **wikilink（先于 $ 配对**，防公式型文件名被切碎；`.pdf`/`.xmind` 附件在此分流：嵌入 → `.pdf-embed` iframe / 构建期转 mermaid mindmap，非嵌入 → 原文件链接，缺文件或解析失败 → garden-missing）→ Obsidian 段落级 `$` 配对 → `==高亮==` → `<mark>` → 图片按 basename 扁平到 `/assets/`（依赖全局唯一，已验证）→ `.md` 相对内链解析 → `$` 残骸抢救 → 空公式清理 → 残骸拆分 → callout → `<aside>/<details>`（canon 11 型）

未解析引用降级为 `.garden-missing` span（诚实降级，六皮肤均有样式）。

## 3. 主题系统（格式与内容分离）

- **DOM 不携带皮肤决策**：markup 无皮肤类、组件无 `<style>`；换肤 = 换一套全局 CSS。
- **加载链**（SSR 固定顺序，顺序决定覆盖权）：`base.css` → `katex.min.css` → 全部皮肤 `<link data-skin-link>`（仅默认启用，其余 disabled + preload，切换零下载等待）→ `#skinRegistry` JSON → 防闪白内联脚本。
- **切换链**：`#skinToggle` → `.skin-menu`（注册表驱动，`site.ts` 注入）→ `chooseSkin` → `applySkin`（翻 `data-skin` + link 启停双写）→ `storePref('garden-skin')` → `rerenderMermaid()`。
- **swap 传递**：`astro:before-swap` 把当前明暗/皮肤/link 启停态预写进新文档（消闪跳）→ `astro:after-swap` 兜底校正并清菜单引用。
- **注册表**：`src/lib/themes.ts` 用 `import.meta.glob` 自动发现 `src/themes/*/index.css`；`defaultSkin` 唯一决定点在 `src/site.config.ts`。`MERMAID` 映射表机制已接线但当前为空（全部皮肤走默认 neutral/dark）。
- **新增皮肤三步**（详见 `_contract.md`）：建目录五文件（skin/chrome/content/motion + index.css）→ `LABELS` 注册显示名 → build 绿 + 截图走查。
- **契约要点**：19 项必需令牌、chrome/content 选择器集、callout 11 型、功能性段落；已知豁免——developer-terminal 允许明暗反向档与 75ms 动效（其设计语言）。

## 4. 前端交互生命周期

**三层绑定模型**：

1. **模块级常驻**（跨 swap 存活，模块级布尔守卫防重挂）：scroll/resize rAF 节流、系统主题 matchMedia、skin-menu 的 document 级委托、⌘K 快捷键、三个 swap 生命周期钩子。
2. **astro:page-load 重绑**（`init()`）：themeToggle/skinToggle/sidebar/copy/reveal/backtop/countUp/mermaid——绑定对象都随 swap 重建；三个 IntersectionObserver（toc/reveal/count）为模块级变量 + `disconnect()` 后重建。
3. **组件自治**：SearchPalette 全部 document 级委托 + `astro:after-swap` 收起，不依赖 page-load（⌘K 经 `#searchToggle.click()` 间接触发它）。

**外观状态管线**：localStorage 三键（`garden-theme` / `garden-skin` / `garden-sidebar`）+ `data-theme`/`data-skin` 内存态；恢复链 = Base.astro 内联脚本（首载）→ before-swap 预写新文档 → after-swap 兜底。

**样式分层**：`base.css` = reset + 结构令牌 + 布局骨架；交互态样式（skin-menu、scrim、reveal 等）全部在皮肤层，由 `_contract.md` 列名管辖。

## 5. 构建与发布

- **命令链**：`npm run build`（prebuild 同步 assets → astro build）→ `dist/`；`npm run linkcheck` 审计 dist；`npm run deploy` 在 dist 内 `git init` 强推 gh-pages。
- **CI**（`.github/workflows/ci.yml`，唯一 workflow）：push main/master 或手动 → Node 22 → npm ci → build → linkcheck → peaceiris/actions-gh-pages@v4（force_orphan 全量重建）。
- **依赖卫生**：无幽灵依赖；mermaid@11 是 CDN 运行时依赖（非 npm 包），首渲染依赖 jsdelivr 可达；fflate 仅构建期使用（xmind 解包）。
- ⚠ **发布现状（v3.9 审计时点）**：V3 全部提交仅在 `source` 分支；`main` 停在 2026-07-29、`gh-pages` 停在 2026-09-09 的 MkDocs 部署——**线上仍是旧 MkDocs 站，Astro 版从未上线**。上线动作：合并 source→main 触发 CI，或本地 `npm run deploy`。

## 6. 仓库根地图

```
仓库根/
├── docs/                    # 内容层（Obsidian 同步产物，一字不动）
├── public/assets/           # prebuild 由 docs/assets 再生（v3.9 起不入库）
├── scripts/                 # sync-assets.mjs / linkcheck.mjs / deploy.mjs
├── src/                     # 前端源码（目录树见 AGENTS.md「前端结构」）
│   └── themes/_contract.md  # 皮肤契约（改皮肤前必读）
├── .github/workflows/ci.yml # 唯一 CI
├── AGENTS.md                # AI 协作操作守则
├── ARCHITECTURE.md          # 本文
├── README.md                # 项目门面
└── DESIGN_SPEC.md           # ⚠ 历史文档（V2/MkDocs 时代手册，仅供考古）
```

## 7. 不变量清单（违反即回归）

1. `docs/` 内容文件一字不动——源在 Obsidian vault，构建只读
2. URL 保留原始大小写：`generateId` 必须保持自定义（Astro 默认 slugify 会破坏外链）
3. 始终 `npm run build`（prebuild 同步 assets），严禁裸 `astro build`
4. remarkMath 必须在 remarkBreaks 之前；wikilink 转换必须在 `$` 配对之前
5. 组件零内嵌样式；DOM 不携带皮肤决策；改皮肤前必读 `_contract.md`
6. 图片按 basename 扁平到 `/assets/`，依赖文件名全局唯一（新增图片先查重名）
7. 交互绑定两范式：随 swap 重建的 DOM 走 `astro:page-load` 重绑；跨 swap 常驻监听只挂一次（模块级布尔守卫）；IntersectionObserver 用模块级变量 + disconnect 再重建
8. localStorage 读写一律走 try/catch 包装（`storedPref`/`storePref`），隐私模式静默降级
9. 改 remark 插件 / content.config 后：`rm -rf .astro node_modules/.astro` 再构建
10. 改任何皮肤后：build 绿 + linkcheck 0 断链 + 截图走查（桌面/移动 × 亮/暗）

## 8. 文档地图

| 文档 | 职责 |
|---|---|
| [README.md](README.md) | 项目门面（人看的第一页） |
| [AGENTS.md](AGENTS.md) | AI 协作操作守则（怎么改） |
| ARCHITECTURE.md | 架构全景 + 问题登记簿（本文） |
| `src/themes/_contract.md` | 皮肤契约（皮肤怎么写、验收标准） |
| DESIGN_SPEC.md | ⚠ 历史文档（V2 重构手册，MkDocs 时代，仅供考古） |

## 9. 问题登记簿（v3.9 审计快照）

### A. 代码修复候选（本版未动，建议下个版本专门提交）

- **[中] `initSidebar` 裸调 localStorage**（site.ts 的 sidebar 路径）：提交 13b96bf 的安全包装漏改此处；storage 抛错时（隐私模式等）会中断整个 `init()`，TOC/复制/渐入/回顶/mermaid 全部失效
- **[中] after-swap 主题兜底不消费运行时态**：用 `stored ?? system` 无条件覆盖，隐私模式下（写入失败只留内存态）手动主题在导航后丢失——与皮肤路径的对称兜底不一致
- **[中] `![[页面]]` 笔记嵌入被误判为图片**：remark-garden 的 bang 判定不回退页面解析，产出「未找到图片」占位（已受害实例：`互感（物理）.md` 的 `![[磁场能量密度]]`）
- **[低·值得顺手修]** Base.astro 防闪白内联脚本裸用 localStorage（抛错连皮肤恢复一并跳过）；`chooseSkin` 同皮肤早退不关菜单；anti-design `--dur-base` 已声明未用于 search-palette 关闭；base.css `scroll-behavior:smooth` 无 reduced-motion 降级；SearchPalette Tab 循环死分支；断点 900/901 的 1px 死区；`/^#\s/m` 会误触 fenced code 内注释行（title fallback）；`themes.ts` 的 MERMAID 空表（填表或删机制，二选一）

### B. 发布与仓库（需人工决策，本版未动）

- **[高] 发布链路断裂**：线上 gh-pages 仍是旧 MkDocs 产物（见 §5 现状）——需合并 source→main 或 `npm run deploy`，属对外发布动作，不自动执行
- [低] CI 无 concurrency 组（连续 push 可并发 force-push gh-pages）
- [低] 本地重残留：`.publish/` 349MB（含内嵌 .git）、`.worktrees/` 1.8GB、v4/v5 分支与 v3 同 commit 纯重复
- [低] `deploy.mjs` 硬编码推送 URL（应读 origin remote）；`tsconfig.json` exclude 的 `"site"` 目录已不存在

### C. 已在 v3.9 处理

- untrack：`.history/`（60 文件，含 mkdocs 历史残留）、`public/assets/`（494 个可再生文件）、`.zcode/plans`（2 个会话工件）；`.gitignore` 补 `.zcode/` 与 `public/assets/`
- README.md 重写（原为 obsidian-publish-mkdocs 模板原文）；CLAUDE.md 改 `@AGENTS.md` 导入存根；DESIGN_SPEC.md 加历史头注
- 文档漂移修正：AGENTS.md（补 `==高亮==` 与 `.md` 内链两项变换、mermaid 映射措辞校准 + CDN 注记、发布现状注记）、`_contract.md`（callout 12→11 型、is-scrolled 可选、明暗反向档条款、75ms 豁免）

### D. 观察项（暂不处理）

- MkDocs admonition 支持面窄（仅根级 + 缩进块内容，当前 3 处实存均无实害）
- dev 模式 `buildMaps` 缓存永不失效（重启 dev server 即解）
- `.md` 内链兜底丢弃 anchor（诚实降级，linkcheck 兜底）
- TOC rootMargin 硬编码 −64px 与 `--toolbar-h: 56px` 不同源；IO disconnect 先后顺序两种写法并存
