/**
 * binary-content.ts —— docs/ 内容区的 PDF/xmind 一等公民文件
 * 与 md 平权：条目即路由（带扩展名，与同名 md 笔记共存），原文件托管到 /files/<relPath>
 * 排除：assets/（附件池，走 basename 扁平嵌入流）、.history/.obsidian 等点目录
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface BinaryDoc {
  /** posix 相对路径，带扩展名，如 学习笔记/大二上/x/论文.pdf */
  relPath: string;
  ext: '.pdf' | '.xmind';
  size: number;
  mtime: Date;
}

let cached: BinaryDoc[] | null = null;

export function binaryDocs(docsDir = join(process.cwd(), 'docs')): BinaryDoc[] {
  if (cached) return cached;
  const out: BinaryDoc[] = [];
  const walk = (dir: string, rel: string) => {
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
        walk(abs, rel ? `${rel}/${f}` : f);
        continue;
      }
      const lower = f.toLowerCase();
      const ext = lower.endsWith('.pdf') ? '.pdf' : lower.endsWith('.xmind') ? '.xmind' : null;
      if (ext) out.push({ relPath: rel ? `${rel}/${f}` : f, ext, size: st.size, mtime: st.mtime });
    }
  };
  walk(docsDir, '');
  cached = out;
  return out;
}

export const fileLabel = (ext: string): string => (ext === '.pdf' ? 'PDF 文档' : 'XMind 导图');

export function formatSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
