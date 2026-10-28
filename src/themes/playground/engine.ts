/**
 * engine.ts —— 「游乐场」皮肤增强脚本（可玩性核心）
 *
 * 由 site.ts 的 SKIN_ENHANCERS 在 data-skin=playground 时懒加载；
 * 纯 CSS 也能独立成站（本脚本所有 DOM 改动都是渐进增强、unmount 全清）。
 *
 * 五个模块（共用一条 rAF 主循环）：
 *   AmbientField   环境流场粒子（p5 风伪噪声流场，滚动=风、光标=吸引子、点击=斥力爆发）
 *   SectionChoreo  章节渐进展开（运行时打 [data-kin]，进入视口弹入；h2 蜡笔波浪画出）
 *   JourneyFx      旅程特效（h2 到达小爆发；读完全文 [EOF] 彩带庆祝，matter.js 优先）
 *   CursorFx       光标墨迹丝带 + 控件磁吸（仅 pointer:fine）
 *   EasterEgg      连点页题三下 → 重力模式（正文便签/代码块掉落可拖拽；matter.js 缺席则果冻抖动）
 *
 * 生命周期：mount（常驻监听一次）→ setupPage（每页重建，html[data-pg-setup] 防重）
 *   → astro:before-swap teardownPage → astro:page-load setupPage → … → unmount 全清
 * 安全网：prefers-reduced-motion 全静默（不建 canvas、不编排、不彩蛋）；
 *   document.hidden 暂停循环；DPR ≤2；移动端粒子减半、无光标特效。
 */

/* ===================== 环境探测（模块级，跨页面存活） ===================== */
import { guideBind, guideSetup, guideTeardown, guideUnbind } from './guide';
import { fxOn, onFxChange, settingsBind, settingsUnbind } from './settings';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const FINE = matchMedia('(pointer: fine)');
const MOBILE = matchMedia('(max-width: 900px)');

/* ===================== 模块级状态（mount ↔ unmount 对称） ===================== */
let mounted = false;
let persistentCleanups: (() => void)[] = [];

/* ---------- 页面级状态（setupPage 重建 / teardownPage 清理） ---------- */
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let cssW = 0;
let cssH = 0;
let dpr = 1;
let rafId = 0;
let lastFrame = 0;
let resizeTimer = 0;

let kinIO: IntersectionObserver | null = null;
let themeMO: MutationObserver | null = null;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ci: number;
  seed: number;
}
let particles: Particle[] = [];

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  born: number;
  life: number;
  strip: boolean;
  w: number;
  h: number;
  rot: number;
  vr: number;
}
let sparks: Spark[] = [];

/* ---------- 便签拖拽（抓胶带甩出去，松手果冻归位） ---------- */
interface StickerDrag {
  el: HTMLElement;
  startX: number;
  startY: number;
  vx: number;
  lastX: number;
  engaged: boolean;
  pointerId: number;
}
let stickerDrag: StickerDrag | null = null;
let stickerSuppressClick = false;

let palette: string[] = ['#ef7d51', '#4fae9f', '#d9a545', '#8d7bd0'];
let inkColor = 'rgba(226, 88, 44, 0.5)';
let isDark = false;

let ink: { x: number; y: number; t: number }[] = [];
const pointer = { x: -1e4, y: -1e4, t: 0, active: false };

let scrollVel = 0;
let lastScrollY = 0;
let journeyP = 0;
let eofFired = false;

let magnets: HTMLElement[] = [];
const magState = new Map<HTMLElement, { x: number; y: number }>();

let titleClicks: number[] = [];

/* matter.js CDN 缓存（跨页面存活；失败则彩蛋降级） */
let matterMod: any = null;

interface GravityPair {
  wrap: HTMLElement;
  src: HTMLElement;
  body: any;
  restoreVis: string;
}
interface GravitySession {
  M: any;
  engine: any;
  pairs: GravityPair[];
  dragBody: any | null;
  dragOff: { x: number; y: number };
  detach: () => void;
}
let gravity: GravitySession | null = null;

/* ============================================================
   AmbientField —— 环境流场
   ============================================================ */

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const next: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const v = cs.getPropertyValue(`--pg-particle-${i}`).trim();
    next.push(v || palette[i - 1] || '#ef7d51');
  }
  palette = next;
  inkColor = cs.getPropertyValue('--pg-ink').trim() || inkColor;
  isDark = document.documentElement.dataset.theme === 'dark';
}

