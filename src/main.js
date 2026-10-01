import './style.css';
import 'lenis/dist/lenis.css';
import Lenis from 'lenis';
import { animate, createTimeline, stagger, utils, scrambleText } from 'animejs';
import { World } from './scene/World.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.body.classList.add('is-loading');

// ───────── text splitting ─────────
function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text]
    .map((ch) => `<span class="split-c" aria-hidden="true"><span>${ch === ' ' ? '&nbsp;' : ch}</span></span>`)
    .join('');
  return $$('.split-c > span', el);
}
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="split-w"><span>${w}</span></span>`).join(' ');
  return $$('.split-w > span', el);
}

// ───────── world ─────────
const world = new World($('#gl'));
const sections = $$('[data-stage]');
const navButtons = $$('.nav__dots button');
const BG = [
  ['#fff3ec', '#ffe1e8'],
  ['#fff0f3', '#ffd6e1'],
  ['#eef5ff', '#d5e5ff'],
  ['#fffbe8', '#ffefb5'],
  ['#effaf4', '#d6f2e4'],
  ['#f5f0ff', '#e2d6ff'],
  ['#fff3ec', '#ffd9cf'],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, f) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * f)).join(',')})`;

// ───────── smooth scroll ─────────
const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.95 });
lenis.stop();
$$('[data-goto]').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.preventDefault();
    const i = +b.dataset.goto;
    const sec = sections[i];
    const offset = sec.offsetHeight > innerHeight * 1.5 ? sec.offsetHeight * 0.32 : sec.offsetHeight / 2 - innerHeight / 2;
    lenis.scrollTo(i === 0 ? 0 : sec.offsetTop + offset, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  })
);

function computeStage() {
  const vc = innerHeight / 2;
  const centers = sections.map((s) => {
    const r = s.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  let stage = 0;
  if (vc <= centers[0]) stage = 0;
  else if (vc >= centers[centers.length - 1]) stage = centers.length - 1;
  else {
    for (let i = 0; i < centers.length - 1; i++) {
      if (vc >= centers[i] && vc < centers[i + 1]) {
        const f = (vc - centers[i]) / (centers[i + 1] - centers[i]);
        // hold poses while a section is centred, travel in between
        stage = i + utils.clamp((f - 0.3) / 0.4, 0, 1);
        break;
      }
    }
  }
  return stage;
}

// ───────── cursor ─────────
const cursor = $('.cursor');
const dot = $('.cursor__dot');
const ring = $('.cursor__ring');
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const ringPos = { x: mouse.x, y: mouse.y };
let pointerOnUI = false;
addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  world.setPointer(e.clientX, e.clientY);
  pointerOnUI = !!e.target.closest('a, button, .card, .panel, .nav');
  cursor.classList.toggle('is-link', !!e.target.closest('a, button'));
});
addEventListener('pointerdown', () => cursor.classList.add('is-down'));
addEventListener('pointerup', () => cursor.classList.remove('is-down'));

// ───────── fx: sparks, rings, bubbles, confetti ─────────
const fx = $('#fx');
const bubbles = $('#bubbles');
const SPARK_COLORS = ['#f28aa4', '#8fb0e8', '#f2c24e', '#86d3b4', '#b9a2ff'];

function sparks(x, y, n = 14, power = 1) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = `spark ${Math.random() < 0.6 ? 'spark--star' : 'spark--dot'}`;
    el.style.background = pick(SPARK_COLORS);
    const size = rand(0.6, 1.6);
    fx.appendChild(el);
    const a = rand(0, Math.PI * 2);
    const d = rand(50, 150) * power;
    animate(el, {
      x: [x, x + Math.cos(a) * d],
      y: [y, y + Math.sin(a) * d],
      scale: [{ to: size * 1.4, duration: 180 }, { to: 0, duration: 650 }],
      rotate: rand(-360, 360),
      duration: 830,
      ease: 'outExpo',
      onComplete: () => el.remove(),
    });
  }
  const r = document.createElement('i');
  r.className = 'ring';
  r.style.borderColor = pick(SPARK_COLORS);
  fx.appendChild(r);
  animate(r, { x, y, scale: [0.1, 1.6 * power], opacity: [1, 0], borderWidth: ['8px', '1px'], duration: 750, ease: 'outExpo', onComplete: () => r.remove() });
}

function bubble(text, x, y) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  bubbles.appendChild(el);
  const w = el.offsetWidth;
  createTimeline({ onComplete: () => el.remove() })
    .add(el, { x: x - w / 2, y: [y - 30, y - 70], scale: [0, 1], rotate: [rand(-25, 25), rand(-6, 6)], duration: 650, ease: 'outElastic(1, .5)' }, 0)
    .add(el, { y: '-=40', opacity: 0, scale: 0.8, duration: 450, ease: 'inQuad' }, 1250);
}

