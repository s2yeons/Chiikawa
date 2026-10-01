import * as THREE from 'three';
import { animate } from 'animejs';
import { faceSet } from './faces.js';
import { blobShadowTexture } from './materials.js';

// A squishy, lying-down "mochi" Chiikawa. The surface is displaced on the GPU by up to
// MAX_HITS damped-spring impacts plus a hover dent; normals are rebuilt by finite differences.
const MAX_HITS = 10;
const SHAPE = new THREE.Vector3(1.3, 0.82, 1.08);

const deformGLSL = /* glsl */ `
  uniform float uTime;
  uniform vec4 uHits[${MAX_HITS}];
  uniform vec3 uPointer;
  uniform float uHover;
  uniform vec3 uShape;

  float bump(vec3 n, vec3 c, float k) { float d = distance(n, c); return exp(-d * d * k); }

  vec3 deform(vec3 n) {
    float d = 0.0;
    // bear ears grown out of the same surface
    for (int k = 0; k < 2; k++) {
      vec3 ec = normalize(vec3(k == 0 ? -0.55 : 0.55, 0.8, 0.12));
      float e = 1.0 - smoothstep(0.0, 0.26, distance(n, ec));
      d += 0.17 * sqrt(e);
    }
    for (int i = 0; i < ${MAX_HITS}; i++) {
      vec4 h = uHits[i];
      float age = uTime - h.w;
      if (age < 0.0 || age > 4.0) continue;
      float dist = distance(n, h.xyz);
      d -= 0.42 * exp(-dist * dist * 6.0) * exp(-age * 3.2) * cos(age * 17.0);
      d += 0.045 * sin(dist * 10.0 - age * 20.0) * exp(-age * 2.4) * smoothstep(0.0, 0.12, age);
    }
    float hd = distance(n, uPointer);
    d -= 0.12 * uHover * exp(-hd * hd * 9.0);
    vec3 q = n * (1.0 + d);
    float br = sin(uTime * 2.1) * 0.02;
    q.y *= 1.0 + br;
    q.xz *= 1.0 - br * 0.5;
    float flt = 1.0 - smoothstep(-0.78, -0.42, q.y);
    q.y = mix(q.y, -0.42 + (q.y + 0.42) * 0.3, flt);
    return q * uShape;
  }

  vec3 deformNormal(vec3 n, vec3 p0) {
    vec3 t = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 b = cross(n, t);
    float e = 0.012;
    vec3 p1 = deform(normalize(n + t * e));
    vec3 p2 = deform(normalize(n + b * e));
    vec3 nn = normalize(cross(p1 - p0, p2 - p0));
    return dot(nn, p0) < 0.0 ? -nn : nn;
  }
`;

