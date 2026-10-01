import './style.css';
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { animate, createTimeline, stagger, utils } from 'animejs';
import { World } from './scene/World.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.body.classList.add('is-loading');

// ───────── text splitting ─────────
function splitChars(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c) => `<span class="ch" aria-hidden="true"><span>${c}</span></span>`).join('');
  return $$('.ch > span', el);
}
const charGroups = new Map($$('[data-chars]').map((el) => [el, splitChars(el)]));
charGroups.forEach((chars) => utils.set(chars, { y: '110%' }));

// statement: one span per word, <em> kept whole
const statement = $('#statement');
const words = [];
[...statement.childNodes].forEach((node) => {
  if (node.nodeType === 3) {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((part) => {
      if (!part.trim()) return frag.append(part);
      const w = document.createElement('span');
      w.className = 'w';
      w.textContent = part;
      words.push(w);
      frag.append(w);
    });
    node.replaceWith(frag);
  } else {
    node.classList.add('w');
    words.push(node);
  }
});

// ───────── world + scroll ─────────
const world = new World($("#gl"));
if (import.meta.env.DEV) window.__w = world;
const game = world.game;
const sections = $$('[data-stage]');
const lenis = new Lenis({ lerp: reduced ? 1 : 0.09, wheelMultiplier: 0.9 });
lenis.stop();

