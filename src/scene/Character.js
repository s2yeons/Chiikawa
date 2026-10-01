import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTimeline, animate } from 'animejs';
import { vinyl, HACHIWARE_PATTERN, blobShadowTexture } from './materials.js';
import { faceSet } from './faces.js';

const HEAD_Y = 1.6;
const HEAD_SCALE = new THREE.Vector3(1.13, 0.93, 1.0);

// Big, mushroom-ish head with a flattened underside (see the figure references).
function headGeometry() {
  let g = new THREE.SphereGeometry(1, 96, 64);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    if (y < -0.35) y = -0.35 + (y + 0.35) * 0.62;
    // slight cap overhang
    const k = 1 + 0.04 * Math.exp(-((y + 0.25) ** 2) * 18);
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

function bodyGeometry() {
  const pts = new THREE.SplineCurve([
    new THREE.Vector2(0.001, 0.14),
    new THREE.Vector2(0.33, 0.16),
    new THREE.Vector2(0.44, 0.34),
    new THREE.Vector2(0.45, 0.6),
    new THREE.Vector2(0.38, 0.88),
    new THREE.Vector2(0.22, 1.04),
    new THREE.Vector2(0.001, 1.08),
  ]).getPoints(40);
  return new THREE.LatheGeometry(pts, 64);
}

function catEarGeometry() {
  const pts = new THREE.SplineCurve([
    new THREE.Vector2(0.001, 0.46),
    new THREE.Vector2(0.06, 0.42),
    new THREE.Vector2(0.17, 0.22),
    new THREE.Vector2(0.27, 0.02),
    new THREE.Vector2(0.24, -0.08),
    new THREE.Vector2(0.001, -0.1),
  ]).getPoints(30);
  const g = new THREE.LatheGeometry(pts, 48);
  g.scale(1, 1, 0.62);
  return g;
}

const GEO = {
  sphere: new THREE.SphereGeometry(1, 48, 32),
  head: null,
  body: null,
  catEar: null,
  leg: new THREE.CapsuleGeometry(0.15, 0.12, 8, 20),
  arm: new THREE.CapsuleGeometry(0.115, 0.2, 8, 20),
  bunnyEar: new THREE.CapsuleGeometry(0.15, 0.85, 10, 24),
  shadow: new THREE.PlaneGeometry(1, 1),
};

const KINDS = {
  chiikawa: { color: '#fbfaf7', ears: 'bear' },
  hachiware: { color: '#fbfaf7', ears: 'cat', earColor: '#7f9fcf', pattern: HACHIWARE_PATTERN },
  usagi: { color: '#f9e9b4', ears: 'bunny' },
};

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const tmp = new THREE.Vector3();

export class Character {
  constructor(kind) {
    GEO.head ??= headGeometry();
    GEO.body ??= bodyGeometry();
    GEO.catEar ??= catEarGeometry();

    this.kind = kind;
    const cfg = KINDS[kind];
    this.faces = faceSet(kind);
    this.phase = Math.random() * 10;

    this.root = new THREE.Group();
    this.root.userData.character = this;
    this.hop = new THREE.Group();
    this.spinner = new THREE.Group();
    this.root.add(this.hop);
    this.hop.add(this.spinner);

    const mat = vinyl(cfg.color);
    this.headMat = vinyl(cfg.color, { face: this.faces.open, pattern: cfg.pattern });
    const mesh = (geo, m = mat) => {
      const o = new THREE.Mesh(geo, m);
      o.castShadow = true;
      return o;
    };

    // body
    const body = mesh(GEO.body);
    this.spinner.add(body);
    for (const s of [-1, 1]) {
      const leg = mesh(GEO.leg);
      leg.position.set(0.19 * s, 0.21, 0.02);
      this.spinner.add(leg);
    }
    const tail = mesh(GEO.sphere);
    tail.scale.setScalar(0.11);
    tail.position.set(0, 0.38, -0.44);
    this.spinner.add(tail);

    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.36 * s, 0.86, 0.06);
      const arm = mesh(GEO.arm);
      arm.position.y = -0.19;
      pivot.add(arm);
      pivot.userData.side = s;
      this.arms.push(pivot);
      this.spinner.add(pivot);
    }

    // head
    this.head = new THREE.Group();
    this.head.position.y = HEAD_Y;
    this.spinner.add(this.head);
    const head = mesh(GEO.head, this.headMat);
    head.scale.copy(HEAD_SCALE);
    this.head.add(head);

    this.ears = [];
    const earMat = cfg.earColor ? vinyl(cfg.earColor) : mat;
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      let ear;
      if (cfg.ears === 'bear') {
        pivot.position.set(0.6 * s, 0.7, 0.02);
        ear = mesh(GEO.sphere);
        ear.scale.set(0.21, 0.2, 0.15);
      } else if (cfg.ears === 'cat') {
        pivot.position.set(0.58 * s, 0.66, 0.0);
        pivot.rotation.z = -0.55 * s;
        ear = mesh(GEO.catEar, earMat);
      } else {
        pivot.position.set(0.27 * s, 0.72, -0.02);
        pivot.rotation.z = -0.1 * s;
        ear = mesh(GEO.bunnyEar);
        ear.position.y = 0.55;
        ear.scale.set(1, 1, 0.72);
        const inner = mesh(GEO.bunnyEar, vinyl('#f6c5c4'));
        inner.scale.set(0.5, 0.82, 0.3);
        inner.position.set(0, 0.04, 0.12);
        ear.add(inner);
      }
      pivot.add(ear);
      pivot.userData.base = pivot.rotation.z;
      this.ears.push(pivot);
      this.head.add(pivot);
    }

    // contact shadow
    this.shadow = new THREE.Mesh(
      GEO.shadow,
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.shadow.scale.set(2.1, 1.7, 1);
    this.root.add(this.shadow);

    // animated state (driven by anime.js + the frame loop)
    this.s = { jumpY: 0, introY: 0, squash: 1, spin: 0, flip: 0, wave: 0, look: 1 };
    this.target = { x: 0, y: 0, z: 0, ry: 0, s: 1 };
    this.busy = false;
    this.nextBlink = 1 + Math.random() * 3;
    this.exprUntil = 0;
    this.prevPos = new THREE.Vector3();
    this.run = 0;
    this.lookX = 0;
    this.lookY = 0;
  }

  setExpression(expr, ms = 0) {
    this.headMat.userData.uniforms.uFace.value = this.faces[expr];
    this.exprUntil = ms ? performance.now() + ms : 0;
  }

  jump({ height = 1.1, spins = 0, flips = 0, expr = null } = {}) {
    if (this.busy) return;
    this.busy = true;
    const s = this.s;
    if (expr) this.setExpression(expr, 1100);
    const tl = createTimeline({ onComplete: () => (this.busy = false) });
    tl.add(s, { squash: 0.7, duration: 130, ease: 'outQuad' }, 0)
      .add(s, { jumpY: height, duration: 340, ease: 'outCubic' }, 130)
      .add(s, { squash: 1.22, duration: 170, ease: 'outQuad' }, 130)
      .add(s, { squash: 1, duration: 220, ease: 'inOutQuad' }, 300)
      .add(s, { jumpY: 0, duration: 300, ease: 'inQuad' }, 470)
      .add(s, { squash: 0.72, duration: 90, ease: 'outQuad' }, 770)
      .add(s, { squash: 1, duration: 650, ease: 'outElastic(1, .35)' }, 860)
      .add(s, { wave: 1, duration: 260, ease: 'outBack' }, 130)
      .add(s, { wave: 0, duration: 500, ease: 'inOutQuad' }, 700);
    if (spins) tl.add(s, { spin: s.spin + spins * Math.PI * 2, duration: 640, ease: 'inOutCubic' }, 130);
    if (flips) tl.add(s, { flip: s.flip - flips * Math.PI * 2, duration: 620, ease: 'inOutCubic' }, 140);
    return tl;
  }

  shake() {
    animate(this.spinner.rotation, {
      z: [0, 0.18, -0.16, 0.12, -0.08, 0.04, 0],
      duration: 700,
      ease: 'inOutSine',
    });
  }

  update(t, dt, camera, pointer) {
    const { root, s, target } = this;
    // follow stage pose
    root.position.x = damp(root.position.x, target.x, 4.5, dt);
    root.position.y = damp(root.position.y, target.y, 4.5, dt);
    root.position.z = damp(root.position.z, target.z, 4.5, dt);
    root.rotation.y = damp(root.rotation.y, target.ry, 5, dt);
    const sc = damp(root.scale.x, target.s, 5, dt);
    root.scale.setScalar(Math.max(sc, 0.0001));
    root.visible = sc > 0.01;

    // little run-cycle hop while travelling between stages
    const speed = this.prevPos.distanceTo(root.position) / Math.max(dt, 1e-4);
    this.prevPos.copy(root.position);
    this.run = damp(this.run, Math.min(speed / 6, 1), 6, dt);
    const runHop = Math.abs(Math.sin(t * 13 + this.phase)) * 0.45 * this.run;

    // idle breathing
    const breathe = Math.sin(t * 2.3 + this.phase) * 0.018;
    const sq = s.squash * (1 + breathe);
    this.hop.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.hop.position.y = s.jumpY + s.introY + runHop;
    this.spinner.rotation.y = s.spin;
    this.spinner.rotation.x = s.flip;
    this.spinner.rotation.z += (Math.sin(t * 13 + this.phase) * 0.12 * this.run - this.spinner.rotation.z) * 0.1;

    // shadow reacts to height
    const h = this.hop.position.y;
    const k = 1 / (1 + h * 0.45);
    this.shadow.scale.set(2.1 * k, 1.7 * k, 1);
    this.shadow.material.opacity = Math.min(1, k * k) * (s.introY > 6 ? 0 : 1);

    // head looks at cursor
    tmp.setFromMatrixPosition(this.head.matrixWorld).project(camera);
    const tx = THREE.MathUtils.clamp((pointer.x - tmp.x) * 0.9, -0.7, 0.7) * s.look;
    const ty = THREE.MathUtils.clamp(-(pointer.y - tmp.y) * 0.7, -0.35, 0.35) * s.look;
    this.lookX = damp(this.lookX, tx, 6, dt);
    this.lookY = damp(this.lookY, ty, 6, dt);
    this.head.rotation.y = this.lookX;
    this.head.rotation.x = this.lookY;
    this.head.rotation.z = Math.sin(t * 1.3 + this.phase) * 0.04 - this.lookX * 0.12;

    // arms
    for (const a of this.arms) {
      const side = a.userData.side;
      const rest = 0.42 + Math.sin(t * 2.3 + this.phase) * 0.04;
      const up = 2.5 + Math.sin(t * 22) * 0.25;
      a.rotation.z = side * THREE.MathUtils.lerp(rest + this.run * Math.sin(t * 13 + side) * 0.4, up, s.wave);
    }
    // ears wobble (bunny ears flop more)
    for (const e of this.ears) {
      const amp = this.kind === 'usagi' ? 0.09 : 0.03;
      e.rotation.z = e.userData.base + Math.sin(t * 3 + this.phase + e.position.x) * amp - this.hop.position.y * 0.03 * Math.sign(e.position.x);
    }

    // blinking / expressions
    const now = performance.now();
    if (this.exprUntil && now > this.exprUntil) this.setExpression('open');
    if (!this.exprUntil) {
      this.nextBlink -= dt;
      if (this.nextBlink < 0) {
        this.setExpression('blink', 120);
        this.nextBlink = 2 + Math.random() * 3.5;
      }
    }
  }
}
