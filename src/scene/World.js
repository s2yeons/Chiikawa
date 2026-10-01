import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character } from './Character.js';
import { Mochi } from './Mochi.js';
import { Particles } from './Particles.js';

const P = (x, y, z, ry = 0, s = 1) => ({ x, y, z, ry, s });
const CAST = ['chiikawa', 'hachiware', 'usagi', 'mochi'];

// One pose table per scroll "stage" (hero → 3 characters → friends → playground → finale).
const WIDE = [
  { chiikawa: P(0, -0.95, 0.8, 0, 1.0), hachiware: P(-2.9, -0.95, -0.2, 0.35, 0.95), usagi: P(2.9, -0.95, -0.2, -0.35, 0.95), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.25, 11] },
  { chiikawa: P(2.6, -0.8, 1.4, -0.35, 1.3), hachiware: P(5.9, -0.8, -5, -0.6), usagi: P(8.2, -0.8, -6.5, -0.6), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.2, 11] },
  { chiikawa: P(-6.2, -0.8, -5, 0.6), hachiware: P(-2.6, -0.8, 1.4, 0.35, 1.3), usagi: P(-8.4, -0.8, -6.5, 0.6), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.2, 11] },
  { chiikawa: P(6.0, -0.8, -5, -0.6), hachiware: P(8.3, -0.8, -6.5, -0.6), usagi: P(2.6, -0.8, 1.4, -0.35, 1.25), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.3, 11] },
  { chiikawa: P(-1.6, -4.0, 2.4, 0.15), hachiware: P(-4.6, -4.2, 1.2, 0.3), usagi: P(1.7, -4.0, 2.4, -0.2), mochi: P(0, -4, -2, 0, 0), cam: [0, 1.3, 11] },
  { chiikawa: P(-4.3, -0.9, -0.6, 0.55, 0.72), hachiware: P(4.1, -0.9, -0.6, -0.55, 0.72), usagi: P(5.9, -0.9, -2.6, -0.6, 0.72), mochi: P(0, -0.85, 0.6, 0, 1.55), cam: [0, 1.0, 11] },
  { chiikawa: P(0, -1.45, 1.4, 0, 0.92), hachiware: P(-2.7, -1.45, 0.6, 0.3, 0.84), usagi: P(2.7, -1.45, 0.6, -0.3, 0.84), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.3, 11.5] },
];

const NARROW = [
  { chiikawa: P(0, -0.2, 0.8, 0, 0.95), hachiware: P(-1.75, -0.6, -1.2, 0.35, 0.8), usagi: P(1.75, -0.6, -1.2, -0.35, 0.8), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.3, 14] },
  { chiikawa: P(0, 1.9, 0.5, -0.2, 1.0), hachiware: P(3.6, 1.0, -7, -0.6), usagi: P(5.2, 1.0, -8, -0.6), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.4, 14] },
  { chiikawa: P(-3.8, 1.0, -7, 0.6), hachiware: P(0, 1.9, 0.5, 0.2, 1.0), usagi: P(-5.2, 1.0, -8, 0.6), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.4, 14] },
  { chiikawa: P(3.8, 1.0, -7, -0.6), hachiware: P(5.2, 1.0, -8, -0.6), usagi: P(0, 1.6, 0.5, -0.2, 0.95), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.4, 14] },
  { chiikawa: P(-1.1, -5.6, 2.4, 0.15, 0.9), hachiware: P(-3.1, -5.7, 1.2, 0.3, 0.9), usagi: P(1.2, -5.6, 2.4, -0.2, 0.9), mochi: P(0, -4, -2, 0, 0), cam: [0, 1.3, 14] },
  { chiikawa: P(-1.9, -4.3, 1.0, 0.4, 0.6), hachiware: P(1.9, -4.3, 1.0, -0.4, 0.6), usagi: P(0, -4.6, -1.5, 0, 0.6), mochi: P(0, -0.1, 0.4, 0, 1.15), cam: [0, 0.9, 14] },
  { chiikawa: P(0, -0.3, 1.0, 0, 0.9), hachiware: P(-1.8, -0.5, 0, 0.3, 0.78), usagi: P(1.8, -0.5, 0, -0.3, 0.78), mochi: P(0, -0.7, -2, 0, 0), cam: [0, 1.3, 14.5] },
];

