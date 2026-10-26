# 主题契约（皮肤系统规范）

本站 = **稳定语义 DOM（内容结构层）× 可插拔皮肤（设计层）**。内容管线（remark-garden、
content collection）与组件 DOM 不携带任何主题决策；一套 DOM 通过替换全局 CSS 即可
呈现完全不同的设计语言。本文是皮肤必须遵守的契约——新皮肤照单全收即可独立开发。

## 加载与切换机制

- `<head>` 中样式顺序固定：`base.css`（共享结构层）→ `katex.min.css` → 皮肤 `<link>`
  （顺序决定覆盖权，皮肤可覆盖 KaTeX 默认样式）
- `Base.astro` 渲染**全部**皮肤的 `<link data-skin-link="<id>">`，仅默认皮肤启用，
  其余 `disabled` 随行（另有 `rel=preload` 预取），切换零下载等待
- `<html data-skin>` 是唯一真值；`localStorage['garden-skin']` 持久化；
  防闪白内联脚本位于 link 之后执行翻转（View Transitions 安全，照抄 `garden-theme` 模式）
- `src/scripts/site.ts` 的 `initSkin()`：`#skinToggle` 点击 → 弹出
  **换肤选择菜单**（`.skin-menu`，注册表驱动渲染；点击选项 → 翻转
  `data-skin` + 链接启停 + `rerenderMermaid()`，mermaid 主题按皮肤映射；
  Escape / 外点关闭，上下键在选项间移动）
- 注册表 `src/lib/themes.ts`：`import.meta.glob('../themes/*/index.css', {query:'?url'})`
  **自动发现**皮肤目录；`LABELS`/`MERMAID` 表补中文显示名与 mermaid 明暗主题映射

### 新增皮肤三步

1. 新建 `src/themes/<id>/`：`skin.css / chrome.css / content.css / motion.css` +
   `index.css`（四行 `@import`）
2. `themes.ts` 的 `LABELS` 加显示名（可选：`MERMAID` 加图表主题映射）
3. `npm run build` 绿 + 按下文「验证要求」截图走查

### 换默认皮肤

`src/site.config.ts` 改 `defaultSkin` 一行，重建即生效（访客手动选择仍存 localStorage）。

## skin.css 必须提供的令牌

共享层 `base.css` 消费（缺一页面即裸奔）：

- 字体：`--font-system` / `--font-mono`；字阶 `--text-caption … --text-large`（至少 `--text-body`）
- 颜色：`--bg` / `--label` / `--label-2..4` / `--accent` / `--accent-raw`（R,G,B 三元组）/
  `--accent-hover` / `--separator` / `--fill` / `--fill-2`
- 代码：`--code-bg` / `--code-bg-block` / `--code-border`
- 上述全部需提供 `[data-theme='dark']` 暗色值（明暗双模式是一等公民）；允许反向档：
  `:root`=暗 + `[data-theme='light']` 覆盖亮色（developer-terminal 先例）
- 结构令牌（间距/布局尺寸/z 层）默认在 `base.css`，皮肤可按需覆盖（如圆角 `--r-*` 归皮肤）

## chrome.css + content.css 必须实现的选择器集

### 组件（BEM，结构见 src/components/）

- `toolbar` 及子元素（滚动态 `is-scrolled` 可选：无滚动视觉变化的皮肤可不实现，
  site.ts 会照常加该类）、`progress`/`progress__bar`
- `icon-btn`（≥44×44 命中区，`:hover`/`:active` 必须有按压反馈）、`icon-btn--search`、
  `icon-btn--github`；**≤640px 窄屏需处理**：搜索收为图标、GitHub 隐藏（页脚可达），
  按钮位次序「搜索/皮肤/明暗」优先——否则站名被挤爆
- `sidebar`：桌面 sticky；≤900px 变抽屉（`transform` 滑入 + `is-open`/`is-collapsed`）
- `sidebar__scroll/__label`、`nav-item`（`is-active`）、`nav-group` 全家（chevron 旋转）
- `toc`：桌面显示、≤1279px 隐藏；`a.is-active` 高亮
- `tabbar`：≤900px 显示为 fixed 悬浮栏；`tabbar__item.is-active`
- `scrim`（`is-open`）、`backtop`（`is-visible`）
- `skin-menu` 全家（site.ts 注入）：`.skin-menu`（fixed 定位，inline style
  定 top/left）、`.skin-menu__label`、`.skin-menu__item`（`is-active` 当前
  皮肤，`::before` 为选择指示点/块）、`is-open` 淡入（入场约 120-200ms，
  JS 关闭动画计时 200ms；developer-terminal 豁免 75ms，掉帧感是其设计语言）
- `ambient`：至少 `display:none` 或给出自己的环境层
- 首页 `home` 全套（`home-card` 系列、`home-stat`、`home__*`）
- `search-palette` 全套：**`[hidden]` 显式压制**（外层 display:flex 会盖过 UA 的
  display:none）、`is-open` 面板入场、**关闭过渡时长 ≈280ms**（`SearchPalette.astro`
  的 closeTimer 硬编码 280ms，写死或用 `--dur-base: 280ms` 对齐）