function confetti(n = 140) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i');
    el.className = 'confetti';
    el.style.background = pick(SPARK_COLORS);
    if (Math.random() < 0.3) el.style.borderRadius = '50%';
    fx.appendChild(el);
    const fromLeft = i % 2 === 0;
    const x0 = fromLeft ? -20 : innerWidth + 20;
    const y0 = innerHeight * rand(0.55, 0.95);
    const vx = (fromLeft ? 1 : -1) * rand(innerWidth * 0.15, innerWidth * 0.6);
    const peak = y0 - rand(innerHeight * 0.45, innerHeight * 0.9);
    const dur = rand(1800, 3000);
    animate(el, {
      x: [x0, x0 + vx],
      y: [{ from: y0, to: peak, duration: dur * 0.4, ease: 'outCubic' }, { to: innerHeight + 60, duration: dur * 0.6, ease: 'inQuad' }],
      rotate: rand(-900, 900),
      rotateX: rand(-720, 720),
      duration: dur,
      delay: rand(0, 300),
      ease: 'linear',
      onComplete: () => el.remove(),
    });
  }
  world.particles.kick();
}

// ───────── character interactions ─────────
const LINES = {
  chiikawa: ['ワ…!', '…!!', 'ヤダ…', 'ウワーン', 'ワァ…!', 'えへ…'],
  hachiware: ['なんとかなれーッ!', 'いいね〜!', 'ワァ〜!', 'ちいかわ〜!', 'え〜!?'],
  usagi: ['ウラ!', 'ヤハ!', 'ハァ?', 'プルルルル', 'フゥン', 'イヤッ', 'ウラウラ!'],
};
const ACTIONS = {
  chiikawa: (c) => (Math.random() < 0.5 ? (c.shake(), c.setExpression('squint', 900)) : c.jump({ height: 0.9, expr: 'squint' })),
  hachiware: (c) => c.jump({ height: 1.2, spins: 1 }),
  usagi: (c) => c.jump({ height: 2.0, flips: 1, expr: Math.random() < 0.5 ? 'squint' : null }),
};

const MOODS = [
  [0, '평온 😌'],
  [3, '움찔 😳'],
  [8, '울먹 🥺'],
  [15, 'ウワーン 😭'],
  [25, '해탈 🫠'],
  [40, '모찌 그 자체 🍡'],
];
let pokes = 0;
const pokeEl = $('#pokeCount');
const moodEl = $('#mood');

let downAt = null;
addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});
addEventListener('click', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
  if (e.target.closest('a, button, .card, .panel, .nav')) return;
  world.setPointer(e.clientX, e.clientY);
  const hit = world.pick();
  if (!hit) {
    sparks(e.clientX, e.clientY, 8, 0.6);
    return;
  }
  if (hit.type === 'character') {
    const c = hit.obj;
    ACTIONS[c.kind](c);
    const p = world.screenPos(c.head, 1.2 * c.root.scale.x);
    bubble(pick(LINES[c.kind]), p.x, p.y);
    sparks(e.clientX, e.clientY, 16, 1);
  } else {
    world.mochi.poke(hit.point, performance.now() / 1000);
    pokes++;
    pokeEl.textContent = pokes;
    animate(pokeEl, { scale: [1.6, 1], rotate: [rand(-20, 20), 0], duration: 600, ease: 'outElastic(1, .4)' });
    const mood = [...MOODS].reverse().find(([n]) => pokes >= n)[1];
    if (moodEl.textContent !== mood) {
      moodEl.textContent = mood;
      animate(moodEl, { y: [20, 0], opacity: [0, 1], duration: 500, ease: 'outBack' });
    }
    const r = document.createElement('div');
    r.className = 'reaction';
    r.textContent = pick(['ワ…', 'ヤダ…!', 'むにゅ', 'もちっ', '…!!', 'ぷにっ']);
    fx.appendChild(r);
    animate(r, {
      x: [e.clientX - 30, e.clientX - 30 + rand(-90, 90)],
      y: [e.clientY - 20, e.clientY - rand(90, 150)],
      scale: [0.3, 1.2, 1],
      rotate: rand(-20, 20),
      opacity: [{ to: 1, duration: 100 }, { to: 0, delay: 500, duration: 300 }],
      duration: 900,
      ease: 'outExpo',
      onComplete: () => r.remove(),
    });
    sparks(e.clientX, e.clientY, 10, 0.8);
    world.chars.chiikawa.jump({ height: 0.5, expr: 'squint' });
    if (pokes % 5 === 0) world.chars.usagi.jump({ height: 1.6, flips: 1 });
    if (pokes % 7 === 0) world.chars.hachiware.jump({ height: 1, spins: 1 });
  }
});

