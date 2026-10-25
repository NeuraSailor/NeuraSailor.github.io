# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

个人知识花园，**Astro 5 + 可插拔多皮肤**（liquid-glass 液态玻璃 / neumorphic 新拟态 / latex-paper LaTeX 论文 / anti-design 反设计 / hogwarts 霍格沃兹 / developer-terminal 开发者终端）构建的静态站点。内容源自 Obsidian vault，同步到 `docs/` 目录后由 Astro 构建。旧 MkDocs 栈已于 V3 重构时移除。

liquid-glass 设计规范依据：`C:\Users\WUZHO\.cc-switch\skills\apple-design-skill-main`（Apple HIG 参考 skill）；neumorphic 规范依据 stylekit neumorphism（同色表面 + 双影凸凹三态，禁位移/渐变）；latex-paper 规范依据 stylekit latex-paper（白纸墨字、衬线、零圆角/零阴影、booktabs 三线表、蓝只作链接）；anti-design 规范依据 stylekit anti-design（4px+ 黑框、硬偏移阴影、高饱和原色块、100ms linear 直切）；hogwarts 源自旧 MkDocs 站 hogwarts.css + hogwarts-theme 技能库（奶油纸/烛光密室、暗金、恒暗代码、深色公式框）；developer-terminal 融合 stylekit developer-terminal × pixel-anime（NES 六色 RPG 终端，内容整页会话化）。

## Key Commands

```bash
npm run dev        # 开发服务器（自动先同步 docs/assets → public/assets）
npm run build      # 生产构建 → dist/
npm run preview    # 预览 dist
npm run linkcheck  # 全站断链审计（256 页/1800+ 内链，要求 0 断链）
npm run deploy     # build + linkcheck + 推送 gh-pages
```

**严禁**直接 `astro build` 跳过 prebuild（会漏同步图片资源）——始终用 `npm run build`。

## 发布

- 日常开发在 `source` 分支；GitHub Actions（`.github/workflows/ci.yml`）在 push 到 main/master 时自动 Node 构建 + 推 gh-pages
- 手动发布：`npm run deploy`（构建+审计+强推 gh-pages）
- 站点地址：https://neurasailor.github.io/ （仓库 remote 即 NeuraSailor/NeuraSailor.github.io）

## Architecture

### 内容管线（内容文件一字不动）

```
Obsidian vault → 同步 → docs/*.md → Astro 构建（只读）
```

- `docs/` 保留 Obsidian 原生语法：`[[wikilink]]`、`![[图片|尺寸]]`、`> [!callout]` 折叠标记
- 构建期由 `src/plugins/remark-garden.ts` 统一转换：wikilink 解析（同名优先同目录）、图片按 basename 扁平到 `/assets/`（文件名已验证全局唯一）、callout → `<aside>/<details>`、MkDocs `!!!` 归一化、mermaid 围栏转客户端渲染
- 数学管线：`remarkMath`（必须在 `remarkBreaks` **之前**，否则 `$` 块公式被 `<br>` 切碎）+ `rehype-katex` 构建期预渲染（`strict:false`）；Obsidian 式段落级 `$` 配对与残骸抢救都在 remark-garden 内
- **URL 保留原始大小写**：content collection 的 `generateId` 必须保持自定义（Astro 默认会 slugify 成小写+连字符，破坏外链）
- Astro 的 markdown 渲染有内容摘要缓存：改 remark 插件后需 `rm -rf .astro node_modules/.astro` 再构建

### 前端结构

```
src/
├── site.config.ts      # 站点配置（defaultSkin：默认皮肤唯一决定点）
├── content.config.ts   # glob loader 读 docs/，自定义 generateId
├── pages/              # index.astro（首页着陆页）+ [...slug].astro（全部内容页）
├── layouts/            # Base.astro（全局壳，皮肤 link 注入与防闪白）/ Article.astro（文章页）
├── components/         # Toolbar/Sidebar/TabBar/Toc/SearchPalette/SidebarNode（零内嵌样式）
├── styles/base.css     # 共享结构层：reset + 结构令牌（间距/布局/z）+ 布局骨架
├── themes/             # 皮肤层（一目录一皮肤，_contract.md 为完整契约）
│   ├── liquid-glass/   #   Apple 液态玻璃（默认）
│   ├── neumorphic/     #   新拟态
│   ├── latex-paper/    #   LaTeX 论文（衬线学术排版）
│   ├── anti-design/    #   反设计（粗野主义原色块）
│   ├── hogwarts/       #   霍格沃兹（旧 MkDocs 主题迁入）
│   ├── developer-terminal/ # 开发者终端（终端风等宽）
│   └── <皮肤>/         #   skin(令牌)/chrome(控件)/content(正文)/motion(动效)/index.css
├── scripts/site.ts     # 全站交互（astro:page-load 感知；initSkin 皮肤切换）
└── lib/                # nav-tree / stats / themes(皮肤注册表自动发现) / katex-text
```

### 主题系统（格式与内容分离）

- **DOM 不携带皮肤决策**（markup 无皮肤类、组件无 `<style>`）；换肤 = 换一套全局 CSS
- 加载：base.css → katex → 皮肤 `<link data-skin-link>`（全部渲染、仅默认启用，
  其余 disabled 备用）；`<html data-skin>` + localStorage('garden-skin') + 防闪白内联脚本
- 切换入口：工具栏 `#skinToggle`（调色板图标）弹出选择菜单，访客可用；mermaid 主题随皮肤映射
- 新增皮肤：建 `src/themes/<id>/` 目录即可被 `lib/themes.ts` 自动发现（三步流程见契约）
- 换默认皮肤：改 `src/site.config.ts` 的 `defaultSkin` 一行重建
- **改动任何皮肤前先读 `src/themes/_contract.md`**（必须实现的令牌/选择器集/功能段落）

