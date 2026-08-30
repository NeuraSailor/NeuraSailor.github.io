---
title: 让 Claude Code 读懂你的文献库：Zotero × AI Agent 的正确打开方式
date: 2026-08-30
author: NeuraSailor × ClaudeCode
---

# 📚 让 Claude Code 读懂你的文献库：Zotero × AI Agent 的正确打开方式

> **作者**：NeuraSailor × ClaudeCode

---

## 0. 写在前面

如果你和我一样，既重度依赖 Zotero 管理文献，又已经开始用 Claude Code / Cursor 等 AI Agent 做科研辅助工作，那你大概率遇到过同一个问题——

**Zotero 里的文献，AI Agent 根本读不到。**

不是技术上做不到，而是 Zotero 的底层设计和 Agent 能理解的「世界模型」之间，存在一道根本性的鸿沟。这篇文章就是来讲清楚这道鸿沟是什么，以及如何用最简单的办法把它填平。

---

## 1. 核心矛盾：数据库 vs. 文件夹

先说结论：

> **Zotero 是数据库驱动的文献管理器，而所有 AI Agent 都只能理解文件系统。这两个世界的接口不兼容。**

### Zotero 的本质

Zotero 看起来是一个带文件夹的软件，但它的「文件夹」根本不是 Windows 资源管理器里的文件夹。你的文献、笔记、标签、元数据，全部存储在一个 SQLite 数据库里（`zotero.sqlite`），路径大概长这样：

```
C:\Users\你的用户名\Zotero\zotero.sqlite
```

你在 Zotero 界面里看到的「收藏夹」层级、文献条目、附件、笔记，全部是这个数据库里的记录，不是磁盘上的真实目录。

这意味着什么？意味着 Claude Code、Cursor、任何终端里的 Agent，想要「看」你的文献，必须先理解怎么解码一个 SQLite 数据库——而且是 Zotero 自己定义 schema 的那种。

### AI Agent 的世界模型

不管是 Claude Code 还是 Cursor，它们理解科研工作的底层模型都是 **文件系统 + Markdown**：

- 读文件：`cat paper.md`、`Read("paper.pdf")`
- 遍历目录：`ls references/`、`Glob("**/*.md")`
- 搜索内容：`Grep("transformer attention")`、全文检索

这三件事在 Obsidian 里毫无障碍，因为 Obsidian 本质就是一个文件夹里放了一堆 `.md` 文件。但对 Zotero 来说，这三件事全都做不了——因为文献不在文件夹里，在数据库里。

**这就是根本矛盾：Agent 只会操作文件，Zotero 只给数据库。**

---

## 2. 为什么现有方案都不好用

你可能会问：不是有人做了 Zotero 的 MCP Server 吗？不是有各种插件可以桥接吗？

确实有。但实际用下来，每条路都有硬伤：

### 方案 A：Zotero MCP Server

社区里有一些 Zotero MCP（Model Context Protocol）的实现，理论上可以让 Agent 通过协议访问 Zotero 数据库。

**问题**：

- 需要本地起一个服务，配置复杂，Windows 环境下兼容性不稳定
- MCP 只能做查询（搜索文献、读元数据），**不能让 Agent 直接操作 PDF 内容、读写笔记**
- 每次交互都要经过协议中转，延迟高，Agent 的上下文窗口消耗大
- Zotero 的数据结构对 Agent 来说是「黑箱」——它不知道你的收藏夹层级代表什么，不知道哪些是核心文献、哪些是泛读

### 方案 B：Zotero 插件 + API

Zotero 有丰富的插件生态，比如 `Better BibTeX` 可以导出引用、`Zotero PDF Translate` 可以翻译，理论上可以通过 API 把数据取出来。

**问题**：

- API 是 REST 接口，Agent 需要学会调用 API、解析 JSON，这不是它擅长的工作模式
- 只能拿到元数据和引用信息，**PDF 全文和笔记内容仍然无法直接访问**
- 你的文献组织结构（收藏夹、标签体系）在 API 返回的数据中是扁平的，丢失了层级关系

### 方案 C：手动复制文件出来

