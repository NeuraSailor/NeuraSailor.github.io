// 构建前把 docs/assets 同步到 public/assets（Astro 静态资源目录）
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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

console.log('[sync-assets] docs/assets → public/assets 完成');
