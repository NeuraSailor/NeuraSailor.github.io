/**
 * remark-garden —— Obsidian/MkDocs 混合语法的统一内容管线插件
 *
 * 处理 docs/ 内容中的语法（源文件不动，全部构建期转换）：
 *  1. wikilink：[[页面]] / [[页面|别名]] / [[#锚点]] / [[页面#锚点]]
 *  2. 图片：![[assets/x.png]] / ![[Pasted image x.png|400]] / ![](../assets/x.png)
 *     （docs/assets 文件名已验证全局唯一，按 basename 扁平解析到 /assets/）
 *  3. Obsidian callout：> [!type] +/-，折叠态渲染 <details>，展开态渲染 <aside>
 *  4. MkDocs admonition：!!! type "title" + 缩进内容（3 处），先归一化为 callout
 *  5. mermaid 围栏 → <pre class="mermaid">，交客户端渲染（绕过 shiki）
 */
import { visit } from 'unist-util-visit';
import GithubSlugger from 'github-slugger';
import { remark } from 'remark';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import type { Plugin } from 'unified';
import type { Node, Parent } from 'unist';
import { xmindToMermaidSheets } from '../lib/xmind-to-mermaid.ts';

/* ---------- 常量与映射 ---------- */

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.avif']);

const CALLOUT_TYPES: Record<string, { canon: string; label: string }> = {
  note: { canon: 'note', label: '备注' },
  abstract: { canon: 'abstract', label: '摘要' },
  summary: { canon: 'abstract', label: '摘要' },
  tldr: { canon: 'abstract', label: '摘要' },
  info: { canon: 'info', label: '信息' },
  tip: { canon: 'tip', label: '提示' },
  hint: { canon: 'tip', label: '提示' },
  important: { canon: 'important', label: '重要' },
  example: { canon: 'example', label: '示例' },
  warning: { canon: 'warning', label: '警告' },
  caution: { canon: 'warning', label: '警告' },
  attention: { canon: 'warning', label: '警告' },
  danger: { canon: 'danger', label: '危险' },
  error: { canon: 'danger', label: '危险' },
  fail: { canon: 'danger', label: '失败' },
  bug: { canon: 'danger', label: '错误' },
  quote: { canon: 'quote', label: '引用' },
  cite: { canon: 'quote', label: '引用' },
  success: { canon: 'success', label: '成功' },
  check: { canon: 'success', label: '成功' },
  done: { canon: 'success', label: '成功' },
  question: { canon: 'question', label: '问题' },
  help: { canon: 'question', label: '问题' },
  faq: { canon: 'question', label: '问题' },
};

interface Options {
  docsDir?: string;
}

interface PageMaps {
  byPath: Map<string, string>;
  byBasename: Map<string, string[]>;
  assetNames: Set<string>;
  assetsDir: string;
  docsDir: string;
  /** 内容区一等公民 pdf/xmind：basename（带扩展名）→ 相对路径列表（与 md 同名歧义同策略） */
  binByBase: Map<string, string[]>;
}

let cachedMaps: PageMaps | null = null;

function buildMaps(docsDir: string): PageMaps {
  if (cachedMaps) return cachedMaps;
  const byPath = new Map<string, string>();
  const byBasename = new Map<string, string[]>();
  const assetNames = new Set<string>();

  const walkMd = (dir: string, rel: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      if (f.startsWith('.')) continue;
      const abs = join(dir, f);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walkMd(abs, rel ? `${rel}/${f}` : f);
      } else if (f.toLowerCase().endsWith('.md')) {
        if (rel === '' && f === 'index.md') continue;
        const noExt = rel ? `${rel}/${f.slice(0, -3)}` : f.slice(0, -3);
        let slug = noExt;
        if (slug.endsWith('/index')) slug = slug.slice(0, -6);
        byPath.set(noExt, slug);
        const base = f.slice(0, -3);
        if (!byBasename.has(base)) byBasename.set(base, []);
        byBasename.get(base)!.push(slug);
      }
    }
  };
  walkMd(docsDir, '');

  const assetsDir = join(docsDir, 'assets');
  if (existsSync(assetsDir)) {
    for (const f of readdirSync(assetsDir)) assetNames.add(f);
  }

  // 内容区一等公民 pdf/xmind（排除 assets/ 附件池与点目录），与 binary-content.ts 同规则
  const binByBase = new Map<string, string[]>();
  const walkBin = (dir: string, rel: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const f of entries) {
      if (f.startsWith('.')) continue;
      if (rel === '' && f === 'assets') continue;
      const abs = join(dir, f);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walkBin(abs, rel ? `${rel}/${f}` : f);
        continue;
      }
      const lower = f.toLowerCase();
      if (lower.endsWith('.pdf') || lower.endsWith('.xmind')) {
        if (!binByBase.has(f)) binByBase.set(f, []);
        binByBase.get(f)!.push(rel ? `${rel}/${f}` : f);
      }
    }
  };
  walkBin(docsDir, '');

  cachedMaps = { byPath, byBasename, assetNames, assetsDir, docsDir, binByBase };
  return cachedMaps;
}