最暴力的方式——直接去 `Zotero\storage\` 目录下找 PDF 文件。

**问题**：

- Zotero 的 `storage` 目录用随机哈希命名，结构是这样的：

  ```
  storage/
  ├── ABC123-DEFG/
  │   └── Attention_Is_All_You_Need.pdf
  ├── HIJ456-KLMN/
  │   └── BERT_Pre-training.pdf
  └── ...
  ```

- **完全没有语义信息**，你不知道哪个哈希对应哪篇论文
- 没有元信息文件、没有笔记、没有主题分类
- Agent 看到这个目录结构，和看一团乱码没有区别

### 小结

| 方案 | 能否读元数据 | 能否读 PDF | 能否读笔记 | 保留目录结构 | Agent 友好度 |
|------|:-:|:-:|:-:|:-:|:-:|
| MCP Server | ✅ | ❌ | ❌ | ❌ | ⭐⭐ |
| Zotero API | ✅ | ❌ | ❌ | ❌ | ⭐⭐ |
| 手动复制 storage | ❌ | ✅ | ❌ | ❌ | ⭐ |
| **ZoFiles 导出** | **✅** | **✅** | **✅** | **✅** | **⭐⭐⭐⭐⭐** |

---

## 3. 正确答案：把数据库变成文件夹

既然 Agent 只能理解文件系统，那最正确的做法就是——**把 Zotero 的数据库内容，完整地映射为一个文件夹结构**。

这就是 **ZoFiles 插件**做的事情。

### ZoFiles 是什么

[ZoFiles](https://github.com/X1AOX1A/ZoFiles) 是一个 Zotero 7+ 插件，它的口号就是「Connect Claude to your Zotero library」。核心功能一句话讲完：

> **将 Zotero 收藏夹层级镜像为真实的文件系统目录结构，每篇文献独立成一个文件夹，且自带 AI 生成的论文总结。**

安装配置好之后（Zotero > Settings > ZoFiles 里设置导出根目录，点一次 Rebuild），它就会在你指定的目录下生成这样的结构：

```
output/
├── Machine Learning/                        ← 收藏夹名 = 顶级文件夹
│   ├── Transformers/                        ← 子收藏夹
│   │   ├── 1706.03762 - Attention Is All You Need/
│   │   │   ├── paper.pdf        ← PDF（软链接或复制）
│   │   │   ├── paper.md         ← 论文全文 Markdown（arxiv2md.org 转换）
│   │   │   ├── kimi.md          ← AI 自动生成的论文总结（papers.cool / Kimi）
│   │   │   ├── paper.bib        ← BibTeX 引用
│   │   │   ├── arxiv.id         ← arXiv 编号纯文本
│   │   │   └── notes/
│   │   │       └── My Notes.md  ← 你在 Zotero 里写的笔记
│   │   └── 2311.10702 - Another Paper/
│   │       └── ...
│   └── Allin/                   ← 扁平视图：本收藏夹及子孙收藏夹的全部论文
└── Computer Vision/
    └── ...
```

**这个结构，Agent 一看就懂。**

而且注意 `kimi.md` 这一项——这是整个插件最妙的细节：**每次导出时，插件会自动调用 papers.cool 的 Kimi 接口，为每篇论文生成一份 AI 审稿总结**。也就是说，在你把文献库交给 Claude Code 之前，插件已经替你做了一轮「预消化」：Agent 想快速了解一篇论文，先读几 KB 的 `kimi.md` 就够了，不需要每次都去啃十几 MB 的 PDF 全文。这个设计对 Agent 的上下文窗口极其友好。

### 为什么这个结构对 Agent 来说是「原生语言」

回想一下 Claude Code 理解世界的三板斧：**读文件、遍历目录、搜索内容**。现在这三件事全部打通了：

| Agent 想做的事 | 对应操作 |
|---|---|
| 快速了解某篇论文讲了什么 | `Read("kimi.md")` — 几 KB 的 AI 总结，秒读 |
| 精读论文全文（Markdown 版） | `Read("paper.md")` |
| 精读论文全文（原版 PDF） | `Read("paper.pdf")`（Claude 支持 PDF） |
| 查看你写的笔记 | `Read("notes/My Notes.md")` |
| 拿到引用信息 | `Read("paper.bib")` |
| 浏览某个主题下的所有文献 | `Glob("Machine Learning/*/")` |
| 在所有文献中搜索关键词 | `Grep("attention mechanism", path="output/")` |
| 理解你的研究方向 | 遍历顶级文件夹 = 你的收藏夹体系 |

注意这里有一个梯度设计：**kimi.md（快速了解）→ paper.md（精读全文）→ paper.pdf（原始版面）**。Agent 可以根据任务需要选择读取深度——写综述时先扫一遍所有 `kimi.md`，定位到重点论文再啃 `paper.md` 全文。这对上下文窗口的利用率是质的提升。

Agent 不需要任何特殊工具、不需要 MCP 协议、不需要 API 调用——它用自己最擅长的方式（文件操作）就能完全理解你的文献库。

---

## 4. 配置建议

所有配置都在 __Zotero > Settings > ZoFiles__ 里，几项对 Agent 工作流比较关键的：

### PDF 处理方式：Windows 用户必须选 Copy

ZoFiles 提供两种 PDF 导出方式：

- **软链接（Symlink）**：不复制文件，只创建指向 Zotero storage 的链接，省空间（默认）
- **复制（Copy）**：把 PDF 完整复制一份，导出目录完全独立

macOS / Linux 用户可以放心用默认的软链接；但 **Windows 用户必须改成 Copy**——Windows 上创建软链接需要管理员权限，不开管理员模式运行 Zotero 的话软链接会静默失败。多占一份磁盘空间，换一个稳定可用的导出目录，值得。

### 内容开关：全部打开

插件对每篇论文生成的内容（PDF / 全文 Markdown / Kimi 总结 / BibTeX / 笔记 / arXiv ID）默认全部开启，建议保持默认。尤其是：

- **Kimi Review**：AI 总结，Agent 的「快车道」
- **Zotero Notes**：你的笔记是你对文献的思考，是 Agent 理解你研究思路的关键线索

### 自动同步：放心开着

首次 Rebuild 之后，ZoFiles 会监听 Zotero 的事件——你新增、修改、移动、删除任何文献，导出目录都会**自动同步更新**，不需要手动重新导出。后续的增量 Rebuild 只处理新增和变更的条目，而且网络内容（Kimi 总结、全文 Markdown）有本地缓存，重复构建也很快。

### 两个使用限制

!!! note "使用前须知"

    1. **只导出有 arXiv ID 的论文**。没有 arXiv 编号的条目（书籍、网页、老论文等）会被静默跳过。如果你的文献库里有不少非 arXiv 来源，导出前要有预期。
    2. **对 Zotero 库本身是只读的**（除非开启「Link back to Zotero」）。不用担心插件搞坏你的数据库，但首次使用前还是建议备份一下 Zotero 数据目录。

### 彩蛋：插件自带 Claude Code Skill

ZoFiles 仓库里附带了两个 Claude Code skill（`.claude/skills/`），把仓库克隆到你的项目里就能自动生效：

- **`read-paper`** — 读论文、做总结、对比两篇论文、拿 BibTeX
- **`zotero-connector`** — 反向操作：让 Claude 把 arXiv 论文批量导入 Zotero

不过说实话，即使不装这两个 skill，只要导出目录在，Claude Code 靠文件操作本身就能完成绝大部分工作——这也是「文件夹方案」的通用性所在：**导出格式是纯 Markdown 和 BibTeX，任何能读文件的 Agent 都能用，不绑定 Claude Code。**

---

## 5. 实际工作流：有了文件夹之后

导出完成后，你的文献就变成了一个普通的文件夹。把导出目录放进你的项目里，Claude Code 就能直接操作了。几个真实场景：

### 场景一：让 Agent 快速摸清一个方向

```
你：把 Transformers/ 这个收藏夹下的论文都总结一下，
    每篇用三句话讲清核心贡献。
