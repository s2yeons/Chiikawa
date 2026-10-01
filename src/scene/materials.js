import * as THREE from 'three';

// Soft matte vinyl, like the collectible figures. Optional pad-printed face decal and
// procedural colour pattern (Hachiware's split cap) are injected into the physical shader.
export function vinyl(color, { face = null, pattern = null, roughness = 0.58 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#ffe1e8'),
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
  });
  if (!face && !pattern) return m;

  const uniforms = {
    uFace: { value: face },
    uPatternColor: { value: new THREE.Color(pattern?.color ?? '#000') },
  };
  m.userData.uniforms = uniforms;
  m.defines = {};
  if (face) m.defines.HAS_FACE = '';
  if (pattern) m.defines.HAS_PATTERN = '';

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObjPos;
        uniform sampler2D uFace;
        uniform vec3 uPatternColor;
        ${pattern?.glsl ?? ''}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 p = vObjPos;
          #ifdef HAS_PATTERN
            float f = patternField(p);
            float w = fwidth(f) * 1.5;
            diffuseColor.rgb = mix(diffuseColor.rgb, uPatternColor, smoothstep(-w, w, f));
          #endif
          #ifdef HAS_FACE
            float front = smoothstep(0.05, 0.3, p.z);
            vec4 fc = texture2D(uFace, p.xy * 0.5 + 0.5) * front;
            diffuseColor.rgb = diffuseColor.rgb * (1.0 - fc.a) + fc.rgb;
          #endif
        }`
      );
  };
  m.customProgramCacheKey = () => `vinyl-${!!face}-${pattern?.key ?? ''}`;
  return m;
}

// Hachiware: blue-grey cap split by a white "八" notch down the forehead.
export const HACHIWARE_PATTERN = {
  key: 'hachiware',
  color: '#7f9fcf',
  glsl: /* glsl */ `
    float patternField(vec3 p) {
      float cap = p.y - 0.02 + abs(p.x) * 0.12;
      float notch = p.z < 0.0 ? 1.0 : abs(p.x) - (0.98 - p.y) * 0.62;
      return min(cap, notch);
    }
  `,
};

let blobTex;
export function blobShadowTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(60,30,40,0.55)');
  grd.addColorStop(0.45, 'rgba(60,30,40,0.22)');
  grd.addColorStop(1, 'rgba(60,30,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
