import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { animate, createTimeline } from 'animejs';

// Chiikawa's little world: a round grassy hill, swaying grass, flowers, drifting clouds,
// weeds to pull, and a night layer of stars + fireflies.

export const GROUND_Y = -1.3;
const R = 46; // hill radius
const PETAL_COLORS = ['#ffd0dc', '#ffc0d1', '#ffe4ec', '#ffb3c8', '#fff3f6'];
const HILL_C = new THREE.Vector3(0, GROUND_Y - R, 0);
const rand = (a, b) => a + Math.random() * (b - a);

// height of the hill surface at (x, z)
export function groundY(x, z) {
  return HILL_C.y + Math.sqrt(Math.max(0, R * R - x * x - z * z));
}

const windChunk = /* glsl */ `
  uniform float uTime;
  uniform float uWind;
`;

function addWind(mat, strength = 1) {
  const uniforms = { uTime: { value: 0 }, uWind: { value: strength } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${windChunk}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float h = max(position.y, 0.0);
          float w = sin(uTime * 1.6 + ip.x * 0.45 + ip.z * 0.3) * 0.5 + sin(uTime * 2.7 + ip.x * 1.3) * 0.25;
          transformed.x += w * h * h * 0.55 * uWind;
          transformed.z += cos(uTime * 1.3 + ip.z * 0.5) * h * h * 0.18 * uWind;
        }`
      );
  };
  return uniforms;
}

function bladeGeometry() {
  // tapered, slightly bent blade; colour gradient baked into vertex colours
  const g = new THREE.PlaneGeometry(0.07, 0.42, 1, 4);
  const p = g.attributes.position;
  const col = [];
  const base = new THREE.Color('#5fae5a');
  const tip = new THREE.Color('#c8ef9a');
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.21; // 0..0.42
    const t = y / 0.42;
    p.setX(i, p.getX(i) * (1 - t * 0.92));
    p.setY(i, y);
    p.setZ(i, t * t * 0.08);
    const c = base.clone().lerp(tip, t);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function flowerGeometry() {
  const parts = [];
  const petal = new THREE.SphereGeometry(0.055, 10, 8);
  petal.scale(1, 0.35, 0.6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = petal.clone();
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.06, 0.26, Math.sin(a) * 0.06);
    parts.push(g);
  }
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.26, 5);
  stem.translate(0, 0.13, 0);
  parts.push(stem);
  // per-part colour: petals = instance colour (white), centre = yellow, stem = green
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  const centre = new THREE.SphereGeometry(0.035, 10, 8).toNonIndexed();
  centre.translate(0, 0.275, 0);
  const all = mergeGeometries([merged, centre]);
  const col = [];
  const petalCount = parts.slice(0, 5).reduce((n, g) => n + g.toNonIndexed().attributes.position.count, 0);
  const stemCount = parts[5].toNonIndexed().attributes.position.count;
  for (let i = 0; i < all.attributes.position.count; i++) {
    if (i < petalCount) col.push(1, 1, 1);
    else if (i < petalCount + stemCount) col.push(0.36, 0.62, 0.32);
    else col.push(1, 0.8, 0.25);
  }
  all.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return all;
}

function cloudGeometry() {
  const puffs = [
    [0, 0, 0, 1], [0.95, -0.15, 0.1, 0.75], [-0.95, -0.18, 0.05, 0.72], [0.45, 0.42, -0.1, 0.7],
    [-0.4, 0.38, 0.05, 0.66], [1.6, -0.35, 0, 0.5], [-1.55, -0.38, 0, 0.48],
  ];
  const geos = puffs.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 4);
    g.translate(x, y, z);
    return g;
  });
  const g = mergeGeometries(geos);
  g.scale(1, 0.85, 0.8);
  return g;
}

function weedGeometry() {
  // a perky clump of broad leaves
  const leaves = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.SphereGeometry(0.1, 10, 8);
    g.scale(0.55, 2.2, 0.22);
    g.translate(0, 0.2, 0);
    g.rotateZ((i % 2 ? 1 : -1) * (0.25 + (i >> 1) * 0.22));
    g.rotateY((i / 6) * Math.PI * 2);
    leaves.push(g);
  }
  return mergeGeometries(leaves);
}

// cherry tree: curvy trunk + branches and a lumpy canopy of pink puffs (vertex coloured)
function cherryTreeGeometry(seed = 1) {
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const bark = [];
  const trunk = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.15, 1.2, 0.05), new THREE.Vector3(-0.1, 2.4, 0), new THREE.Vector3(0.1, 3.2, 0)]),
    24, 0.22, 10
  );
  bark.push(trunk);
  const tips = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    const len = 1.2 + rnd() * 0.9;
    const tip = new THREE.Vector3(Math.cos(a) * len, 3.6 + rnd() * 0.9, Math.sin(a) * len * 0.7);
    tips.push(tip);
    bark.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 2.3 + rnd() * 0.6, 0), tip.clone().multiplyScalar(0.55).setY(tip.y - 0.2), tip]), 12, 0.08, 6));
  }
  const barkGeo = mergeGeometries(bark.map((g) => g.toNonIndexed()));
  const barkCol = new THREE.Color('#7a5a4c');
  const col = [];
  for (let i = 0; i < barkGeo.attributes.position.count; i++) col.push(barkCol.r, barkCol.g, barkCol.b);
  barkGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  barkGeo.deleteAttribute('uv');

  const puffs = [];
  const pinks = ['#ffd3df', '#ffc4d4', '#ffe1e9', '#fff0f4', '#ffb8cb'].map((h) => new THREE.Color(h));
  const centres = [new THREE.Vector3(0, 3.9, 0), ...tips];
  centres.forEach((c, k) => {
    const n = k === 0 ? 16 : 10;
    for (let j = 0; j < n; j++) {
      const rr = (k === 0 ? 0.62 : 0.5) * (0.7 + rnd() * 0.55);
      const g = new THREE.IcosahedronGeometry(rr, 3).toNonIndexed();
      g.deleteAttribute('uv');
      g.translate(c.x + (rnd() - 0.5) * 1.6, c.y + (rnd() - 0.3) * 0.9, c.z + (rnd() - 0.5) * 1.4);
      const pc = pinks[Math.floor(rnd() * pinks.length)];
      const cc = [];
      const pos = g.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        // lighter on top, deeper underneath
        const t = THREE.MathUtils.clamp((pos.getY(v) - c.y + 1) / 2, 0, 1);
        const shade = pc.clone().lerp(new THREE.Color('#ff9bb6'), (1 - t) * 0.35);
        cc.push(shade.r, shade.g, shade.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
      puffs.push(g);
    }
  });
  return { bark: barkGeo, canopy: mergeGeometries(puffs) };
}

function petalGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.5);
  sh.bezierCurveTo(0.45, -0.25, 0.42, 0.35, 0.12, 0.5);
  sh.lineTo(0, 0.38);
  sh.lineTo(-0.12, 0.5);
  sh.bezierCurveTo(-0.42, 0.35, -0.45, -0.25, 0, -0.5);
  const g = new THREE.ShapeGeometry(sh, 6);
  g.scale(0.11, 0.11, 0.11);
  // gentle cup so lighting reads
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) ** 2) * 1.6);
  g.computeVertexNormals();
  return g;
}

const softStar = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uPixel;
  attribute float aSize; attribute float aPhase;
  varying float vA;
`;

function pointsMaterial(color, { fireflies = false } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: fireflies ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPixel: { value: Math.min(devicePixelRatio, 2) }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      ${softStar}
      void main() {
        vec3 p = position;
        ${fireflies ? 'p += vec3(sin(uTime * 0.7 + aPhase * 5.0), sin(uTime * 1.1 + aPhase * 3.0) * 0.6, cos(uTime * 0.6 + aPhase * 4.0)) * 0.35;' : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * ${fireflies ? '3.0' : '2.0'} + aPhase * 6.28);
        gl_PointSize = aSize * uPixel * (0.6 + 0.6 * tw) * (14.0 / -mv.z);
        vA = uOpacity * (0.3 + 0.7 * tw);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);
        float star = ${fireflies ? '0.0' : '0.02 / (abs(uv.x * uv.y) + 0.02) * smoothstep(1.0, 0.2, r)'};
        float core = smoothstep(1.0, 0.0, r);
        float a = clamp(star + core * core, 0.0, 1.0) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

function makePoints(n, spread, mat, sizeRange) {
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set(spread(i), i * 3);
    size[i] = rand(...sizeRange);
    phase[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

export class Meadow {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // hill
    this.groundMat = new THREE.MeshStandardMaterial({ color: '#8fcf6e', roughness: 1 });
    const hill = new THREE.Mesh(new THREE.SphereGeometry(R, 160, 80), this.groundMat);
    hill.position.copy(HILL_C);
    hill.receiveShadow = true;
    this.group.add(hill);

    // grass
    const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    this.grassU = addWind(bladeMat, 1);
    const N = 9000;
    const grass = new THREE.InstancedMesh(bladeGeometry(), bladeMat, N);
    grass.receiveShadow = true;
    const d = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let i = 0; i < N; i++) {
      // denser near the stage, sparser far away
      const r = Math.pow(Math.random(), 0.65) * 17;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.4;
      const z = Math.sin(a) * r - 3;
      // keep the spot right under the character a bit clearer
      if (Math.hypot(x, z - 1) < 0.5 && Math.random() < 0.7) continue;
      d.position.set(x, groundY(x, z) - 0.02, z);
      d.rotation.set(0, Math.random() * Math.PI, 0);
      const s = rand(0.6, 1.35);
      d.scale.set(s, s * rand(0.8, 1.3), s);
      d.updateMatrix();
      grass.setMatrixAt(i, d.matrix);
      grass.setColorAt(i, tint.setHSL(rand(0.25, 0.3), rand(0.35, 0.55), rand(0.62, 0.8)));
    }
    this.group.add(grass);

    // flowers
    const flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.flowerU = addWind(flowerMat, 0.6);
    const F = 260;
    const flowers = new THREE.InstancedMesh(flowerGeometry(), flowerMat, F);
    const petals = ['#ffffff', '#ffd8e2', '#ffc2d3', '#fff2a8', '#ffe6ee'];
    for (let i = 0; i < F; i++) {
      const r = Math.pow(Math.random(), 0.8) * 15 + 1.2;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.4;
      const z = Math.sin(a) * r - 3;
      d.position.set(x, groundY(x, z) - 0.02, z);
      d.rotation.set(rand(-0.15, 0.15), Math.random() * 6, rand(-0.15, 0.15));
      d.scale.setScalar(rand(0.9, 1.6));
      d.updateMatrix();
      flowers.setMatrixAt(i, d.matrix);
      flowers.setColorAt(i, tint.set(petals[i % petals.length]));
    }
    this.group.add(flowers);

    // clouds
    this.cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#dfe9ff', emissiveIntensity: 0.25 });
    const cg = cloudGeometry();
    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(cg, this.cloudMat);
      const z = rand(-46, -24);
      const side = i % 2 ? 1 : -1;
      m.position.set(side * rand(15, 42), rand(7, 15), z);
      m.userData.side = side;
      m.scale.setScalar(rand(1.6, 3.2));
      m.userData.speed = rand(0.15, 0.4);
      this.clouds.push(m);
      this.group.add(m);
    }

    // cherry trees around the meadow
    this.canopyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: '#ff8fb0', emissiveIntensity: 0 });
    const barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const spots = [
      [-9.5, -7, 1.0, 0.3], [10, -8.5, 1.05, 2.1], [-15, -13, 1.25, 1.2], [15.5, -14, 1.3, 4], [-6, -19, 1.2, 2.6], [6.5, -21, 1.3, 0.8],
      [-21, -21, 1.5, 3.3], [21, -23, 1.5, 1.7], [0, -28, 1.6, 5.1],
    ];
    this.trees = spots.map(([x, z, sc, ry], i) => {
      const { bark, canopy } = cherryTreeGeometry(i * 17 + 3);
      const tree = new THREE.Group();
      const b = new THREE.Mesh(bark, barkMat);
      const cMesh = new THREE.Mesh(canopy, this.canopyMat);
      b.castShadow = cMesh.castShadow = i < 2;
      tree.add(b, cMesh);
      tree.position.set(x, groundY(x, z) - 0.1, z);
      tree.scale.setScalar(sc);
      tree.rotation.y = ry;
      tree.userData.canopy = cMesh;
      tree.userData.phase = Math.random() * 6;
      this.group.add(tree);
      return tree;
    });

    // petals carpeting the grass
    const petalGeo = petalGeometry();
    const petalMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide });
    const GP = 1400;
    const groundPetals = new THREE.InstancedMesh(petalGeo, petalMat, GP);
    for (let i = 0; i < GP; i++) {
      const r = Math.pow(Math.random(), 0.7) * 16;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.4;
      const z = Math.sin(a) * r - 4;
      d.position.set(x, groundY(x, z) + 0.01, z);
      d.rotation.set(-Math.PI / 2 + rand(-0.3, 0.3), 0, Math.random() * 6);
      d.scale.setScalar(rand(0.8, 1.3));
      d.updateMatrix();
      groundPetals.setMatrixAt(i, d.matrix);
      groundPetals.setColorAt(i, tint.set(PETAL_COLORS[i % PETAL_COLORS.length]));
    }
    groundPetals.receiveShadow = true;
    this.group.add(groundPetals);

    // falling petals (whole world volume, incl. the sky game band)
    const FP = 520;
    this.fall = new THREE.InstancedMesh(petalGeo, petalMat, FP);
    this.fall.frustumCulled = false;
    this.fallData = Array.from({ length: FP }, (_, i) => {
      this.fall.setColorAt(i, tint.set(PETAL_COLORS[i % PETAL_COLORS.length]));
      return {
        p: new THREE.Vector3(rand(-16, 16), rand(-1.5, 15), rand(-10, 6)),
        v: rand(0.35, 0.8),
        spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)),
        r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)),
        ph: Math.random() * 10,
        s: rand(0.9, 1.6),
      };
    });
    this.group.add(this.fall);
    this.wind = 0.5;
    this.windBoost = 0;
    this.dummy = d;

    // night: stars + fireflies
    this.stars = makePoints(700, () => [rand(-90, 90), rand(2, 45), rand(-70, -40)], pointsMaterial('#fff6d6'), [10, 30]);
    this.fireflies = makePoints(70, () => {
      const x = rand(-9, 9), z = rand(-5, 4);
      return [x, groundY(x, z) + rand(0.3, 2.2), z];
    }, pointsMaterial('#ffe58a', { fireflies: true }), [16, 30]);
    this.group.add(this.stars, this.fireflies);

    // weeds to pull (풀뽑기)
    this.weedMat = new THREE.MeshStandardMaterial({ color: '#4f9a45', roughness: 0.9 });
    this.weedGeo = weedGeometry();
    this.weeds = [];
    this.weedSpots = [
      [-0.2, 2.6], [0.9, 3.1], [2.6, 2.9], [3.5, 2.0], [-0.8, 1.6], [3.4, 0.6], [0.2, 0.4], [4.4, 1.2], [1.6, 3.6], [-1.6, 2.7],
    ];
    this.dirtGeo = new THREE.SphereGeometry(0.05, 6, 5);
    this.dirtMat = new THREE.MeshStandardMaterial({ color: '#9b6b45', roughness: 1 });
    this.weedsVisible = 0;
    this.plantWeeds();
  }

  plantWeeds() {
    for (const w of this.weeds) this.group.remove(w);
    this.weeds = this.weedSpots.map(([x, z], i) => {
      const w = new THREE.Mesh(this.weedGeo, this.weedMat);
      w.castShadow = true;
      w.position.set(x, groundY(x, z) - 0.03, z);
      w.rotation.y = Math.random() * Math.PI;
      w.userData = { weed: true, pulled: false, base: w.position.y, i, phase: Math.random() * 6 };
      w.scale.setScalar(0.0001);
      this.group.add(w);
      return w;
    });
  }

  pull(w, onDone) {
    if (w.userData.pulled) return false;
    w.userData.pulled = true;
    const y0 = w.position.y;
    createTimeline({ onComplete: () => { w.visible = false; onDone?.(); } })
      .add(w.scale, { y: [1, 1.5], x: [1, 0.75], z: [1, 0.75], duration: 120, ease: 'outQuad' }, 0)
      .add(w.position, { y: [y0, y0 + 1.1], duration: 420, ease: 'outCubic' }, 100)
      .add(w.rotation, { z: [0, Math.PI * 1.5], duration: 700, ease: 'outQuad' }, 100)
      .add(w.scale, { x: 0.0001, y: 0.0001, z: 0.0001, duration: 300, ease: 'inBack' }, 520);
    // dirt bits
    for (let k = 0; k < 9; k++) {
      const p = new THREE.Mesh(this.dirtGeo, this.dirtMat);
      p.position.copy(w.position);
      p.position.y = y0 + 0.05;
      this.group.add(p);
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.3, 0.8);
      animate(p.position, { x: p.position.x + Math.cos(a) * r, z: p.position.z + Math.sin(a) * r, duration: 600, ease: 'outQuad' });
      animate(p.position, { y: [y0 + 0.05, y0 + rand(0.4, 0.8), y0], duration: 600, ease: 'inOutSine' });
      animate(p.scale, { x: 0.001, y: 0.001, z: 0.001, delay: 450, duration: 300, onComplete: () => this.group.remove(p) });
    }
    return true;
  }

  gust(power = 1) {
    this.windBoost = Math.max(this.windBoost, power * 4);
  }

  // weeds pop in / out depending on how much the weeding stage is in focus
  update(t, dt, look) {
    this.windBoost *= Math.exp(-dt * 1.2);
    const wind = this.wind + this.windBoost;
    const d = this.dummy;
    this.fallData.forEach((f, i) => {
      f.p.y -= f.v * dt * (1 + this.windBoost * 0.3);
      f.p.x += (Math.sin(t * 0.8 + f.ph) * 0.4 + wind) * dt;
      f.p.z += Math.cos(t * 0.6 + f.ph) * 0.25 * dt;
      f.r.x += f.spin.x * dt;
      f.r.y += f.spin.y * dt;
      f.r.z += f.spin.z * dt;
      if (f.p.y < -2 || f.p.x > 17) {
        f.p.set(rand(-17, 12), rand(12, 16), rand(-10, 6));
      }
      d.position.copy(f.p);
      d.rotation.copy(f.r);
      d.scale.setScalar(f.s);
      d.updateMatrix();
      this.fall.setMatrixAt(i, d.matrix);
    });
    this.fall.instanceMatrix.needsUpdate = true;
    for (const tr of this.trees) tr.rotation.z = Math.sin(t * 0.9 + tr.userData.phase) * 0.012 * (1 + this.windBoost);
    this.canopyMat.emissiveIntensity = look.night * 0.35;
    this.grassU.uWind.value = 1 + this.windBoost * 0.6;
    this.grassU.uTime.value = t;
    this.flowerU.uTime.value = t;
    for (const c of this.clouds) {
      // drift outward-ish so the centre (title area) stays clear
      c.position.x += c.userData.speed * dt * c.userData.side;
      if (Math.abs(c.position.x) > 48) c.position.x = c.userData.side * 15;
    }
    this.stars.material.uniforms.uTime.value = t;
    this.fireflies.material.uniforms.uTime.value = t;
    this.stars.material.uniforms.uOpacity.value = look.night;
    this.fireflies.material.uniforms.uOpacity.value = look.night;
    this.cloudMat.color.copy(look.cloud);
    this.cloudMat.emissive.copy(look.cloudGlow);
    this.groundMat.color.copy(look.ground);

    const show = look.weeds;
    for (const w of this.weeds) {
      if (w.userData.pulled) continue;
      const target = show > 0.5 ? 1 : 0.0001;
      const s = w.scale.x + (target - w.scale.x) * (1 - Math.exp(-dt * (6 + w.userData.i)));
      w.scale.setScalar(s);
      w.visible = s > 0.01;
      w.rotation.z = Math.sin(t * 2 + w.userData.phase) * 0.06;
    }
  }
}
