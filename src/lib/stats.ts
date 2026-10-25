/**
 * stats.ts —— 站点统计（移植 hooks.py 口径，软函数，不硬编码）
 * - semesters: 学习笔记下的学期目录数（大一上/大一下/大二上，按实际出现计）
 * - courses:   学期下的课程目录数
 * - notes:     课程目录直属的 md 数
 * - blogs:     科研竞赛blog 各子模块递归 md 数
 */

const SEMESTERS = new Set(['大一上', '大一下', '大二上']);

export interface SiteStats {
  notes: number;
  courses: number;
  semesters: number;
  blogs: number;
}

export function computeStats(slugs: string[]): SiteStats {
  const stats: SiteStats = { notes: 0, courses: 0, semesters: 0, blogs: 0 };
  const semesters = new Set<string>();
  const courses = new Set<string>();

  for (const slug of slugs) {
    const p = slug.split('/');
    if (p[0] === '学习笔记') {
      if (p.length >= 2 && SEMESTERS.has(p[1]!)) {
        semesters.add(p[1]!);
        if (p.length >= 3 && p[2]) courses.add(`${p[1]}/${p[2]}`);
        if (p.length === 4) stats.notes++; // 课程目录直属 md
      }
    } else if (p[0] === '科研竞赛blog' && p.length >= 2) {
      stats.blogs++;
    }
  }

  stats.semesters = semesters.size;
  stats.courses = courses.size;
  return stats;
}
