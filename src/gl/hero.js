import * as THREE from 'three';
import { coverChunk, ditherChunk } from './glsl.js';
import { inkUniforms, loadTexture } from './stage.js';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Retrato: a foto aparece normal e só dentro da lente do cursor vira dither de 4 tintas.
// Na entrada, a foto surge pixel a pixel em dither e depois "revela" as cores, na ordem da matriz de Bayer.
const portraitFragment = /* glsl */ `
  ${ditherChunk}
  ${coverChunk}
  uniform sampler2D uTex;
  uniform vec2 uBox;
  uniform vec2 uImage;
  uniform vec2 uMouse;
  uniform float uLens;
  uniform float uIntro;
  uniform float uReveal;
  uniform float uContrast;
  varying vec2 vUv;

  void main() {
    float t = threshold();
    if (t > uIntro) discard;

    vec3 color = texture2D(uTex, coverUv(vUv, uBox, uImage)).rgb;
    float v = (luma(color) - 0.5) * uContrast + 0.5;
    vec3 inked = inkRamp(v, t);

    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uBox;
    float lens = 1.0 - smoothstep(uLens * 0.5, uLens, distance(p, uMouse));
    float showColor = uReveal * (1.0 - lens);
    gl_FragColor = vec4(t < showColor ? color : inked, 1.0);
  }
`;

const pointer = { x: -9999, y: -9999, active: false };
const trackPointer = event => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
};
// pointerdown cobre o toque no celular, onde não existe hover
addEventListener('pointermove', trackPointer, { passive: true });
addEventListener('pointerdown', trackPointer, { passive: true });
document.addEventListener('pointerleave', () => { pointer.active = false; });

export class HeroPortrait {
  static async create(image) {
    const texture = await loadTexture(image.currentSrc || image.src);
    return new HeroPortrait(image, texture);
  }

  constructor(image, texture) {
    this.image = image;
    this.lens = 0;
    this.age = 0;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: portraitFragment,
      uniforms: {
        ...inkUniforms(),
        uPixel: { value: 2 },
        uTex: { value: texture },
        uBox: { value: new THREE.Vector2() },
        uImage: { value: new THREE.Vector2(texture.image.width, texture.image.height) },
        uMouse: { value: new THREE.Vector2() },
        uLens: { value: 0 },
        uIntro: { value: 0 },
        uReveal: { value: 0 },
        uContrast: { value: 1.25 }
      },
      depthTest: false,
      depthWrite: false
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.renderOrder = 1;
  }

  update(stage, delta) {
    const rect = stage.syncToElement(this.mesh, this.image);
    const u = this.material.uniforms;
    const x = pointer.x - rect.left;
    const y = pointer.y - rect.top;
    const hovering = pointer.active && x > -40 && y > -40 && x < rect.width + 40 && y < rect.height + 40;

    // Tempo de relógio: a entrada termina no tempo certo mesmo se a aba estiver com quadros lentos
    this.start ??= performance.now();
    this.age = (performance.now() - this.start) / 1000;
    this.lens += ((hovering ? 1 : 0) - this.lens) * Math.min(1, delta * 8);

    // 0–1,1 s: entra em dither; 1,1–2,2 s: as cores aparecem
    u.uIntro.value = Math.min(1.001, this.age * 0.9);
    u.uReveal.value = Math.min(1.001, Math.max(0, (this.age - 1.1) * 0.9));
    u.uPixel.value = 2 * stage.dpr;
    u.uBox.value.set(rect.width, rect.height);
    u.uMouse.value.set(x, y);
    u.uLens.value = this.lens * Math.min(120, rect.width * 0.26);
  }
}