function goto(i) {
  const sec = sections[i];
  const off = sec.offsetHeight > innerHeight * 1.5 ? sec.offsetHeight * 0.4 - innerHeight * 0.1 : sec.offsetHeight / 2 - innerHeight / 2;
  lenis.scrollTo(i === 0 ? 0 : sec.offsetTop + off, { duration: 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
}
$$('[data-goto]').forEach((b) => b.addEventListener('click', (e) => (e.preventDefault(), goto(+b.dataset.goto))));

function computeStage() {
  const vc = innerHeight / 2;
  const centers = sections.map((s) => {
    const r = s.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  if (vc <= centers[0]) return 0;
  const last = centers.length - 1;
  if (vc >= centers[last]) return last;
  for (let i = 0; i < last; i++) {
    if (vc >= centers[i] && vc < centers[i + 1]) {
      const f = (vc - centers[i]) / (centers[i + 1] - centers[i]);
      return i + clamp01((f - 0.3) / 0.4); // hold while a section is centred
    }
  }
  return 0;
}

// per-stage art direction for the CSS backdrop
const LOOK = [
  { bg: '#f3efea', disc: '#f6d4db', d: 1.0, grid: 0 }, // hero
  { bg: '#f3efea', disc: '#f6d4db', d: 0.0, grid: 0 }, // statement
  { bg: '#f4ecea', disc: '#f3c8d2', d: 1.05, grid: 0 }, // profile
  { bg: '#eeebe6', disc: '#e7e1d9', d: 0.0, grid: 1 }, // anatomy
  { bg: '#f0ecf2', disc: '#ddd2ea', d: 1.0, grid: 0 }, // mochi
  { bg: '#e4edf7', disc: '#d4e3f4', d: 0.0, grid: 0 }, // sky game
  { bg: '#f3efea', disc: '#f6d4db', d: 1.1, grid: 0 }, // finale
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, f) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * f)).join(',')})`;

// ───────── cursor ─────────
const cursor = $('.cursor');
const dot = $('.cursor__dot');
const ring = $('.cursor__ring');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const ringPos = { ...mouse };
let overUI = false;
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  world.setPointer(e.clientX, e.clientY);
  overUI = !!e.target.closest('a, button, .controls, .game__over');
  cursor.classList.toggle('is-link', !!e.target.closest('a, button'));
});

// ───────── fx ─────────
const fx = $('#fx');
const FX_COLORS = ['#ec8ea4', '#1d1715', '#f6d4db'];
function burst(x, y, n = 8, power = 1) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'dot-fx';
    el.style.background = pick(FX_COLORS);
    fx.appendChild(el);
    const a = (i / n) * Math.PI * 2 + rand(-0.3, 0.3);
    const d = rand(40, 90) * power;
    animate(el, { x: [x, x + Math.cos(a) * d], y: [y, y + Math.sin(a) * d], scale: [rand(0.8, 1.4), 0], duration: 800, ease: 'outExpo', onComplete: () => el.remove() });
  }
  const r = document.createElement('i');
  r.className = 'ring-fx';
  fx.appendChild(r);
  animate(r, { x, y, scale: [0.1, 1.3 * power], opacity: [0.8, 0], duration: 800, ease: 'outExpo', onComplete: () => r.remove() });
}
function bubble(text, x, y) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  fx.appendChild(el);
  const w = el.offsetWidth;
  createTimeline({ onComplete: () => el.remove() })
    .add(el, { x: x - w / 2, y: [y - 20, y - 56], scale: [0.4, 1], opacity: [0, 1], duration: 600, ease: 'outExpo' }, 0)
    .add(el, { y: '-=24', opacity: 0, duration: 400, ease: 'inQuad' }, 1300);
}

// ───────── interactions ─────────
const c = world.chiikawa;
const LINES = ['ワ…!', '…!!', 'ヤダ…', 'ウワーン', 'ワァ…', 'えへ…'];
const MOODS = [[0, '평온'], [3, '움찔'], [8, '울먹'], [15, 'ウワーン'], [25, '해탈'], [40, '모찌 그 자체']];
let pokes = 0;
const pokeEl = $('#pokeCount');
const moodEl = $('#mood');
let down = null;
addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
addEventListener('click', (e) => {
  if (game.state !== 'idle' || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
  if (e.target.closest('a, button, .controls, .game__over')) return;
  world.setPointer(e.clientX, e.clientY);
  const hit = world.pick();
  if (!hit) return;
  if (hit.type === 'character') {
    if (Math.random() < 0.45) {
      c.shake();
      c.setExpression('squint', 900);
    } else c.jump({ height: 0.9, expr: Math.random() < 0.5 ? 'squint' : null });
    const p = world.project(c.head, 1.25 * c.root.scale.x);
    bubble(pick(LINES), p.x, p.y);
    burst(e.clientX, e.clientY, 8, 1);
  } else {
    world.mochi.poke(hit.point, performance.now() / 1000);
    pokes++;
    pokeEl.textContent = String(pokes).padStart(3, '0');
    const mood = [...MOODS].reverse().find(([n]) => pokes >= n)[1];
    if (moodEl.textContent !== mood) {
      moodEl.textContent = mood;
      animate(moodEl, { y: [12, 0], opacity: [0, 1], duration: 600, ease: 'outExpo' });
    }
    const pop = document.createElement('div');
    pop.className = 'pop-fx';
    pop.textContent = pick(['むにゅ', 'もちっ', 'ぷにっ', 'ワ…', 'ヤダ…!']);
    fx.appendChild(pop);
    animate(pop, {
      x: [e.clientX - 24, e.clientX - 24 + rand(-60, 60)],
      y: [e.clientY - 20, e.clientY - rand(80, 120)],
      opacity: [{ to: 1, duration: 120 }, { to: 0, delay: 450, duration: 300 }],
      duration: 900,
      ease: 'outExpo',
      onComplete: () => pop.remove(),
    });
    burst(e.clientX, e.clientY, 6, 0.7);
    if (pokes % 4 === 0) c.jump({ height: 0.6, expr: 'squint' });
  }
});

// anatomy controls
$$('.controls [data-expr]').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.controls [data-expr]').forEach((x) => x.classList.toggle('is-on', x === b));
    c.lock(b.dataset.expr === 'open' ? null : b.dataset.expr);
  })
);
$('.controls [data-act="jump"]').addEventListener('click', () => c.jump({ height: 1.1 }));
$('.controls [data-act="spin"]').addEventListener('click', () => c.jump({ height: 0.9, spins: 1 }));

// ───────── sky game UI ─────────
const gameSec = $('#game');
const gameScore = $('#gameScore');
const gameOver = $('#gameOver');
$('#gameBest').textContent = game.best;
let lockedY = 0;
function startGame() {
  if (game.state === 'idle') lockedY = scrollY;
  document.activeElement?.blur();
  gameOver.hidden = true;
  gameSec.classList.remove('is-over');
  gameSec.classList.add('is-playing');
  gameScore.textContent = '0';
  lenis.stop();
  game.start();
}
function exitGame() {
  gameOver.hidden = true;
  gameSec.classList.remove('is-playing', 'is-over');
  game.reset();
  $('#gameBest').textContent = game.best;
  lenis.scrollTo(lockedY, { immediate: true, force: true });
  lenis.start();
}
game.onScore = (n) => {
  gameScore.textContent = n;
  animate(gameScore, { scale: [1.25, 1], duration: 500, ease: 'outExpo' });
};
game.onOver = (score, best) => {
  gameSec.classList.remove('is-playing');
  gameSec.classList.add('is-over');
  $('#overScore').textContent = score;
  $('#overBest').textContent = best;
  gameOver.hidden = false;
  animate(gameOver, { opacity: [0, 1], scale: [0.92, 1], duration: 700, ease: 'outExpo' });
};
$('#gameStart').addEventListener('click', startGame);
$('#gameRetry').addEventListener('click', startGame);
$('#gameExit').addEventListener('click', exitGame);
$('#gameHit').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  game.flap();
});
addEventListener('keydown', (e) => {
  if (!['Space', 'ArrowUp', 'KeyW'].includes(e.code)) return;
  if (game.state !== 'idle') {
    e.preventDefault();
    if (game.state === 'play') game.flap();
  } else if (game.state === 'idle' && Math.abs(world.stage - 5) < 0.2 && e.code === 'Space') {
    e.preventDefault();
    startGame();
  }
});

// ───────── reveals ─────────
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      if (charGroups.has(el)) {
        animate(charGroups.get(el), { y: ['110%', '0%'], duration: 1300, delay: stagger(70), ease: 'outExpo' });
      } else if (el.dataset.reveal === 'spec') {
        const rows = [...el.children];
        animate(rows, { '--l': [0, 1], duration: 1200, delay: stagger(80, { start: 200 }), ease: 'inOutQuart' });
        animate(rows.map((r) => r.children).flatMap((x) => [...x]), { y: [18, 0], opacity: [0, 1], duration: 1000, delay: stagger(40, { start: 350 }), ease: 'outExpo' });
      } else {
        animate(el, { y: [36, 0], opacity: [0, 1], duration: 1200, delay: (+el.dataset.i || 0) * 90, ease: 'outExpo' });
      }
    }),
  { threshold: 0.3 }
);
$$('[data-reveal="up"]').forEach((el, i, all) => {
  el.style.opacity = 0;
  el.dataset.i = all.filter((x) => x.closest('section') === el.closest('section')).indexOf(el);
});
$$('.spec dt, .spec dd').forEach((el) => (el.style.opacity = 0));

// ───────── anatomy call-outs ─────────
const svg = $('#lines');
const NS = 'http://www.w3.org/2000/svg';
const callouts = $$('.callout').map((el) => {
  const path = document.createElementNS(NS, 'path');
  const halo = document.createElementNS(NS, 'circle');
  const dotc = document.createElementNS(NS, 'circle');
  halo.setAttribute('class', 'halo');
  dotc.setAttribute('class', 'dot');
  dotc.setAttribute('r', 3);
  svg.append(path, halo, dotc);
  return { el, path, halo, dot: dotc, anchor: el.dataset.anchor, side: el.dataset.side, row: +el.dataset.row };
});

function layoutCallouts(weight, t) {
  const show = weight > 0.01;
  svg.style.display = show ? '' : 'none';
  if (!show) {
    callouts.forEach((co) => (co.el.style.opacity = 0));
    return;
  }
  const W = innerWidth, H = innerHeight;
  const narrow = W < 760;
  const anchors = world.anchors();
  const boxW = narrow ? 128 : 210;
  const gapX = narrow ? 0 : Math.min(W * 0.22, 330);
  for (const co of callouts) {
    const a = anchors[co.anchor];
    const vis = clamp01(a.facing * 4);
    const rowY = H * (narrow ? [0.26, 0.5, 0.66] : [0.27, 0.47, 0.67])[co.row];
    const x = narrow ? (co.side === 'l' ? 12 : W - boxW - 12) : co.side === 'l' ? W / 2 - gapX - boxW : W / 2 + gapX;
    co.el.style.transform = `translate3d(${x}px, ${rowY + (1 - weight) * 24}px, 0)`;
    co.el.style.opacity = weight * (0.3 + 0.7 * vis);
    const lx = co.side === 'l' ? x + boxW + 14 : x - 14;
    const ly = rowY + 11;
    const ex = lx + (co.side === 'l' ? 40 : -40);
    co.path.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${ex.toFixed(1)},${ly.toFixed(1)} L${lx.toFixed(1)},${ly.toFixed(1)}`);
    co.path.style.opacity = weight * vis;
    co.dot.setAttribute('cx', a.x);
    co.dot.setAttribute('cy', a.y);
    co.dot.style.opacity = weight * vis;
    co.halo.setAttribute('cx', a.x);
    co.halo.setAttribute('cy', a.y);
    co.halo.setAttribute('r', 6 + ((t * 0.0012 + co.row * 0.3) % 1) * 10);
    co.halo.style.opacity = weight * vis * (1 - ((t * 0.0012 + co.row * 0.3) % 1));
  }
}

