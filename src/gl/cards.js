import * as THREE from 'three';
import { coverChunk, ditherChunk } from './glsl.js';
import { inkUniforms, loadTexture } from './stage.js';

// Cada vértice é "enrolado" num cilindro deitado: perto do centro da tela o card fica reto,
// e quanto mais longe ele está, mais se curva para trás (o efeito do Featured Work do Ricardo Chance).
const vertex = /* glsl */ `
  uniform float uRadius;
  uniform float uBend;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    float angle = clamp(world.y / uRadius, -1.35, 1.35);
    vec3 bent = vec3(world.x, uRadius * sin(angle), uRadius * (cos(angle) - 1.0));
    world.xyz = mix(world.xyz, bent, uBend);
    vDepth = (1.0 - cos(angle)) * uBend;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Fora do foco o card fica em dither; no centro ele se revela em cores, pixel a pixel
const fragment = /* glsl */ `
  ${ditherChunk}
  ${coverChunk}
  uniform sampler2D uTex;
  uniform vec2 uBox;
  uniform vec2 uImage;
  uniform float uFocus;
  uniform float uHover;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec2 uv = coverUv(vUv, uBox, uImage);
    uv = (uv - 0.5) * (1.0 - uHover * 0.04) + 0.5;
    vec3 color = texture2D(uTex, uv).rgb;

    float t = threshold();
    vec3 inked = inkRamp((luma(color) - 0.5) * 1.15 + 0.5, t);
    vec3 result = t < uFocus ? color : inked;

    // Escurece conforme a curva se afasta, para dar profundidade
    result *= 1.0 - clamp(vDepth * 1.6, 0.0, 0.55);
    gl_FragColor = vec4(result, 1.0);
  }
`;

/**
 * Card de projeto em WebGL.
 * - mode "scroll" (home): curva (bend 1) e foco dependem da distância até o centro da tela;
 *   com bend 0 o card fica reto.
 * - mode "reveal" (capa do estudo de caso): fica reto e se revela em cores logo depois de carregar.
 */
export class WorkCard {
  static async create(image, options) {
    const texture = await loadTexture(image.currentSrc || image.src);
    return new WorkCard(image, texture, options);
  }

  constructor(image, texture, { mode = 'scroll', bend = 1 } = {}) {
    this.image = image;
    this.mode = mode;
    this.bend = bend;
    this.age = 0;
    this.hover = 0;
    this.hovering = false;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        ...inkUniforms(),
        uPixel: { value: 2 },
        uTex: { value: texture },
        uBox: { value: new THREE.Vector2() },
        uImage: { value: new THREE.Vector2(texture.image.width, texture.image.height) },
        uRadius: { value: 1000 },
        uBend: { value: 1 },
        uFocus: { value: 0 },
        uHover: { value: 0 }
      },
      depthTest: false,
      depthWrite: false
    });
    // Segmentos verticais suficientes para a curva ficar lisa
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 48), this.material);
    this.mesh.renderOrder = 1;

    const link = image.closest('a') || image;
    link.addEventListener('pointerenter', () => { this.hovering = true; });
    link.addEventListener('pointerleave', () => { this.hovering = false; });
  }

  update(stage, delta) {
    const rect = stage.syncToElement(this.mesh, this.image, 400);
    const u = this.material.uniforms;
    this.start ??= performance.now();
    this.age = (performance.now() - this.start) / 1000;
    this.hover += ((this.hovering ? 1 : 0) - this.hover) * Math.min(1, delta * 8);

    let focus;
    if (this.mode === 'reveal') {
      u.uBend.value = 0;
      focus = Math.max(0, (this.age - 0.5) * 0.8);
    } else {
      u.uBend.value = this.bend;
      // 1 no centro da tela, 0 a partir de ~45% de distância
      const center = rect.top + rect.height / 2;
      const offset = Math.abs(center - stage.height / 2) / stage.height;
      focus = 1 - THREE.MathUtils.smoothstep(offset, 0.06, 0.45);
    }

    u.uFocus.value = Math.min(1.001, focus + this.hover * 0.6);
    u.uHover.value = this.hover;
    u.uRadius.value = stage.height * 0.62;
    u.uPixel.value = 2 * stage.dpr;
    u.uBox.value.set(rect.width, rect.height);
  }
}
