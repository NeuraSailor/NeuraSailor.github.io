/**
 * guide.ts —— 「游乐场」探索引导（护照 / 花园小径 / 足迹 / 今日手气）
 *
 * 定位：引导式吸引——为浏览型读者服务，不做学习任务。核心命题：
 * 永远给一个比关闭标签页更有趣的下一步，让站点成为「记得你足迹的地方」。
 *
 * 由 engine.ts 在 mount 时接入（同 chunk 懒加载）；纯前端 + localStorage
 * 单键 garden-passport；docs/ 一字不动；换肤 / 翻页零残留。
 * reduced-motion 下功能完整、动画静默；隐私模式 storage 抛错则整模块静默降级。
 */

/* ===================== 依赖注入（避免与 engine 循环 import） ===================== */
import { fxOn, onFxChange } from './settings';

export interface GuideFx {
  /** canvas 爆发粒子（engine 主循环绘制） */
  burst: (x: number, y: number, n?: number) => void;
}
let fx: GuideFx | null = null;

/* ===================== 数据层 ===================== */
interface PageRec {
  t: number; // 最后进度更新时间
  p: number; // 最大阅读进度 0-1
  done: boolean; // 是否已盖章
}
interface PassportData {
  pages: Record<string, PageRec>;
  last: { path: string; title: string; y: number } | null;
  today: { date: string; path: string } | null;
  fresh: number; // 未在护照面板看过的章数（按钮呼吸微光）
}

const KEY = 'garden-passport';
let storageOk = true;
let data: PassportData = { pages: {}, last: null, today: null, fresh: 0 };

function loadPassport() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PassportData>;
      data = {
        pages: parsed.pages ?? {},
        last: parsed.last ?? null,
        today: parsed.today ?? null,
        fresh: parsed.fresh ?? 0,
      };
    }
  } catch {
    storageOk = false; // 隐私模式：功能整体静默降级
  }
}

function savePassport() {
  if (!storageOk) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 写满则只保留内存态 */
  }
}

/* ===================== 站点地图（侧栏 DOM 提取，零构建改动） ===================== */
interface Station {
  path: string;
  title: string;
  group: string; // 顶层园区名（路径第一段）
}

function readStations(): Station[] {
  const out: Station[] = [];
  const seen = new Set<string>();
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.sidebar a[href^="/"]')) {
    const path = a.getAttribute('href') ?? '';
    if (!path || path === '/' || seen.has(path)) continue;
    seen.add(path);
    out.push({
      path,
      title: (a.textContent ?? '').trim().replace(/\s+/g, ' '),
      group: decodeURIComponent(path.split('/')[1] ?? '花园'),
    });
  }
  return out;
}

function stationTitle(stations: Station[], path: string): string {
  return stations.find((s) => s.path === path)?.title ?? decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
}

/* ===================== 今日手气（日期哈希，全站每天同一篇） ===================== */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

function todayStation(stations: Station[]): Station | null {
  if (!stations.length) return null;
  const date = todayStr();
  if (data.today?.date === date && stations.some((s) => s.path === data.today!.path)) {
    return stations.find((s) => s.path === data.today!.path) ?? null;
  }
  const pick = stations[hashStr(date) % stations.length]!;
  data.today = { date, path: pick.path };
  savePassport();
  return pick;
}

/* ===================== 阅读进度追踪（滚动节流） ===================== */
const RM = matchMedia('(prefers-reduced-motion: reduce)');
let pageEnterT = 0;
let lastSavedP = -1;

function onGuideScroll() {
  if (!storageOk || !document.querySelector('.md-content')) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? Math.min(1, window.scrollY / max) : 1;
  const slug = location.pathname;

  // 短页（max<400）要求 5s 停留，防止路过目录页也盖章
  const dwellOk = max >= 400 || Date.now() - pageEnterT > 5000;
  if (!dwellOk) return;

  let rec = data.pages[slug];
  if (!rec) {
    rec = data.pages[slug] = { t: Date.now(), p: 0, done: false };
    lastSavedP = -1;
  }
  if (p > rec.p) {
    rec.p = p;
    rec.t = Date.now();
    data.last = {
      path: slug,
      title: document.title.split('·')[0]?.trim() ?? slug,
      y: Math.round(window.scrollY),
    };
    if (rec.done || p - lastSavedP >= 0.05 || p >= 1) {
      lastSavedP = p;
      savePassport();
    }
  }

  if (!rec.done && rec.p >= 0.85) {
    rec.done = true;
    data.fresh += 1;
    savePassport();
    stampCeremony();
  }
}

