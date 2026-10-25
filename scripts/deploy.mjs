/**
 * deploy.mjs —— 构建并推送 dist → gh-pages 分支
 * 用法：npm run deploy（= build + linkcheck + 推送）
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', shell: true });

if (!existsSync(join(dist, 'index.html'))) {
  console.error('[deploy] dist/index.html 不存在，请先 npm run build');
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
run('git init -b gh-pages-temp', dist);
run('git add -A', dist);
run(`git -c user.name="deploy" -c user.email="deploy@local" commit -m "deploy ${stamp}" --quiet`, dist);
run('git push --force "https://github.com/NeuraSailor/NeuraSailor.github.io.git" gh-pages-temp:gh-pages', dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });
console.log(`[deploy] 已推送 gh-pages（${stamp}）`);
