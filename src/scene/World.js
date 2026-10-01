import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './Character.js';
import { Mochi } from './Mochi.js';
import { SkyGame } from './SkyGame.js';

const P = (x, y, z, ry = 0, s = 1) => ({ x, y, z, ry, s });
const HIDDEN = P(0, -1, -2, 0, 0);

// Scroll stages: hero → statement → profile → anatomy → mochi → sky game → finale
// turn: turntable speed (rad/s), look: how much the head follows the cursor
const WIDE = [
  { c: P(0, -1.25, 0.6, 0, 1.0), m: HIDDEN, cam: [0, 1.3, 11], turn: 0, look: 1 },
  { c: P(3.9, -1.45, 0.4, -0.55, 0.78), m: HIDDEN, cam: [0, 1.3, 11], turn: 0, look: 1 },
  { c: P(2.75, -1.3, 1.2, -0.38, 1.18), m: HIDDEN, cam: [0, 1.25, 11], turn: 0, look: 1 },
  { c: P(0, -1.35, 1.0, 0, 1.16), m: HIDDEN, cam: [0, 1.25, 11], turn: 0.55, look: 0 },
  { c: P(-4.4, -1.1, -0.8, 0.55, 0.68), m: P(0.3, -0.95, 0.6, 0, 1.5), cam: [0, 1.1, 11], turn: 0, look: 1 },
  { c: P(-2.6, 1.0, 0.4, 0.95, 0.55), m: HIDDEN, cam: [0, 1.2, 11], turn: 0, look: 0 },
  { c: P(0, -1.5, 1.3, 0, 0.98), m: HIDDEN, cam: [0, 1.3, 11], turn: 0, look: 1 },
];
const NARROW = [
  { c: P(0, -1.7, 0.6, 0, 1.12), m: HIDDEN, cam: [0, 1.3, 15], turn: 0, look: 1 },
  { c: P(1.5, -4.4, 0.6, -0.35, 0.95), m: HIDDEN, cam: [0, 1.3, 15], turn: 0, look: 1 },
  { c: P(0, 1.35, 0.4, -0.25, 1.0), m: HIDDEN, cam: [0, 1.4, 15], turn: 0, look: 1 },
  { c: P(0, -0.4, 0.5, 0, 1.2), m: HIDDEN, cam: [0, 1.3, 15], turn: 0.55, look: 0 },
  { c: P(-1.9, -4.3, 0, 0.4, 0.62), m: P(0, -0.5, 0.4, 0, 1.12), cam: [0, 0.9, 15], turn: 0, look: 1 },
  { c: P(-1.2, 1.0, 0.4, 0.95, 0.55), m: HIDDEN, cam: [0, 1.5, 15], turn: 0, look: 0 },
  { c: P(0, -1.3, 1, 0, 1.0), m: HIDDEN, cam: [0, 1.3, 15], turn: 0, look: 1 },
];

const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, f) => a + (b - a) * f;
const v3 = new THREE.Vector3();
const n3 = new THREE.Vector3();
const c3 = new THREE.Vector3();