### 功能性段落（缺了功能坏，不是风格问题）

- `[data-theme='light'] #themeToggle .ico-moon` / `[data-theme='dark'] #themeToggle .ico-sun`
  显隐（日月图标随明暗切换）
- `[data-theme='dark'] .md-content pre.astro-code` 的 `--shiki-dark`/`--shiki-dark-bg`
  变量切换（Shiki 双主题，需 `!important` 压内联 style）
- `html.has-modal` 已在 base.css（滚动锁），无需重复

### 内容层（remark-garden 插件产物契约）

- `.md-content` 全套正文排印（标题/列表/表格/图片/脚注/引用/`hr`）
- **callout 11 型**（canon 集合 = `remark-garden.ts` 的 `CALLOUT_TYPES`：
  note / abstract / info / tip / important / example / warning / danger / quote /
  success / question）：`.callout`（`aside` 或 `details`）、`.callout--<type>` 提供
  `--co`（R,G,B）与 `--callout-icon`、`.callout__title::before`（mask 图标）、
  折叠 chevron（`details.callout[open]`）、按压反馈；亮暗各一套类型色
- `.garden-missing`（未解析引用的诚实降级）
- `pre.mermaid`（透明底、居中、横向滚动）
- `.pdf-embed`（附件阅读容器，v4.0 嵌入 + v4.1 一等公民内容页共用：
  `.pdf-embed__open` 顶部打开/下载链接 + `.pdf-embed__frame` iframe/挂载点；
  高度用 `var(--pdf-frame-h, min(72vh, 560px))`——嵌入用默认值，
  内容页由页面侧设 `--pdf-frame-h: calc(100vh - 300px)` 全高；
  每皮肤按设计语言给容器框与标题栏感，可点目标 ≥44×44、:active 按压态）；
  xmind 两轨：正文嵌入复用 `pre.mermaid`（构建期转 mindmap，见
  `src/lib/xmind-to-mermaid.ts`）；一等公民内容页 = `.pdf-embed` 外壳 +
  `[data-xmind-src]` 挂载点（复用 `.pdf-embed__frame` 类取高度），
  由 site.ts `initXmind()` 挂 xmind-embed-viewer（官方渲染器，皮肤只包壳）；
  皮肤层均零新增选择器
- `.katex-display` 横向滚动、`.katex-error` 安静降级（源码文本）
- `.code-copy`（JS 注入的复制按钮）：`is-copied`/`is-error` 两态

### JS 状态类（脚本只加类，外观解释权在皮肤 CSS）

`is-scrolled` `is-collapsed` `is-open` `is-active` `is-flipped`（明暗翻转动画，可不理会）
`is-visible` `is-copied` `is-error` `theme-transition`（明暗/皮肤切换时的过渡类）

## 已知限制

- Shiki 语法色板是构建期全局配置（`astro.config.mjs` 的双主题），皮肤只能换代码块
  背景与周边，不能换语法配色
- 皮肤切换为瞬切（无跨皮肤形变动画）；`theme-transition` 类只平滑颜色/阴影
- 组件内**禁止** `<style>` 皮肤决策（曾经的三处飞地已收拢；Astro scoped 选择器
  特异性会压过皮肤 `<link>`，导致换肤失败）

## 验证要求

改任何皮肤后：`npm run build` 绿 + `npm run linkcheck` 0 断链 + 截图走查
（桌面/移动 × 亮/暗 × 受影响皮肤）。`liquid-glass` 是基准皮肤，无理由不得回归；
`neumorphic` 按 stylekit 新拟态规范验收（同色表面、双影三态、禁位移/渐变）；
`latex-paper` 按 stylekit latex-paper 规范验收（白纸墨字、衬线、零圆角/
零阴影/零渐变、booktabs 三线表、蓝只作链接、唯一 fade-in 动效；暗色为
夜间纸自适配档）；`anti-design` 按 stylekit anti-design 规范验收（4px+ 黑框、
硬偏移阴影、高饱和原色、零圆角/渐变/半透明、100ms linear 直切、
禁单侧彩色条纹；暗色为反相档）；`hogwarts` 按旧 MkDocs 站 hogwarts.css
与 hogwarts-theme 技能库验收（奶油纸/烛光密室双档、暗金强调、
五色渐变顶规、恒暗代码 #1e1e36、深色公式框、h1/h2/h3 金饰签名、
零 webfont）；`developer-terminal` 融合 stylekit developer-terminal ×
pixel-anime 验收（NES 六色 RPG 终端：内容整页会话化——VIEWER.EXE 标题栏/
cd 面包屑/'>' 金字页题+闪烁光标/命令流 h2/输出正文/[EOF]；2px 蓝框+
外扩双线+硬偏移阴影+对角像素角块；75ms linear 掉帧感、步进 2px 悬停、
挤压拉伸按压、角块仅悬停闪烁；恒暗代码/公式子窗；暗色=规范原档、
亮色=白昼会话深化档）。