/* ---------- 工具 ---------- */

const encodeHref = (s: string) => encodeURI(s);

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- wikilink 变换（先收集再替换，避免遍历期间变更兄弟节点） ---------- */

const WIKILINK_RE = /(!?)\[\[([^\]]+?)\]\]/g;

interface TransformCtx {
  maps: PageMaps;
  currentSlug: string;
  slugger: GithubSlugger;
  stats: { links: number; unresolved: number; images: number };
}

function resolvePage(target: string, ctx: TransformCtx): string | null {
  const { byPath, byBasename } = ctx.maps;
  if (byPath.has(target)) return byPath.get(target)!;
  const base = target.split('/').pop()!;
  const candidates = byBasename.get(base);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const dir = ctx.currentSlug.includes('/') ? ctx.currentSlug.slice(0, ctx.currentSlug.lastIndexOf('/')) : '';
  const sameDir = candidates.find((c) => (c.includes('/') ? c.slice(0, c.lastIndexOf('/')) : '') === dir);
  if (sameDir) return sameDir;
  return [...candidates].sort((a, b) => a.length - b.length)[0];
}

function makeImageNode(name: string, alias: string | undefined): Node {
  const img = {
    type: 'image',
    url: `/assets/${encodeHref(name)}`,
    alt: alias && !/^\d+$/.test(alias) ? alias : '',
  } as Node & { url: string; alt: string; data?: unknown };
  if (alias && /^\d+$/.test(alias)) {
    (img as { data: { hProperties: Record<string, unknown> } }).data = {
      hProperties: { width: Number(alias) },
    };
  }
  return img;
}

/* ---------- PDF / xmind 附件（v4.1：一等公民内容页 + 附件双轨） ----------
 * docs/assets/ = 附件池（basename 扁平，原文件在 /assets/）；
 * 内容区 = 一等公民（独立路由页 /<relPath>/，原文件托管在 /files/<relPath>）。
 * 解析：assets 原文件优先（v4.0 语义），内容区兜底；非嵌入链接优先指向内容页。 */

function pdfPageOf(frag: string): number | null {
  const m = /^(?:page=)?(\d+)$/.exec(frag);
  return m ? Number(m[1]) : null;
}

function resolveBinPage(name: string, ctx: TransformCtx): string | null {
  const candidates = ctx.maps.binByBase.get(name);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const dir = ctx.currentSlug.includes('/') ? ctx.currentSlug.slice(0, ctx.currentSlug.lastIndexOf('/')) : '';
  const sameDir = candidates.find((c) => (c.includes('/') ? c.slice(0, c.lastIndexOf('/')) : '') === dir);
  if (sameDir) return sameDir;
  return [...candidates].sort((a, b) => a.length - b.length)[0];
}

function makePdfEmbed(url: string, label: string): Node {
  const safeLabel = escapeHtml(label);
  return {
    type: 'html',
    value:
      `<div class="pdf-embed">` +
      `<a class="pdf-embed__open" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="在新标签页打开">${safeLabel}</a>` +
      `<iframe class="pdf-embed__frame" src="${escapeHtml(url)}" loading="lazy" title="${safeLabel}"></iframe>` +
      `</div>`,
  };
}

function xmindEmbedHtml(absPath: string): string {
  const data = readFileSync(absPath);
  const sheets = xmindToMermaidSheets(new Uint8Array(data));
  // 多张表时逐表出图并加 sheet 标题（单一表不加，避免噪音）；样式复用既有 pre.mermaid
  const multi = sheets.length > 1;
  return sheets
    .map((s, i) => {
      const head = multi ? `<p><strong>${escapeHtml(s.title || `Sheet ${i + 1}`)}</strong></p>` : '';
      return `${head}<pre class="mermaid">${escapeHtml(s.mermaid)}</pre>`;
    })
    .join('');
}

