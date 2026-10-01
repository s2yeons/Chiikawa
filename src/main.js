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

// ───────── masked line reveals ─────────
$$('[data-lines] > span').forEach((line) => {
  line.innerHTML = `<span>${line.innerHTML}</span>`;
});
utils.set('[data-lines] > span > span', { y: '105%' });
utils.set('[data-reveal]', { opacity: 0 });

// ───────── world + scroll ─────────
const world = new World($('#gl'));
if (import.meta.env.DEV) window.__w = world;
const c = world.chiikawa;
const game = world.game;
const sections = $$('[data-stage]');

const lenis = new Lenis({ lerp: reduced ? 1 : 0.08, wheelMultiplier: 0.9 });
lenis.stop();
function goto(i) {
  const sec = sections[i];
  const off = i === 1 ? innerHeight * 0.2 : sec.offsetHeight > innerHeight * 1.5 ? sec.offsetHeight * 0.4 - innerHeight * 0.1 : sec.offsetHeight / 2 - innerHeight / 2;
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
      return i + clamp01((f - 0.3) / 0.4);
    }
  }
  return 0;
}

// ───────── cursor ─────────
const cursor = $('.cursor');
const dot = $('.cursor i');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const cur = { ...mouse };
let overUI = false;
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  world.setPointer(e.clientX, e.clientY);
  overUI = !!e.target.closest('a, button, .game-over');
  cursor.classList.toggle('is-link', !!e.target.closest('a, button'));
});

// ───────── figure reactions ─────────
const fx = $('#fx');
const LINES = [['ワッ', '앗'], ['…!', '…!'], ['ヤダ…', '싫어…'], ['えへ', '에헤'], ['ワァ…', '와아…']];
function chip([jp, ko], x, y) {
  const el = document.createElement('div');
  el.className = 'chip';
  el.innerHTML = `${jp}<span>${ko}</span>`;
  fx.append(el);
  const w = el.offsetWidth;
  createTimeline({ onComplete: () => el.remove() })
    .add(el, { x: x - w / 2, y: [y, y - 26], opacity: [0, 1], duration: 600, ease: 'outExpo' }, 0)
    .add(el, { y: '-=16', opacity: 0, duration: 500, ease: 'inQuad' }, 1300);
}
let down = null;
addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
addEventListener('click', (e) => {
  if (game.state !== 'idle' || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
  if (e.target.closest('a, button, .game-over')) return;
  world.setPointer(e.clientX, e.clientY);
  if (!world.pick()) return;
  if (Math.random() < 0.35) {
    c.shake();
    c.setExpression('squint', 900);
  } else c.jump({ height: 0.7, expr: Math.random() < 0.3 ? 'blink' : null });
  const p = world.project(c.head, 1.15 * c.root.scale.x);
  chip(pick(LINES), p.x, p.y);
});

// expressions
$$('.face').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.face').forEach((x) => x.classList.toggle('is-on', x === b));
    c.lock(b.dataset.expr === 'open' ? null : b.dataset.expr);
    c.jump({ height: 0.35 });
  })
);