### 设计语言约束

通用（各皮肤共担）：
- 系统字体栈（衬线皮肤用 Georgia/Times + 宋体系，其余 -apple-system/PingFang SC…），零 CJK webfont
- 所有可点目标 ≥44×44；按钮必须有 :active 按压态；全部动效带 prefers-reduced-motion 降级
- 明暗双模式一等公民：所有颜色令牌亮暗双值
- 每改设计后需截图验证（桌面/移动 × 亮/暗 × 受影响皮肤）

liquid-glass（Apple HIG）：
- Liquid Glass 只用于控件与导航层；内容层安静不透明表面
- 唯一强调色 iOS 蓝（`--accent`）；弹性动效 `--ease-spring`（Q弹过冲）

neumorphic（新拟态）：
- 同色表面 + 左上亮影/右下暗影；凸起（可点）/平面/凹陷（激活、输入）三态
- 禁位移/缩放交互、禁渐变、禁纯黑纯白；圆角宁大勿小；阴影过渡 300ms ease-in-out
- 强调紫只用于文字与条纹，不作大面积背景；文字对比度独立校验（正文 ≥4.5:1）

latex-paper（LaTeX 论文）：
- 白纸墨字，层级靠横线（2px 墨粗规 / 1px 灰细规）与留白；零圆角/零阴影/零渐变
- 衬线排印（Georgia/Times + 宋体系）；章节自动编号（CSS 计数器 h2=1, h3=1.1）
- callout = 定理环境（#F5F5F0 填充 + 左墨规 + 小帽标签）；表格 booktabs 三线表
- 蓝 #0B5394 只作链接与焦点；hover 只加下划线不变色；唯一动效 fade-in 0.5s ease-out

anti-design（反设计）：
- 白底黑墨，4px+ 纯黑边框 + 硬偏移阴影（4/8/12px 无模糊）；零圆角/渐变/半透明
- 高饱和原色块（红/蓝/黄/青/绿/洋红）；红=主强调，蓝=链接与焦点，黄=高亮与激活
- 交互 100ms linear 直切：hover 位移 + 原色翻转，:active 按下阴影收缩；禁 ease 曲线
- 正文全粗体、标题全大写 font-black；callout 按原色分桶（danger 红底白字）
- 禁单侧彩色条纹、柔和投影、灰色文字于彩底；暗色 = 反相档（黑底白框白偏移阴影）

hogwarts（霍格沃兹，旧 MkDocs 主题迁入）：
- 亮=图书馆白天（奶油纸 #f5f0e8），暗=烛光密室（#1a1a2e）；暗金 #d4a855 主强调
- 签名：工具栏五色渐变顶规、金渐变发光进度条、h1 金下划线/h2 左金竖条/h3 金菱、
  链接金下划线扫入、strong 悬停跳起
- 代码恒暗 #1e1e36（Shiki dark 无条件启用）；展示公式=深色公式框（不改浅铁律）
- callout=tip-box 分桶；navy 表头表格；纸纹噪点 .ambient；零 webfont（系统衬线）
- 魔法特效层（纯 CSS，transform/opacity，reduced-motion 冻结）：Hero 双层金尘
  视差上浮、暗色星空闪烁+烛光顶晕、导航卡微光扫过、激活胶囊金光呼吸、
  进度条彗星头、h1 金线流光

developer-terminal（像素终端，terminal × pixel-anime 融合）：
- 内容 = 终端窗口里的会话：VIEWER.EXE 标题栏 → cd 面包屑 → '>' 金字页题 +
  闪烁光标 → stat 元信息 → h2 '>' 命令流 → 输出正文 → [EOF]
- NES 六色：紫底 #2d1b69/面板 #1a1040/蓝 #4a90d9 框与链接/金 #ffd93d 命令/
  绿 #50c878 激活/红 #ff6b6b 危险；全站等宽 + 全大写标题，零圆角/渐变/模糊
- 窗口语言：2px 蓝框 + 外扩双线 + 硬偏移阴影 + 对角像素角块（悬停闪烁）
- 交互 75ms linear 掉帧感：hover 步进 2px + 金色光晕方块阵，
  :active 挤压拉伸（scaleX1.08/scaleY0.92，禁等比）；callout=RPG 对话框，
  代码=OUTPUT 子窗、公式=CALC 子窗（恒暗），表格=任务日志，进度条=EXP 条
- 暗色=规范原档 NES 夜间；亮色=白昼会话（文字级四色深化）

### 客户端交互要点

- View Transitions（ClientRouter）：swap 会替换整个 document，事件绑定用 document 级委托或每次 `astro:page-load` 重绑（见 site.ts 模式）
- 搜索：Pagefind（构建后生成索引），⌘K 命令面板；中文输入需 `isComposing` 守卫
- Mermaid 源码存档在 `dataset.src`，主题切换时重渲染

## 内容组织（不变）

```
docs/
├── 学习笔记/   大一上/大一下/大二上 → 课程 → 笔记（最深四层）
├── 科研竞赛blog/  机械臂blog/ + 强化学习blog/
└── 唱唱反调/   平铺文章
```

目录即路由：`docs/学习笔记/index.md` → `/学习笔记/`；学期目录无 index 页属正常（仅侧栏导航节点）。

## 工作约定

- Git commit message 用中文；不主动 push
- 修改 remark 插件或 content.config 后：`rm -rf .astro node_modules/.astro && npm run build`
- 长会话连续导航的 IntersectionObserver 已做 disconnect 管理，新增观察器沿用同一模式
