/**
 * katex-text.ts —— 把纯文本中的 $...$ 片段渲染为 KaTeX HTML（构建期）
 * 用于文章标题与侧栏目录：源库有 4 个文件名本身是公式（如 $I_{F}$.md）
 * 其余文本 HTML 转义；结果按输入字符串缓存（侧栏会在每页重复渲染同名节点）
 */
import katex from 'katex';

const cache = new Map<string, string>();

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderMathText(input: string): string {
  const hit = cache.get(input);
  if (hit !== undefined) return hit;

  let out = '';
  let last = 0;
  const re = /\$([^$\n]{1,200})\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const content = m[1]!;
    if (/^\s|\s$/.test(content)) continue; // MathJax 规则：首尾空白不视为公式
    out += escapeHtml(input.slice(last, m.index));
    try {
      out += katex.renderToString(content, { throwOnError: false, output: 'html' });
    } catch {
      out += escapeHtml(m[0]);
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(input.slice(last));
  cache.set(input, out);
  return out;
}
