import * as THREE from 'three';
import { INKS } from './glsl.js';

const FOV = 35;

// Converte a tinta hex em vec3 sem gerenciamento de cor: os shaders trabalham direto em sRGB
const toVec3 = hex => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

export const inkUniforms = () => ({
  uInk0: { value: toVec3(INKS[0]) },
  uInk1: { value: toVec3(INKS[1]) },
  uInk2: { value: toVec3(INKS[2]) },
  uInk3: { value: toVec3(INKS[3]) }
});

export function loadTexture(src) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(src, texture => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      resolve(texture);
    }, undefined, reject);
  });
}

/**
 * Um único canvas fixo atrás da página. Cada item é um plano que acompanha
 * a posição de um elemento do DOM, então o layout continua sendo do HTML.
 * A câmera é posicionada para que 1 unidade do mundo = 1 pixel CSS no plano z = 0.
 */
export class Stage {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'gl-stage';
    this.canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);
    this.items = [];
    this.time = 0;

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  get dpr() {
    return this.renderer.getPixelRatio();
  }

  resize() {
    // clientWidth desconta a barra de rolagem; innerWidth faria o canvas vazar para o lado
    this.width = document.documentElement.clientWidth;
    this.height = innerHeight;
    // O fundo cobre a tela inteira a cada quadro; 1,5x é o equilíbrio entre nitidez e custo em telas retina
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    // O tamanho na tela vem do CSS (.gl-stage); aqui só o buffer interno
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.position.z = (this.height / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.far = this.camera.position.z * 4;
    this.camera.updateProjectionMatrix();
    this.items.forEach(item => item.resize?.(this));
  }

  add(item) {
    this.items.push(item);
    this.scene.add(item.mesh);
    item.resize?.(this);
  }

  // Posiciona o plano exatamente sobre o elemento e diz se ele está perto da tela
  syncToElement(mesh, element, margin = 200) {
    const rect = element.getBoundingClientRect();
    mesh.scale.set(rect.width, rect.height, 1);
    mesh.position.set(
      rect.left + rect.width / 2 - this.width / 2,
      this.height / 2 - (rect.top + rect.height / 2),
      0
    );
    mesh.visible = rect.bottom > -margin && rect.top < this.height + margin && rect.width > 0;
    return rect;
  }

  render(deltaSeconds) {
    this.time += deltaSeconds;
    this.items.forEach(item => item.update(this, deltaSeconds));
    this.renderer.render(this.scene, this.camera);
  }
}