/* ===================== 盖章仪式（右下角砸章 → 飞收进护照） ===================== */
function stampCeremony() {
  if (!fxOn('passport')) return;
  refreshPassportBtn();
  if (RM.matches) return;
  const st = document.createElement('div');
  st.className = 'pg-stamp';
  st.setAttribute('aria-hidden', 'true');
  st.innerHTML = '<span class="pg-stamp__ring"></span><span class="pg-stamp__text">已探索 ✓</span>';
  document.body.appendChild(st);
  fx?.burst(window.innerWidth - 120, window.innerHeight - 120, 16);
  requestAnimationFrame(() => requestAnimationFrame(() => st.classList.add('is-stamped')));
  window.setTimeout(() => st.classList.add('is-fly'), 1500);
  window.setTimeout(() => st.remove(), 2000);
}

/* ===================== 护照按钮与面板 ===================== */
let passportBtn: HTMLElement | null = null;
let passportPanel: HTMLElement | null = null;

function buildPassportBtn() {
  if (!fxOn('passport')) return;
  passportBtn = document.createElement('button');
  passportBtn.type = 'button';
  passportBtn.className = 'pg-passport-btn';
  passportBtn.setAttribute('aria-label', '探索护照');
  passportBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11v14h-11A2.5 2.5 0 0 1 4 16.5z"/><path d="M17.5 5h1A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-1"/><circle cx="10.5" cy="11" r="2.2"/><path d="M7 16.2c.6-1.4 1.9-2.2 3.5-2.2s2.9.8 3.5 2.2"/></svg><span class="pg-passport-btn__badge" hidden></span>';
  passportBtn.addEventListener('click', openPassport);
  document.body.appendChild(passportBtn);
  refreshPassportBtn();
}

function refreshPassportBtn() {
  if (!passportBtn) return;
  const done = Object.values(data.pages).filter((r) => r.done).length;
  const badge = passportBtn.querySelector('.pg-passport-btn__badge') as HTMLElement | null;
  if (badge) {
    badge.textContent = String(done);
    badge.toggleAttribute('hidden', done === 0);
  }
  passportBtn.classList.toggle('has-new', data.fresh > 0);
}

function buildPassportPanel() {
  if (!fxOn('passport')) return;
  passportPanel = document.createElement('div');
  passportPanel.className = 'pg-passport';
  passportPanel.setAttribute('role', 'dialog');
  passportPanel.setAttribute('aria-label', '探索护照');
  passportPanel.hidden = true;
  passportPanel.addEventListener('click', (e) => {
    if (e.target === passportPanel) closePassport();
  });
  document.body.appendChild(passportPanel);
}

function openPassport() {
  if (!passportPanel) return;
  data.fresh = 0;
  savePassport();
  refreshPassportBtn();
  renderPassport();
  passportPanel.hidden = false;
  document.documentElement.classList.add('has-modal');
  requestAnimationFrame(() => passportPanel?.classList.add('is-open'));
}

function closePassport() {
  if (!passportPanel) return;
  passportPanel.classList.remove('is-open');
  document.documentElement.classList.remove('has-modal');
  window.setTimeout(() => {
    if (passportPanel && !passportPanel.classList.contains('is-open')) passportPanel.hidden = true;
  }, 280);
}