// ───────── bonus game ─────────
const playSec = $('#play');
const gameScore = $('#gameScore');
const gameOver = $('#gameOver');
$('#gameBest').textContent = game.best;
let lockedY = 0;
function startGame() {
  if (game.state === 'idle') lockedY = scrollY;
  document.activeElement?.blur();
  gameOver.hidden = true;
  playSec.classList.remove('is-over');
  playSec.classList.add('is-playing');
  gameScore.textContent = '0';
  lenis.stop();
  game.start();
}
function exitGame() {
  gameOver.hidden = true;
  playSec.classList.remove('is-playing', 'is-over');
  game.reset();
  $('#gameBest').textContent = game.best;
  lenis.start();
}
game.onScore = (n) => {
  gameScore.textContent = n;
  animate(gameScore, { y: [-12, 0], opacity: [0.4, 1], duration: 500, ease: 'outExpo' });
};
game.onOver = (score, best) => {
  playSec.classList.remove('is-playing');
  playSec.classList.add('is-over');
  $('#overScore').textContent = score;
  $('#overBest').textContent = best;
  gameOver.hidden = false;
  animate(gameOver, { opacity: [0, 1], y: [24, 0], duration: 800, ease: 'outExpo' });
};
$('#gameStart').addEventListener('click', startGame);
$('#gameRetry').addEventListener('click', startGame);
$('#gameExit').addEventListener('click', exitGame);
$('#gameHit').addEventListener('pointerdown', (e) => (e.preventDefault(), game.flap()));
addEventListener('keydown', (e) => {
  if (!['Space', 'ArrowUp', 'KeyW'].includes(e.code)) return;
  if (game.state !== 'idle') {
    e.preventDefault();
    if (game.state === 'play') game.flap();
  } else if (Math.abs(world.stage - 4) < 0.2 && e.code === 'Space') {
    e.preventDefault();
    startGame();
  }
});

// ───────── reveals ─────────
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const box = en.target;
      io.unobserve(box);
      animate($$('[data-lines] > span > span', box), { y: ['105%', '0%'], duration: 1300, delay: stagger(110), ease: 'outExpo' });
      animate($$('[data-reveal]', box), { opacity: [0, 1], y: [18, 0], duration: 1100, delay: stagger(110, { start: 350 }), ease: 'outExpo' });
    }),
  { threshold: 0.3 }
);

// ───────── 360° chapter ─────────
const turnSec = $('#turn');
const degEl = $('#deg');
const capEl = $('#angleCap');
const turnBar = $('#turnBar');
const CAPS = [
  [0, 'まえ', '정면'],
  [70, 'よこ', '동그란 볼'],
  [135, 'うしろ', '작은 꼬리'],
  [225, 'よこ', '짧은 팔'],
  [300, 'まえ', '다시 정면'],
];
let capIdx = -1;

// ───────── detail call-outs ─────────
const svg = $('#lines');
const NS = 'http://www.w3.org/2000/svg';
const callouts = $$('.callout').map((el) => {
  const path = document.createElementNS(NS, 'path');
  const halo = document.createElementNS(NS, 'circle');
  const dotc = document.createElementNS(NS, 'circle');
  halo.setAttribute('class', 'halo');
  dotc.setAttribute('r', 3);
  svg.append(path, halo, dotc);
  return { el, path, halo, dot: dotc, anchor: el.dataset.anchor, dx: +el.dataset.dx, dy: +el.dataset.dy };
});
function layoutCallouts(weight, now) {
  svg.style.display = weight > 0.01 ? '' : 'none';
  if (weight <= 0.01) {
    callouts.forEach((co) => (co.el.style.opacity = 0));
    return;
  }
  const anchors = world.anchors();
  const sc = innerWidth < 760 ? 0.5 : 1;
  for (const co of callouts) {
    const a = anchors[co.anchor];
    const vis = clamp01(a.facing * 4) * weight;
    const lx = a.x + co.dx * sc;
    const ly = a.y + co.dy * sc;
    const left = co.dx < 0;
    const bx = left ? lx - (innerWidth < 760 ? 140 : 200) : lx;
    co.el.style.transform = `translate3d(${bx}px, ${ly - 10 + (1 - weight) * 16}px, 0)`;
    co.el.style.textAlign = left ? 'right' : 'left';
    co.el.style.opacity = vis;
    const ex = left ? lx + 10 : lx - 10;
    co.path.setAttribute('d', `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${(ex + (left ? 30 : -30)).toFixed(1)},${ly.toFixed(1)} L${ex.toFixed(1)},${ly.toFixed(1)}`);
    co.path.style.opacity = vis;
    co.dot.setAttribute('cx', a.x);
    co.dot.setAttribute('cy', a.y);
    co.dot.style.opacity = vis;
    const ph = (now * 0.001 + co.dx * 0.001) % 1;
    co.halo.setAttribute('cx', a.x);
    co.halo.setAttribute('cy', a.y);
    co.halo.setAttribute('r', 5 + ph * 12);
    co.halo.style.opacity = vis * (1 - ph);
  }
}