function particleBudget(): number {
  const base = Math.round((cssW * cssH) / 17000);
  const cap = MOBILE.matches ? 42 : 88;
  return Math.max(26, Math.min(cap, base));
}

function seedParticles() {
  const n = particleBudget();
  particles = Array.from({ length: n }, () => ({
    x: Math.random() * cssW,
    y: Math.random() * cssH,
    vx: 0,
    vy: 0,
    r: 0.9 + Math.random() * 1.7,
    ci: (Math.random() * palette.length) | 0,
    seed: Math.random() * 1000,
  }));
}

function sizeCanvas() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = window.innerWidth;
  cssH = window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** p5 风伪噪声流场：几组 sin/cos 叠出缓变的向量场（零依赖近似 Perlin） */
function flowAngle(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 0.0018 + t * 0.00034) +
    Math.cos(y * 0.0014 - t * 0.00027) +
    Math.sin((x + y) * 0.0006 + t * 0.00017)
  ) * 1.25;
}

function updateField(now: number, dtf: number) {
  if (!ctx || !fxOn('field')) return;
  const speedBase = 0.34 + journeyP * 0.62; // 阅读越深，园子越活
  const gust = 1 + Math.min(Math.abs(scrollVel) / 55, 1.3); // 滚动=风
  const windX = Math.max(-6, Math.min(6, scrollVel * 0.055));

  // 暗色用加法混合出霓虹辉光，亮色保持蜡笔质感
  const comp = isDark ? 'lighter' : 'source-over';

  for (const p of particles) {
    const a = flowAngle(p.x, p.y, now + p.seed * 7);
    const s = speedBase * (0.55 + p.r * 0.34) * gust;
    p.vx += (Math.cos(a) * s - p.vx) * 0.065 * dtf;
    p.vy += (Math.sin(a) * s - p.vy) * 0.065 * dtf;
    p.vx += windX * 0.02 * dtf;

    // 光标吸引子
    if (pointer.active && FINE.matches) {
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160 && d2 > 36) {
        const d = Math.sqrt(d2);
        p.vx += (dx / d) * 0.05 * dtf;
        p.vy += (dy / d) * 0.05 * dtf;
      }
    }

    p.x += p.vx * dtf;
    p.y += p.vy * dtf;

    // 环绕边界
    if (p.x < -12) p.x = cssW + 12;
    else if (p.x > cssW + 12) p.x = -12;
    if (p.y < -12) p.y = cssH + 12;
    else if (p.y > cssH + 12) p.y = -12;

    const color = palette[p.ci] ?? palette[0]!;
    // 光晕
    ctx.globalCompositeOperation = comp;
    ctx.globalAlpha = isDark ? 0.16 : 0.13;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    // 芯点
    ctx.globalAlpha = isDark ? 0.85 : 0.72;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/* ============================================================
   JourneyFx —— 爆发与彩带
   ============================================================ */

function burst(x: number, y: number, n = 14) {
  if (RM.matches || !fxOn('bursts')) return;
  const now = performance.now();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 1.2 + Math.random() * 3.2;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 0.6,
      r: 1.4 + Math.random() * 2.1,
      color: palette[(Math.random() * palette.length) | 0] ?? '#ef7d51',
      born: now,
      life: 520 + Math.random() * 380,
      strip: false,
      w: 0,
      h: 0,
      rot: 0,
      vr: 0,
    });
  }
  // 斥力：推开附近流场粒子
  for (const p of particles) {
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 130 * 130 && d2 > 1) {
      const d = Math.sqrt(d2);
      const f = ((130 - d) / 130) * 3.4;
      p.vx += (dx / d) * f;
      p.vy += (dy / d) * f;
    }
  }
}

