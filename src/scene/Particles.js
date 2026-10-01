import * as THREE from 'three';

const PALETTE = ['#ffb3c7', '#a9c6ff', '#ffe08a', '#a6e8cf', '#cdb6ff', '#ffc9a3'];

function starGeometry() {
  const s = new THREE.Shape();
  const n = 5;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? 0.22 : 0.5;
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 4 });
  g.center();
  return g;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.45);
  s.bezierCurveTo(-0.15, -0.3, -0.55, -0.08, -0.5, 0.18);
  s.bezierCurveTo(-0.46, 0.42, -0.12, 0.48, 0, 0.24);
  s.bezierCurveTo(0.12, 0.48, 0.46, 0.42, 0.5, 0.18);
  s.bezierCurveTo(0.55, -0.08, 0.15, -0.3, 0, -0.45);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 5, curveSegments: 24 });
  g.center();
  return g;
}

const sparkleVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPR;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.6 + aSeed * 6.28) * 0.35;
    p.x += cos(uTime * 0.4 + aSeed * 12.0) * 0.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (60.0 + aSeed * 90.0) * uPR / -mv.z;
    vA = pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 40.0), 3.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const sparkleFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float rays = pow(max(0.0, 1.0 - abs(c.x) * 14.0), 2.0) + pow(max(0.0, 1.0 - abs(c.y) * 14.0), 2.0);
    float a = (rays * (1.0 - smoothstep(0.0, 0.5, r)) + (1.0 - smoothstep(0.0, 0.12, r))) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

export class Particles {
  constructor() {
    this.group = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, sheen: 0.3 });
    const geos = [starGeometry(), heartGeometry(), new THREE.SphereGeometry(0.4, 24, 16)];
    const counts = [34, 26, 30];
    this.sets = [];
    const dummyColor = new THREE.Color();
    geos.forEach((geo, gi) => {
      const n = counts[gi];
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.frustumCulled = false;
      const data = [];
      for (let i = 0; i < n; i++) {
        const z = -2 - Math.random() * 12;
        data.push({
          p: new THREE.Vector3((Math.random() - 0.5) * (22 + -z * 1.4), -8 + Math.random() * 26, z),
          r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
          rs: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.2),
          s: 0.25 + Math.random() * 0.45,
          ph: Math.random() * 10,
          depth: 0.4 + Math.random() * 0.8,
        });
        mesh.setColorAt(i, dummyColor.set(PALETTE[(i + gi * 2) % PALETTE.length]));
      }
      this.group.add(mesh);
      this.sets.push({ mesh, data });
    });
    this.dummy = new THREE.Object3D();

    // twinkles
    const N = 260;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = -10 + Math.random() * 30;
      pos[i * 3 + 2] = -1 - Math.random() * 12;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.sparkleUniforms = {
      uTime: { value: 0 },
      uPR: { value: Math.min(devicePixelRatio, 2) },
      uColor: { value: new THREE.Color('#ffc94d') },
    };
    this.sparkles = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.sparkleUniforms,
        vertexShader: sparkleVert,
        fragmentShader: sparkleFrag,
        transparent: true,
        depthWrite: false,
      })
    );
    this.sparkles.frustumCulled = false;
    this.group.add(this.sparkles);
    this.burst = 0;
  }

  kick() {
    this.burst = 1;
  }

  update(t, dt, scroll) {
    this.burst *= Math.exp(-dt * 2.5);
    const { dummy } = this;
    for (const { mesh, data } of this.sets) {
      data.forEach((d, i) => {
        d.r.x += d.rs.x * dt * (1 + this.burst * 8);
        d.r.y += d.rs.y * dt * (1 + this.burst * 8);
        // parallax: deeper objects scroll slower; wrap vertically
        let y = d.p.y + scroll * 9 * d.depth + Math.sin(t * 0.8 + d.ph) * 0.3;
        y = ((((y + 8) % 26) + 26) % 26) - 8;
        dummy.position.set(d.p.x + Math.sin(t * 0.3 + d.ph) * 0.3, y, d.p.z);
        dummy.rotation.copy(d.r);
        dummy.scale.setScalar(d.s * (1 + this.burst * 0.6));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.sparkleUniforms.uTime.value = t;
    this.sparkles.position.y = scroll * 5;
  }
}