// ───────── frame loop ─────────
const navLinks = $$('.nav-links a');
const navNum = $('#navNum');
let lastNav = -1;
let hover = false;
let booted = false;

function frame(now) {
  lenis.raf(now);
  if (game.state !== 'idle' && Math.abs(scrollY - lockedY) > 1) window.scrollTo(0, lockedY);

  const stage = computeStage();
  world.stage = stage;

  // scroll-scrubbed turntable
  const tr = turnSec.getBoundingClientRect();
  const tp = clamp01(-tr.top / (tr.height - innerHeight));
  world.spin = tp * Math.PI * 2;
  const deg = Math.round(tp * 360) % 360;
  degEl.textContent = String(deg).padStart(3, '0');
  turnBar.style.transform = `scaleX(${tp})`;
  const ci = CAPS.reduce((k, cap, j) => (deg >= cap[0] ? j : k), 0);
  if (ci !== capIdx) {
    capIdx = ci;
    capEl.innerHTML = `<span class="jp">${CAPS[ci][1]}</span> ${CAPS[ci][2]}`;
    animate(capEl, { opacity: [0, 1], y: [8, 0], duration: 600, ease: 'outExpo' });
  }

  layoutCallouts(clamp01(1 - Math.abs(stage - 2) * 2.5), now);

  const nav = Math.round(stage);
  if (nav !== lastNav) {
    navNum.textContent = String(nav + 1).padStart(2, '0');
    navLinks.forEach((a) => a.classList.toggle('is-active', +a.dataset.goto === nav));
    lastNav = nav;
  }

  cur.x += (mouse.x - cur.x) * 0.25;
  cur.y += (mouse.y - cur.y) * 0.25;
  dot.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
  if (booted && !overUI && game.state === 'idle') {
    const h = !!world.pick();
    if (h !== hover) cursor.classList.toggle('is-hot', (hover = h));
  } else if (hover) cursor.classList.toggle('is-hot', (hover = false));

  world.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ───────── boot ─────────
utils.set('.nav', { opacity: 0 });
c.s.introY = 4;
world.camera.position.set(0, 2.4, 16);

async function boot() {
  const counter = { v: 0 };
  animate('.loader-jp', { opacity: [0, 1], y: [20, 0], duration: 900, ease: 'outExpo' });
  const counted = new Promise((r) =>
    animate(counter, {
      v: 100, duration: reduced ? 300 : 1500, ease: 'inOutQuart',
      onUpdate: () => {
        $('#loadNum').textContent = Math.round(counter.v);
        $('#loadBar').style.transform = `scaleX(${counter.v / 100})`;
      },
      onComplete: r,
    })
  );
  await Promise.all([counted, document.fonts.ready]);
  createTimeline()
    .add('.loader-jp, .loader-line, .loader-meta', { opacity: 0, y: -12, duration: 500, delay: stagger(60), ease: 'inQuad' }, 0)
    .add('#loader', { opacity: 0, duration: 900, ease: 'inOutQuad' }, 400)
    .call(intro, 500)
    .call(() => $('#loader').remove(), 1300);
}

function intro() {
  document.body.classList.remove('is-loading');
  lenis.start();
  booted = true;
  animate('.nav', { opacity: [0, 1], duration: 1200, delay: 900, ease: 'outQuad' });
  createTimeline()
    .add(c.s, { introY: [4, 0], duration: 700, ease: 'inQuad' }, 500)
    .add(c.s, { squash: [0.78, 1], duration: 900, ease: 'outElastic(1, .4)' }, 1200);
  $$('.hero, .copy, .end-copy').forEach((el) => io.observe(el));
}

boot();
