// 构建前把 docs/assets 同步到 public/assets（Astro 静态资源目录）
import { cpSync, existsSync, mkdirSync } from 'node:fs';
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
console.log('[sync-assets] docs/assets → public/assets 完成');
