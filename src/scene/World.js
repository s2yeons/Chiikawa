import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './Character.js';
import { Mochi } from './Mochi.js';
import { SkyGame, GAME_Y } from './SkyGame.js';
import { Meadow, groundY } from './Meadow.js';

const G = null; // "stand on the hill"
const P = (x, y, z, ry = 0, s = 1) => ({ x, y, z, ry, s });
const HIDDEN = P(0, G, -2, 0, 0);

// Story stages: morning hero → noon profile → afternoon weeding → pink dusk mochi → sunset sky game → night
const WIDE = [
  { c: P(0, G, 1.0, 0, 1.0), m: HIDDEN, cam: [0, 1.25, 11], lk: 1.3 },
  { c: P(2.7, G, 1.2, -0.4, 1.1), m: HIDDEN, cam: [0, 1.1, 11], lk: 0.95 },
  { c: P(1.3, G, 1.0, -0.25, 0.86), m: HIDDEN, cam: [0.9, 2.9, 10.5], lk: 0.2 },
  { c: P(-4.4, G, -0.6, 0.55, 0.7), m: P(0.5, G, 0.6, 0, 1.5), cam: [0, 0.9, 11], lk: 0.6 },
  { c: P(-2.6, GAME_Y + 1, 0.4, 0.95, 0.55), m: HIDDEN, cam: [0, GAME_Y + 1.2, 11], lk: GAME_Y + 1.05 },
  { c: P(0, G, 1.2, 0, 0.9), m: HIDDEN, cam: [0, 1.4, 11], lk: 1.75 },
];
const NARROW = [
  { c: P(0, G, 0.6, 0, 1.05), m: HIDDEN, cam: [0, 1.7, 15], lk: 1.5 },
  { c: P(0, G, 0.8, -0.2, 0.95), m: HIDDEN, cam: [0, -0.1, 15], lk: -0.5 },
  { c: P(0.4, G, 0.6, -0.2, 0.8), m: HIDDEN, cam: [0.8, 2.6, 12], lk: -0.6 },
  { c: P(-1.9, G, -1.5, 0.4, 0.6), m: P(0.3, G, 0.8, 0, 1.1), cam: [0, 0.6, 15], lk: 0.1 },
  { c: P(-1.2, GAME_Y + 1, 0.4, 0.95, 0.55), m: HIDDEN, cam: [0, GAME_Y + 1.5, 15], lk: GAME_Y + 1.35 },
  { c: P(0, G, 0.8, 0, 1.0), m: HIDDEN, cam: [0, 0.7, 15], lk: 0.3 },
];

// time-of-day lighting per stage
const C = (h) => new THREE.Color(h);
const LIGHT = [
  { sky: C('#ffffff'), gnd: C('#cfe6c0'), hemi: 1.1, key: C('#fff6e8'), keyI: 2.2, env: 0.5, cloud: C('#ffffff'), glow: C('#dfe9ff'), ground: C('#8fcf6e'), night: 0 },
  { sky: C('#ffffff'), gnd: C('#d3ebc2'), hemi: 1.15, key: C('#fffaf0'), keyI: 2.3, env: 0.5, cloud: C('#ffffff'), glow: C('#e4eeff'), ground: C('#93d271'), night: 0 },
  { sky: C('#fff8ec'), gnd: C('#d7e6b8'), hemi: 1.1, key: C('#fff0d6'), keyI: 2.3, env: 0.5, cloud: C('#fffaf0'), glow: C('#ffe9c9'), ground: C('#8fcc6c'), night: 0 },
  { sky: C('#ffe9f2'), gnd: C('#e8c8d6'), hemi: 1.1, key: C('#ffdbe5'), keyI: 2.0, env: 0.45, cloud: C('#fff1f6'), glow: C('#ffcfe0'), ground: C('#a3cc84'), night: 0 },
  { sky: C('#ffe4cf'), gnd: C('#e0aaa8'), hemi: 1.05, key: C('#ffc190'), keyI: 2.1, env: 0.45, cloud: C('#ffe6d4'), glow: C('#ffb79c'), ground: C('#8fb86c'), night: 0 },
  { sky: C('#d4dbff'), gnd: C('#4a4a80'), hemi: 1.2, key: C('#dfe4ff'), keyI: 1.3, env: 0.35, cloud: C('#8e98c8'), glow: C('#3a4478'), ground: C('#3f6a5a'), night: 1 },
];

