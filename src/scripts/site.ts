/**
 * site.ts —— 全站客户端交互（View Transitions 感知）
 * astro:page-load 在首次加载与每次 swap 后触发，用于重新绑定
 */

/* ---------- 常驻监听（模块级，只挂一次） ---------- */
let globalBound = false;
let mermaidMod: any = null;
let themeTimer: number | undefined;
let ticking = false;
let tocIO: IntersectionObserver | null = null;
let revealIO: IntersectionObserver | null = null;
let countIO: IntersectionObserver | null = null;

function onScrollFrame() {
  ticking = false;
  const toolbar = document.getElementById('toolbar');
  const bar = document.getElementById('progressBar');
  const backtop = document.getElementById('backtop');
  const doc = document.documentElement;
  toolbar?.classList.toggle('is-scrolled', window.scrollY > 8);

  const max = doc.scrollHeight - window.innerHeight;
  if (bar) bar.style.width = max > 0 ? `${Math.min(100, (window.scrollY / max) * 100)}%` : '0%';

  backtop?.classList.toggle('is-visible', window.scrollY > 640);
}

function requestScrollFrame() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(onScrollFrame);
}

function bindGlobal() {
  if (globalBound) return;
  globalBound = true;
  window.addEventListener('scroll', requestScrollFrame, { passive: true });
  window.addEventListener('resize', requestScrollFrame, { passive: true });

  // 抽屉状态跨断点清理：移动端打开后拉宽到桌面时，收掉残留的遮罩
  matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
    if (e.matches) {
      document.getElementById('sidebar')?.classList.remove('is-open');
      document.getElementById('scrim')?.classList.remove('is-open');
    }
  });
}

/* ---------- localStorage 安全读写（隐私模式 / 受限源下不抛错） ---------- */
function storedPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 写不进就只保留内存态 */
  }
}

/* ---------- 明暗切换（跟随系统 + 手动覆盖） ---------- */
let systemThemeBound = false;

function initTheme() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // 未手动选择时，跟随系统主题变化；监听器跨 swap 存活，模块级只挂一次
  if (!systemThemeBound) {
    systemThemeBound = true;
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (storedPref('garden-theme')) return;
      document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    });
  }

  btn.addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.classList.add('theme-transition');
    root.dataset.theme = next;
    storePref('garden-theme', next);
    window.clearTimeout(themeTimer);
    themeTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 350);
    // 图标翻转（Q弹）+ Mermaid 按新主题重渲染
    btn.classList.toggle('is-flipped');
    rerenderMermaid();
  });
}

/* ---------- 皮肤切换（data-skin + 备用 link 启停，localStorage 持久化） ---------- */
function applySkin(skin: string) {
  document.documentElement.dataset.skin = skin;
  for (const l of document.querySelectorAll<HTMLLinkElement>('link[data-skin-link]')) {
    const off = l.dataset.skinLink !== skin;
    l.disabled = off;
    l.toggleAttribute('disabled', off);
  }
  void syncEnhancer();
}

/* ---------- 皮肤增强脚本（可选：皮肤自带的懒加载 JS，如 canvas 引擎） ----------
   皮肤 = 纯 CSS 是底线；需要 JS 的皮肤在此注册（key = 皮肤 id = 目录名），
   模块由 Vite 打成独立 chunk，仅当该皮肤激活时才下载执行。
   增强模块须导出 { mount, unmount }，契约见 src/themes/_contract.md */
interface SkinEnhancer {
  mount: () => void;
  unmount: () => void;
}

const SKIN_ENHANCERS: Record<string, () => Promise<SkinEnhancer>> = {
  playground: () => import('../themes/playground/engine'),
};

let activeEnhancer: SkinEnhancer | null = null;
let enhancerTarget = ''; // 已挂载或正在加载的目标皮肤（幂等 + 竞态守卫）

async function syncEnhancer() {
  const skin = document.documentElement.dataset.skin ?? '';
  if (skin === enhancerTarget) return;
  enhancerTarget = skin;
  activeEnhancer?.unmount();
  activeEnhancer = null;
  const loader = SKIN_ENHANCERS[skin];
  if (!loader) return;
  try {
    const mod = await loader();
    if (enhancerTarget !== skin) return; // 加载期间皮肤又切走，本次结果作废
    activeEnhancer = mod;
    mod.mount();
  } catch (err) {
    console.warn(`[garden] 皮肤增强脚本加载失败：${skin}`, err);
  }
}