// ───────── frame loop ─────────
const disc = $('#disc');
const progress = $('#progress');
const navNum = $('#navNum');
const navLinks = $$('.nav__links button');
const discPos = { x: innerWidth / 2, y: innerHeight / 2, r: 0 };
let hoverKind = null;
let booted = false;
let lastNav = -1;

function frame(now) {
  lenis.raf(now);
  if (game.state !== 'idle' && Math.abs(scrollY - lockedY) > 1) window.scrollTo(0, lockedY);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

  const stage = computeStage();
  world.stage = stage;

  const i = Math.min(Math.floor(stage), LOOK.length - 2);
  const f = stage - i;
  const A = LOOK[i], B = LOOK[i + 1];
  document.body.style.setProperty('--bg', mix(A.bg, B.bg, f));
  document.body.style.setProperty('--disc', mix(A.disc, B.disc, f));
  document.body.style.setProperty('--grid', A.grid + (B.grid - A.grid) * f);

  // backdrop disc follows the focused figure
  const focus = Math.round(stage) === 4 ? 'mochi' : 'chiikawa';
  const circ = world.focusCircle(focus);
  const size = A.d + (B.d - A.d) * f;
  discPos.x += (circ.x - discPos.x) * 0.12;
  discPos.y += (circ.y - discPos.y) * 0.12;
  discPos.r += (circ.r * size - discPos.r) * 0.12;
  disc.style.transform = `translate3d(${discPos.x - 500}px, ${discPos.y - 500}px, 0) scale(${Math.max(discPos.r, 0) / 500})`;

  // statement words light up with scroll
  const st = statement.closest('section').getBoundingClientRect();
  const sp = clamp01((innerHeight * 0.6 - st.top) / (st.height - innerHeight * 0.9));
  const lit = sp * words.length * 1.08;
  words.forEach((w, k) => (w.style.opacity = 0.12 + 0.88 * clamp01(lit - k)));

  layoutCallouts(clamp01(1 - Math.abs(stage - 3) * 2.2), now);

  const nav = Math.round(stage);
  if (nav !== lastNav) {
    navNum.textContent = String(nav + 1).padStart(2, '0');
    navLinks.forEach((b) => b.classList.toggle('is-active', +b.dataset.goto === nav));
    lastNav = nav;
  }

  dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
  ringPos.x += (mouse.x - ringPos.x) * 0.2;
  ringPos.y += (mouse.y - ringPos.y) * 0.2;
  ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  if (booted && !overUI && game.state === 'idle') {
    const hit = world.pick();
    const kind = hit ? hit.type : null;
    world.mochi.setPointer(kind === 'mochi' ? hit.point : null);
    if (kind !== hoverKind) {
      cursor.classList.toggle('is-char', kind === 'character');
      cursor.classList.toggle('is-poke', kind === 'mochi');
      hoverKind = kind;
    }
  } else if (hoverKind) {
    cursor.classList.remove('is-char', 'is-poke');
    world.mochi.setPointer(null);
    hoverKind = null;
  }

  world.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ───────── boot ─────────
const heroTitle = $('.hero__title');
utils.set('.hero__corner, .hero__foot > *, .nav', { opacity: 0 });
c.s.introY = 9;

async function boot() {
  const num = $('#loadNum');
  const counter = { v: 0 };
  animate('.loader__mark span', { y: ['110%', '0%'], duration: 1000, delay: stagger(70), ease: 'outExpo' });
  const counted = new Promise((r) =>
    animate(counter, {
      v: 100,
      duration: reduced ? 300 : 1800,
      ease: 'inOutQuart',
      onUpdate: () => {
        num.textContent = String(Math.round(counter.v)).padStart(3, '0');
        $('#loadBar').style.transform = `scaleX(${counter.v / 100})`;
      },
      onComplete: r,
    })
  );
  await Promise.all([counted, document.fonts.ready]);
  createTimeline()
    .add('.loader__mark span', { y: '-110%', duration: 700, delay: stagger(50), ease: 'inExpo' }, 0)
    .add('#loader', { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'], duration: 1100, ease: 'inOutQuart' }, 650)
    .call(intro, 1000)
    .call(() => $('#loader').remove(), 1800);
}

function intro() {
  document.body.classList.remove('is-loading');
  lenis.start();
  booted = true;
  animate(charGroups.get(heroTitle), { y: ['110%', '0%'], duration: 1500, delay: stagger(80), ease: 'outExpo' });
  animate('.hero__corner, .hero__foot > *, .nav', { opacity: [0, 1], y: [16, 0], duration: 1200, delay: stagger(90, { start: 600 }), ease: 'outExpo' });
  createTimeline()
    .add(c.s, { introY: [9, 0], duration: 850, ease: 'inQuad' }, 350)
    .add(c.s, { squash: [0.68, 1], duration: 1000, ease: 'outElastic(1, .35)' }, 1200)
    .call(() => {
      const p = world.project(c.root, 0);
      burst(p.x, p.y, 10, 1.4);
    }, 1200)
    .call(() => {
      const p = world.project(c.head, 1.25);
      bubble('ワァ…!', p.x, p.y);
    }, 1900);

  $$('[data-reveal]').forEach((el) => io.observe(el));
  charGroups.forEach((_, el) => el !== heroTitle && io.observe(el));
}

boot();
