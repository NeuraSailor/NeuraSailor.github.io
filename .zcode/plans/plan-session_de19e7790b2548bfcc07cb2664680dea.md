# 存档 + 发布

## 1. 会话存档 → Obsidian vault

写 `D:\Obsidian\claudevault\01_项目\知识花园多皮肤主题系统-2026-10-25.md`（按全局约定「尽量简洁」）：
- 主题宏层架构一句话（共享语义 DOM × 可插拔皮肤 CSS，glob 自动发现，`<html data-skin>` + localStorage + 防闪白内联脚本）
- 五皮肤清单与各自规范来源（液态玻璃=默认基准 / 新拟态、LaTeX 论文、反设计=stylekit / 霍格沃兹=旧 MkDocs 主题迁入）
- 关键机制：换肤弹出菜单（注册表驱动）、明暗跨导航恢复（astro:after-swap）、callout 分桶特异性坑（`.md-content .callout--*` 高特异性写法）
- 霍格沃兹特效层与微交互清单（金尘/星空烛光/光带/彗星头/hr 魔法伸开等）
- 维护入口：`src/themes/_contract.md` 契约、新增皮肤三步、换默认皮肤改 `site.config.ts`

## 2. 提交 source 分支（首次提交整个 Astro 时代，含全部本会话工作）

`git add -A && git commit`，中文信息，要点：
- V3 重构落库：Astro 5 + 内容管线（remark-garden、KaTeX 预渲染、Pagefind、View Transitions）
- 主题宏层：base 结构层与皮肤分离、皮肤 link 启停机制、注册表自动发现
- 五皮肤：liquid-glass（基准）/ neumorphic / latex-paper / anti-design / hogwarts
- 换肤弹出菜单、明暗换页丢失修复、==荧光笔== 渲染、callout 类型分色特异性修复
- 霍格沃兹魔法特效层与微交互

不 push source（约定：不主动 push）。

## 3. 发布

`npm run deploy`（= prebuild 同步资源 → astro build → linkcheck 0 断链 → deploy.mjs 强推 dist → gh-pages）→ 线上 https://neurasailor.github.io/ 生效。

## 4. 线上验证

curl 线上首页：HTTP 200、HTML 含全部 5 个 `data-skin-link` 与「霍格沃兹」注册项，确认发布成功并汇报。