/* ---------- 皮肤选择菜单（#skinToggle 弹出，注册表驱动） ---------- */
let skinMenu: HTMLElement | null = null;
let skinMenuTimer: number | undefined;
let skinMenuGlobalBound = false;

function skinList(): { id: string; label: string }[] {
  try {
    const reg = JSON.parse(
      document.getElementById('skinRegistry')?.textContent ?? '',
    ) as { skins?: { id: string; label?: string }[] };
    return (reg.skins ?? []).filter((s) => s.id);
  } catch {
    return [];
  }
}

function closeSkinMenu() {
  if (!skinMenu) return;
  const m = skinMenu;
  skinMenu = null;
  m.classList.remove('is-open');
  document.getElementById('skinToggle')?.setAttribute('aria-expanded', 'false');
  window.clearTimeout(skinMenuTimer);
  skinMenuTimer = window.setTimeout(() => m.remove(), 200);
}

function chooseSkin(id: string) {
  if (document.documentElement.dataset.skin === id) return;
  const root = document.documentElement;
  root.classList.add('theme-transition');
  applySkin(id);
  storePref('garden-skin', id);
  window.clearTimeout(themeTimer);
  themeTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 350);
  rerenderMermaid(); // 皮肤可能映射不同 mermaid 主题
  closeSkinMenu();
}

function openSkinMenu(btn: HTMLElement) {
  window.clearTimeout(skinMenuTimer);
  skinMenu?.remove();
  const skins = skinList();
  if (!skins.length) return;
  const root = document.documentElement;

  const menu = document.createElement('div');
  menu.className = 'skin-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', '界面风格');
  const head = document.createElement('div');
  head.className = 'skin-menu__label';
  head.textContent = '界面风格';
  menu.appendChild(head);
  for (const s of skins) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'skin-menu__item';
    item.setAttribute('role', 'menuitemradio');
    const active = (root.dataset.skin ?? '') === s.id;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-checked', String(active));
    item.textContent = s.label;
    item.addEventListener('click', () => chooseSkin(s.id));
    menu.appendChild(item);
  }
  document.body.appendChild(menu);

  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth;
  menu.style.top = `${Math.round(r.bottom + 8)}px`;
  menu.style.left = `${Math.max(8, Math.round(Math.min(r.right - mw, window.innerWidth - mw - 8)))}px`;
  skinMenu = menu;
  btn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => menu.classList.add('is-open'));
  (menu.querySelector('.skin-menu__item.is-active') as HTMLElement | null)?.focus();
}

function initSkin() {
  const btn = document.getElementById('skinToggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (skinMenu) closeSkinMenu();
    else openSkinMenu(btn as HTMLElement);
  });

  // 文档级监听跨 swap 存活，只挂一次
  if (skinMenuGlobalBound) return;
  skinMenuGlobalBound = true;
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (skinMenu && !skinMenu.contains(target) && !target.closest('#skinToggle')) closeSkinMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (!skinMenu) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSkinMenu();
      document.getElementById('skinToggle')?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...skinMenu.querySelectorAll<HTMLElement>('.skin-menu__item')];
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  });
}

/* ---------- 侧边栏：桌面折叠 / 移动抽屉 ---------- */
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const scrim = document.getElementById('scrim');
  if (!sidebar || !toggle) return;

  const desktop = matchMedia('(min-width: 901px)');
  if (desktop.matches && storedPref('garden-sidebar') === 'collapsed') {
    sidebar.classList.add('is-collapsed');
  }

  toggle.addEventListener('click', () => {
    if (matchMedia('(max-width: 900px)').matches) {
      const open = sidebar.classList.toggle('is-open');
      scrim?.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    } else {
      const collapsed = sidebar.classList.toggle('is-collapsed');
      storePref('garden-sidebar', collapsed ? 'collapsed' : 'open');
      toggle.setAttribute('aria-expanded', String(!collapsed));
    }
  });

  scrim?.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    scrim.classList.remove('is-open');
  });
}

