/**
 * nav-tree.ts —— 从 collection 条目构建侧边栏目录树
 * 目录即路由：学习笔记/大二上/电路原理/笔记/x → 嵌套树
 * 目录的 index.md（slug 无尾巴）成为该目录的着陆链接
 */

export interface NavNode {
  name: string;
  slug: string | null;
  children: NavNode[];
}

const SECTION_ORDER: Record<string, number> = {
  学习笔记: 0,
  科研竞赛blog: 1,
  唱唱反调: 2,
};

const collatorZH = new Intl.Collator(['zh', 'en'], { numeric: true });

export function buildNavTree(slugs: string[]): NavNode[] {
  interface RawNode {
    name: string;
    slug: string | null;
    children: Map<string, RawNode>;
  }
  const root: RawNode = { name: '', slug: null, children: new Map() };

  for (const slug of slugs) {
    const parts = slug.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const isLeaf = i === parts.length - 1;
      const name = parts[i]!;
      if (!cur.children.has(name)) {
        cur.children.set(name, { name, slug: null, children: new Map() });
      }
      const node = cur.children.get(name)!;
      if (isLeaf) node.slug = slug; // 叶子 = 目录 index 或文件本身
      cur = node;
    }
  }

  // 学习笔记 index.md 的 slug 是 '学习笔记'（叶子），其余文件挂 children
  const toNav = (raw: RawNode): NavNode => {
    const childArr = [...raw.children.values()].map(toNav);
    // 目录排序：子目录在前，文件在后，各自中文序
    childArr.sort((a, b) => {
      const ad = a.children.length > 0 || a.slug === null ? 0 : 1;
      const bd = b.children.length > 0 || b.slug === null ? 0 : 1;
      if (ad !== bd) return ad - bd;
      return collatorZH.compare(a.name, b.name);
    });
    return { name: raw.name, slug: raw.slug, children: childArr };
  };

  const sections = [...root.children.values()].map(toNav);
  sections.sort((a, b) => {
    const oa = SECTION_ORDER[a.name] ?? 99;
    const ob = SECTION_ORDER[b.name] ?? 99;
    return oa - ob || collatorZH.compare(a.name, b.name);
  });
  return sections;
}

/** 当前 slug 的祖先目录集合（用于默认展开路径） */
export function ancestorSet(currentSlug: string): Set<string> {
  const parts = currentSlug.split('/');
  const set = new Set<string>();
  for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('/'));
  return set;
}

export function countLeaves(node: NavNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((n, c) => n + countLeaves(c), 0);
}