const vert = /* glsl */ `
  ${deformGLSL}
  varying vec3 vN;
  varying vec3 vUnit;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(position);
    vec3 p = deform(n);
    vec3 nrm = deformNormal(n, p);
    vUnit = n;
    vN = normalize(normalMatrix * nrm);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uFace;
  uniform vec3 uLight;
  uniform vec3 uBase;
  uniform vec3 uRim;
  varying vec3 vN;
  varying vec3 vUnit;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vView);
    vec3 base = uBase;
    float front = smoothstep(0.05, 0.3, vUnit.z);
    vec4 fc = texture2D(uFace, vec2(vUnit.x * 0.5 / 0.92, vUnit.y * 0.5 / 0.92) + 0.5) * front;
    base = base * (1.0 - fc.a) + fc.rgb;

    float wrap = dot(n, uLight) * 0.5 + 0.5;
    float diff = smoothstep(0.0, 1.0, wrap);
    vec3 col = base * (0.62 + 0.45 * diff);
    // subsurface-ish warm fill in the shadows
    col += uRim * 0.12 * (1.0 - diff);
    vec3 h = normalize(uLight + v);
    col += vec3(1.0) * pow(max(dot(n, h), 0.0), 40.0) * 0.12;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col += uRim * fres * 0.35;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Mochi {
  constructor() {
    this.root = new THREE.Group();
    this.faces = faceSet('mochi');
    this.hits = Array.from({ length: MAX_HITS }, () => new THREE.Vector4(0, 0, 1, -100));
    this.hitIndex = 0;

    this.uniforms = {
      uTime: { value: 0 },
      uHits: { value: this.hits },
      uPointer: { value: new THREE.Vector3(0, 0, 1) },
      uHover: { value: 0 },
      uShape: { value: SHAPE },
      uFace: { value: this.faces.open },
      uLight: { value: new THREE.Vector3(0.4, 0.7, 0.6).normalize() },
      uBase: { value: new THREE.Color('#fbfaf6') },
      uRim: { value: new THREE.Color('#ffc4d2') },
    };
    const geo = new THREE.IcosahedronGeometry(1, 64);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag })
    );
    this.mesh.frustumCulled = false;

    // invisible proxy for raycasting
    const proxyGeo = new THREE.SphereGeometry(1, 32, 24);
    proxyGeo.scale(SHAPE.x, SHAPE.y * 0.95, SHAPE.z);
    this.proxy = new THREE.Mesh(proxyGeo, new THREE.MeshBasicMaterial({ visible: false }));

    this.squish = new THREE.Group();
    this.squish.add(this.mesh, this.proxy);
    this.squish.position.y = 0.68;
    this.root.add(this.squish);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(3.6, 2.6, 1);
    shadow.position.y = 0.02;
    this.root.add(shadow);

    this.target = { x: 0, y: 0, z: 0, ry: 0, s: 0 };
    this.root.scale.setScalar(0.0001);
    this.hovering = false;
    this.exprUntil = 0;
    this.nextBlink = 2;
    this.sq = { x: 1, y: 1 };
  }

  poke(worldPoint, t) {
    const local = this.proxy.worldToLocal(worldPoint.clone());
    local.set(local.x / SHAPE.x, local.y / SHAPE.y, local.z / SHAPE.z).normalize();
    this.hits[this.hitIndex].set(local.x, local.y, local.z, t);
    this.hitIndex = (this.hitIndex + 1) % MAX_HITS;
    this.uniforms.uFace.value = this.faces.squint;
    this.exprUntil = performance.now() + 750;
    animate(this.sq, {
      x: [1.14, 0.94, 1.03, 1],
      y: [0.82, 1.08, 0.97, 1],
      duration: 900,
      ease: 'outQuad',
    });
  }

  setPointer(worldPoint) {
    if (!worldPoint) {
      this.hovering = false;
      return;
    }
    this.hovering = true;
    const local = this.proxy.worldToLocal(worldPoint.clone());
    local.set(local.x / SHAPE.x, local.y / SHAPE.y, local.z / SHAPE.z).normalize();
    this.uniforms.uPointer.value.lerp(local, 0.35).normalize();
  }

  update(t, dt, camera, light) {
    const { root, target } = this;
    const k = 1 - Math.exp(-4.5 * dt);
    root.position.x += (target.x - root.position.x) * k;
    root.position.y += (target.y - root.position.y) * k;
    root.position.z += (target.z - root.position.z) * k;
    root.rotation.y += (target.ry - root.rotation.y) * k;
    const sc = root.scale.x + (target.s - root.scale.x) * (1 - Math.exp(-5 * dt));
    root.scale.setScalar(Math.max(sc, 0.0001));
    root.visible = sc > 0.01;

    this.squish.scale.set(this.sq.x, this.sq.y, this.sq.x);
    this.squish.rotation.z = Math.sin(t * 0.9) * 0.04;
    this.uniforms.uTime.value = t;
    this.uniforms.uHover.value += ((this.hovering ? 1 : 0) - this.uniforms.uHover.value) * 0.12;
    // light direction in view space
    this.uniforms.uLight.value.copy(light).transformDirection(camera.matrixWorldInverse);

    const now = performance.now();
    if (this.exprUntil && now > this.exprUntil) {
      this.uniforms.uFace.value = this.faces.open;
      this.exprUntil = 0;
    }
    if (!this.exprUntil) {
      this.nextBlink -= dt;
      if (this.nextBlink < 0) {
        this.uniforms.uFace.value = this.faces.blink;
        this.exprUntil = now + 130;
        this.nextBlink = 2 + Math.random() * 3;
      }
    }
  }
}