/* ---------- TOC scroll-spy（中文标题 id 与 a.hash 编码一致） ---------- */
function initTocSpy() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('#toc a[data-toc-link]')];
  if (!links.length) return;

  // headingId -> link 的映射，绕开 percent-encode 比较陷阱
  const linkById = new Map<string, HTMLAnchorElement>();
  const headings: HTMLElement[] = [];
  for (const a of links) {
    const id = decodeURIComponent(a.hash.slice(1));
    const h = document.getElementById(id);
    if (h) {
      linkById.set(h.id, a);
      headings.push(h);
    }
  }
  if (!headings.length) return;

  const setActive = (id: string) => {
    for (const a of links) a.classList.toggle('is-active', a === linkById.get(id));
  };
  // 首屏先点亮第一个（避免页面顶部无高亮）
  setActive(headings[0]!.id);

  tocIO?.disconnect();
  tocIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) setActive(e.target.id);
      }
    },
    { rootMargin: '-64px 0px -68% 0px', threshold: 0 },
  );
  headings.forEach((h) => tocIO!.observe(h));
}

/* ---------- 代码块复制按钮（含 execCommand 回退） ---------- */
const COPY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>';

function flashCopyState(btn: HTMLButtonElement, ok: boolean) {
  btn.classList.toggle('is-copied', ok);
  btn.classList.toggle('is-error', !ok);
  btn.innerHTML = ok ? CHECK_SVG : COPY_SVG;
  window.setTimeout(() => {
    btn.classList.remove('is-copied', 'is-error');
    btn.innerHTML = COPY_SVG;
  }, 1400);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function initCopyButtons() {
  for (const pre of document.querySelectorAll<HTMLPreElement>('.md-content pre')) {
    if (pre.classList.contains('mermaid') || pre.querySelector('.code-copy')) continue;
    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.type = 'button';
    btn.setAttribute('aria-label', '复制代码');
    btn.innerHTML = COPY_SVG;
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.innerText ?? pre.innerText;
      flashCopyState(btn, await copyText(code));
    });
    pre.appendChild(btn);
  }
}

/* ---------- 滚动渐入 ---------- */
function initReveal() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)');
  revealIO?.disconnect();
  if (!els.length) return;
  revealIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          revealIO!.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  els.forEach((el) => revealIO!.observe(el));
}

/* ---------- 回顶 ---------- */
function initBacktop() {
  document.getElementById('backtop')?.addEventListener('click', () => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
}

/* ---------- 数字滚动（首页统计条） ---------- */
function initCountUp() {
  const els = document.querySelectorAll<HTMLElement>('[data-count]:not([data-counted])');
  countIO?.disconnect();
  if (!els.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animate = (el: HTMLElement) => {
    const target = Number(el.dataset.count ?? '0');
    if (reduce || target <= 0) {
      el.textContent = String(target);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  countIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          countIO!.unobserve(e.target);
          (e.target as HTMLElement).dataset.counted = '1';
          animate(e.target as HTMLElement);
        }
      }
    },
    { threshold: 0.4 },
  );
  els.forEach((el) => countIO!.observe(el));
}

/* ---------- Mermaid（源码存档，明暗/皮肤切换可重渲染） ---------- */
function mermaidThemeFor(dark: boolean): string {
  try {
    const reg = JSON.parse(
      document.getElementById('skinRegistry')?.textContent ?? '',
    ) as { skins?: { id: string; mermaid?: { light: string; dark: string } }[] };
    const skin = document.documentElement.dataset.skin;
    const m = reg.skins?.find((s) => s.id === skin)?.mermaid;
    if (m) return dark ? m.dark : m.light;
  } catch {
    /* 注册表缺失时回退默认 */
  }
  return dark ? 'dark' : 'neutral';
}

async function ensureMermaid() {
  if (!mermaidMod) {
    const url = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaidMod = await import(/* @vite-ignore */ url);
  }
  return mermaidMod;
}

async function renderMermaid() {
  const nodes = document.querySelectorAll<HTMLPreElement>('pre.mermaid:not([data-processed])');
  if (!nodes.length) return;
  try {
    const mod = await ensureMermaid();
    const dark = document.documentElement.dataset.theme === 'dark';
    // 渲染会替换文本内容，先存档源码供主题切换重渲染
    nodes.forEach((n) => {
      if (!n.dataset.src) n.dataset.src = n.textContent ?? '';
    });
    mod.default.initialize({
      startOnLoad: false,
      theme: mermaidThemeFor(dark),
      fontFamily: 'var(--font-system), sans-serif',
    });
    await mod.default.run({ querySelector: 'pre.mermaid' });
  } catch {
    /* CDN 失败时保留源码文本 */
  }
}

async function rerenderMermaid() {
  const done = document.querySelectorAll<HTMLPreElement>('pre.mermaid[data-processed]');
  if (!done.length) return;
  done.forEach((n) => {
    n.removeAttribute('data-processed');
    n.innerHTML = '';
    n.textContent = n.dataset.src ?? '';
  });
  await renderMermaid();
}