function transformWikilinks(tree: Node, ctx: TransformCtx) {
  // 收集所有含 [[ 的文本节点及其父节点
  const hits: { node: Node & { value: string }; parent: Parent }[] = [];
  visit(tree, 'text', (node: Node, _index: unknown, parent: Parent | undefined) => {
    const v = (node as { value: string }).value;
    if (v.includes('[[') && parent && Array.isArray(parent.children)) {
      hits.push({ node: node as Node & { value: string }, parent });
    }
  });

  for (const { node, parent } of hits) {
    const idx = parent.children.indexOf(node);
    if (idx < 0) continue; // 已被其它变换移除
    const value = node.value;
    const out: Node[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(value)) !== null) {
      if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) });
      const [full, bang, inner] = m;
      const [rawTarget, ...aliasParts] = inner.split('|');
      const alias = aliasParts.join('|').trim();
      const target = rawTarget.trim();
      // 目标可带 #片段（[[页面#标题]] / ![[x.pdf#page=3]]）：先拆出纯文件部分再判扩展名
      const hashIdx = target.indexOf('#');
      const filePart = (hashIdx >= 0 ? target.slice(0, hashIdx) : target).trim();
      const frag = hashIdx >= 0 ? target.slice(hashIdx + 1).trim() : '';
      const ext = extname(filePart).toLowerCase();
      const isImage = bang === '!' || IMG_EXT.has(ext);
      // ![[页面]] 嵌入：无图片扩展名时先按页面解析（Obsidian 笔记嵌入语义），
      // 命中内链，避免被当图片降级成 garden-missing（pdf/xmind 走附件分流，不当页面）
      const pageSlug =
        bang === '!' && !IMG_EXT.has(ext) && ext !== '.pdf' && ext !== '.xmind'
          ? resolvePage(filePart, ctx)
          : null;

      if (ext === '.pdf' || ext === '.xmind') {
        const name = filePart.replace(/^assets\//, '').split('/').pop()!;
        const pageSlug = resolveBinPage(name, ctx); // 内容区一等公民页（null = 无）
        const inAssets = ctx.maps.assetNames.has(name);
        const pageFrag = pdfPageOf(frag);
        const stem = name.replace(/\.(pdf|xmind)$/i, '');
        // 原文件地址：assets 附件池优先，否则内容区 /files/ 托管
        const rawUrl = (withFrag: boolean): string | null =>
          inAssets
            ? `/assets/${encodeHref(name)}` + (withFrag && pageFrag ? `#page=${pageFrag}` : '')
            : pageSlug
              ? `/files/${encodeHref(pageSlug)}` + (withFrag && pageFrag ? `#page=${pageFrag}` : '')
              : null;
        const missing = (why: string) => {
          out.push({
            type: 'html',
            value: `<span class="garden-missing garden-link" title="${why}">${escapeHtml(alias || filePart)}</span>`,
          });
          ctx.stats.unresolved++;
        };
        if (!inAssets && !pageSlug) {
          missing(ext === '.pdf' ? '未找到 PDF 文件' : '未找到 xmind 文件');
        } else if (bang !== '!') {
          // 非嵌入：无片段时内容页直达优先；带 #page 片段或无内容页时指向原文件
          ctx.stats.links++;
          if (pageSlug && !frag) {
            out.push({
              type: 'link',
              url: `/${encodeHref(pageSlug)}/`,
              children: [{ type: 'text', value: alias || stem }],
            } as unknown as Node);
          } else {
            out.push({
              type: 'link',
              url: rawUrl(true)!,
              children: [{ type: 'text', value: alias || stem }],
            } as unknown as Node);
          }
        } else if (ext === '.pdf') {
          // ![[x.pdf]] / ![[x.pdf#page=3]] / ![[x.pdf|标题]] → iframe 嵌入 + 新窗口打开链接
          out.push(makePdfEmbed(rawUrl(true)!, alias || stem));
          ctx.stats.images++;
        } else {
          // ![[x.xmind]] → 构建期解包转 mermaid mindmap（正文嵌入保持轻量主题融合），
          // 一等公民内容页则由 xmind-embed-viewer 直接渲染；失败降级 garden-missing
          try {
            const abs = inAssets ? join(ctx.maps.assetsDir, name) : join(ctx.maps.docsDir, pageSlug!);
            out.push({ type: 'html', value: xmindEmbedHtml(abs) });
            ctx.stats.images++;
          } catch (err) {
            console.warn(`[remark-garden] xmind 解析失败 ${name}: ${(err as Error).message}`);
            missing('xmind 解析失败');
          }
        }
      } else if (isImage && !pageSlug) {
        const name = filePart.replace(/^assets\//, '').split('/').pop()!;
        if (ctx.maps.assetNames.has(name)) {
          out.push(makeImageNode(name, alias));
          ctx.stats.images++;
        } else {
          out.push({
            type: 'html',
            value: `<span class="garden-missing" title="未找到图片">${escapeHtml(alias || name)}</span>`,
          });
          ctx.stats.unresolved++;
        }
      } else if (pageSlug) {
        ctx.stats.links++;
        const url = `/${encodeHref(pageSlug)}/` + (frag ? `#${ctx.slugger.slug(frag)}` : '');
        out.push({
          type: 'link',
          url,
          children: [{ type: 'text', value: alias || filePart.split('/').pop()! }],
        } as unknown as Node);
      } else {
        ctx.stats.links++;
        if (!filePart && frag) {
          out.push({
            type: 'link',
            url: `#${ctx.slugger.slug(frag)}`,
            children: [{ type: 'text', value: alias || frag }],
          } as unknown as Node);
        } else {
          const slug = resolvePage(filePart, ctx);
          if (slug) {
            const url = `/${encodeHref(slug)}/` + (frag ? `#${ctx.slugger.slug(frag)}` : '');
            out.push({
              type: 'link',
              url,
              children: [{ type: 'text', value: alias || filePart.split('/').pop()! }],
            } as unknown as Node);
          } else {
            out.push({
              type: 'html',
              value: `<span class="garden-missing garden-link">${escapeHtml(alias || filePart)}</span>`,
            });
            ctx.stats.unresolved++;
          }
        }
      }
      last = m.index + full.length;
    }
    if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
    if (out.length > 0) parent.children.splice(idx, 1, ...out);
  }
}

