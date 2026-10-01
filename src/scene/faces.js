import * as THREE from 'three';

// Faces are painted onto a 2D canvas and front-projected onto the head (object-space xy → uv),
// just like the pad-printed faces on vinyl figures.
// Canvas coords: face-space x,y ∈ [-1, 1], +y up.

const SIZE = 1024;
const INK = '#2a1a17';
const BROWN = '#5b2e24';
const CHEEK = 'rgba(243, 160, 176, 0.95)';

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

function ellipse(g, x, y, rx, ry, fill, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
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

function cheeks(g, cx, cy, rx = 0.13, ry = 0.08) {
  for (const s of [-1, 1]) {
    const x = cx * s;
    ellipse(g, x, cy, rx, ry, CHEEK);
    for (let k = -1; k <= 1; k++) {
      const lx = x + k * rx * 0.42;
      stroke(g, 0.017, BROWN, () => {
        g.moveTo(lx - 0.012, cy - ry * 0.45);
        g.lineTo(lx + 0.012, cy + ry * 0.45);
      });
    }
  }
}

function sparkleEyes(g, ex, ey, rx, ry, color = INK) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    ellipse(g, x, ey, rx, ry, color);
    ellipse(g, x - rx * 0.18, ey + ry * 0.3, rx * 0.46, ry * 0.4, '#fff');
    ellipse(g, x + rx * 0.38, ey - ry * 0.42, rx * 0.17, ry * 0.14, '#fff');
  }
}

function dotEyes(g, ex, ey, rx, ry) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    ellipse(g, x, ey, rx, ry, INK);
    ellipse(g, x - rx * 0.25, ey + ry * 0.35, rx * 0.3, ry * 0.25, '#fff');
  }
}

function closedEyes(g, ex, ey, w) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    stroke(g, 0.024, INK, () => {
      g.moveTo(x - w, ey + 0.01);
      g.quadraticCurveTo(x, ey - 0.05, x + w, ey + 0.01);
    });
  }
}

function squintEyes(g, ex, ey, w) {
  // ">  <"
  for (const s of [-1, 1]) {
    const x = ex * s;
    stroke(g, 0.026, INK, () => {
      g.moveTo(x + w * s, ey + 0.065);
      g.lineTo(x - w * s, ey);
      g.lineTo(x + w * s, ey - 0.065);
    });
  }
}

function brows(g, ex, by, w, worried = 0.02) {
  for (const s of [-1, 1]) {
    const x = ex * s;
    stroke(g, 0.017, BROWN, () => {
      g.moveTo(x - w, by - (s < 0 ? 0 : worried));
      g.quadraticCurveTo(x, by + 0.035, x + w, by - (s < 0 ? worried : 0));
    });
  }
}

function catMouth(g, y, open = true, scale = 1) {
  const r = 0.035 * scale;
  stroke(g, 0.017, INK, () => {
    g.arc(-r, y, r, Math.PI, Math.PI * 2, false);
    g.arc(r, y, r, Math.PI, Math.PI * 2, false);
  });
  if (open) {
    g.beginPath();
    g.moveTo(-r * 1.3, y - r * 0.9);
    g.quadraticCurveTo(0, y - r * 4.2, r * 1.3, y - r * 0.9);
    g.closePath();
    g.fillStyle = '#4a1f1c';
    g.fill();
    ellipse(g, 0, y - r * 2.1, r * 0.75, r * 0.5, '#ef8d9c');
  }
}

function wailMouth(g, y) {
  g.beginPath();
  g.ellipse(0, y - 0.03, 0.06, 0.05, 0, 0, Math.PI * 2);
  g.fillStyle = '#4a1f1c';
  g.fill();
  ellipse(g, 0, y - 0.06, 0.035, 0.018, '#ef8d9c');
}