function updateSparks(now: number, dtf: number, c: CanvasRenderingContext2D) {
  if (!sparks.length) return;
  sparks = sparks.filter((s) => now - s.born < s.life);
  for (const s of sparks) {
    if (s.strip) {
      s.vy += 0.085 * dtf; // 纸条受重力
      s.vx *= 0.992;
      s.rot += s.vr * dtf;
    } else {
      s.vx *= 0.955;
      s.vy = s.vy * 0.955 + 0.02 * dtf;
    }
    s.x += s.vx * dtf;
    s.y += s.vy * dtf;
    const age = (now - s.born) / s.life;
    c.globalAlpha = 1 - age * age;
    c.fillStyle = s.color;
    if (s.strip) {
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.rot);
      c.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      c.restore();
    } else {
      c.beginPath();
      c.arc(s.x, s.y, s.r * (1 - age * 0.4), 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = 1;
}

/* ---------- 庆祝层画布（z 高于内容，pointer-events 无） ---------- */
function makeCelebrateCanvas(): { el: HTMLCanvasElement; c: CanvasRenderingContext2D } | null {
  if (RM.matches) return null;
  const el = document.createElement('canvas');
  el.className = 'pg-celebrate';
  const c = el.getContext('2d');
  if (!c) return null;
  el.style.cssText =
    'position:fixed;inset:0;width:100%;height:100%;z-index:75;pointer-events:none;transition:opacity 400ms ease';
  const d = Math.min(window.devicePixelRatio || 1, 2);
  el.width = Math.round(window.innerWidth * d);
  el.height = Math.round(window.innerHeight * d);
  c.setTransform(d, 0, 0, d, 0, 0);
  document.body.appendChild(el);
  return { el, c };
}

function confettiStrips(count: number) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * cssW,
    y: -20 - Math.random() * 160,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 1 + Math.random() * 2.6,
    w: 7 + Math.random() * 7,
    h: 4 + Math.random() * 3,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.25,
    color: palette[(Math.random() * palette.length) | 0] ?? '#ef7d51',
  }));
}

/** 彩带庆祝：matter.js 可用则物理纸条，否则手写简化物理（gravity + 阻尼 + 翻转） */
async function fireConfetti() {
  if (RM.matches || !fxOn('confetti')) return;
  const layer = makeCelebrateCanvas();
  if (!layer) return;
  const { el, c } = layer;
  const stop = () => {
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 420);
  };
  try {
    const M = await ensureMatter();
    matterConfetti(M, el, c, stop);
  } catch {
    handConfetti(el, c, stop);
  }
}

function handConfetti(
  el: HTMLCanvasElement,
  c: CanvasRenderingContext2D,
  stop: () => void,
) {
  const strips = confettiStrips(90);
  const t0 = performance.now();
  let last = t0;
  const tick = (t: number) => {
    const dtf = Math.min(2.5, (t - last) / 16.7);
    last = t;
    c.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;
    for (const s of strips) {
      s.vy += 0.075 * dtf;
      s.vx *= 0.995;
      s.x += s.vx * dtf;
      s.y += s.vy * dtf;
      s.rot += s.vr * dtf;
      if (s.y < window.innerHeight + 30) alive = true;
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.rot);
      c.fillStyle = s.color;
      c.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      c.restore();
    }
    if (t - t0 < 3200 && alive) requestAnimationFrame(tick);
    else stop();
  };
  requestAnimationFrame(tick);
}

function matterConfetti(
  M: any,
  el: HTMLCanvasElement,
  c: CanvasRenderingContext2D,
  stop: () => void,
) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const engine = M.Engine.create();
  const strips = confettiStrips(80);
  const bodies = strips.map((s) =>
    M.Bodies.rectangle(s.x, s.y, s.w, s.h, {
      restitution: 0.45,
      friction: 0.08,
      frictionAir: 0.022,
      angle: s.rot,
    }),
  );
  M.Composite.add(engine.world, [
    ...bodies,
    M.Bodies.rectangle(W / 2, H + 40, W * 1.4, 80, { isStatic: true }),
    M.Bodies.rectangle(-40, H / 2, 80, H * 2, { isStatic: true }),
    M.Bodies.rectangle(W + 40, H / 2, 80, H * 2, { isStatic: true }),
  ]);
  const t0 = performance.now();
  let last = t0;
  const tick = (t: number) => {
    M.Engine.update(engine, Math.min(24, t - last));
    last = t;
    c.clearRect(0, 0, W, H);
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const s = strips[i]!;
      c.save();
      c.translate(b.position.x, b.position.y);
      c.rotate(b.angle);
      c.fillStyle = s.color;
      c.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      c.restore();
    }
    if (t - t0 < 3000) requestAnimationFrame(tick);
    else {
      M.Engine.clear(engine);
      stop();
    }
  };
  requestAnimationFrame(tick);
}