/* ---------- 标准图片节点扁平解析 ---------- */

function flattenImages(tree: Node, ctx: TransformCtx) {
  visit(tree, 'image', (node: Node) => {
    const n = node as { url: string };
    const url = n.url;
    if (/^(https?:)?\/\//.test(url) || url.startsWith('/') || url.startsWith('data:')) return;
    const name = url.split('/').pop()!;
    // docs/assets 文件名全局唯一：一律按 basename 扁平到 /assets/
    n.url = `/assets/${encodeHref(name)}`;
    void ctx;
  });
}

/* ---------- 标准 .md 内链解析（Astro 内容层不重写，须自行处理） ---------- */

function resolveMdLinks(tree: Node, ctx: TransformCtx) {
  visit(tree, 'link', (node: Node) => {
    const n = node as { url: string };
    const url = n.url;
    if (/^(https?:)?\/\//.test(url) || url.startsWith('/') || url.startsWith('mailto:')) return;
    if (!/\.md(\#.*)?$/i.test(url)) return;
    const hashIdx = url.indexOf('#');
    const anchor = hashIdx >= 0 ? url.slice(hashIdx + 1) : '';
    const path = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const noExt = path.replace(/\.md$/i, '');
    // 相对路径优先按当前目录解析，其次 basename 扁平解析
    const dir = ctx.currentSlug.includes('/') ? ctx.currentSlug.slice(0, ctx.currentSlug.lastIndexOf('/')) : '';
    const target = dir ? `${dir}/${noExt}` : noExt;
    const slug = ctx.maps.byPath.get(target) ?? resolvePage(noExt, ctx);
    if (slug) {
      n.url = `/${encodeHref(slug)}/` + (anchor ? `#${ctx.slugger.slug(decodeURIComponent(anchor))}` : '');
    } else {
      n.url = `/${encodeHref(noExt)}/`; // 兜底，断链审计会捕获
      ctx.stats.unresolved++;
    }
  });
}

/* ---------- Obsidian 荧光笔 ==高亮== → <mark> ----------
   在数学配对之后运行；按文本节点内成对 == 切分（不成对保持原文，
   代码/行内代码/公式的值不在 text 节点上，天然不受影响） */
function transformHighlights(tree: Node) {
  const hits: { node: Node & { value: string }; parent: Parent }[] = [];
  visit(tree, 'text', (node: Node, _index: unknown, parent: Parent | undefined) => {
    const v = (node as { value: string }).value;
    if (v.includes('==') && parent && Array.isArray(parent.children)) {
      hits.push({ node: node as Node & { value: string }, parent });
    }
  });

  for (const { node, parent } of hits) {
    const idx = parent.children.indexOf(node);
    if (idx < 0) continue; // 已被其它变换移除
    const parts = node.value.split('==');
    if (parts.length % 2 === 0) continue; // 分隔符不成对，保持原文
    const out: Node[] = [];
    for (let i = 0; i < parts.length; i++) {
      const piece = parts[i]!;
      if (i % 2 === 0) {
        if (piece) out.push({ type: 'text', value: piece });
      } else if (piece.trim()) {
        out.push({
          type: 'emphasis',
          data: { hName: 'mark' },
          children: [{ type: 'text', value: piece }],
        } as unknown as Node);
      }
    }
    if (out.length > 0) parent.children.splice(idx, 1, ...out);
  }
}

/* ---------- mermaid 围栏 → <pre class="mermaid"> ---------- */

function transformMermaid(tree: Node) {
  visit(tree, 'code', (node: Node, index: number | undefined, parent: Parent | undefined) => {
    if (index === undefined || !parent) return;
    const n = node as { lang?: string | null; value: string };
    if (n.lang !== 'mermaid') return;
    parent.children[index] = {
      type: 'html',
      value: `<pre class="mermaid">${escapeHtml(n.value)}</pre>`,
    };
  });
}

/* ---------- MkDocs !!! admonition → callout 归一化 ---------- */

function transformMkdocsAdmonitions(root: Parent) {
  for (let i = 0; i < root.children.length; i++) {
    const node = root.children[i] as Node & { type: string };
    if (node.type !== 'paragraph') continue;
    const first = (node as unknown as { children?: { type: string; value?: string }[] }).children?.[0];
    if (first?.type !== 'text' || !/^!!!\s*\S+/.test(first.value ?? '')) continue;

    const m = /^!!!\s*([\w-]+)(?:\s+"([^"]*)")?/.exec(first.value ?? '');
    if (!m) continue;
    const [, type, title] = m;

    // 向后吃掉缩进 code block（内容按 markdown 再解析）
    let j = i + 1;
    const contentNodes: Node[] = [];
    if (j < root.children.length && (root.children[j] as Node & { type: string }).type === 'code') {
      const codeNode = root.children[j] as unknown as { value: string };
      const parsed = remark().parse(codeNode.value);
      contentNodes.push(...parsed.children.filter((c) => c.type !== 'yaml'));
      j++;
    }

    const bq: Parent & { data?: unknown } = {
      type: 'blockquote',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: `[!${type}] ${title ?? ''}`.trim() }],
        } as Node,
        ...contentNodes,
      ],
    };
    root.children.splice(i, Math.max(1, j - i), bq as Node);
  }
}