function renderPassport() {
  if (!passportPanel) return;
  const stations = readStations();
  const doneRecs = Object.entries(data.pages).filter(([, r]) => r.done);
  const total = stations.length || doneRecs.length;
  const donePaths = new Set(doneRecs.map(([p]) => p));

  // 园区分组统计
  const groups = new Map<string, { total: number; done: string[] }>();
  for (const s of stations) {
    const g = groups.get(s.group) ?? { total: 0, done: [] };
    g.total += 1;
    if (donePaths.has(s.path)) g.done.push(s.title);
    groups.set(s.group, g);
  }

  const recent = Object.entries(data.pages)
    .sort((a, b) => b[1].t - a[1].t)
    .slice(0, 4)
    .map(([p]) => stationTitle(stations, p));

  const groupHtml = [...groups.entries()]
    .map(
      ([name, g]) => `
      <div class="pg-passport__group">
        <div class="pg-passport__group-head">
          <span class="pg-passport__group-name">${name}</span>
          <span class="pg-passport__group-count">${g.done.length} / ${g.total}</span>
        </div>
        <div class="pg-passport__stamps${g.done.length ? '' : ' is-empty'}">${
          g.done.length
            ? g.done.slice(0, 8).map((t) => `<span class="pg-passport__stamp">✓ ${t}</span>`).join('') +
              (g.done.length > 8 ? `<span class="pg-passport__more">等 ${g.done.length - 8} 站…</span>` : '')
            : '<span class="pg-passport__empty">还没来过，去逛逛 →</span>'
        }</div>
      </div>`,
    )
    .join('');

  passportPanel.innerHTML = `
    <div class="pg-passport__panel">
      <div class="pg-passport__head">
        <span class="pg-passport__title">探索护照</span>
        <span class="pg-passport__count">${doneRecs.length} / ${total} 站</span>
        <button type="button" class="pg-passport__close" aria-label="关闭">✕</button>
      </div>
      <div class="pg-passport__body">
        ${groupHtml || '<div class="pg-passport__empty">护照还是空白的，去花园里逛逛吧。</div>'}
        ${recent.length ? `<div class="pg-passport__recent"><span class="pg-passport__group-name">最近足迹</span>${recent.map((t) => `<span class="pg-passport__stamp">${t}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  passportPanel.querySelector('.pg-passport__close')?.addEventListener('click', closePassport);
}

/* ===================== 花园小径（文末三卡） ===================== */
function nextStation(): { path: string; title: string } | null {
  const active = document.querySelector<HTMLAnchorElement>('.sidebar a.nav-item.is-active');
  if (!active) return null;
  // 分组容器兼容 ul 与 div（SidebarNode 实际用 .nav-group__children）
  const box = active.closest('ul, .nav-group__children');
  if (!box) return null;
  const links = [...box.querySelectorAll<HTMLAnchorElement>('a.nav-item')].filter((a) => a.getAttribute('href'));
  const idx = links.indexOf(active);
  if (idx < 0 || links.length < 2) return null;
  const next = links[(idx + 1) % links.length]!; // 末站环形回到本组首篇
  return { path: next.getAttribute('href')!, title: (next.textContent ?? '').trim() };
}

function diceStation(stations: Station[]): Station | null {
  const cur = location.pathname;
  const pool = stations.filter((s) => s.path !== cur);
  if (!pool.length) return null;
  const fresh = pool.filter((s) => !data.pages[s.path]?.done);
  const from = fresh.length ? fresh : pool;
  return from[(Math.random() * from.length) | 0]!;
}

function buildTrail() {
  if (!fxOn('trail')) return;
  const article = document.querySelector('.article');
  if (!article || !document.querySelector('.md-content')) return;
  const stations = readStations();
  const next = nextStation();
  const dice = diceStation(stations);
  const today = todayStation(stations);
  if (!next && !dice && !today) return;

  const card = (cls: string, tag: string, name: string, href: string | null) =>
    href
      ? `<a class="pg-trail__card ${cls}" href="${href}"><span class="pg-trail__tag">${tag}</span><span class="pg-trail__name">${name}</span><span class="pg-trail__go">出发 →</span></a>`
      : '';

  const section = document.createElement('section');
  section.className = 'pg-trail';
  section.setAttribute('aria-label', '下一条小径');
  section.innerHTML = `
    <div class="pg-trail__label">下一条小径</div>
    <div class="pg-trail__cards">
      ${card('', '下一站 · 同章节', next?.title ?? '', next?.path ?? null)}
      ${card('pg-trail__card--dice', '骰子漫游', dice?.title ?? '', dice?.path ?? null)}
      ${card('pg-trail__card--today', '今日手气 · ' + todayStr(), today?.title ?? '', today?.path ?? null)}
    </div>`;
  article.appendChild(section);
}

/* ===================== 继续探索（首页，滚动位置记忆） ===================== */
function buildContinue() {
  if (!fxOn('trail')) return;
  const home = document.querySelector('.home');
  if (!home) return;
  const last = data.last;
  if (!last || last.path === location.pathname) return;
  const rec = data.pages[last.path];
  if (!rec || rec.p < 0.05 || last.path === '/') return;

  const cardsHost = home.querySelector('.home__cards');
  const card = document.createElement('a');
  card.className = 'pg-continue';
  card.href = last.path;
  card.innerHTML = `
    <span class="pg-continue__tag">继续探索</span>
    <span class="pg-continue__name">${last.title}</span>
    <span class="pg-continue__bar"><span class="pg-continue__fill" style="width:${Math.round(rec.p * 100)}%"></span></span>
    <span class="pg-continue__hint">回到第 ${Math.round(rec.p * 100)}% 处 →</span>`;
  if (cardsHost) home.insertBefore(card, cardsHost);
  else home.appendChild(card);
  card.addEventListener('click', () => {
    try {
      sessionStorage.setItem('pg-restore', JSON.stringify({ path: last.path, y: last.y }));
    } catch {
      /* 隐私模式直接从页首开始 */
    }
  });
}

function maybeRestoreScroll() {
  try {
    const raw = sessionStorage.getItem('pg-restore');
    if (!raw) return;
    sessionStorage.removeItem('pg-restore');
    const { path, y } = JSON.parse(raw) as { path: string; y: number };
    if (path === location.pathname && y > 0) {
      window.setTimeout(() => window.scrollTo({ top: y, behavior: RM.matches ? 'auto' : 'auto' }), 120);
    }
  } catch {
    /* ignore */
  }
}

/* ===================== 侧栏已探索圆点 ===================== */
function markNavDots() {
  if (!fxOn('passport')) return;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.sidebar a.nav-item')) {
    const href = a.getAttribute('href') ?? '';
    if (href && data.pages[href]?.done && !a.querySelector('.pg-dot')) {
      const dot = document.createElement('span');
      dot.className = 'pg-dot';
      dot.title = '已探索';
      a.appendChild(dot);
    }
  }
}

/* ===================== 生命周期 ===================== */
let bound = false;
const cleanups: (() => void)[] = [];

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && passportPanel && !passportPanel.hidden) closePassport();
}

export function guideBind(fxRef: GuideFx) {
  fx = fxRef;
  loadPassport();
  if (bound) return;
  bound = true;
  window.addEventListener('scroll', onGuideScroll, { passive: true });
  window.addEventListener('pagehide', savePassport, { passive: true });
  document.addEventListener('keydown', onKeydown);
  cleanups.push(() => {
    window.removeEventListener('scroll', onGuideScroll);
    window.removeEventListener('pagehide', savePassport);
    document.removeEventListener('keydown', onKeydown);
  });

  // 特效细分开关实时应用（trail / passport 两组）
  const unFx = onFxChange((key, on) => {
    if (key === 'trail') {
      if (on) {
        buildTrail();
        buildContinue();
      } else {
        document.querySelectorAll('.pg-trail, .pg-continue').forEach((el) => el.remove());
      }
    } else if (key === 'passport') {
      if (on) {
        buildPassportBtn();
        buildPassportPanel();
        markNavDots();
      } else {
        document.querySelectorAll('.pg-passport, .pg-passport-btn, .pg-stamp, .pg-dot').forEach((el) => el.remove());
        document.documentElement.classList.remove('has-modal');
        passportBtn = null;
        passportPanel = null;
      }
    }
  });
  cleanups.push(() => unFx());
}

/** 每页重建（engine.setupPage 调用） */
export function guideSetup() {
  if (!storageOk) return;
  pageEnterT = Date.now();
  lastSavedP = data.pages[location.pathname]?.p ?? -1;
  maybeRestoreScroll();
  buildPassportBtn();
  buildPassportPanel();
  buildTrail();
  buildContinue();
  markNavDots();
}

/** 每页清理（engine.teardownPageState 调用） */
export function guideTeardown() {
  for (const sel of ['.pg-trail', '.pg-passport', '.pg-passport-btn', '.pg-stamp', '.pg-continue']) {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  }
  document.querySelectorAll('.pg-dot').forEach((el) => el.remove());
  document.documentElement.classList.remove('has-modal');
  passportBtn = null;
  passportPanel = null;
}

export function guideUnbind() {
  for (const fn of cleanups) fn();
  cleanups.length = 0;
  bound = false;
  fx = null;
}