/** matter.js：esm 动态 import 优先，UMD script 标签兜底，全失败抛给调用方降级 */
async function ensureMatter(): Promise<any> {
  if (matterMod) return matterMod;
  const esm = 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm';
  try {
    const m: any = await import(/* @vite-ignore */ esm);
    matterMod = m?.default ?? m;
    if (matterMod?.Engine) return matterMod;
    throw new Error('esm 导出缺失');
  } catch {
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js';
      s.onload = () => res();
      s.onerror = () => rej(new Error('matter.js UMD 加载失败'));
      document.head.appendChild(s);
    });
    matterMod = (window as any).Matter;
    if (!matterMod?.Engine) throw new Error('window.Matter 缺失');
    return matterMod;
  }
}

/* ============================================================
   CursorFx —— 光标墨迹 + 磁吸
   ============================================================ */

function pushInk(x: number, y: number) {
  const lastPt = ink[ink.length - 1];
  if (lastPt) {
    const dx = x - lastPt.x;
    const dy = y - lastPt.y;
    if (dx * dx + dy * dy < 9) return;
  }
  ink.push({ x, y, t: performance.now() });
  if (ink.length > 26) ink.shift();
}

function drawInk(now: number) {
  if (!ctx || !FINE.matches || MOBILE.matches || !fxOn('cursor')) return;
  ink = ink.filter((p) => now - p.t < 420);
  if (ink.length < 3 || !pointer.active) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = inkColor;
  for (let i = 1; i < ink.length; i++) {
    const k = i / ink.length;
    ctx.globalAlpha = k * 0.55;
    ctx.lineWidth = 0.8 + k * 4.6;
    ctx.beginPath();
    ctx.moveTo(ink[i - 1]!.x, ink[i - 1]!.y);
    ctx.lineTo(ink[i]!.x, ink[i]!.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function collectMagnets() {
  magnets = [...document.querySelectorAll<HTMLElement>('.icon-btn, .tabbar__item')];
  magState.clear();
  for (const el of magnets) magState.set(el, { x: 0, y: 0 });
}

function updateMagnets(now: number) {
  // 磁吸只跟随「移动中」的光标：光标停下（260ms 无 move）即回弹归位，
  // 避免按钮被静止光标永久吸附（也保住自动化点击的元素稳定性）
  const live =
    pointer.active && FINE.matches && !MOBILE.matches && fxOn('cursor') && now - pointer.t < 260;
  if (!live) {
    for (const el of magnets) {
      const st = magState.get(el);
      if (!st) continue;
      st.x += (0 - st.x) * 0.24;
      st.y += (0 - st.y) * 0.24;
      if (Math.abs(st.x) < 0.05 && Math.abs(st.y) < 0.05) {
        if (el.style.translate) el.style.translate = '';
        continue;
      }
      el.style.translate = `${st.x.toFixed(2)}px ${st.y.toFixed(2)}px`;
    }
    return;
  }
  const R = 72;
  for (const el of magnets) {
    if (!el.isConnected) continue;
    const st = magState.get(el);
    if (!st) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const d = Math.hypot(dx, dy);
    let tx = 0;
    let ty = 0;
    if (d < R) {
      const pull = ((R - d) / R) * 10;
      tx = (dx / (d || 1)) * pull;
      ty = (dy / (d || 1)) * pull;
    }
    st.x += (tx - st.x) * 0.22;
    st.y += (ty - st.y) * 0.22;
    if (Math.abs(st.x) < 0.05 && Math.abs(st.y) < 0.05 && tx === 0 && ty === 0) {
      if (el.style.translate) el.style.translate = '';
      continue;
    }
    el.style.translate = `${st.x.toFixed(2)}px ${st.y.toFixed(2)}px`;
  }
}

function resetMagnets() {
  for (const el of magnets) el.style.translate = '';
  magnets = [];
  magState.clear();
}

/* ============================================================
   SectionChoreo —— 章节渐进展开
   ============================================================ */

const KIN_TARGETS =
  ':scope > h2, :scope > h3, :scope > h4, :scope > p, :scope > ul, :scope > ol, ' +
  ':scope > blockquote, :scope > pre, :scope > .callout, :scope > .katex-display, ' +
  ':scope > .table-wrap, :scope > img, :scope > .footnotes';

function decorateSections() {
  const root = document.querySelector<HTMLElement>('.md-content');
  if (!root) return;

  const targets = [...root.querySelectorAll<HTMLElement>(KIN_TARGETS)];
  let inSection = 0;
  for (const el of targets) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      el.dataset.kin = 'heading';
      inSection = 0; // 换新小节，错峰重新计
    } else if (el.classList.contains('callout')) {
      el.dataset.kin = 'sticker';
    } else {
      el.dataset.kin = 'block';
    }
    if (el.dataset.kin === 'heading') {
      el.style.removeProperty('--kin-delay');
    } else {
      el.style.setProperty('--kin-delay', `${Math.min(inSection * 45, 360)}ms`);
      inSection++;
    }
  }

  kinIO?.disconnect();
  kinIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        kinIO!.unobserve(el);
        el.classList.add('is-kin-in');
        if (el.dataset.kin === 'heading') {
          const r = el.getBoundingClientRect();
          burst(r.left + Math.min(r.width * 0.5, 260), r.top + 8, 12);
        }
      }
    },
    { rootMargin: '0px 0px -7% 0px', threshold: 0.05 },
  );
  targets.forEach((el) => kinIO!.observe(el));
}