/* ---------- xmind 一等公民页（官方 embed-viewer 直接渲染，控制器懒加载） ---------- */
let xmindViewerCtor: any = null;

async function initXmind() {
  const nodes = document.querySelectorAll<HTMLElement>(
    '.xmind-embed__frame[data-xmind-src]:not([data-ready])',
  );
  if (!nodes.length) return;
  try {
    if (!xmindViewerCtor) {
      xmindViewerCtor = (await import('xmind-embed-viewer')).XMindEmbedViewer;
    }
  } catch (err) {
    console.warn('[initXmind] viewer 控制器加载失败', err);
    return; // 控制器加载失败：顶部下载/新窗口链接兜底
  }
  for (const el of nodes) {
    el.dataset.ready = '1';
    try {
      const res = await fetch(el.dataset.xmindSrc!);
      if (!res.ok) {
        console.warn('[initXmind] 原文件加载失败', res.status, el.dataset.xmindSrc);
        continue;
      }
      const buf = await res.arrayBuffer();
      const viewer = new xmindViewerCtor({
        el,
        region: 'cn', // 国内图库（www.xmind.cn），渲染器本体在 XMind 托管 iframe 中
        styles: { width: '100%', height: '100%' },
      });
      viewer.addEventListener('sheets-load', () => {
        try {
          viewer.setFitMap();
        } catch {
          /* 自适配失败保持默认缩放 */
        }
      });
      viewer.load(buf);
    } catch (err) {
      console.warn('[initXmind] 挂载失败', el.dataset.xmindSrc, err);
      /* 单个文件失败不影响其它 */
    }
  }
}

/* ---------- 快捷键：⌘K / Ctrl+K ---------- */
function initShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('searchToggle')?.click();
    }
  });
}

/* ---------- 入口 ---------- */
function init() {
  bindGlobal();
  onScrollFrame();
  initTheme();
  initSkin();
  initSidebar();
  initTocSpy();
  initCopyButtons();
  initReveal();
  initBacktop();
  initCountUp();
  renderMermaid();
  initXmind();
}

/* View Transitions 交换 <html> 前把当前外观写进新文档：
   SSR 产物不带 data-theme、皮肤 <link> 也是默认启停态，
   若等 after-swap 再修，swap 与其之间的 await 边界会渲染一帧错误主题
   （即「页面加载完成后自动切换一次」的来源） */
document.addEventListener('astro:before-swap', (e) => {
  const cur = document.documentElement;
  const next = (e as Event & { newDocument?: Document }).newDocument;
  if (!next) return;
  if (cur.dataset.theme) next.documentElement.dataset.theme = cur.dataset.theme;
  if (cur.dataset.skin) next.documentElement.dataset.skin = cur.dataset.skin;
  const skin = cur.dataset.skin;
  if (!skin) return;
  for (const l of next.querySelectorAll<HTMLLinkElement>('link[data-skin-link]')) {
    const off = l.dataset.skinLink !== skin;
    l.disabled = off;
    l.toggleAttribute('disabled', off);
  }
});

/* 兜底：swap 后再校正一次（防 before-swap 未覆盖的路径） */
document.addEventListener('astro:after-swap', () => {
  // 换肤菜单挂在旧 body 上，随 swap 丢弃；清引用防误操作已离屏节点
  skinMenu = null;
  window.clearTimeout(skinMenuTimer);

  const root = document.documentElement;
  const stored = storedPref('garden-theme');
  const current = root.dataset.theme;
  root.dataset.theme =
    stored === 'light' || stored === 'dark'
      ? stored
      : current === 'light' || current === 'dark'
        ? current
        : matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

  const links = [...document.querySelectorAll<HTMLLinkElement>('link[data-skin-link]')];
  const ids = links.map((l) => l.dataset.skinLink).filter((x): x is string => !!x);
  if (ids.length > 1) {
    const storedSkin = storedPref('garden-skin');
    const current = root.dataset.skin;
    const skin =
      storedSkin && ids.includes(storedSkin)
        ? storedSkin
        : current && ids.includes(current)
          ? current
          : ids[0]!;
    applySkin(skin);
  }
});

document.addEventListener('astro:page-load', init);
initShortcuts();
syncEnhancer(); // 首次加载（皮肤已由防闪白内联脚本写好；换肤路径走 applySkin）
