import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Character } from './Character.js';
import { SkyGame, GAME_Y } from './SkyGame.js';

// A product-photography studio: seamless cyclorama, softbox area lights, soft shadows, GTAO.

const WALL_Z = -5;

function cycloramaGeometry() {
  // profile in (z, y): floor → quarter-round cove → wall
  const pts = [];
  for (let z = 30; z > WALL_Z + 3; z -= 1) pts.push([z, 0]);
  const r = 3;
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 0.5;
    pts.push([WALL_Z + r - Math.sin(a) * r, r - Math.cos(a) * r]);
  }
  for (let y = r + 1; y <= 40; y += 1) pts.push([WALL_Z, y]);
  const W = 120;
  const pos = [];
  const idx = [];
  for (const [z, y] of pts) pos.push(-W / 2, y, z, W / 2, y, z);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function wallType(text, font) {
  const width = 2048, height = 512;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    g.clearRect(0, 0, width, height);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff';
    g.fillText(text, width / 2, height / 2 + 20);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);
  return tex;
}

const P = (x, z, ry = 0, s = 1) => ({ x, z, ry, s });

// per-stage set dressing: figure pose, camera, look-at, backdrop colour, wall type [hero, end]
// stages: hero, 360°, details, faces, game, ending
const WIDE = [
  { c: P(0, 0, 0), cam: [0, 1.9, 9.6], lk: [0, 1.6, 0], bg: '#ece6df', type: [1, 0] },
  { c: P(0, 0, 0), cam: [0, 2.3, 10.6], lk: [0, 2.65, 0], bg: '#efdfe0', type: [0, 0] },
  { c: P(0.75, 0, -0.3), cam: [0.1, 2.35, 4.9], lk: [0.6, 2.0, 0], bg: '#e6e3ec', type: [0, 0] },
  { c: P(1.5, 0, -0.32), cam: [0, 1.8, 9], lk: [0.4, 1.55, 0], bg: '#f1e4d6', type: [0, 0] },
  { c: P(-2.6, 0, 0.95, 0.55), cam: [0, GAME_Y + 1.2, 11], lk: [0, GAME_Y + 1.05, 0], bg: '#d9e5f0', type: [0, 0] },
  { c: P(-1.7, 0, 0.25), cam: [0, 1.9, 9.6], lk: [0, 1.6, 0], bg: '#ece6df', type: [0, 1] },
];
const NARROW = [
  { c: P(0, 0, 0), cam: [0, 2.3, 13.5], lk: [0, 2.0, 0], bg: '#ece6df', type: [1, 0] },
  { c: P(0, 0, 0), cam: [0, 1.4, 12.5], lk: [0, 0.6, 0], bg: '#efdfe0', type: [0, 0] },
  { c: P(0, 0, 0.18), cam: [0.3, 2.6, 6.2], lk: [0, 1.25, 0], bg: '#e6e3ec', type: [0, 0] },
  { c: P(0, 0, -0.2), cam: [0, 1.2, 12.5], lk: [0, 0.4, 0], bg: '#f1e4d6', type: [0, 0] },
  { c: P(-1.2, 0, 0.95, 0.55), cam: [0, GAME_Y + 1.5, 15], lk: [0, GAME_Y + 1.35, 0], bg: '#d9e5f0', type: [0, 0] },
  { c: P(0, 0, 0), cam: [0, 1.6, 14], lk: [0, 0.1, 0], bg: '#ece6df', type: [0, 1] },
];

const smooth = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, f) => a + (b - a) * f;
const v3 = new THREE.Vector3();
const n3 = new THREE.Vector3();
const c3 = new THREE.Vector3();
const bgA = new THREE.Color();
const bgB = new THREE.Color();
const SUN_OFFSET = new THREE.Vector3(3.5, 9, 5.5);

