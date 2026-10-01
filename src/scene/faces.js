import * as THREE from 'three';

// Faces are painted onto a 2D canvas and front-projected onto the head (object-space xy → uv),
// like the pad-printed face on the vinyl figure. Canvas coords: face-space x,y ∈ [-1, 1], +y up.
// Feature positions were measured off the figure reference (front view).

const SIZE = 1024;
const INK = '#121010';
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

// Face-reference measurements (front photo, head 625×500px) are expressed in
// "photo space": fx = x / half-width, fy = y / half-height (from the head centre).
// F() maps them onto the projected sphere (the head is a bit taller above its centre).
const F = (fx, fy) => [fx * 0.95, -0.1 + fy * 0.88];

function refEyes(g, open = 'open') {
  for (const s of [-1, 1]) {
    const [x, y] = F(0.35 * s, 0.03);
    const rx = 0.118, ry = 0.152;
    if (open === 'open') {
      ellipse(g, x, y, rx, ry, INK);
      // big glossy highlight, slightly towards the nose and up
      ellipse(g, x - rx * 0.2, y + ry * 0.2, rx * 0.5, ry * 0.4, '#fff');
      // curved glint along the lower rim
      stroke(g, 0.02, '#fff', () => {
        g.moveTo(x - rx * 0.36, y - ry * 0.52);
        g.quadraticCurveTo(x + rx * 0.05, y - ry * 0.7, x + rx * 0.42, y - ry * 0.42);
      });
    } else if (open === 'blink') {
      stroke(g, 0.045, INK, () => {
        g.moveTo(x - rx * 0.95, y);
        g.quadraticCurveTo(x, y - ry * 0.65, x + rx * 0.95, y);
      });
    } else {
      // "> <"
      stroke(g, 0.045, INK, () => {
        g.moveTo(x + rx * 0.8 * s, y + ry * 0.6);
        g.lineTo(x - rx * 0.7 * s, y);
        g.lineTo(x + rx * 0.8 * s, y - ry * 0.6);
      });
    }
  }
}

function refBrows(g) {
  for (const s of [-1, 1]) {
    const [x0, y0] = F(0.47 * s, 0.3);
    const [x1, y1] = F(0.27 * s, 0.355);
    const [cx, cy] = F(0.37 * s, 0.37);
    stroke(g, 0.042, INK, () => {
      g.moveTo(x0, y0);
      g.quadraticCurveTo(cx, cy, x1, y1);
    });
  }
}

function refCheeks(g) {
  for (const s of [-1, 1]) {
    const [x, y] = F(0.56 * s, -0.3);
    ellipse(g, x, y, 0.175, 0.135, 'rgba(246, 196, 204, 0.95)');
    // three slanted strokes + a dot, mirrored per side
    const marks = [-0.09, -0.035, 0.02];
    for (const m of marks) {
      const mx = x + m; // strokes left, dot on the right — same on both cheeks (as printed)
      stroke(g, 0.034, INK, () => {
        g.moveTo(mx - 0.012, y - 0.05);
        g.quadraticCurveTo(mx - 0.004, y, mx + 0.012, y + 0.052);
      });
    }
    ellipse(g, x + 0.075, y - 0.005, 0.017, 0.028, INK);
  }
}

function refMouth(g) {
  const W = 0.15;
  const [px, py] = F(0, -0.2); // ω peak
  const [, ay] = F(0, -0.3); // ω lower curve
  const [, uy] = F(0, -0.45); // U bottom
  stroke(g, 0.032, INK, () => {
    // left curl → peak → right curl
    g.moveTo(-W, ay + 0.04);
    g.quadraticCurveTo(-W * 0.62, ay - 0.06, -0.04, ay - 0.005);
    g.quadraticCurveTo(-0.012, py - 0.02, px, py);
    g.quadraticCurveTo(0.012, py - 0.02, 0.04, ay - 0.005);
    g.quadraticCurveTo(W * 0.62, ay - 0.06, W, ay + 0.04);
  });
  // open U mouth (white inside, inked outline)
  g.beginPath();
  g.moveTo(-0.06, ay - 0.012);
  g.bezierCurveTo(-0.075, uy - 0.02, 0.075, uy - 0.02, 0.06, ay - 0.012);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 0.03;
  g.strokeStyle = INK;
  g.stroke();
  // chin smile
  const [, cy] = F(0, -0.56);
  stroke(g, 0.03, INK, () => {
    g.moveTo(-0.065, cy + 0.012);
    g.quadraticCurveTo(0, cy - 0.022, 0.065, cy + 0.012);
  });
}

function refWail(g) {
  const [, y] = F(0, -0.36);
  g.beginPath();
  g.ellipse(0, y, 0.085, 0.1, 0, 0, Math.PI * 2);
  g.fillStyle = '#3a1a18';
  g.fill();
  ellipse(g, 0, y - 0.05, 0.05, 0.03, '#ef8d9c');
}

const PAINTERS = {
  chiikawa(g, expr) {
    refCheeks(g);
    refBrows(g);
    refEyes(g, expr);
    if (expr === 'squint') {
      refWail(g);
      for (const s of [-1, 1]) {
        const [x, y] = F(0.4 * s, -0.12);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 0.05 * s, y - 0.1, x, y - 0.14);
        g.quadraticCurveTo(x - 0.04 * s, y - 0.1, x, y);
        g.fillStyle = 'rgba(140, 200, 255, 0.95)';
        g.fill();
      }
    } else refMouth(g);
  },
  // the lying-down mochi version (squished face)
  mochi(g, expr) {
    g.save();
    g.scale(0.82, 0.82);
    PAINTERS.chiikawa(g, expr);
    g.restore();
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