```

Claude Code 用 `Glob` 找到所有论文文件夹，逐篇读取 `kimi.md`（几 KB 一篇，读起来毫不费力），几分钟后给你一份带 arXiv 编号的结构化总结。**这一步完全不用碰 PDF，速度快到离谱。**

### 场景二：精读对比两篇论文

```
你：对比一下 2301.04104 和 2305.14078 这两篇，
    方法上的关键区别是什么？
```

Agent 根据文件夹名里的 arXiv ID 直接定位，读 `paper.md` 全文做深度对比——公式、实验设置、结论差异，一并给你整理出来。

### 场景三：写 Related Work

```
你：基于我文献库里关于预训练范式的论文，帮我写一段 Related Work，
    引用格式用 [Author, Year]，BibTeX 一并整理出来。
```

Agent 先扫 `kimi.md` 定位相关论文，再读 `paper.md` 补充细节，最后从 `paper.bib` 里取出引用信息，生成带规范的 Related Work 段落和配套的 `.bib` 文件。

### 场景四：反向导入新论文

看到一篇新论文想收进文献库？都不用打开浏览器：

```
你：把 2301.07041 这篇导入 Zotero 的 "LLM Papers" 收藏夹
```

（用插件自带的 `zotero-connector` skill 完成。）导入之后自动同步机制会把它导出到文件夹里，Kimi 总结也会自动生成——形成闭环。

---

## 6. 一点个人感受

说实话，写这篇文章的时候我自己也在反思——**为什么我们总想让 AI 去适应旧工具，而不是让旧工具的数据格式去适应 AI？**

Zotero 是一个伟大的文献管理工具，它的数据库设计在「人用 GUI 操作」这个场景下是完美的。但当你的协作者从「人」变成了「AI Agent」，数据的接口方式就需要重新审视。

ZoFiles 做的事情其实非常朴素——就是做了一层格式转换。但正是这层转换，打通了两个原本不兼容的世界。它甚至更进一步：导出时就替你把每篇论文「预消化」成 AI 总结（`kimi.md`），让 Agent 连读全文的力气都省了。

**不是 MCP 不好，不是 API 不够用，而是「文件夹 + Markdown」本身就是 AI Agent 的原生语言。** 任何桥接方案，最终都要翻译成这个语言，那不如一开始就用这个语言。

---

## 写在最后

如果你也在用 Zotero 管理论文，同时想让 Claude Code 之类的 Agent 帮你做文献工作，我的建议是：

1. 装 [ZoFiles](https://github.com/X1AOX1A/ZoFiles)，设置好导出目录，点一次 Rebuild
2. Windows 用户记得把 PDF 模式改成 Copy
3. 保持默认的内容开关，让每篇论文自带 Kimi 总结、全文 Markdown 和你的笔记
4. 之后正常用 Zotero 管文献，自动同步会搞定剩下的一切

就这四步，没有了。剩下的事情，Agent 自己会做。

*这里是「唱唱反调」——数据库是给人看的，文件夹才是给 Agent 看的。*
