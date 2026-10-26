// 构建前把 docs/assets 同步到 public/assets（Astro 静态资源目录）
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'docs', 'assets');
const dest = join(root, 'public', 'assets');

if (!existsSync(src)) {
  console.warn('[sync-assets] docs/assets 不存在，跳过');
  process.exit(0);
}
mkdirSync(join(root, 'public'), { recursive: true });
cpSync(src, dest, { recursive: true });

// 内容管线按 basename 扁平解析 wikilink，子目录同名文件会互相抢指向——提前警告
const seen = new Map();
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (seen.has(f.name)) console.warn(`[sync-assets] basename 重复: ${f.name} → ${seen.get(f.name)} 与 ${p}`);
    else seen.set(f.name, p);
  }
};
walk(src);

// 内容区 pdf/xmind 一等公民文件 → public/files/<相对路径>（内容页阅读器加载）
// 与 assets 附件池互斥：docs/assets/ 走 basename 扁平嵌入流，不入 files/
// public/files 为纯生成物：每次全量重建（避免陈旧文件与 Windows 覆盖锁）
const BIN_EXT = new Set(['.pdf', '.xmind']);
const filesDest = join(root, 'public', 'files');
rmSync(filesDest, { recursive: true, force: true });
mkdirSync(filesDest, { recursive: true });
let binCount = 0;
const walkBin = (dir, rel) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.')) continue;
    if (rel === '' && f.name === 'assets') continue;
    const abs = join(dir, f.name);
    if (f.isDirectory()) {
      walkBin(abs, rel ? `${rel}/${f.name}` : f.name);
      continue;
    }
    const lower = f.name.toLowerCase();
    if (!BIN_EXT.has(lower.slice(lower.lastIndexOf('.')))) continue;
    mkdirSync(join(filesDest, rel), { recursive: true });
    cpSync(abs, join(filesDest, rel, f.name));
    binCount++;
  }
};
walkBin(join(root, 'docs'), '');

console.log('[sync-assets] docs/assets → public/assets 完成');
console.log(`[sync-assets] 内容区 pdf/xmind → public/files 完成（${binCount} 个，全量重建）`);
