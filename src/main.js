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

// ───────── title splitting (keeps <em>/<br>) ─────────
function splitInto(el) {
  const chars = [];
  [...el.childNodes].forEach((node) => {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (!part.trim()) return frag.append(' ');
        const w = document.createElement('span');
        w.className = 'w';
        [...part].forEach((ch) => {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          chars.push(c);
          w.append(c);
        });
        frag.append(w);
      });
      node.replaceWith(frag);
    } else if (node.nodeName === 'EM') {
      chars.push(...splitInto(node));
    }
  });
  return chars;
}
const titles = new Map($$('[data-split]').map((el) => [el, splitInto(el)]));
titles.forEach((chars, el) => {
  utils.set(chars, { opacity: 0, y: '0.5em', rotate: () => rand(-14, 14) });
  $$('em', el).forEach((em) => em.style.setProperty('--u', 0));
});
$$('[data-reveal]').forEach((el) => (el.style.opacity = 0));

// ───────── world ─────────
const world = new World($('#gl'));
if (import.meta.env.DEV) window.__w = world;
const c = world.chiikawa;
const game = world.game;
const sections = $$('[data-stage]');

const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.9 });
lenis.stop();
function goto(i) {
  const sec = sections[i];
  const off = sec.offsetHeight > innerHeight * 1.5 ? sec.offsetHeight * 0.4 - innerHeight * 0.1 : sec.offsetHeight / 2 - innerHeight / 2;
  lenis.scrollTo(i === 0 ? 0 : sec.offsetTop + off, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
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

// spring sky per stage: top, bottom, rays, sun, sun height (%), moon
const SKY = [
  ['#9fd3ff', '#fff0f5', 1, 1, 30, 0],
  ['#8ccbff', '#fdf3f8', 0.85, 1, 24, 0],
  ['#a7d6fb', '#fff1dc', 0.6, 0.85, 30, 0],
  ['#c8b4f4', '#ffd6e5', 0.45, 0.5, 46, 0],
  ['#9590e6', '#ffc6a6', 0.55, 0.75, 62, 0],
  ['#1a1a4a', '#4a3c7c', 0, 0, 90, 1],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, f) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * f)).join(',')})`;
const rootStyle = document.documentElement.style;

// ───────── cursor + petal trail ─────────
const cursor = $('.cursor');
const dot = $('.cursor-dot');
const ring = $('.cursor-ring');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const ringPos = { ...mouse };
const fx = $('#fx');
const PETALS = ['#ffc7d6', '#ffb3c6', '#ffe1ea', '#ffffff', '#ff9fbe'];
let overUI = false;
let lastSpark = 0;
function petal(x, y, { spread = 14, fall = 34, size = 1, dur = 900 } = {}) {
  const s = document.createElement('i');
  s.className = 'petal';
  s.style.background = pick(PETALS);
  fx.append(s);
  animate(s, {
    x: [x, x + rand(-spread, spread)], y: [y, y + rand(fall * 0.3, fall)], scale: [rand(0.7, 1.2) * size, 0], rotate: [rand(0, 360), rand(-360, 360)],
    duration: dur, ease: 'outQuad', onComplete: () => s.remove(),
  });
}
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  world.setPointer(e.clientX, e.clientY);
  overUI = !!e.target.closest('a, button, .hud, .game-over');
  cursor.classList.toggle('is-link', !!e.target.closest('a, button'));
  const now = performance.now();
  if (now - lastSpark > 50 && !reduced) {
    lastSpark = now;
    petal(e.clientX, e.clientY);
  }
});

// ───────── fx helpers ─────────
function burst(x, y, n = 14, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(40, 120) * power;
    const s = document.createElement('i');
    s.className = Math.random() < 0.6 ? 'petal' : 'spark';
    s.style.background = Math.random() < 0.7 ? pick(PETALS) : '#ffd66b';
    fx.append(s);
    animate(s, { x: [x, x + Math.cos(a) * d], y: [y, y + Math.sin(a) * d + 20], scale: [{ to: rand(1, 1.7), duration: 150 }, { to: 0, duration: 750 }], rotate: rand(-300, 300), duration: 900, ease: 'outExpo', onComplete: () => s.remove() });
  }
}
function bubble(text, x, y, ko = false) {
  const el = document.createElement('div');
  el.className = `bubble${ko ? ' ko' : ''}`;
  el.textContent = text;
  fx.append(el);
  const w = el.offsetWidth;
  createTimeline({ onComplete: () => el.remove() })
    .add(el, { x: x - w / 2, y: [y - 20, y - 64], scale: [0, 1], rotate: [rand(-16, 16), 0], duration: 700, ease: 'outElastic(1, .55)' }, 0)
    .add(el, { y: '-=30', opacity: 0, duration: 400, ease: 'inQuad' }, 1400);
}
function popText(text, x, y) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  fx.append(el);
  animate(el, {
    x: [x - 20, x - 20 + rand(-40, 40)], y: [y - 10, y - rand(70, 110)], scale: [0.4, 1.15, 1], rotate: rand(-15, 15),
    opacity: [{ to: 1, duration: 100 }, { to: 0, delay: 450, duration: 300 }], duration: 900, ease: 'outExpo', onComplete: () => el.remove(),
  });
}
function petalStorm(n = 140) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'petal petal--big';
    el.style.background = pick(PETALS);
    fx.append(el);
    const x0 = rand(-100, innerWidth);
    const dur = rand(2200, 3800);
    animate(el, {
      x: [x0, x0 + rand(80, 320)], y: [-30, innerHeight + 40], rotate: rand(-720, 720), rotateX: rand(-540, 540),
      duration: dur, delay: rand(0, 700), ease: 'inOutSine', onComplete: () => el.remove(),
    });
  }
  world.meadow.gust();
}

// ───────── interactions ─────────
const LINES = ['ワ…!', '…!!', 'ヤダ…', 'ワァ…', '에헤…', '앗!', '벚꽃이다…!'];
const MOODS = [[0, '평온'], [3, '움찔'], [8, '울먹'], [15, '으앙'], [25, '해탈'], [40, '모찌 그 자체']];
let pokes = 0;
let weeds = 0;
let down = null;
addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
addEventListener('click', (e) => {
  if (game.state !== 'idle' || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
  if (e.target.closest('a, button, .hud, .game-over')) return;
  world.setPointer(e.clientX, e.clientY);
  const hit = world.pick();
  if (!hit) {
    for (let k = 0; k < 6; k++) petal(e.clientX, e.clientY, { spread: 50, fall: 80, dur: 1200 });
    return;
  }
  if (hit.type === 'character') {
    if (Math.random() < 0.4) {
      c.shake();
      c.setExpression('squint', 900);
    } else c.jump({ height: 1.0, expr: Math.random() < 0.4 ? 'squint' : null, spins: Math.random() < 0.2 ? 1 : 0 });
    const p = world.project(c.head, 1.2 * c.root.scale.x);
    const line = pick(LINES);
    bubble(line, p.x, p.y, /[가-힣]/.test(line));
    burst(e.clientX, e.clientY, 16, 1);
    world.meadow.gust(0.6);
  } else if (hit.type === 'weed') {
    if (!world.meadow.pull(hit.obj)) return;
    weeds++;
    $('#weedNum').textContent = weeds;
    $('#weedBar').style.width = `${weeds * 10}%`;
    animate('#weedNum', { scale: [1.5, 1], duration: 500, ease: 'outBack' });
    popText(pick(['뽁!', '쑥!', '영차!', '뽑았다!']), e.clientX, e.clientY);
    burst(e.clientX, e.clientY, 10, 0.8);
    if (weeds % 3 === 0 && weeds < 10) c.jump({ height: 0.7 });
    if (weeds === 10) setTimeout(passed, 500);
  } else {
    world.mochi.poke(hit.point, performance.now() / 1000);
    pokes++;
    $('#pokeNum').textContent = pokes;
    const mood = [...MOODS].reverse().find(([n]) => pokes >= n)[1];
    const moodEl = $('#mood');
    if (moodEl.textContent !== mood) {
      moodEl.textContent = mood;
      animate(moodEl, { scale: [1.4, 1], duration: 600, ease: 'outElastic(1, .5)' });
    }
    popText(pick(['말랑', '쫀득', '모찌!', 'ワ…', '꾹!']), e.clientX, e.clientY);
    burst(e.clientX, e.clientY, 8, 0.7);
    if (pokes % 4 === 0) c.jump({ height: 0.6, expr: 'squint' });
  }
});

function passed() {
  const stamp = $('#stamp');
  stamp.hidden = false;
  animate(stamp, { scale: [2.4, 1], rotate: [-30, -12], opacity: [0, 1], duration: 700, ease: 'outBack(2)' });
  petalStorm();
  c.jump({ height: 1.4, spins: 1 });
  setTimeout(() => {
    const p = world.project(c.head, 1.2 * c.root.scale.x);
    bubble('해냈다…!', p.x, p.y, true);
  }, 400);
}
$('#replant').addEventListener('click', () => {
  weeds = 0;
  $('#weedNum').textContent = 0;
  $('#weedBar').style.width = '0%';
  $('#stamp').hidden = true;
  world.meadow.plantWeeds();
});

// ───────── sky game ─────────
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
  lenis.start();
}
game.onScore = (n) => {
  gameScore.textContent = n;
  animate(gameScore, { scale: [1.3, 1], duration: 500, ease: 'outBack' });
};
game.onOver = (score, best) => {
  gameSec.classList.remove('is-playing');
  gameSec.classList.add('is-over');
  $('#overScore').textContent = score;
  $('#overBest').textContent = best;
  gameOver.hidden = false;
  animate(gameOver, { opacity: [0, 1], scale: [0.85, 1], duration: 700, ease: 'outBack' });
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
      const copy = en.target;
      io.unobserve(copy);
      const title = $('[data-split]', copy);
      if (title) {
        animate(titles.get(title), { opacity: [0, 1], y: ['0.5em', '0em'], rotate: 0, duration: 900, delay: stagger(28), ease: 'outBack(1.6)' });
        $$('em', title).forEach((em, i) => animate(em, { '--u': [0, 1], duration: 700, delay: 500 + i * 200, ease: 'outExpo' }));
      }
      animate($$('[data-reveal]', copy), { opacity: [0, 1], y: [24, 0], duration: 1000, delay: stagger(120, { start: 300 }), ease: 'outExpo' });
    }),
  { threshold: 0.25 }
);

// hero letters wobble on hover
$$('.ht').forEach((el) =>
  el.addEventListener('pointerenter', () => {
    animate(el, { y: [0, -30, 0], scaleY: [1, 1.12, 0.92, 1], rotate: [0, rand(-8, 8), 0], duration: 800, ease: 'outElastic(1, .5)' });
    const r = el.getBoundingClientRect();
    for (let k = 0; k < 5; k++) petal(r.left + r.width * Math.random(), r.top + r.height * 0.3, { spread: 40, fall: 90, dur: 1300 });
  })
);

// ───────── frame loop ─────────
const navLinks = $$('.nav-links a');
const dots = $$('.dots i');
let lastNav = -1;
let hover = null;
let booted = false;
let nextZ = 0;

function frame(now) {
  lenis.raf(now);
  if (game.state !== 'idle' && Math.abs(scrollY - lockedY) > 1) window.scrollTo(0, lockedY);

  const stage = computeStage();
  world.stage = stage;

  const i = Math.min(Math.floor(stage), SKY.length - 2);
  const f = stage - i;
  const A = SKY[i], B = SKY[i + 1];
  rootStyle.setProperty('--sky-top', mix(A[0], B[0], f));
  rootStyle.setProperty('--sky-bot', mix(A[1], B[1], f));
  rootStyle.setProperty('--rays', A[2] + (B[2] - A[2]) * f);
  rootStyle.setProperty('--sun', A[3] + (B[3] - A[3]) * f);
  rootStyle.setProperty('--sun-y', `${A[4] + (B[4] - A[4]) * f}%`);
  rootStyle.setProperty('--moon', A[5] + (B[5] - A[5]) * f);
  document.body.classList.toggle('is-night', stage > 4.5);

  // bedtime under the night blossoms
  const sleepy = stage > 4.65;
  if (sleepy && c.locked !== 'blink') c.lock('blink');
  else if (!sleepy && c.locked === 'blink') c.lock(null);
  if (sleepy && now > nextZ) {
    nextZ = now + 900;
    const p = world.project(c.head, 0.9 * c.root.scale.x);
    const z = document.createElement('div');
    z.className = 'zz';
    z.textContent = pick(['z', 'Z', 'z']);
    fx.append(z);
    animate(z, { x: [p.x + 40, p.x + rand(70, 120)], y: [p.y, p.y - rand(80, 130)], opacity: [0, 1, 0], scale: [0.6, 1.3], duration: 2200, ease: 'outSine', onComplete: () => z.remove() });
  }

  const nav = Math.round(stage);
  if (nav !== lastNav) {
    navLinks.forEach((a) => a.classList.toggle('is-active', +a.dataset.goto === nav));
    dots.forEach((d, k) => d.classList.toggle('is-on', k === nav));
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
    if (kind !== hover) {
      cursor.classList.toggle('is-hot', !!kind);
      hover = kind;
    }
  } else if (hover) {
    cursor.classList.remove('is-hot');
    world.mochi.setPointer(null);
    hover = null;
  }

  world.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ───────── boot ─────────
const heroBits = '.hero-tag, .hero-hint, .hero-bottom > *, .nav, .dots';
utils.set(heroBits, { opacity: 0 });
utils.set('.ht', { y: '-120%', opacity: 0 });
c.s.introY = 9;

async function boot() {
  const counter = { v: 0 };
  animate('.loader-face', { y: [0, -18, 0], scaleY: [1, 1.06, 0.9, 1], duration: 700, loop: true, ease: 'inOutSine' });
  animate('.loader-shadow', { scaleX: [1, 0.7, 1], opacity: [1, 0.6, 1], duration: 700, loop: true, ease: 'inOutSine' });
  const counted = new Promise((r) =>
    animate(counter, {
      v: 100, duration: reduced ? 300 : 1700, ease: 'inOutQuart',
      onUpdate: () => {
        $('#loadNum').textContent = Math.round(counter.v);
        $('#loadBar').style.width = `${counter.v}%`;
      },
      onComplete: r,
    })
  );
  await Promise.all([counted, document.fonts.ready]);
  createTimeline()
    .add('.loader-inner', { scale: [1, 0.8], opacity: 0, duration: 500, ease: 'inBack' }, 0)
    .add('#loader', { opacity: 0, duration: 700, ease: 'outQuad' }, 350)
    .call(intro, 450)
    .call(() => $('#loader').remove(), 1100);
}

function intro() {
  document.body.classList.remove('is-loading');
  lenis.start();
  booted = true;
  animate('.ht', { y: ['-120%', '0%'], opacity: [0, 1], duration: 1200, delay: stagger(110, { start: 200 }), ease: 'outBounce' });
  animate(heroBits, { opacity: [0, 1], y: [20, 0], duration: 1000, delay: stagger(100, { start: 900 }), ease: 'outExpo' });
  createTimeline()
    .add(c.s, { introY: [9, 0], duration: 850, ease: 'inQuad' }, 700)
    .add(c.s, { squash: [0.65, 1], duration: 1000, ease: 'outElastic(1, .35)' }, 1550)
    .call(() => {
      const p = world.project(c.root, 0);
      burst(p.x, p.y, 22, 1.6);
      world.meadow.gust();
    }, 1550)
    .call(() => {
      const p = world.project(c.head, 1.2);
      bubble('ワァ…!', p.x, p.y);
    }, 2200);
  $$('.copy').forEach((el) => io.observe(el));
}

boot();