/* ---------- Obsidian callout → aside / details（深度优先，支持嵌套） ---------- */

const CALLOUT_HEAD_RE = /^\[!(\w+)\]([-+]?)\s*(.*)$/;

function transformCallouts(node: Parent) {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i] as Parent & { type: string };
    // 深度优先：先处理子树里的嵌套 callout
    if (Array.isArray(child.children) && child.children.length > 0) {
      transformCallouts(child as Parent);
    }
    if (child.type !== 'blockquote') continue;

    const firstPara = child.children[0] as (Parent & { type: string }) | undefined;
    if (!firstPara || firstPara.type !== 'paragraph') continue;
    const firstText = (firstPara as unknown as { children?: { type: string; value?: string }[] }).children?.[0];
    if (firstText?.type !== 'text') continue;
    if (!CALLOUT_HEAD_RE.test((firstText.value ?? '').trim())) continue;

    // Obsidian callout 标题行与正文之间常无空行：整块被解析为单一段落，
    // 行分隔只剩 remark-breaks 产生的 break 节点 —— 在第一个 break 处切开。
    const kids = (firstPara as Parent).children;
    const brIdx = kids.findIndex((k) => k.type === 'break');
    const headKids = brIdx > 0 ? kids.slice(0, brIdx) : kids;
    const restKids = brIdx > 0 ? kids.slice(brIdx + 1) : [];
    const headText = headKids
      .map((k) => (k.type === 'text' ? ((k as { value: string }).value ?? '') : ''))
      .join('')
      .trim();

    const m = CALLOUT_HEAD_RE.exec(headText);
    if (!m) continue;
    const [, rawType, fold, restTitle] = m;
    const meta = CALLOUT_TYPES[rawType.toLowerCase()] ?? { canon: 'note', label: rawType };
    const title = restTitle.trim() || meta.label;

    const titlePara: Parent & { data?: unknown } = {
      type: 'paragraph',
      children: [{ type: 'text', value: title }],
    };

    // 正文：首段的 break 之后内容恢复为段落，再接原块后续子节点
    const bodyChildren: Node[] = [];
    if (restKids.length > 0) {
      bodyChildren.push({ type: 'paragraph', children: restKids } as Node);
    }
    bodyChildren.push(...child.children.slice(1));

    const folded = fold === '-';
    const aside: Parent & { data?: unknown } = {
      type: 'blockquote',
      children: [titlePara as Node, ...bodyChildren],
    };
    (aside as { data: { hName: string; hProperties: Record<string, string> } }).data = {
      hName: folded ? 'details' : 'aside',
      hProperties: { class: `callout callout--${meta.canon}`, 'data-callout': meta.canon },
    };
    (titlePara as { data: { hName: string; hProperties: Record<string, string> } }).data = folded
      ? { hName: 'summary', hProperties: { class: 'callout__title' } }
      : { hName: 'p', hProperties: { class: 'callout__title' } };

    node.children[i] = aside as Node;
  }
}