export class World {
  constructor(canvas) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 1.3, 11);
    this.camTarget = new THREE.Vector3(0, 1.3, 11);
    this.lookTarget = new THREE.Vector3();

    // studio light: warm key with soft shadows, cool rim, pink bounce
    const hemi = new THREE.HemisphereLight('#fffaf5', '#e9d6d6', 1.15);
    const key = (this.key = new THREE.DirectionalLight('#fff4ec', 2.3));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -4;
    key.shadow.camera.right = key.shadow.camera.top = 4;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 6;
    const rim = new THREE.DirectionalLight('#dfe8ff', 1.4);
    rim.position.set(-6, 5, -7);
    const bounce = new THREE.DirectionalLight('#ffd9e1', 0.45);
    bounce.position.set(-4, -2, 6);
    this.scene.add(hemi, key, key.target, rim, bounce);
    this.keyOffset = new THREE.Vector3(4, 8, 7);
    this.keyDir = this.keyOffset.clone().normalize();

    this.chiikawa = new Character();
    this.scene.add(this.chiikawa.root);
    this.mochi = new Mochi();
    this.scene.add(this.mochi.root);
    this.game = new SkyGame(this);
    this.GAME_STAGE = 5;

    this.stage = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.last = performance.now() / 1000;
    this.party = false;
    this.partyClock = 0;

    this.resize();
    this.applyStage(true);
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.narrow = w / h < 0.85;
    this.camera.fov = this.narrow ? 38 : 32;
    this.camera.updateProjectionMatrix();
  }

  setPointer(x, y) {
    this.pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  }

  applyStage(snap = false) {
    const table = this.narrow ? NARROW : WIDE;
    const max = table.length - 1;
    const s = THREE.MathUtils.clamp(this.stage, 0, max);
    const i = Math.min(Math.floor(s), max - 1);
    const f = smooth(THREE.MathUtils.clamp(s - i, 0, 1));
    const A = table[i], B = table[i + 1];
    for (const [key, obj] of [['c', this.chiikawa], ['m', this.mochi]]) {
      const a = A[key], b = B[key], t = obj.target;
      for (const k of ['x', 'y', 'z', 'ry', 's']) t[k] = lerp(a[k], b[k], f);
      if (snap) {
        obj.root.position.set(t.x, t.y, t.z);
        obj.root.rotation.y = t.ry;
        obj.root.scale.setScalar(Math.max(t.s, 0.0001));
      }
    }
    this.camTarget.set(lerp(A.cam[0], B.cam[0], f), lerp(A.cam[1], B.cam[1], f), lerp(A.cam[2], B.cam[2], f));
    const c = this.chiikawa;
    c.turnSpeed = lerp(A.turn, B.turn, f);
    c.s.look = lerp(A.look, B.look, f);
    // settle the turntable back to facing front outside the anatomy stage
    if (c.turnSpeed < 0.05) {
      const front = Math.round(c.turn / (Math.PI * 2)) * Math.PI * 2;
      c.turn += (front - c.turn) * 0.04;
    }
    this.party = s > max - 0.3;
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.mochi.proxy, this.chiikawa.root], true);
    for (const h of hits) {
      if (h.object === this.mochi.proxy) {
        if (this.mochi.root.scale.x < 0.5) continue;
        return { type: 'mochi', point: h.point };
      }
      if (this.chiikawa.root.scale.x > 0.3) return { type: 'character', point: h.point };
    }
    return null;
  }

  project(obj3d, offsetY = 0) {
    obj3d.getWorldPosition(v3);
    v3.y += offsetY;
    v3.project(this.camera);
    return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight };
  }

  // screen position + facing (-1..1) of each anatomy anchor
  anchors() {
    const out = {};
    for (const [name, o] of Object.entries(this.chiikawa.anchors)) {
      o.getWorldPosition(v3);
      n3.copy(o.userData.normal).transformDirection(o.parent.matrixWorld);
      const facing = n3.dot(c3.copy(this.camera.position).sub(v3).normalize());
      v3.project(this.camera);
      out[name] = { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight, facing };
    }
    return out;
  }

  // bounding circle (screen px) of the character or the mochi, for the CSS backdrop disc
  focusCircle(which) {
    const obj = which === 'mochi' ? this.mochi.root : this.chiikawa.root;
    const s = obj.scale.x;
    const bottom = this.project(obj, 0);
    const top = this.project(obj, (which === 'mochi' ? 1.5 : 2.9) * s);
    return { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2, r: Math.abs(bottom.y - top.y) * 0.64 };
  }

  update(nowMs) {
    const t = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0.0001, t - this.last));
    this.last = t;
    this.applyStage();

    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 3);
    cam.position.x += (this.camTarget.x + this.pointerSmooth.x * 0.45 - cam.position.x) * k;
    cam.position.y += (this.camTarget.y + this.pointerSmooth.y * 0.25 - cam.position.y) * k;
    cam.position.z += (this.camTarget.z - cam.position.z) * k;
    this.lookTarget.set(this.pointerSmooth.x * 0.1, this.camTarget.y - 0.15, 0);
    cam.lookAt(this.lookTarget);

    // shadow frustum follows the character
    const root = this.chiikawa.root.position;
    this.key.target.position.copy(root);
    this.key.position.copy(root).add(this.keyOffset);

    const gw = THREE.MathUtils.clamp(1 - Math.abs(this.stage - this.GAME_STAGE) * 2.2, 0, 1);
    this.game.update(t, dt, gw);
    this.chiikawa.update(t, dt, cam, this.pointer);
    this.mochi.update(t, dt, cam, this.keyDir);

    if (this.party) {
      this.partyClock -= dt;
      if (this.partyClock < 0) {
        this.chiikawa.jump({ height: 0.7 + Math.random() * 0.6, spins: Math.random() < 0.3 ? 1 : 0 });
        this.partyClock = 1.4 + Math.random() * 1.2;
      }
    }

    this.renderer.render(this.scene, cam);
  }
}
