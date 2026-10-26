/**
 * xmind-to-mermaid —— XMind 导图 → mermaid mindmap 源码（构建期纯转换）
 *
 * .xmind 是 zip 包：解包取 content.json（XMind ZEN / 2020+ 格式），逐层遍历
 * rootTopic 的 attached 子树，生成缩进式 mindmap 语法。旧版 XMind 8 的
 * content.xml 格式不支持（抛错，由调用方降级 garden-missing）。
 * 输出以 <pre class="mermaid"> 形态交给 site.ts 既有渲染链
 * （CDN mermaid@11 + 主题重渲染），六皮肤零新增样式。
 */
import { unzipSync } from 'fflate';

export interface XmindSheet {
  title: string;
  mermaid: string;
}

interface Topic {
  title?: string;
  children?: { attached?: Topic[] };
}

/* 节点文本净化：去 HTML 标签与残余尖括号（防破坏输出 HTML）、
   去图形定界符 ()[]{} 与引号反引号（mermaid mindmap 用它们声明节点形状）、
   去注释符 %%，压平空白 */
function cleanTitle(raw: unknown): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[<>()[\]{}"'`%%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(topic: Topic, depth: number, lines: string[]): void {
  const title = cleanTitle(topic.title);
  if (depth === 1) {
    lines.push(`${'  '.repeat(depth)}root((${title || '中心主题'}))`);
  } else {
    lines.push(`${'  '.repeat(depth)}${title || '…'}`);
  }
  for (const child of topic.children?.attached ?? []) walk(child, depth + 1, lines);
}

export function xmindToMermaidSheets(data: Uint8Array): XmindSheet[] {
  const files = unzipSync(data);
  const entry = files['content.json'];
  if (!entry) {
    throw new Error('缺少 content.json（旧版 XMind 8 的 content.xml 格式暂不支持）');
  }
  const json: unknown = JSON.parse(new TextDecoder().decode(entry));
  const sheets = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const out: XmindSheet[] = [];
  for (const sheet of sheets) {
    const root = (sheet as { rootTopic?: Topic }).rootTopic;
    if (!root) continue;
    const lines: string[] = ['mindmap'];
    walk(root, 1, lines);
    out.push({
      title: cleanTitle((sheet as { title?: string }).title) || `导图 ${out.length + 1}`,
      mermaid: lines.join('\n'),
    });
  }
  if (!out.length) throw new Error('content.json 中没有可渲染的 rootTopic');
  return out;
}
