// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGarden from './src/plugins/remark-garden.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://neurasailor.github.io',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [pagefind()],
  build: {
    format: 'directory',
  },
  markdown: {
    // remarkMath 必须排在 remarkBreaks 之前：先提取 $/$$ 公式，
    // 否则公式块内的换行会被转成 <br>，把 $$ 定界符切碎（MathJax 时代的渲染失败根因）
    remarkPlugins: [remarkMath, remarkGfm, remarkBreaks, [remarkGarden, { docsDir: 'docs' }]],
    rehypePlugins: [[rehypeKatex, { strict: false, output: 'htmlAndMathml' }]],
    shikiConfig: {
      // 双主题：暗色模式通过 CSS 变量切换（见 content.css .astro-code 暗色段）
      themes: {
        light: 'github-light-default',
        dark: 'github-dark-default',
      },
      defaultColor: 'light',
      wrap: false,
    },
  },
});