function stripKin() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-kin]')) {
    el.removeAttribute('data-kin');
    el.classList.remove('is-kin-in');
    el.style.removeProperty('--kin-delay');
  }
}

function watchTheme() {
  themeMO?.disconnect();
  themeMO = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.attributeName === 'data-theme') {
        readPalette();
        return;
      }
    }
  });
  themeMO.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ============================================================
   EasterEgg —— 连点页题：果冻 + 重力模式
   ============================================================ */

function jelly(el: HTMLElement) {
  el.classList.remove('is-jelly');
  void el.offsetWidth; // 重置动画
  el.classList.add('is-jelly');
  window.setTimeout(() => el.classList.remove('is-jelly'), 760);
}

function onTitlePointer(e: Event) {
  const target = e.target as HTMLElement | null;
  const title = target?.closest?.('.article__title, .home__title');
  if (!title) return;
  const now = performance.now();
  titleClicks = titleClicks.filter((t) => now - t < 900);
  titleClicks.push(now);
  if (titleClicks.length < 3) return;
  titleClicks = [];
  const titleEl = title as HTMLElement;
  jelly(titleEl);
  const r = titleEl.getBoundingClientRect();
  burst(r.left + r.width * 0.3, r.top + r.height * 0.5, 16);
  if (RM.matches) return;
  if (gravity) exitGravity();
  else void enterGravity();
}

