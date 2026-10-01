import * as THREE from 'three';

// Faces are painted onto a 2D canvas and front-projected onto the head (object-space xy → uv),
// like the pad-printed face on the vinyl figure. Canvas coords: face-space x,y ∈ [-1, 1], +y up.
// Feature positions were measured off the figure reference (front view).

const SIZE = 1024;
const INK = '#1d1715';
const CHEEK = 'rgba(244, 172, 186, 0.92)';
const HATCH = '#5a2f2a';

function makeCtx() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  g.translate(SIZE / 2, SIZE / 2);
  g.scale(SIZE / 2, -SIZE / 2);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  return { c, g };
}

function ellipse(g, x, y, rx, ry, fill) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}

function stroke(g, w, color, fn) {
  g.beginPath();
  fn();
  g.lineWidth = w;
  g.strokeStyle = color;
  g.stroke();
}

function cheeks(g, cx, cy, rx, ry, lines = 4) {
  for (const s of [-1, 1]) {
    const x = cx * s;
    ellipse(g, x, cy, rx, ry, CHEEK);
    for (let k = 0; k < lines; k++) {
      const lx = x + (k - (lines - 1) / 2) * rx * 0.36;
      stroke(g, 0.014, HATCH, () => {
        g.moveTo(lx - 0.012, cy - ry * 0.42);
        g.lineTo(lx + 0.012, cy + ry * 0.42);
      });
    }
  }
}

// black oval, big highlight up top, a small curved glint along the bottom
function eyes(g, ex, ey, rx, ry) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    ellipse(g, x, ey, rx, ry, INK);
    ellipse(g, x - rx * 0.12, ey + ry * 0.24, rx * 0.5, ry * 0.42, '#fff');
    stroke(g, 0.011, '#fff', () => g.arc(x + rx * 0.05, ey - ry * 0.12, rx * 0.6, Math.PI * 1.3, Math.PI * 1.72));
  }
}

function closedEyes(g, ex, ey, w) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    stroke(g, 0.02, INK, () => {
      g.moveTo(x - w, ey);
      g.quadraticCurveTo(x, ey - 0.045, x + w, ey);
    });
  }
}

function squintEyes(g, ex, ey, w) {
  // "> <"
  for (const s of [-1, 1]) {
    const x = ex * s;
    stroke(g, 0.022, INK, () => {
      g.moveTo(x + w * s, ey + 0.06);
      g.lineTo(x - w * s, ey);
      g.lineTo(x + w * s, ey - 0.06);
    });
  }
}

function brows(g, ex, by, w) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    stroke(g, 0.014, INK, () => {
      g.moveTo(x - w, by - 0.01);
      g.quadraticCurveTo(x, by + 0.03, x + w, by - 0.01);
    });
  }
}

// "ω" on top of an outlined U-shaped open mouth, plus the little chin line
function mouth(g, y) {
  const r = 0.046;
  stroke(g, 0.015, INK, () => {
    g.arc(-r, y, r, Math.PI, Math.PI * 2, false);
    g.arc(r, y, r, Math.PI, Math.PI * 2, false);
  });
  stroke(g, 0.015, INK, () => {
    g.moveTo(-r, y - r);
    g.bezierCurveTo(-r * 1.05, y - 0.2, r * 1.05, y - 0.2, r, y - r);
  });
  stroke(g, 0.014, INK, () => {
    g.moveTo(-0.05, y - 0.25);
    g.quadraticCurveTo(0, y - 0.27, 0.05, y - 0.25);
  });
}

function wailMouth(g, y) {
  g.beginPath();
  g.ellipse(0, y - 0.07, 0.06, 0.07, 0, 0, Math.PI * 2);
  g.fillStyle = '#3a1a18';
  g.fill();
  ellipse(g, 0, y - 0.11, 0.035, 0.022, '#ef8d9c');
}

function tears(g, ex, ey) {
  for (const s of [-1, 1]) {
    const x = ex * s + 0.05 * s;
    g.beginPath();
    g.moveTo(x, ey - 0.06);
    g.quadraticCurveTo(x + 0.045 * s, ey - 0.15, x, ey - 0.18);
    g.quadraticCurveTo(x - 0.035 * s, ey - 0.15, x, ey - 0.06);
    g.fillStyle = 'rgba(140, 200, 255, 0.92)';
    g.fill();
  }
}

const PAINTERS = {
  chiikawa(g, expr) {
    const ex = 0.34, ey = 0.02;
    cheeks(g, 0.68, -0.14, 0.14, 0.085);
    if (expr === 'open') eyes(g, ex, ey, 0.075, 0.115);
    if (expr === 'blink') closedEyes(g, ex, ey, 0.065);
    if (expr === 'squint') { squintEyes(g, ex, ey, 0.055); tears(g, ex, ey); }
    brows(g, ex, 0.26, 0.065);
    if (expr === 'squint') wailMouth(g, -0.12);
    else mouth(g, -0.11);
  },
  // the lying-down mochi version (other figure reference)
  mochi(g, expr) {
    const ex = 0.3, ey = -0.08;
    cheeks(g, 0.62, -0.24, 0.11, 0.068, 3);
    if (expr === 'open') eyes(g, ex, ey, 0.062, 0.095);
    if (expr === 'blink') closedEyes(g, ex, ey, 0.06);
    if (expr === 'squint') { squintEyes(g, ex, ey, 0.05); tears(g, ex, ey); }
    brows(g, ex, 0.12, 0.055);
    if (expr === 'squint') wailMouth(g, -0.2);
    else {
      const r = 0.032;
      stroke(g, 0.015, INK, () => {
        g.arc(-r, -0.2, r, Math.PI, Math.PI * 2, false);
        g.arc(r, -0.2, r, Math.PI, Math.PI * 2, false);
      });
    }
  },
};

const cache = new Map();

export function faceTexture(kind, expr = 'open') {
  const key = kind + expr;
  if (cache.has(key)) return cache.get(key);
  const { c, g } = makeCtx();
  PAINTERS[kind](g, expr);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

export function faceSet(kind) {
  return {
    open: faceTexture(kind, 'open'),
    blink: faceTexture(kind, 'blink'),
    squint: faceTexture(kind, 'squint'),
  };
}
