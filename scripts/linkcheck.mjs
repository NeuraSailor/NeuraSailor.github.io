/**
 * linkcheck.mjs —— dist 产物内链审计
 * 扫描所有 HTML 的 href/src，校验站内目标存在（忽略外链/锚点）
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist', import.meta.url));
const pages = [];

function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) pages.push(p);
  }
}
walk(root);

const hrefs = [];
const re = /(?:href|src)="([^"]+)"/g;
for (const p of pages) {
  const html = readFileSync(p, 'utf-8');
  let m;
  while ((m = re.exec(html)) !== null) {
    hrefs.push({ page: p, url: m[1] });
  }
}

const broken = [];
const seen = new Set();
const decodeEntities = (s) =>
  s
    .replace(/&#x26;|&#38;/gi, '&')
    .replace(/&#x3c;|&#60;/gi, '<')
    .replace(/&#x3e;|&#62;/gi, '>')
    .replace(/&#x22;|&#34;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'");
for (const { page, url } of hrefs) {
  if (seen.has(url)) continue;
  seen.add(url);
  if (/^(https?:|mailto:|data:|#|javascript:)/.test(url)) continue;
  // 先解 HTML 实体再剥锚点：实体 &#38; 内含 #，顺序反了会把链接截断
  const clean = decodeEntities(url).split('#')[0];
  if (!clean) continue;
  const decoded = decodeURIComponent(clean);
  const abs = decoded.startsWith('/')
    ? join(root, decoded)
    : join(dirname(page), decoded);
  // 目录 → index.html；文件 → 直接存在
  const okDir = existsSync(join(abs, 'index.html'));
  const okFile = existsSync(abs);
  const okAsset = decoded.startsWith('/assets/') && existsSync(join(root, decoded));
  if (!okDir && !okFile && !okAsset) {
    broken.push({ page: page.slice(root.length), url });
  }
}

console.log(`页面数: ${pages.length}, 唯一内链: ${seen.size}`);
if (broken.length) {
  console.log(`\n断链 ${broken.length} 处:`);
  for (const b of broken.slice(0, 40)) console.log(`  ${b.page}  →  ${b.url}`);
  if (broken.length > 40) console.log(`  …另有 ${broken.length - 40} 处`);
  process.exitCode = 1;
} else {
  console.log('断链: 0 ✓');
}