async function enterGravity() {
  if (RM.matches || !fxOn('gravity')) return;
  const root = document.querySelector('.md-content');
  if (!root) return;
  const candidates = [...root.querySelectorAll<HTMLElement>(':scope > .callout, :scope > pre:not(.mermaid)')].filter(
    (el) => {
      const r = el.getBoundingClientRect();
      // 宽度上限须容得下正文栏全宽（46rem≈736px），否则便签全被误拒
      return r.height > 0 && r.height < 320 && r.width > 60 && r.width < 800;
    },
  );
  if (candidates.length < 2) return;

  let M: any;
  try {
    M = await ensureMatter();
  } catch {
    return; // matter 不可用：果冻抖动已是全部反馈
  }
  if (gravity || !mounted) return; // 等待 CDN 期间退出/卸载了

  const engine = M.Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  const pairs: GravityPair[] = [];
  for (const src of candidates.slice(0, 10)) {
    const r = src.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    const wrap = document.createElement('div');
    wrap.className = 'pg-clone';
    wrap.style.cssText = `position:fixed;left:0;top:0;width:${w}px;z-index:65;will-change:transform;cursor:grab;`;
    const inner = src.cloneNode(true) as HTMLElement;
    inner.querySelectorAll('button').forEach((b) => b.remove()); // 克隆按钮无监听意义
    wrap.appendChild(inner);
    document.body.appendChild(wrap);

    const body = M.Bodies.rectangle(r.left + w / 2, r.top + h / 2, w, h, {
      restitution: 0.36,
      friction: 0.12,
      angle: (Math.random() - 0.5) * 0.24,
    });
    M.Composite.add(engine.world, body);

    const restoreVis = src.style.visibility;
    src.style.visibility = 'hidden';
    pairs.push({ wrap, src, body, restoreVis });
  }
  M.Composite.add(engine.world, [
    M.Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 40, window.innerWidth * 1.5, 80, { isStatic: true }),
    M.Bodies.rectangle(-40, window.innerHeight / 2, 80, window.innerHeight * 2, { isStatic: true }),
    M.Bodies.rectangle(window.innerWidth + 40, window.innerHeight / 2, 80, window.innerHeight * 2, { isStatic: true }),
  ]);

  let session: GravitySession;
  const detachFns: (() => void)[] = [];

  // 拖拽（手写：pointer 捕获 + setPosition/setVelocity，避免 MouseConstraint 劫持事件）
  for (const pair of pairs) {
    const onDown = (e: PointerEvent) => {
      if (!session) return;
      e.preventDefault();
      session.dragBody = pair.body;
      session.dragOff = {
        x: pair.body.position.x - e.clientX,
        y: pair.body.position.y - e.clientY,
      };
      pair.wrap.style.cursor = 'grabbing';
      pair.wrap.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!session || session.dragBody !== pair.body) return;
      const nx = e.clientX + session.dragOff.x;
      const ny = e.clientY + session.dragOff.y;
      M.Body.setVelocity(session.dragBody, {
        x: nx - session.dragBody.position.x,
        y: ny - session.dragBody.position.y,
      });
      M.Body.setPosition(session.dragBody, { x: nx, y: ny });
    };
    const onUp = () => {
      if (!session) return;
      session.dragBody = null;
      pair.wrap.style.cursor = 'grab';
    };
    pair.wrap.addEventListener('pointerdown', onDown);
    pair.wrap.addEventListener('pointermove', onMove);
    pair.wrap.addEventListener('pointerup', onUp);
    pair.wrap.addEventListener('pointercancel', onUp);
    detachFns.push(() => {
      pair.wrap.removeEventListener('pointerdown', onDown);
      pair.wrap.removeEventListener('pointermove', onMove);
      pair.wrap.removeEventListener('pointerup', onUp);
      pair.wrap.removeEventListener('pointercancel', onUp);
    });
  }

  // 点空白退出
  const onBgDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('.pg-clone')) return;
    exitGravity();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') exitGravity();
  };
  document.addEventListener('pointerdown', onBgDown);
  document.addEventListener('keydown', onKey);
  detachFns.push(() => {
    document.removeEventListener('pointerdown', onBgDown);
    document.removeEventListener('keydown', onKey);
  });

  session = {
    M,
    engine,
    pairs,
    dragBody: null,
    dragOff: { x: 0, y: 0 },
    detach: () => {
      for (const fn of detachFns) fn();
    },
  };
  gravity = session;
}

function syncGravity() {
  if (!gravity) return;
  gravity.M.Engine.update(gravity.engine, 16.7);
  for (const pair of gravity.pairs) {
    const b = pair.body;
    pair.wrap.style.transform = `translate(${b.position.x - pair.wrap.offsetWidth / 2}px, ${
      b.position.y - pair.wrap.offsetHeight / 2
    }px) rotate(${b.angle}rad)`;
  }
}

function exitGravity() {
  if (!gravity) return;
  const g = gravity;
  gravity = null;
  g.detach();
  for (const pair of g.pairs) {
    pair.wrap.remove();
    pair.src.style.visibility = pair.restoreVis;
  }
  g.M.Engine.clear(g.engine);
}

/* ============================================================
   StickerDrag —— 便签拖拽（只有胶带命中区可抓；纯点击不接管）
   ============================================================ */

const TAPE_H = 14; // 胶带命中区高度（px，从便签顶往下）
const TAPE_W = 44; // 胶带命中区半宽（px，从中心往两侧）
const DRAG_THRESHOLD = 6; // 位移阈值：超过才算拖拽，否则放行原生点击

function tapeHit(el: HTMLElement, x: number, y: number): boolean {
  const r = el.getBoundingClientRect();
  return (
    y <= r.top + TAPE_H &&
    Math.abs(x - (r.left + r.width / 2)) <= TAPE_W
  );
}

function onStickerDown(e: PointerEvent) {
  if (RM.matches || !FINE.matches || MOBILE.matches || gravity || stickerDrag || !fxOn('sticker')) return;
  if (e.button !== 0) return;
  stickerSuppressClick = false; // 新手势开启，旧抑制作废（防无 click 场景泄漏到下一次）
  const target = e.target as HTMLElement | null;
  const callout = target?.closest?.('.md-content > .callout') as HTMLElement | null;
  if (!callout || !tapeHit(callout, e.clientX, e.clientY)) return;
  stickerDrag = {
    el: callout,
    startX: e.clientX,
    startY: e.clientY,
    vx: 0,
    lastX: e.clientX,
    engaged: false,
    pointerId: e.pointerId,
  };
}