$('#confettiBtn').addEventListener('click', (e) => {
  confetti();
  sparks(e.clientX, e.clientY, 24, 1.5);
  Object.values(world.chars).forEach((c, i) => setTimeout(() => c.jump({ height: 1.6, spins: 1 }), i * 120));
});

// ───────── magnetic + tilt ─────────
$$('.magnetic').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    animate(el, { x: dx * 0.35, y: dy * 0.45, duration: 400, ease: 'outQuad' });
  });
  el.addEventListener('pointerleave', () => animate(el, { x: 0, y: 0, duration: 900, ease: 'outElastic(1, .3)' }));
});
$$('.tilt').forEach((el) => {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    animate(el, { rotateY: (px - 0.5) * 22, rotateX: -(py - 0.5) * 18, scale: 1.04, duration: 400, ease: 'outQuad' });
  });
  el.addEventListener('pointerleave', () => animate(el, { rotateX: 0, rotateY: 0, scale: 1, duration: 1000, ease: 'outElastic(1, .4)' }));
});

// ───────── scroll reveals ─────────
const panelNames = $$('[data-split]').map((el) => ({ el, chars: splitChars(el) }));
panelNames.forEach(({ chars }) => utils.set(chars, { y: '110%', rotate: 12 }));
const finaleChars = $$('[data-split-finale]').map((el) => splitChars(el));
finaleChars.flat().forEach((c) => utils.set(c, { y: '115%' }));

const revealers = {
  chars(el) {
    const entry = panelNames.find((p) => p.el === el);
    animate(entry.chars, { y: ['110%', '0%'], rotate: [12, 0], duration: 1100, delay: stagger(70), ease: 'outElastic(1, .7)' });
  },
  words(el) {
    const words = splitWords(el);
    animate(words, { y: ['110%', '0%'], duration: 800, delay: stagger(60, { start: 150 }), ease: 'outExpo' });
  },
  fade(el) {
    animate(el, { opacity: [0, 1], y: [30, 0], filter: ['blur(8px)', 'blur(0px)'], duration: 1000, delay: 250, ease: 'outExpo' });
  },
  stats(el) {
    const bars = $$('.bar i', el);
    const nums = $$('b[data-count]', el);
    animate(bars, { scaleX: [0, 1], duration: 1400, delay: stagger(110, { start: 350 }), ease: 'outElastic(1, .6)' });
    nums.forEach((n, i) => {
      const o = { v: 0 };
      animate(o, { v: +n.dataset.count, duration: 1400, delay: 350 + i * 110, ease: 'outExpo', onUpdate: () => (n.textContent = Math.round(o.v)) });
    });
  },
  chips(el) {
    animate(el.children, { scale: [0, 1], rotate: () => [rand(-30, 30), 0], duration: 800, delay: stagger(70, { start: 500 }), ease: 'outElastic(1, .5)' });
  },
  pop(el) {
    animate(el, { scale: [0, 1], rotate: [-8, 0], duration: 900, delay: 650, ease: 'outElastic(1, .45)' });
  },
};
$$('[data-reveal="fade"], [data-reveal="pop"]').forEach((el) => utils.set(el, { opacity: el.dataset.reveal === 'fade' ? 0 : 1, scale: el.dataset.reveal === 'pop' ? 0 : 1 }));
$$('[data-reveal="chips"]').forEach((el) => utils.set(el.children, { scale: 0 }));
$$('[data-reveal="words"]').forEach((el) => (el.style.opacity = 0));

const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      if (el.dataset.reveal === 'words') el.style.opacity = 1;
      if (el.hasAttribute('data-split')) revealers.chars(el);
      else revealers[el.dataset.reveal]?.(el);
    }),
  { threshold: 0.35 }
);

// friends cards + finale
const friendsIO = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      friendsIO.unobserve(en.target);
      if (en.target.classList.contains('friends__grid')) {
        animate(en.target.children, {
          y: [160, 0],
          rotate: () => [rand(-14, 14), 0],
          opacity: [0, 1],
          duration: 1200,
          delay: stagger(110),
          ease: 'outElastic(1, .65)',
        });
      } else if (en.target.classList.contains('finale__big')) {
        animate(finaleChars.flat(), { y: ['115%', '0%'], duration: 1300, delay: stagger(55), ease: 'outElastic(1, .6)' });
        setTimeout(() => confetti(90), 500);
      }
    }),
  { threshold: 0.3 }
);
utils.set($$('.friends__grid > *'), { opacity: 0 });

// ───────── frame loop ─────────
const progress = $('#progress');
const ghosts = $$('[data-drift]');
let activeNav = 0;
let hoverKind = null;

