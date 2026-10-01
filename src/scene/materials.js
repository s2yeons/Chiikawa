import * as THREE from 'three';

// Soft matte vinyl, like the collectible figure. An optional pad-printed face decal is
// front-projected from object space inside the physical shader.
export function vinyl(color, { face = null, roughness = 0.7 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#ffffff'),
  });
  if (!face) return m;

  const uniforms = { uFace: { value: face } };
  m.userData.uniforms = uniforms;

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nuniform sampler2D uFace;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float front = smoothstep(0.05, 0.3, vObjPos.z);
          vec4 fc = texture2D(uFace, vObjPos.xy * 0.5 + 0.5) * front;
          diffuseColor.rgb = diffuseColor.rgb * (1.0 - fc.a) + fc.rgb;
        }`
      )
      // printed ink is flat matte — no glossy highlight sitting on the eyes
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 1.0, texture2D(uFace, vObjPos.xy * 0.5 + 0.5).a * smoothstep(0.05, 0.3, vObjPos.z));`
      );
  };
  m.customProgramCacheKey = () => 'vinyl-face';
  return m;
}

let blobTex;
export function blobShadowTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(40,30,30,0.5)');
  grd.addColorStop(0.3, 'rgba(40,30,30,0.22)');
  grd.addColorStop(1, 'rgba(40,30,30,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}
