import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// 内容源：docs/ 目录（Obsidian → convert 脚本产出，本站只读不动）
// 排除：根 index.md（首页为定制页）、.history（VSCode 本地历史）、.obsidian
//
// generateId：必须自定义 —— glob loader 默认返回 githubSlug(id)（小写+空格转连字符），
// 会破坏与旧站 URL 的大小写一致性；这里直接返回原始相对路径（去扩展名、/index 折叠）。
const docs = defineCollection({
  loader: glob({
    base: './docs',
    pattern: ['**/*.md', '!index.md', '!**/.history/**', '!**/.obsidian/**'],
    generateId: ({ entry }) => {
      let id = entry.replace(/\\/g, '/').replace(/\.md$/i, '');
      if (id.endsWith('/index')) id = id.slice(0, -'/index'.length);
      return id;
    },
  }),
});

export const collections = { docs };