const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, f) => a + (b - a) * f;
const v3 = new THREE.Vector3();

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
    this.scene.fog = new THREE.Fog('#dff1ff', 26, 70);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.camera.position.set(0, 1.0, 11);
    this.camTarget = new THREE.Vector3(0, 1.0, 11);
    this.lookY = 0.85;
    this.lookTarget = new THREE.Vector3(0, 0.85, 0);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#cfe6c0', 1.1);
    const key = (this.key = new THREE.DirectionalLight('#fff6e8', 2.2));
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -6;
    key.shadow.camera.right = key.shadow.camera.top = 6;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 40;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    key.shadow.radius = 5;
    const rim = new THREE.DirectionalLight('#e3ecff', 1.2);
    rim.position.set(-6, 5, -7);
    this.scene.add(this.hemi, key, key.target, rim);
    this.keyOffset = new THREE.Vector3(4, 9, 7);
    this.keyDir = this.keyOffset.clone().normalize();

    this.meadow = new Meadow(this.scene);
    this.chiikawa = new Character();
    this.scene.add(this.chiikawa.root);
    this.mochi = new Mochi();
    this.scene.add(this.mochi.root);
    this.game = new SkyGame(this);
    this.GAME_STAGE = 4;

    const L0 = LIGHT[0];
    this.look = {
      sky: L0.sky.clone(), gnd: L0.gnd.clone(), key: L0.key.clone(), cloud: L0.cloud.clone(), glow: L0.glow.clone(), ground: L0.ground.clone(),
      cloudGlow: new THREE.Color(), hemi: 1, keyI: 1, env: 0.5, night: 0, weeds: 0,
    };

    this.stage = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.last = performance.now() / 1000;
    this.party = false;

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
      for (const k of ['x', 'z', 'ry', 's']) t[k] = lerp(a[k], b[k], f);
      // stay on the hill while walking between grounded poses
      if (a.y === null && b.y === null) t.y = groundY(t.x, t.z);
      else t.y = lerp(a.y ?? groundY(a.x, a.z), b.y ?? groundY(b.x, b.z), f);
      if (snap) {
        obj.root.position.set(t.x, t.y, t.z);
        obj.root.rotation.y = t.ry;
        obj.root.scale.setScalar(Math.max(t.s, 0.0001));
      }
    }
    this.camTarget.set(lerp(A.cam[0], B.cam[0], f), lerp(A.cam[1], B.cam[1], f), lerp(A.cam[2], B.cam[2], f));
    this.lookY = lerp(A.lk, B.lk, f);
    if (snap) {
      this.camera.position.copy(this.camTarget);
      this.lookTarget.set(0, this.lookY, 0);
    }

    const LA = LIGHT[i], LB = LIGHT[i + 1], L = this.look;
    for (const k of ['sky', 'gnd', 'key', 'cloud', 'glow', 'ground']) L[k].copy(LA[k]).lerp(LB[k], f);
    for (const k of ['hemi', 'keyI', 'env', 'night']) L[k] = lerp(LA[k], LB[k], f);
    L.cloudGlow.copy(L.glow);
    L.weeds = 1 - Math.min(1, Math.abs(s - 2) * 2.5);
    this.party = s > max - 0.3;
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const weeds = this.look.weeds > 0.5 ? this.meadow.weeds.filter((w) => w.visible && !w.userData.pulled) : [];
    const hits = this.raycaster.intersectObjects([this.mochi.proxy, this.chiikawa.root, ...weeds], true);
    for (const h of hits) {
      if (h.object.userData.weed) return { type: 'weed', obj: h.object, point: h.point };
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

  update(nowMs) {
    const t = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0.0001, t - this.last));
    this.last = t;
    this.applyStage();

    const L = this.look;
    this.hemi.color.copy(L.sky);
    this.hemi.groundColor.copy(L.gnd);
    this.hemi.intensity = L.hemi;
    this.key.color.copy(L.key);
    this.key.intensity = L.keyI;
    this.scene.environmentIntensity = L.env;
    this.scene.fog.color.copy(L.cloud).lerp(L.glow, 0.6);

    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 2.6);
    cam.position.x += (this.camTarget.x + this.pointerSmooth.x * 0.45 - cam.position.x) * k;
    cam.position.y += (this.camTarget.y + this.pointerSmooth.y * 0.25 - cam.position.y) * k;
    cam.position.z += (this.camTarget.z - cam.position.z) * k;
    this.lookTarget.x += (this.pointerSmooth.x * 0.1 + this.camTarget.x * 0.6 - this.lookTarget.x) * k;
    this.lookTarget.y += (this.lookY - this.lookTarget.y) * k;
    cam.lookAt(this.lookTarget);

    const root = this.chiikawa.root.position;
    this.key.target.position.copy(root);
    this.key.position.copy(root).add(this.keyOffset);

    const gw = THREE.MathUtils.clamp(1 - Math.abs(this.stage - this.GAME_STAGE) * 2.2, 0, 1);
    this.game.update(t, dt, gw);
    this.meadow.update(t, dt, L);
    this.chiikawa.update(t, dt, cam, this.pointer);
    this.mochi.update(t, dt, cam, this.keyDir);

    this.renderer.render(this.scene, cam);
  }
}
