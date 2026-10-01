import * as THREE from 'three';
import { animate } from 'animejs';
import { vinyl } from './materials.js';

// Side-scrolling "flap through the clouds" mini game, played inside the main scene.
// Chiikawa flaps its arms to rise; cloud pillars scroll in from the right.

const GRAVITY = -17;
const FLAP = 6.2;
const PUFFS = 13; // puffs per pillar half
const POOL = 6; // pillar pairs alive at once
const HALF_W = 0.55; // collision half width of a pillar
const SCALE = 0.55; // character scale while flying
export const GAME_Y = 6; // the game is played up in the sky above the meadow

const rand = (a, b) => a + Math.random() * (b - a);

export class SkyGame {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.position.y = GAME_Y;
    world.scene.add(this.group);

    const cloudMat = vinyl('#ffffff', { roughness: 0.9 });
    cloudMat.sheenColor.set('#e9f1ff');
    cloudMat.sheen = 0.8;
    const puff = new THREE.IcosahedronGeometry(1, 4);

    // obstacle pillars (instanced)
    this.pillarMesh = new THREE.InstancedMesh(puff, cloudMat, POOL * 2 * PUFFS);
    this.pillarMesh.castShadow = false;
    this.pillarMesh.frustumCulled = false;
    this.group.add(this.pillarMesh);
    this.pillars = Array.from({ length: POOL }, () => ({ x: 999, gapY: 0, gap: 3, passed: false, puffs: [] }));