function usagiMouth(g, y, wide = false) {
  const w = wide ? 0.1 : 0.075;
  g.beginPath();
  g.moveTo(-w, y);
  g.quadraticCurveTo(0, y + 0.02, w, y);
  g.quadraticCurveTo(0, y - (wide ? 0.2 : 0.14), -w, y);
  g.closePath();
  g.fillStyle = '#4a1f1c';
  g.fill();
  ellipse(g, 0, y - (wide ? 0.11 : 0.08), w * 0.55, 0.035, '#ef8d9c');
}

function tears(g, ex, ey) {
  for (const s of [-1, 1]) {
    const x = ex * s + 0.06 * s;
    g.beginPath();
    g.moveTo(x, ey - 0.03);
    g.quadraticCurveTo(x + 0.05 * s, ey - 0.11, x, ey - 0.14);
    g.quadraticCurveTo(x - 0.04 * s, ey - 0.11, x, ey - 0.03);
    g.fillStyle = 'rgba(140, 200, 255, 0.9)';
    g.fill();
  }
}

const PAINTERS = {
  chiikawa(g, expr) {
    const ex = 0.27, ey = -0.04;
    cheeks(g, 0.56, -0.2, 0.15, 0.095);
    if (expr === 'open') sparkleEyes(g, ex, ey, 0.085, 0.112);
    if (expr === 'blink') closedEyes(g, ex, ey, 0.07);
    if (expr === 'squint') { squintEyes(g, ex, ey, 0.06); tears(g, ex, ey); }
    brows(g, ex, 0.15, 0.06, 0.018);
    if (expr === 'squint') wailMouth(g, -0.2);
    else {
      catMouth(g, -0.19, true, 1.2);
      stroke(g, 0.014, INK, () => { g.moveTo(-0.03, -0.33); g.quadraticCurveTo(0, -0.345, 0.03, -0.33); });
    }
  },
  hachiware(g, expr) {
    const ex = 0.27, ey = -0.06;
    cheeks(g, 0.56, -0.22, 0.15, 0.095);
    if (expr === 'open') sparkleEyes(g, ex, ey, 0.08, 0.105);
    if (expr === 'blink') closedEyes(g, ex, ey, 0.07);
    if (expr === 'squint') squintEyes(g, ex, ey, 0.06);
    if (expr === 'squint') wailMouth(g, -0.2);
    else catMouth(g, -0.2, true, 1.15);
  },
  usagi(g, expr) {
    const ex = 0.24, ey = -0.02;
    cheeks(g, 0.52, -0.18, 0.11, 0.07);
    if (expr === 'open') dotEyes(g, ex, ey, 0.058, 0.078);
    if (expr === 'blink') closedEyes(g, ex, ey, 0.055);
    if (expr === 'squint') squintEyes(g, ex, ey, 0.055);
    usagiMouth(g, -0.17, expr === 'squint');
  },
  // the lying-down mochi from the playground
  mochi(g, expr) {
    const ex = 0.25, ey = -0.08;
    cheeks(g, 0.5, -0.24, 0.12, 0.075);
    if (expr === 'open') {
      for (const s of [-1, 1]) {
        const x = ex * s;
        ellipse(g, x, ey, 0.07, 0.085, BROWN);
        ellipse(g, x, ey, 0.05, 0.062, '#fff');
        ellipse(g, x + 0.005, ey - 0.008, 0.038, 0.048, BROWN);
        ellipse(g, x - 0.012, ey + 0.012, 0.016, 0.016, '#fff');
      }
    }
    if (expr === 'blink') closedEyes(g, ex, ey, 0.065);
    if (expr === 'squint') { squintEyes(g, ex, ey, 0.055); tears(g, ex, ey); }
    for (const s of [-1, 1]) {
      stroke(g, 0.016, BROWN, () => {
        const x = ex * s;
        g.moveTo(x - 0.05, 0.1 + (s > 0 ? 0.0 : 0.01));
        g.lineTo(x + 0.05, 0.1 + (s > 0 ? 0.01 : 0.0));
      });
    }
    if (expr === 'squint') wailMouth(g, -0.2);
    else catMouth(g, -0.2, false, 0.9);
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
