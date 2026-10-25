/**
 * themes —— 皮肤注册表
 * 自动发现 src/themes/ 下含 index.css 的目录；新增主题即新建目录，
 * 无需改任何核心代码。皮肤切换：Base.astro 渲染全部皮肤的
 * <link data-skin-link>（仅默认皮肤启用），JS 按 <html data-skin> 启停。
 */
import { SITE } from '../site.config';

const cssUrls = import.meta.glob('../themes/*/index.css', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export interface SkinInfo {
  id: string;
  label: string;
  cssUrl: string;
  /** mermaid 图表按皮肤×明暗取主题名 */
  mermaid: { light: string; dark: string };
}

/** 皮肤的中文显示名（缺省用目录名） */
const LABELS: Record<string, string> = {
  'liquid-glass': '液态玻璃',
  neumorphic: '新拟态',
  'latex-paper': 'LaTeX 论文',
  'anti-design': '反设计',
  hogwarts: '霍格沃兹',
};

/** 各皮肤的 mermaid 主题映射（缺省 neutral/dark） */
const MERMAID: Record<string, { light: string; dark: string }> = {};

export const SKINS: SkinInfo[] = Object.entries(cssUrls)
  .map(([path, cssUrl]) => {
    const m = path.match(/themes\/([^/]+)\/index\.css$/);
    const id = m?.[1] ?? '';
    if (!id) return null;
    return {
      id,
      label: LABELS[id] ?? id,
      cssUrl,
      mermaid: MERMAID[id] ?? { light: 'neutral', dark: 'dark' },
    };
  })
  .filter((s): s is SkinInfo => s !== null);

export const DEFAULT_SKIN: string = SKINS.some((s) => s.id === SITE.defaultSkin)
  ? SITE.defaultSkin
  : (SKINS[0]?.id ?? 'liquid-glass');
