import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTimeline, animate } from 'animejs';
import { vinyl, blobShadowTexture } from './materials.js';
import { faceSet } from './faces.js';

// Proportions measured from the vinyl figure reference:
// head ≈ 1.22 : 1 (w : h), body + legs ≈ 0.6 × head height, body ≈ 0.45 × head width.
const HEAD_Y = 2.15;
const HEAD_SCALE = new THREE.Vector3(1.07, 0.92, 1.0);

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Big soft ball, widest slightly below the middle, underside gently flattened.
function headGeometry() {
  let g = new THREE.SphereGeometry(1, 128, 96);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    // daifuku: widest in the lower third, rounder/narrower dome on top, flat-ish underside
    const k = 1 + 0.05 * Math.exp(-((y + 0.3) ** 2) * 3) - 0.04 * ss(0.3, 1, y);
    y = y * (1 - 0.12 * ss(-0.3, -1, y));
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

// Short body, a little wider at the bottom.
function bodyGeometry() {
  const pts = new THREE.SplineCurve([
    new THREE.Vector2(0.001, 0.31),
    new THREE.Vector2(0.36, 0.33),
    new THREE.Vector2(0.52, 0.47),
    new THREE.Vector2(0.555, 0.72),
    new THREE.Vector2(0.52, 1.0),
    new THREE.Vector2(0.45, 1.28),
    new THREE.Vector2(0.34, 1.5),
    new THREE.Vector2(0.001, 1.56),
  ]).getPoints(48);
  const g = new THREE.LatheGeometry(pts, 72);
  g.scale(1, 1, 0.86);
  return g;
}

const GEO = {
  sphere: new THREE.SphereGeometry(1, 48, 32),
  head: null,
  body: null,
  leg: new THREE.CapsuleGeometry(0.13, 0.22, 10, 24),
  arm: new THREE.CapsuleGeometry(0.115, 0.34, 10, 24),
  shadow: new THREE.PlaneGeometry(1, 1),
};

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const tmp = new THREE.Vector3();

export class Character {
  constructor() {
    GEO.head ??= headGeometry();
    GEO.body ??= bodyGeometry();

    this.faces = faceSet('chiikawa');
    this.phase = 0.7;

    this.root = new THREE.Group();
    this.root.userData.character = this;
    this.hop = new THREE.Group();
    this.spinner = new THREE.Group();
    this.root.add(this.hop);
    this.hop.add(this.spinner);

    const mat = vinyl('#ffffff');
    this.headMat = vinyl('#ffffff', { face: this.faces.open });
    const mesh = (geo, m = mat) => {
      const o = new THREE.Mesh(geo, m);
      o.castShadow = true;
      o.receiveShadow = true;
      return o;
    };

    this.spinner.add(mesh(GEO.body));

    this.legs = [];
    for (const s of [-1, 1]) {
      const leg = mesh(GEO.leg);
      leg.position.set(0.24 * s, 0.24, 0.02);
      this.legs.push(leg);
      this.spinner.add(leg);
    }
    const tail = mesh(GEO.sphere);
    tail.scale.setScalar(0.1);
    tail.position.set(0, 0.5, -0.47);
    this.spinner.add(tail);

    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.47 * s, 1.24, 0.04);
      pivot.rotation.y = -0.15 * s;
      const arm = mesh(GEO.arm);
      arm.position.y = -0.29;
      pivot.add(arm);
      pivot.userData.side = s;
      this.arms.push(pivot);
      this.spinner.add(pivot);
    }

    this.head = new THREE.Group();
    this.head.position.y = HEAD_Y;
    this.spinner.add(this.head);
    const head = mesh(GEO.head, this.headMat);
    head.scale.copy(HEAD_SCALE);
    this.head.add(head);

    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = mesh(GEO.sphere);
      ear.position.set(0.6 * s, 0.8, 0.0);
      ear.scale.set(0.2, 0.19, 0.16);
      ear.rotation.z = -0.6 * s;
      ear.userData.base = ear.rotation.z;
      this.ears.push(ear);
      this.head.add(ear);
    }

    // anchors for the anatomy call-outs (face-space → head surface)
    const onHead = (fx, fy) => {
      const z = Math.sqrt(Math.max(0, 1 - fx * fx - fy * fy));
      const v = new THREE.Vector3(fx, fy, z).multiply(HEAD_SCALE);
      const o = new THREE.Object3D();
      o.position.copy(v);
      o.userData.normal = new THREE.Vector3(fx, fy, z).normalize();
      this.head.add(o);
      return o;
    };
    const at = (parent, x, y, z, n) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.userData.normal = n;
      parent.add(o);
      return o;
    };
    this.anchors = {
      ear: at(this.ears[1], 0, 1, 0, new THREE.Vector3(0.4, 0.9, 0.2).normalize()),
      eye: onHead(-0.33, -0.07),
      cheek: onHead(0.58, -0.33),
      mouth: onHead(0, -0.42),
      arm: at(this.arms[0], 0, -0.4, 0.06, new THREE.Vector3(-0.6, 0, 0.8).normalize()),
      leg: at(this.legs[1], 0.05, -0.08, 0.12, new THREE.Vector3(0.3, 0, 1).normalize()),
    };

    this.shadow = new THREE.Mesh(
      GEO.shadow,
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.shadow.scale.set(1.9, 1.5, 1);
    this.root.add(this.shadow);

    this.s = { jumpY: 0, introY: 0, squash: 1, spin: 0, wave: 0, look: 1 };
    this.target = { x: 0, y: 0, z: 0, ry: 0, s: 1 };
    this.turn = 0;
    this.turnSpeed = 0;
    this.busy = false;
    this.nextBlink = 2;
    this.exprUntil = 0;
    this.locked = null; // forced expression from UI
    this.prevPos = new THREE.Vector3();
    this.run = 0;
    this.lookX = 0;
    this.lookY = 0;
  }

  setExpression(expr, ms = 0) {
    this.headMat.userData.uniforms.uFace.value = this.faces[expr];
    this.exprUntil = ms ? performance.now() + ms : 0;
  }

  lock(expr) {
    this.locked = expr;
    this.setExpression(expr || 'open');
  }

  jump({ height = 1.0, spins = 0, expr = null } = {}) {
    if (this.busy) return;
    this.busy = true;
    const s = this.s;
    if (expr) this.setExpression(expr, 1100);
    const tl = createTimeline({ onComplete: () => (this.busy = false) });
    tl.add(s, { squash: 0.74, duration: 140, ease: 'outQuad' }, 0)
      .add(s, { jumpY: height, duration: 360, ease: 'outCubic' }, 140)
      .add(s, { squash: 1.16, duration: 180, ease: 'outQuad' }, 140)
      .add(s, { squash: 1, duration: 240, ease: 'inOutQuad' }, 320)
      .add(s, { jumpY: 0, duration: 320, ease: 'inQuad' }, 500)
      .add(s, { squash: 0.78, duration: 100, ease: 'outQuad' }, 820)
      .add(s, { squash: 1, duration: 600, ease: 'outElastic(1, .4)' }, 920)
      .add(s, { wave: 1, duration: 280, ease: 'outBack' }, 140)
      .add(s, { wave: 0, duration: 500, ease: 'inOutQuad' }, 760);
    if (spins) tl.add(s, { spin: s.spin + spins * Math.PI * 2, duration: 700, ease: 'inOutCubic' }, 140);
    return tl;
  }

  shake() {
    animate(this.spinner.rotation, { z: [0, 0.16, -0.14, 0.1, -0.06, 0.03, 0], duration: 700, ease: 'inOutSine' });
  }

  update(t, dt, camera, pointer) {
    const { root, s, target } = this;
    root.position.x = damp(root.position.x, target.x, 4, dt);
    root.position.y = damp(root.position.y, target.y, 4, dt);
    root.position.z = damp(root.position.z, target.z, 4, dt);
    root.rotation.y = damp(root.rotation.y, target.ry, 4.5, dt);
    const sc = damp(root.scale.x, target.s, 4.5, dt);
    root.scale.setScalar(Math.max(sc, 0.0001));
    root.visible = sc > 0.01;

    const speed = this.prevPos.distanceTo(root.position) / Math.max(dt, 1e-4);
    this.prevPos.copy(root.position);
    this.run = damp(this.run, Math.min(speed / 7, 1), 6, dt);
    const runHop = Math.abs(Math.sin(t * 12)) * 0.3 * this.run;

    const breathe = Math.sin(t * 2.2) * 0.014;
    const sq = s.squash * (1 + breathe);
    this.hop.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.hop.position.y = s.jumpY + s.introY + runHop;
    this.turn += this.turnSpeed * dt;
    this.spinner.rotation.y = s.spin + this.turn;
    this.spinner.rotation.z += (Math.sin(t * 12) * 0.08 * this.run - this.spinner.rotation.z) * 0.1;

    const h = this.hop.position.y;
    const k = 1 / (1 + h * 0.5);
    this.shadow.scale.set(1.9 * k, 1.5 * k, 1);
    this.shadow.material.opacity = Math.min(1, k * k) * (s.introY > 6 ? 0 : 1);

    tmp.setFromMatrixPosition(this.head.matrixWorld).project(camera);
    const tx = THREE.MathUtils.clamp((pointer.x - tmp.x) * 0.8, -0.6, 0.6) * s.look;
    const ty = THREE.MathUtils.clamp(-(pointer.y - tmp.y) * 0.6, -0.3, 0.3) * s.look;
    this.lookX = damp(this.lookX, tx, 5, dt);
    this.lookY = damp(this.lookY, ty, 5, dt);
    this.head.rotation.y = this.lookX;
    this.head.rotation.x = this.lookY;
    this.head.rotation.z = Math.sin(t * 1.2) * 0.03 - this.lookX * 0.1;

    for (const a of this.arms) {
      const side = a.userData.side;
      const rest = 0.68 + Math.sin(t * 2.2) * 0.03;
      const up = 2.4 + Math.sin(t * 22) * 0.22;
      a.rotation.z = side * THREE.MathUtils.lerp(rest + this.run * Math.sin(t * 12 + side) * 0.35, up, s.wave);
    }
    for (const e of this.ears) e.rotation.z = e.userData.base + Math.sin(t * 2.6 + e.position.x) * 0.03;

    const now = performance.now();
    if (this.exprUntil && now > this.exprUntil) this.setExpression(this.locked || 'open');
    if (!this.exprUntil && !this.locked) {
      this.nextBlink -= dt;
      if (this.nextBlink < 0) {
        this.setExpression('blink', 120);
        this.nextBlink = 2 + Math.random() * 3.5;
      }
    }
  }
}