/* ---------- 误吞公式拆分 ----------
 * remark-math 可能把相邻链/单开双关的多段内容并进一个公式节点（内容含 $ 残骸）。
 * 按定界符残骸拆分、逐段重新作为公式。是否真为公式交 KaTeX 判断
 * （strict:false + throwOnError:false，渲染不了安静显示原文，与 Obsidian 行为一致）。 */

function demoteBadMath(tree: Node) {
  // 块级：math 节点（$$...$$）含 $ 残骸 → 拆成多段
  visit(tree, 'math', (node: Node, index: number | undefined, parent: Parent | undefined) => {
    if (index === undefined || !parent) return;
    const v = (node as unknown as { value: string }).value ?? '';
    if (!v.includes('$')) return;
    const pieces = v.split(/\$+/).map((p) => p.trim()).filter((p) => p && !p.includes('**'));
    if (pieces.length > 0) {
      parent.children.splice(
        index,
        1,
        ...pieces.map((p) => ({ type: 'math', value: p }) as Node),
      );
    }
  });
  // 行内：inlineMath 节点（$...$）含 $ 残骸 → 拆成多段
  visit(tree, 'inlineMath', (node: Node, index: number | undefined, parent: Parent | undefined) => {
    if (index === undefined || !parent) return;
    const v = (node as unknown as { value: string }).value ?? '';
    if (!v.includes('$')) return;
    const pieces = v.split(/\$+/).map((p) => p.trim()).filter((p) => p && !p.includes('**'));
    if (pieces.length > 0) {
      const nodes: Node[] = [];
      for (const p of pieces) {
        if (nodes.length) nodes.push({ type: 'text', value: ' ' });
        nodes.push({ type: 'inlineMath', value: p });
      }
      parent.children.splice(index, 1, ...nodes);
    }
  });
}

/* ---------- 数学抢救（remark-math 吃剩的定界符残骸） ----------
 * 源文件常见三类 remark-math 无法解析的写法（MathJax 时代靠客户端扫描容忍）：
 *  1. 相邻链：$a$$b$$c$（多个行内公式无分隔符）
 *  2. 单开双关：$...=$$（行内公式误以 $$ 收尾）
 *  3. \(...\) 定界符（管线原生不处理）
 * 在 remark-math 解析后，对遗留文本节点按 MathJax 规则（首尾非空白、行内配对）重新配对。
 * 若内容首尾含空白则放弃（避免把"$5 和 $10"这类散文误判为公式）。 */

function isValidInlineMath(content: string): boolean {
  if (!content) return false;
  const first = content[0]!;
  const last = content[content.length - 1]!;
  return !/\s/.test(first) && !/\s/.test(last) && !content.includes('\n');
}