const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, f) => a + (b - a) * f;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 1.3, 11);
    this.camTarget = new THREE.Vector3(0, 1.3, 11);
    this.lookTarget = new THREE.Vector3(0, 1.1, 0);

    // studio lighting: warm key, cool rim, soft sky fill
    const hemi = new THREE.HemisphereLight('#fff7f2', '#f3c9d4', 1.1);
    const key = new THREE.DirectionalLight('#fff3ea', 2.1);
    key.position.set(4, 7, 8);
    const rim = new THREE.DirectionalLight('#cfe0ff', 1.6);
    rim.position.set(-6, 4, -6);
    const fill = new THREE.DirectionalLight('#ffd9e4', 0.6);
    fill.position.set(-5, -1, 6);
    this.scene.add(hemi, key, rim, fill);
    this.keyDir = key.position.clone().normalize();

    this.chars = {
      chiikawa: new Character('chiikawa'),
      hachiware: new Character('hachiware'),
      usagi: new Character('usagi'),
    };
    for (const c of Object.values(this.chars)) this.scene.add(c.root);
    this.mochi = new Mochi();
    this.scene.add(this.mochi.root);
    this.particles = new Particles();
    this.scene.add(this.particles.group);

    this.stage = 0;
    this.scroll = 0;
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSmooth = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
    this.hover = null;
    this.last = performance.now() / 1000;
    this.party = false;
    this.partyClock = 0;

    // snap poses to stage 0 on boot
    this.applyStage(true);
    this.resize();
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
    for (const key of CAST) {
      const obj = key === 'mochi' ? this.mochi : this.chars[key];
      const a = A[key], b = B[key], t = obj.target;
      t.x = lerp(a.x, b.x, f);
      t.y = lerp(a.y, b.y, f);
      t.z = lerp(a.z, b.z, f);
      t.ry = lerp(a.ry, b.ry, f);
      t.s = lerp(a.s, b.s, f);
      if (snap) {
        obj.root.position.set(t.x, t.y, t.z);
        obj.root.rotation.y = t.ry;
        obj.root.scale.setScalar(Math.max(t.s, 0.0001));
      }
    }
    this.camTarget.set(lerp(A.cam[0], B.cam[0], f), lerp(A.cam[1], B.cam[1], f), lerp(A.cam[2], B.cam[2], f));
    this.party = s > max - 0.35;
  }

  // returns { type: 'character'|'mochi', obj, point } or null
  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [this.mochi.proxy, ...Object.values(this.chars).map((c) => c.root)];
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      if (h.object === this.mochi.proxy) {
        if (this.mochi.root.scale.x < 0.5) continue;
        return { type: 'mochi', obj: this.mochi, point: h.point };
      }
      let o = h.object;
      while (o && !o.userData.character) o = o.parent;
      if (o && o.visible && o.scale.x > 0.3) return { type: 'character', obj: o.userData.character, point: h.point };
    }
    return null;
  }

  screenPos(obj3d, offsetY = 0) {
    const v = new THREE.Vector3();
    obj3d.getWorldPosition(v);
    v.y += offsetY;
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  update(nowMs) {
    const t = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0.0001, t - this.last));
    this.last = t;
    this.applyStage();

    // camera: damped follow + pointer parallax
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 4));
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 3);
    cam.position.x += (this.camTarget.x + this.pointerSmooth.x * 0.6 - cam.position.x) * k;
    cam.position.y += (this.camTarget.y + this.pointerSmooth.y * 0.35 - cam.position.y) * k;
    cam.position.z += (this.camTarget.z - cam.position.z) * k;
    this.lookTarget.set(this.pointerSmooth.x * 0.15, this.camTarget.y - 0.15, 0);
    cam.lookAt(this.lookTarget);

    for (const c of Object.values(this.chars)) c.update(t, dt, cam, this.pointer);
    this.mochi.update(t, dt, cam, this.keyDir);
    this.particles.update(t, dt, this.scroll);

    if (this.party) {
      this.partyClock -= dt;
      if (this.partyClock < 0) {
        const list = Object.values(this.chars);
        const c = list[Math.floor(Math.random() * list.length)];
        c.jump({ height: 0.9 + Math.random() * 0.8, spins: Math.random() < 0.35 ? 1 : 0, expr: Math.random() < 0.3 ? 'blink' : null });
        this.partyClock = 0.35 + Math.random() * 0.6;
      }
    }

    this.renderer.render(this.scene, cam);
  }
}