export class World {
  constructor(canvas) {
    RectAreaLightUniformsLib.init();
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    this.pr = Math.min(window.devicePixelRatio, 1.75);
    renderer.setPixelRatio(this.pr);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const scene = (this.scene = new THREE.Scene());
    this.bg = new THREE.Color('#ece6df');
    scene.background = this.bg;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    this.camTarget = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.lookGoal = new THREE.Vector3();

    // seamless backdrop
    this.backdropMat = new THREE.MeshStandardMaterial({ color: this.bg.clone(), roughness: 0.95 });
    const cyc = new THREE.Mesh(cycloramaGeometry(), this.backdropMat);
    cyc.receiveShadow = true;
    scene.add(cyc);

    // tone-on-tone type printed on the backdrop wall
    this.typeMats = [];
    for (const text of ['ちいかわ', 'またね。']) {
      const mat = new THREE.MeshStandardMaterial({ map: wallType(text, '900 380px "Zen Kaku Gothic New"'), transparent: true, opacity: 0, roughness: 1, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 3.6), mat);
      m.position.set(0, 3.25, WALL_Z + 0.02);
      m.receiveShadow = true;
      scene.add(m);
      this.typeMats.push(mat);
    }

    // lighting: big warm softbox key, cool fill, top rim, soft-shadow sun
    const key = new THREE.RectAreaLight('#fff6ee', 4.2, 9, 9);
    key.position.set(5, 6.5, 7);
    key.lookAt(0, 1.6, 0);
    const fill = new THREE.RectAreaLight('#eef3ff', 2.4, 4, 7);
    fill.position.set(-7, 3, 4);
    fill.lookAt(0, 1.5, 0);
    const rim = new THREE.RectAreaLight('#ffffff', 3.2, 8, 2);
    rim.position.set(-2, 6, -4.2);
    rim.lookAt(0, 2.2, 0);
    const sun = (this.sun = new THREE.DirectionalLight('#fff3ea', 1.1));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -7;
    sun.shadow.camera.right = sun.shadow.camera.top = 7;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    sun.shadow.radius = 14;
    sun.shadow.blurSamples = 20;
    sun.shadow.bias = -0.0005;
    const hemi = new THREE.HemisphereLight('#ffffff', '#d8cfc8', 0.55);
    scene.add(key, fill, rim, sun, sun.target, hemi);

    this.chiikawa = new Character();
    this.chiikawa.shadow.material.opacity = 0.55;
    scene.add(this.chiikawa.root);
    this.game = new SkyGame(this);
    this.GAME_STAGE = 4;

    // post: MSAA render target → GTAO → output (tone map + sRGB)
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.gtao = new GTAOPass(scene, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 16 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.gtao.blendIntensity = 0.9;
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());

    this.stage = 0;
    this.spin = 0; // turntable angle driven by scroll in the 360° chapter
    this.spinWeight = 0;
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.last = performance.now() / 1000;

    this.resize();
    this.applyStage(true);
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.narrow = w / h < 0.85;
    this.camera.fov = this.narrow ? 36 : 30;
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
    const c = this.chiikawa, t = c.target;
    t.x = lerp(A.c.x, B.c.x, f);
    t.z = lerp(A.c.z, B.c.z, f);
    t.ry = lerp(A.c.ry, B.c.ry, f);
    t.s = lerp(A.c.s, B.c.s, f);
    t.y = 0;
    this.camTarget.set(lerp(A.cam[0], B.cam[0], f), lerp(A.cam[1], B.cam[1], f), lerp(A.cam[2], B.cam[2], f));
    this.lookGoal.set(lerp(A.lk[0], B.lk[0], f), lerp(A.lk[1], B.lk[1], f), lerp(A.lk[2], B.lk[2], f));
    this.bg.copy(bgA.set(A.bg)).lerp(bgB.set(B.bg), f);
    this.typeMats[0].opacity = lerp(A.type[0], B.type[0], f) * 0.8;
    this.typeMats[1].opacity = lerp(A.type[1], B.type[1], f) * 0.8;
    if (snap) {
      c.root.position.set(t.x, 0, t.z);
      c.root.rotation.y = t.ry;
      this.camera.position.copy(this.camTarget);
      this.lookTarget.copy(this.lookGoal);
    }
    // turntable only while the 360° chapter is in focus; head holds still there and in the macro chapter
    this.spinWeight = 1 - Math.min(1, Math.abs(s - 1) * 2.2);
    const macro = 1 - Math.min(1, Math.abs(s - 2) * 2.2);
    c.s.look = Math.max(0, 1 - this.spinWeight - macro * 0.85);
  }

  pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.chiikawa.root, true);
    return hits.length && this.chiikawa.root.scale.x > 0.3 ? { type: 'character', point: hits[0].point } : null;
  }

  project(obj3d, offsetY = 0) {
    obj3d.getWorldPosition(v3);
    v3.y += offsetY;
    v3.project(this.camera);
    return { x: (v3.x * 0.5 + 0.5) * window.innerWidth, y: (-v3.y * 0.5 + 0.5) * window.innerHeight };
  }

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

  update(nowMs) {
    const t = nowMs / 1000;
    const dt = Math.min(0.05, Math.max(0.0001, t - this.last));
    this.last = t;
    this.applyStage();
    this.backdropMat.color.copy(this.bg);

    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 2.4);
    const par = this.stage > 1.5 && this.stage < 2.5 ? 0.1 : 0.35;
    cam.position.x += (this.camTarget.x + this.pointerSmooth.x * par - cam.position.x) * k;
    cam.position.y += (this.camTarget.y + this.pointerSmooth.y * par * 0.5 - cam.position.y) * k;
    cam.position.z += (this.camTarget.z - cam.position.z) * k;
    this.lookTarget.lerp(this.lookGoal, k);
    cam.lookAt(this.lookTarget);

    const c = this.chiikawa;
    // scroll-scrubbed turntable
    c.turnSpeed = 0;
    c.turn += (this.spin * this.spinWeight - c.turn) * (1 - Math.exp(-dt * 6));

    this.sun.target.position.copy(c.root.position);
    this.sun.position.copy(c.root.position).add(SUN_OFFSET);

    const gw = THREE.MathUtils.clamp(1 - Math.abs(this.stage - this.GAME_STAGE) * 2.2, 0, 1);
    this.game.update(t, dt, gw);
    c.update(t, dt, cam, this.pointer);

    this.composer.render();
  }
}