function salvageMathInText(textNode: Node, parent: Parent, index: number): void {
  const value = (textNode as { value: string }).value;
  if (!value || (!value.includes('$') && !value.includes('\\('))) return;

  const out: Node[] = [];
  let last = 0;
  let i = 0;
  while (i < value.length) {
    // \(...\) 定界符
    if (value.startsWith('\\(', i)) {
      const close = value.indexOf('\\)', i + 2);
      const content = value.slice(i + 2, close);
      if (close > 0 && isValidInlineMath(content)) {
        if (i > last) out.push({ type: 'text', value: value.slice(last, i) });
        out.push({ type: 'inlineMath', value: content });
        i = last = close + 2;
        continue;
      }
      i++;
      continue;
    }
    // $ 定界符（含 $...$$ 单开双关与 $a$$b$ 相邻链）
    if (value[i] === '$') {
      let matched = false;
      // 非贪婪向右找最近的 $ / $$
      for (let j = i + 1; j < Math.min(value.length, i + 302); j++) {
        if (value[j] !== '$') continue;
        const isDouble = value[j + 1] === '$';
        const content = value.slice(i + 1, j);
        if (isValidInlineMath(content)) {
          if (i > last) out.push({ type: 'text', value: value.slice(last, i) });
          out.push({ type: 'inlineMath', value: content });
          i = last = j + (isDouble ? 2 : 1);
          matched = true;
          break;
        }
        if (isDouble) j++; // 跳过 $$ 的第二个 $
      }
      if (matched) continue;
    }
    i++;
  }
  if (out.length > 0) {
    if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
    parent.children.splice(index, 1, ...out);
  }
}

function salvageMath(tree: Node) {
  const hits: { node: Node; parent: Parent }[] = [];
  visit(tree, 'text', (node: Node, _i: unknown, parent: Parent | undefined) => {
    const v = (node as { value: string }).value ?? '';
    if ((v.includes('$') || v.includes('\\(')) && parent && Array.isArray(parent.children)) {
      hits.push({ node, parent });
    }
  });
  for (const { node, parent } of hits) {
    const idx = parent.children.indexOf(node);
    if (idx >= 0) salvageMathInText(node, parent, idx);
  }
}

/* ---------- 清理空公式块（$$ 围栏断裂产生的空 display） ---------- */
function dropEmptyMath(tree: Node) {
  visit(tree, 'math', (node: Node, index: number | undefined, parent: Parent | undefined) => {
    if (index === undefined || !parent) return;
    const v = (node as unknown as { value: string }).value ?? '';
    if (v.trim() === '') parent.children.splice(index, 1);
  });
}

/* ---------- 段落级 Obsidian 式数学配对 ----------
 * Obsidian 的数学扫描比 remark-math 宽松：允许跨行配对、相邻链、$$ 内含中文。
 * 这里在每个段落的 text/break 流上模拟该行为（拼接后配对，再映射回节点）：
 *  - $$...$$ 优先（display，内容不设限——$$守恒$$ 在 Obsidian 也渲染为居中块）
 *  - $...$ 其次（首尾仅拒绝空格，允许换行；跨行内容交 KaTeX 当空格处理）
 *  - 遇到 code/strong 等其它内联节点即断开配对窗口（不跨结构配对） */

interface MathMatch {
  start: number;
  end: number;
  content: string;
  display: boolean;
}

function pairDelims(buf: string): MathMatch[] {
  const matches: MathMatch[] = [];
  let i = 0;
  while (i < buf.length) {
    // $$...$$ 优先（display，最近闭合）
    if (buf.startsWith('$$', i)) {
      const j = buf.indexOf('$$', i + 2);
      if (j > 0) {
        matches.push({ start: i, end: j + 2, content: buf.slice(i + 2, j), display: true });
        i = j + 2;
        continue;
      }
    }
    // $...$（最近闭合；首尾仅拒绝空格，换行允许）
    if (buf[i] === '$') {
      let matched = false;
      const j = buf.indexOf('$', i + 1);
      if (j > 0) {
        const content = buf.slice(i + 1, j);
        const t = content.replace(/^\n+|\n+$/g, '');
        if (t && !t.startsWith(' ') && !t.endsWith(' ')) {
          matches.push({ start: i, end: j + 1, content: t, display: false });
          i = j + 1;
          matched = true;
        }
      }
      if (!matched) i++; // 这个 $ 配不上（或作为下一个公式的开头），前进一步
      continue;
    }
    i++;
  }
  return matches;
}

interface RunEntry {
  node: Node;
  start: number;
  end: number;
}