    // background clouds, drifting slowly far behind
    this.bgMat = vinyl('#ffffff', { roughness: 0.95 });
    this.bgMat.transparent = true;
    this.bgMat.opacity = 0;
    this.bgMat.depthWrite = false;
    this.bg = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(puff, this.bgMat);
        const r = rand(0.5, 1.0);
        m.scale.setScalar(r);
        m.position.set(k * 0.8 - n * 0.4 + rand(-0.2, 0.2), rand(-0.15, 0.3) + (k % 2) * 0.25, rand(-0.3, 0.3));
        g.add(m);
      }
      g.position.set(rand(-18, 18), rand(0, 7), rand(-22, -15));
      g.userData.speed = rand(0.25, 0.6);
      this.bg.push(g);
      this.group.add(g);
    }

    this.dummy = new THREE.Object3D();
    this.state = 'idle';
    this.weight = 0;
    this.score = 0;
    this.best = 0;
    try { this.best = +localStorage.getItem('chiikawa-sky-best') || 0; } catch {}
    this.pos = new THREE.Vector3(-2.6, 1.0, 0.4);
    this.vy = 0;
    this.speed = 3.2;
    this.tilt = 0;
    this.overSpin = 0;
    this.onScore = () => {};
    this.onOver = () => {};
    this.hideAll();
  }

  get bounds() {
    const narrow = this.world.narrow;
    // visible world-space band at z≈0 (feet coordinates for floor/ceil)
    const bottom = narrow ? -3.7 : -2.05;
    const top = narrow ? 6.3 : 4.15;
    return { left: narrow ? -3.2 : -7, right: narrow ? 3.6 : 7.5, bottom, top, floor: bottom - 0.5, ceil: top - 1.85, startX: narrow ? -1.2 : -2.6, spacing: narrow ? 4.4 : 4.6 };
  }

  hideAll() {
    for (const p of this.pillars) p.x = 999;
    this.writePillars();
  }

  start() {
    const b = this.bounds;
    this.state = 'play';
    this.overSpin = 0;
    this.score = 0;
    this.speed = 3.2;
    this.vy = FLAP * 0.8;
    this.pos.set(b.startX, 1.0, 0.4);
    this.pillars.forEach((p, i) => this.spawn(p, b.right + 3.5 + i * b.spacing, i));
    const c = this.world.chiikawa;
    c.setExpression('open');
    this.flap();
  }

  spawn(p, x, i = 99) {
    const b = this.bounds;
    p.x = x;
    p.gap = Math.max(2.7, 3.5 - this.score * 0.04) + (i < 2 ? 0.3 : 0);
    p.gapY = rand(b.bottom + 0.9 + p.gap / 2, b.top - 0.9 - p.gap / 2);
    p.passed = false;
    p.puffs = [];
    for (const dir of [-1, 1]) {
      for (let k = 0; k < PUFFS; k++) {
        p.puffs.push({
          dir,
          dy: p.gap / 2 + 0.36 + k * 0.42 + rand(-0.05, 0.05),
          dx: rand(-0.18, 0.18),
          r: k === 0 ? 0.5 : rand(0.42, 0.62),
          dz: rand(-0.2, 0.2),
        });
      }
    }
  }

  flap() {
    if (this.state !== 'play') return;
    this.vy = FLAP;
    const s = this.world.chiikawa.s;
    animate(s, { wave: [1, 0], duration: 420, ease: 'outQuad' });
    animate(s, { squash: [0.86, 1], duration: 420, ease: 'outElastic(1, .5)' });
  }

  crash() {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.vy = 4;
    this.overSpin = 0;
    const c = this.world.chiikawa;
    c.setExpression('squint', 2200);
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('chiikawa-sky-best', String(this.best)); } catch {}
    }
    setTimeout(() => this.onOver(this.score, this.best), 900);
  }

  reset() {
    this.state = 'idle';
    this.hideAll();
    this.world.chiikawa.root.rotation.z = 0;
  }

  writePillars() {
    const { dummy } = this;
    let i = 0;
    for (const p of this.pillars) {
      for (const f of p.puffs.length ? p.puffs : Array(PUFFS * 2).fill(null)) {
        if (!f || p.x > 900) {
          dummy.position.set(0, -999, 0);
          dummy.scale.setScalar(0.0001);
        } else {
          dummy.position.set(p.x + f.dx, p.gapY + f.dir * f.dy, f.dz);
          dummy.scale.setScalar(f.r);
        }
        dummy.updateMatrix();
        this.pillarMesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    this.pillarMesh.instanceMatrix.needsUpdate = true;
  }

  hits(cx, cy, r) {
    for (const p of this.pillars) {
      if (p.x > 900 || Math.abs(p.x - cx) > HALF_W + r) continue;
      const top = p.gapY + p.gap / 2;
      const bottom = p.gapY - p.gap / 2;
      // closest point on the two pillar rectangles
      const qx = Math.max(p.x - HALF_W, Math.min(cx, p.x + HALF_W));
      if (cy + r > top) {
        const qy = Math.max(top, cy);
        if ((cx - qx) ** 2 + (cy - qy) ** 2 < r * r) return true;
      }
      if (cy - r < bottom) {
        const qy = Math.min(bottom, cy);
        if ((cx - qx) ** 2 + (cy - qy) ** 2 < r * r) return true;
      }
    }
    return false;
  }

  // weight: 0..1 how much the game stage is in focus
  update(t, dt, weight) {
    this.weight = weight;
    this.bgMat.opacity = weight * 0.55;
    this.group.visible = weight > 0.01;
    for (const g of this.bg) {
      g.position.x -= g.userData.speed * dt * (this.state === 'play' ? 3 : 1);
      if (g.position.x < -22) g.position.x = 22;
    }

    const c = this.world.chiikawa;
    const b = this.bounds;

    if (this.state === 'idle') {
      // hover in place, waiting for start
      this.pos.set(b.startX, 1.0 + Math.sin(t * 2) * 0.25, 0.4);
      this.tilt = Math.sin(t * 2) * 0.06;
      if (weight > 0.5 && Math.random() < dt * 1.4) animate(c.s, { wave: [0.8, 0], duration: 380, ease: 'outQuad' });
    } else {
      this.speed = Math.min(5.4, this.speed + dt * 0.05);
      this.vy += GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.state === 'play') {
        if (this.pos.y > b.ceil) { this.pos.y = b.ceil; this.vy = Math.min(this.vy, 0); }
        for (const p of this.pillars) {
          p.x -= this.speed * dt;
          if (!p.passed && p.x + HALF_W < this.pos.x - 0.4) {
            p.passed = true;
            this.score++;
            this.onScore(this.score);
          }
          if (p.x < b.left - 2) {
            const far = Math.max(...this.pillars.map((q) => q.x));
            this.spawn(p, far + b.spacing);
          }
        }
        const cy = this.pos.y + 1.6 * SCALE;
        if (this.pos.y < b.floor || this.hits(this.pos.x, cy, 0.92 * SCALE)) this.crash();
      }
      if (this.state === 'over') this.overSpin += dt * 9;
      this.tilt = THREE.MathUtils.clamp(this.vy * 0.05, -0.5, 0.35) + this.overSpin;
      this.writePillars();
    }

    // drive the character while the game stage is in focus
    if (weight > 0) {
      const tg = c.target;
      tg.x = THREE.MathUtils.lerp(tg.x, this.pos.x, weight);
      tg.y = THREE.MathUtils.lerp(tg.y, this.pos.y + GAME_Y, weight);
      tg.z = THREE.MathUtils.lerp(tg.z, this.pos.z, weight);
      tg.s = THREE.MathUtils.lerp(tg.s, SCALE, weight);
      if (this.state !== 'idle') {
        c.root.position.set(this.pos.x, this.pos.y + GAME_Y, this.pos.z);
        c.prevPos.copy(c.root.position);
      }
    }
    c.root.rotation.order = 'ZYX';
    c.root.rotation.z = THREE.MathUtils.lerp(c.root.rotation.z, this.tilt * weight, 0.2);
    c.shadow.visible = weight < 0.5;
  }
}