function frame(now) {
  lenis.raf(now);
  const max = document.documentElement.scrollHeight - innerHeight;
  const sp = max > 0 ? scrollY / max : 0;
  progress.style.transform = `scaleX(${sp})`;

  const stage = computeStage();
  world.stage = stage;
  world.scroll = sp;

  // background colour morph
  const i = Math.min(Math.floor(stage), BG.length - 2);
  const f = stage - i;
  document.body.style.setProperty('--bg', mixHex(BG[i][0], BG[i + 1][0], f));
  document.body.style.setProperty('--bg-2', mixHex(BG[i][1], BG[i + 1][1], f));

  const nav = Math.round(stage);
  if (nav !== activeNav) {
    navButtons[activeNav]?.classList.remove('is-active');
    navButtons[nav]?.classList.add('is-active');
    activeNav = nav;
  }

  // ghost type drift
  for (const g of ghosts) {
    const r = g.parentElement.getBoundingClientRect();
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    g.style.transform = `translate3d(${p * 40 - 10}vw, ${p * -10}vh, 0)`;
  }

  // cursor + 3D hover
  dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
  ringPos.x += (mouse.x - ringPos.x) * 0.18;
  ringPos.y += (mouse.y - ringPos.y) * 0.18;
  ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  if (!pointerOnUI && booted) {
    const hit = world.pick();
    const kind = hit ? hit.type : null;
    world.mochi.setPointer(hit && hit.type === 'mochi' ? hit.point : null);
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
let booted = false;
requestAnimationFrame(frame);

// ───────── boot sequence ─────────
const heroChars = $$('.hero__ch > span');
utils.set(heroChars, { y: '115%' });
utils.set('.hero__top > *, .hero__bottom > *, .scroll-cue, .hero__ring, .nav', { opacity: 0 });
Object.values(world.chars).forEach((c) => (c.s.introY = 12));

async function boot() {
  const counter = { v: 0 };
  const num = $('#loadNum');
  const bar = $('#loadBar');
  animate('.loader__word span', { y: [0, -26, 0], duration: 700, delay: stagger(90), loop: true, loopDelay: 300, ease: 'inOutSine' });
  animate('.loader__face', { rotate: [-8, 8], scaleY: [1, 0.92], duration: 520, alternate: true, loop: true, ease: 'inOutSine' });
  const minTime = new Promise((r) =>
    animate(counter, { v: 100, duration: reduced ? 300 : 1900, ease: 'inOutQuart', onUpdate: () => {
      num.textContent = Math.round(counter.v);
      bar.style.width = `${counter.v}%`;
    }, onComplete: r })
  );
  await Promise.all([minTime, document.fonts.ready]);

  const tl = createTimeline({ defaults: { ease: 'inOutExpo' } });
  tl.add('.loader__inner', { scale: [1, 0.6], opacity: 0, duration: 600, ease: 'inBack' }, 0)
    .add('.loader__curtain i', { y: ['0%', '-100%'], duration: 1100, delay: stagger(70, { from: 'center' }) }, 450)
    .call(() => {
      $('#loader').style.pointerEvents = 'none';
    }, 600)
    .call(intro, 700)
    .call(() => $('#loader').remove(), 1800);
}

function intro() {
  document.body.classList.remove('is-loading');
  lenis.start();
  booted = true;
  animate(heroChars, { y: ['115%', '0%'], duration: 1400, delay: stagger(90), ease: 'outElastic(1, .55)' });
  animate('.hero__ring', { opacity: [0, 0.75], scale: [0.6, 1], duration: 1800, ease: 'outExpo', delay: 300 });
  animate('.hero__top > *, .hero__bottom > *, .scroll-cue, .nav', { opacity: [0, 1], y: [30, 0], duration: 1100, delay: stagger(110, { start: 700 }), ease: 'outExpo' });
  animate('.scramble', { innerHTML: scrambleText({ chars: 'ちいかわハチワレうさぎ✦' }), duration: 1600, delay: 600 });
  const order = ['hachiware', 'chiikawa', 'usagi'];
  order.forEach((k, i) => {
    const c = world.chars[k];
    createTimeline()
      .add(c.s, { introY: [12, 0], duration: 900, ease: 'inQuad' }, 250 + i * 220)
      .add(c.s, { squash: [0.6, 1], duration: 900, ease: 'outElastic(1, .3)' }, 1150 + i * 220)
      .call(() => {
        const p = world.screenPos(c.root, 0);
        sparks(p.x, p.y, 12, 1.1);
        if (k === 'usagi') setTimeout(() => c.jump({ height: 1.4, flips: 1 }), 200);
      }, 1150 + i * 220);
  });
  setTimeout(() => {
    const c = world.chars.chiikawa;
    const p = world.screenPos(c.head, 1.3);
    bubble('ワァ…!', p.x, p.y);
  }, 2200);

  $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));
  friendsIO.observe($('.friends__grid'));
  friendsIO.observe($('.finale__big'));
}

boot();