function onStickerMove(e: PointerEvent) {
  if (!stickerDrag || e.pointerId !== stickerDrag.pointerId) return;
  const d = stickerDrag;
  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;

  if (!d.engaged) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    // 正式接管：抓捕获、清选区（阈值窗口内可能已开始的选择）
    d.engaged = true;
    try {
      d.el.setPointerCapture(d.pointerId);
    } catch {
      /* 释放时机极端情况下可能失败，忽略 */
    }
    d.el.classList.add('is-dragging');
    d.el.classList.remove('is-settling');
    d.el.style.translate = `${dx}px ${dy}px`;
    getSelection()?.removeAllRanges();
    return;
  }

  d.vx = d.vx * 0.7 + (e.clientX - d.lastX) * 0.3;
  d.lastX = e.clientX;
  d.el.style.translate = `${dx}px ${dy}px`;
  const tilt = Math.max(-8, Math.min(8, d.vx * 0.6));
  d.el.style.rotate = `${tilt.toFixed(2)}deg`;
}

function onStickerUp(e: PointerEvent) {
  if (!stickerDrag || e.pointerId !== stickerDrag.pointerId) return;
  const d = stickerDrag;
  stickerDrag = null;
  if (!d.engaged) return; // 未过阈值：放行原生点击（折叠/链接照常）

  stickerSuppressClick = true;
  window.setTimeout(() => {
    stickerSuppressClick = false; // 正常路径 click 会立刻消耗；此为兜底（如 pointerup 后无 click）
  }, 350);
  d.el.style.translate = '0px 0px';
  d.el.style.rotate = '';
  d.el.classList.remove('is-dragging');
  d.el.classList.add('is-settling'); // 果冻弹簧归位（CSS transition）
  window.setTimeout(() => {
    d.el.classList.remove('is-settling');
    d.el.style.translate = ''; // 归位动画已结束，清内联值
    jelly(d.el);
  }, 620);
}

/** 拖拽刚结束的这一次 click 吞掉（防误折叠 details / 误触发内链） */
function onSuppressStickerClick(e: MouseEvent) {
  if (!stickerSuppressClick) return;
  stickerSuppressClick = false;
  e.preventDefault();
  e.stopPropagation();
}

function teardownStickerDrag() {
  if (!stickerDrag) return;
  const d = stickerDrag;
  stickerDrag = null;
  d.el.classList.remove('is-dragging', 'is-settling');
  d.el.style.translate = '';
  d.el.style.rotate = '';
}

/* ============================================================
   主循环（一条 rAF 驱动全部模块）
   ============================================================ */

function tick(t: number) {
  rafId = requestAnimationFrame(tick);
  if (!ctx || !canvas) return;
  const dtf = Math.max(0.5, Math.min(2.5, lastFrame ? (t - lastFrame) / 16.7 : 1));
  lastFrame = t;

  // 拖影淡出（向透明，保住 CSS 点阵纸底）
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.globalCompositeOperation = 'source-over';

  scrollVel *= Math.pow(0.9, dtf); // 风力衰减

  updateField(t, dtf);
  updateSparks(t, dtf, ctx);
  drawInk(t);
  updateMagnets(t);
  syncGravity();
}

function startLoop() {
  if (rafId || RM.matches) return;
  lastFrame = 0;
  rafId = requestAnimationFrame(tick);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}

/* ============================================================
   生命周期
   ============================================================ */

function progressNow(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

function onScroll() {
  const y = window.scrollY;
  const dv = y - lastScrollY;
  if (dv !== 0) scrollVel = Math.max(-90, Math.min(90, dv));
  lastScrollY = y;
  journeyP = progressNow();
  if (!eofFired && journeyP >= 0.985) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 600) {
      eofFired = true;
      void fireConfetti();
    }
  }
}

function onPointerMove(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.t = performance.now();
  pointer.active = true;
  if (FINE.matches && !MOBILE.matches) pushInk(e.clientX, e.clientY);
}

function onPointerDown(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
  burst(e.clientX, e.clientY, 10);
}