function processMathRun(paragraph: Parent, run: RunEntry[]): void {
  const buf = run.map((r) => (r.node.type === 'break' ? '\n' : (r.node as { value: string }).value)).join('');
  if (!buf.includes('$')) return;
  const matches = pairDelims(buf);
  if (!matches.length) return;

  const children = paragraph.children;
  const firstIdx = children.indexOf(run[0]!.node);
  if (firstIdx < 0) return;

  // 从后往前替换，避免索引漂移
  for (let m = matches.length - 1; m >= 0; m--) {
    const { start, end, content, display } = matches[m]!;
    // 找到被覆盖的 run 节点范围
    const startEntry = run.find((r) => r.start <= start && start < r.end)
      ?? run.find((r) => r.start === start);
    const endEntry = run.find((r) => r.start < end && end <= r.end)
      ?? run[run.length - 1];
    if (!startEntry || !endEntry) continue;

    const startNodeIdx = children.indexOf(startEntry.node);
    const endNodeIdx = children.indexOf(endEntry.node);
    if (startNodeIdx < 0 || endNodeIdx < 0 || startNodeIdx > endNodeIdx) continue;

    const startVal = startEntry.node.type === 'break' ? '\n' : (startEntry.node as { value: string }).value;
    const endVal = endEntry.node.type === 'break' ? '\n' : (endEntry.node as { value: string }).value;
    const prefix = startVal.slice(0, start - startEntry.start);
    const suffix = endVal.slice(end - endEntry.start);

    const replacement: Node[] = [];
    if (prefix.trim()) replacement.push({ type: 'text', value: prefix });
    replacement.push({ type: display ? 'math' : 'inlineMath', value: content });
    if (suffix.trim()) replacement.push({ type: 'text', value: suffix });

    children.splice(startNodeIdx, endNodeIdx - startNodeIdx + 1, ...replacement);
  }
}

function paragraphMath(tree: Node) {
  visit(tree, 'paragraph', (node: Node) => {
    const p = node as unknown as Parent;
    if (!Array.isArray(p.children)) return;
    let run: RunEntry[] = [];
    let offset = 0;
    const flush = () => {
      if (run.length > 0) processMathRun(p, run);
      run = [];
      offset = 0;
    };
    for (const child of p.children) {
      if (child.type === 'text' || child.type === 'break') {
        const seg = child.type === 'break' ? '\n' : (child as { value: string }).value;
        run.push({ node: child, start: offset, end: offset + seg.length });
        offset += seg.length;
      } else {
        flush();
      }
    }
    flush();
  });
}

/* ---------- 主插件 ---------- */

const remarkGarden: Plugin<[Options?]> = function (options = {}) {
  const docsDir = options.docsDir
    ? join(process.cwd(), options.docsDir)
    : join(process.cwd(), 'docs');
  const maps = buildMaps(docsDir);

  return (tree, file) => {
    let currentSlug = '';
    try {
      const hist =
        (file as unknown as { history?: string[] }).history?.[0] ??
        (file as unknown as { path?: string }).path ??
        '';
      const norm = hist.replace(/\\/g, '/');
      const idx = norm.indexOf('/docs/');
      if (idx >= 0) {
        let s = norm.slice(idx + '/docs/'.length).replace(/\.md$/i, '');
        if (s.endsWith('/index') || s === 'index') s = s.replace(/\/?index$/, '');
        currentSlug = s;
      }
    } catch {
      /* ignore */
    }

    const ctx: TransformCtx = {
      maps,
      currentSlug,
      slugger: new GithubSlugger(),
      stats: { links: 0, unresolved: 0, images: 0 },
    };

    transformMermaid(tree);
    transformMkdocsAdmonitions(tree as unknown as Parent);
    // wikilink 必须先于数学配对：链接目标可能是 $I_{F}$ 这类公式文件名，
    // 若数学先吃掉 $ 会把 [[...]] 切碎导致链接裸露
    transformWikilinks(tree, ctx);
    paragraphMath(tree);
    transformHighlights(tree);
    flattenImages(tree, ctx);
    resolveMdLinks(tree, ctx);
    salvageMath(tree);
    dropEmptyMath(tree);
    demoteBadMath(tree);
    transformCallouts(tree as unknown as Parent);

    if (ctx.stats.unresolved > 0 && currentSlug) {
      console.warn(`[remark-garden] ${currentSlug}: ${ctx.stats.unresolved} 个未解析引用`);
    }
  };
};

export default remarkGarden;
