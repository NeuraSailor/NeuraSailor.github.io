/**
 * settings.ts —— 「游乐场」特效细分开关（皮肤菜单第二层）
 *
 * 换肤菜单的「游乐场」行上追加滑杆小图标，点开特效面板：
 * 9 个特效独立开关，即时生效，localStorage 记忆（缺省全开）。
 * 架构：site.ts 的 openSkinMenu 注入菜单后广播通用事件
 * `garden:skinmenu`（detail.menu），本模块据此装饰菜单——
 * site.ts 不携带任何皮肤决策。
 */

/* ===================== 开关键值 ===================== */
export type FxKey =
  | 'field'
  | 'choreo'
  | 'cursor'
  | 'bursts'
  | 'confetti'
  | 'gravity'
  | 'sticker'
  | 'trail'
  | 'passport';

const LABELS: Record<FxKey, string> = {
  field: '粒子流场',
  choreo: '章节渐进展开',
  cursor: '光标墨迹与磁吸',
  bursts: '点击爆发',
  confetti: '读完彩带',
  gravity: '重力彩蛋',
  sticker: '便签拖拽',
  trail: '花园小径与足迹',
  passport: '探索护照',
};

const GROUPS: { name: string; keys: FxKey[] }[] = [
  {
    name: '视觉引擎',
    keys: ['field', 'choreo', 'cursor', 'bursts', 'confetti', 'gravity', 'sticker'],
  },
  { name: '探索引导', keys: ['trail', 'passport'] },
];

const KEY = 'garden-playground-fx';

let state: Partial<Record<FxKey, boolean>> = {};
let bound = false;
let fxPanel: HTMLElement | null = null;
let panelCleanups: (() => void)[] = [];

(function loadFx() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as Partial<Record<FxKey, boolean>>;
  } catch {
    /* 隐私模式：仅内存态，功能照常（缺省全开） */
  }
})();

function saveFx() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 写不进就只保留内存态 */
  }
}

/** 查询开关（缺省全开；reduced-motion 仍由各特效自身守卫） */
export function fxOn(key: FxKey): boolean {
  return state[key] !== false;
}

/* ===================== 变更分发 ===================== */
type Listener = (key: FxKey, on: boolean) => void;
const listeners = new Set<Listener>();

export function onFxChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setFx(key: FxKey, on: boolean) {
  if (state[key] === on) return;
  state[key] = on;
  saveFx();
  for (const fn of listeners) fn(key, on);
}

/* ===================== 皮肤菜单装饰 ===================== */

const GEAR_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9.5" cy="7" r="2.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.6" fill="currentColor" stroke="none"/><circle cx="8" cy="17" r="2.6" fill="currentColor" stroke="none"/></svg>';

function onSkinMenuEvent(e: Event) {
  const menu = (e as CustomEvent).detail?.menu as HTMLElement | null | undefined;
  if (!menu) return;
  const item = [...menu.querySelectorAll<HTMLElement>('.skin-menu__item')].find((b) =>
    b.textContent?.includes('游乐场'),
  );
  if (!item || item.querySelector('.pg-fxgear')) return;

  // 滑杆小图标（span 避免 button 嵌套；点击不触发换肤）
  const gear = document.createElement('span');
  gear.className = 'pg-fxgear';
  gear.setAttribute('role', 'button');
  gear.setAttribute('tabindex', '0');
  gear.setAttribute('aria-label', '游乐场特效设置');
  gear.innerHTML = GEAR_SVG;
  gear.addEventListener('click', (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    toggleFxPanel(gear);
  });
  gear.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      ev.stopPropagation();
      toggleFxPanel(gear);
    }
  });
  item.appendChild(gear);

  // 已激活时点整行 = 打开特效层（chooseSkin 同皮肤早退，不会冲突）
  if (item.classList.contains('is-active')) {
    item.addEventListener('click', () => {
      if (fxPanel) closeFxPanel();
      else toggleFxPanel(item);
    });
  }
}

/* ===================== 特效面板 ===================== */

function toggleFxPanel(anchor: HTMLElement) {
  if (fxPanel) {
    closeFxPanel();
    return;
  }
  const panel = document.createElement('div');
  panel.className = 'pg-fxmenu';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', '游乐场特效开关');

  const head = document.createElement('div');
  head.className = 'pg-fxmenu__label';
  head.textContent = '游乐场 · 特效';
  panel.appendChild(head);

  for (const g of GROUPS) {
    const gh = document.createElement('div');
    gh.className = 'pg-fxmenu__group';
    gh.textContent = g.name;
    panel.appendChild(gh);
    for (const key of g.keys) {
      const row = document.createElement('label');
      row.className = 'pg-fxmenu__row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = fxOn(key);
      input.addEventListener('change', () => setFx(key, input.checked));
      const name = document.createElement('span');
      name.className = 'pg-fxmenu__name';
      name.textContent = LABELS[key];
      const sw = document.createElement('span');
      sw.className = 'pg-fxmenu__sw';
      row.append(name, input, sw);
      panel.appendChild(row);
    }
  }
  document.body.appendChild(panel);

  // 定位：菜单左侧，放不下则对齐左缘
  const r = anchor.getBoundingClientRect();
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  let left = r.left - w - 10;
  if (left < 8) left = Math.max(8, r.right - w);
  panel.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - h - 8))}px`;
  panel.style.left = `${Math.round(left)}px`;

  fxPanel = panel;
  requestAnimationFrame(() => panel.classList.add('is-open'));

  // 外点 / Escape 关闭（跳过本次打开点击）
  const onDocDown = (ev: PointerEvent) => {
    const t = ev.target as HTMLElement | null;
    if (fxPanel && !fxPanel.contains(t) && !t?.closest?.('.pg-fxgear')) closeFxPanel();
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') closeFxPanel();
  };
  window.setTimeout(() => {
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
  }, 0);
  panelCleanups.push(() => {
    document.removeEventListener('pointerdown', onDocDown);
    document.removeEventListener('keydown', onKey);
  });
}

function closeFxPanel() {
  if (!fxPanel) return;
  const p = fxPanel;
  fxPanel = null;
  p.classList.remove('is-open');
  window.setTimeout(() => p.remove(), 180);
  for (const fn of panelCleanups) fn();
  panelCleanups = [];
}

/* ===================== 生命周期 ===================== */

export function settingsBind() {
  if (bound) return;
  bound = true;
  window.addEventListener('garden:skinmenu', onSkinMenuEvent);
}

export function settingsUnbind() {
  closeFxPanel();
  window.removeEventListener('garden:skinmenu', onSkinMenuEvent);
  bound = false;
  listeners.clear();
}