function onPointerOut(e: PointerEvent) {
  if (!e.relatedTarget) {
    pointer.active = false;
    pointer.x = -1e4;
    pointer.y = -1e4;
    ink = [];
  }
}

function onResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!canvas) return;
    sizeCanvas();
    seedParticles();
  }, 180);
}

function onVisibility() {
  if (document.hidden) stopLoop();
  else if (canvas && !RM.matches) startLoop();
}

function onMotionPref() {
  // 偏好变化：整页重建（reduce → 全静态；恢复 → 动效归来）
  teardownPageState();
  if (mounted) setupPage();
}

/** 每页重建：swap 后新 DOM / 首次挂载（html[data-pg-setup] 防重入） */
function setupPage() {
  const rootEl = document.documentElement;
  if (rootEl.dataset.pgSetup) return;
  rootEl.dataset.pgSetup = '1';

  lastScrollY = window.scrollY;
  eofFired = false;
  journeyP = progressNow();
  readPalette();

  if (!RM.matches) {
    const host = document.querySelector('.ambient');
    if (host && host.getElementsByTagName('canvas').length === 0) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
      if (ctx) {
        host.appendChild(canvas);
        sizeCanvas();
        seedParticles();
      } else {
        canvas = null;
      }
    }
    startLoop();
  }

  if (!RM.matches && fxOn('choreo')) decorateSections();
  collectMagnets();
  watchTheme();
  guideSetup();
}

/** 清掉本页全部痕迹（canvas / IO / 打标 / 磁吸 / 彩蛋 / 重力会话） */
function teardownPageState() {
  stopLoop();
  kinIO?.disconnect();
  kinIO = null;
  themeMO?.disconnect();
  themeMO = null;
  canvas?.remove();
  canvas = null;
  ctx = null;
  particles = [];
  sparks = [];
  ink = [];
  exitGravity();
  teardownStickerDrag();
  guideTeardown();
  for (const el of document.querySelectorAll('.pg-celebrate')) el.remove();
  resetMagnets();
  stripKin();
  delete document.documentElement.dataset.pgSetup;
}

export function mount() {
  if (mounted) return;
  mounted = true;

  const keep = (fn: () => void) => persistentCleanups.push(fn);
  const bind = (target: EventTarget, type: string, fn: any, opts?: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    keep(() => target.removeEventListener(type, fn, opts));
  };

  // document/window 级监听跨 swap 存活，只在 mount 挂一次
  bind(window, 'scroll', onScroll, { passive: true });
  bind(window, 'pointermove', onPointerMove, { passive: true });
  bind(window, 'pointerdown', onPointerDown, { passive: true });
  bind(window, 'pointerout', onPointerOut, { passive: true });
  bind(window, 'resize', onResize, { passive: true });
  bind(document, 'visibilitychange', onVisibility);
  bind(document, 'astro:page-load', setupPage);
  bind(document, 'astro:before-swap', teardownPageState);
  bind(document, 'click', onTitlePointer);
  bind(document, 'click', onSuppressStickerClick, { capture: true });
  bind(document, 'pointerdown', onStickerDown, { passive: true });
  bind(document, 'pointermove', onStickerMove, { passive: true });
  bind(document, 'pointerup', onStickerUp, { passive: true });
  bind(document, 'pointercancel', onStickerUp, { passive: true });
  RM.addEventListener?.('change', onMotionPref);
  keep(() => RM.removeEventListener?.('change', onMotionPref));

  guideBind({ burst });

  // 特效细分开关（换肤菜单第二层）：实时应用
  settingsBind();
  const unFx = onFxChange((key, on) => {
    if (key === 'choreo') {
      if (on) {
        if (!RM.matches && document.querySelector('.md-content')) decorateSections();
      } else {
        kinIO?.disconnect();
        kinIO = null;
        stripKin();
      }
    } else if (key === 'field') {
      if (on) {
        if (canvas) seedParticles();
      } else {
        particles = [];
        ctx?.clearRect(0, 0, cssW, cssH);
      }
    } else if (key === 'gravity' && !on) {
      exitGravity();
    }
  });
  keep(unFx);

  setupPage();
}

export function unmount() {
  if (!mounted) return;
  teardownPageState();
  for (const fn of persistentCleanups) fn();
  persistentCleanups = [];
  titleClicks = [];
  guideUnbind();
  settingsUnbind();
  mounted = false;
}
