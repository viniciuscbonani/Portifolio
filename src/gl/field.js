import * as THREE from 'three';
import { ditherChunk, noiseChunk, shapeChunk } from './glsl.js';
import { inkUniforms, loadTexture } from './stage.js';
import logosAtlas from '../assets/logos-atlas.png';

const SHAPES = { sparkle: 0, ring: 1, waves: 2 };
// Ordem das células em src/assets/logos-atlas.png
const LOGOS = { inteli: 0, redbull: 1, nvidia: 2, cocamar: 3, tractian: 4, academy: 5, junior: 6, codeclub: 7, suno: 8 };
const LOGO_COUNT = 9;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fundo da página inteira: um fluxo de ruído (só onde a seção pede) e um único elemento central
// que muda de forma a cada seção — estrela, anel, ondas ou o logo de uma empresa.
// Na ramificação da trajetória, os logos dos três clubes se formam no lugar deles ("slots"),
// pixel a pixel, conforme o scroll. No fim das páginas de projeto, o anel vira um arco que
// "carrega" da esquerda para a direita antes de levar ao próximo projeto.
const fragment = /* glsl */ `
  ${ditherChunk}
  ${noiseChunk}
  ${shapeChunk}
  uniform sampler2D uLogos;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uShapeCenter;
  uniform float uShapeSize;
  uniform float uShapeIndex;
  uniform float uShapeIntensity;
  uniform float uLogoIndex;
  uniform float uLogoMix;
  uniform float uFlow;
  uniform float uSplit;
  uniform float uSplitIntensity;
  uniform vec3 uSlot0;
  uniform vec3 uSlot1;
  uniform vec3 uSlot2;
  uniform vec3 uSlotLogo;
  uniform vec3 uSlotProgress;
  uniform float uArc;
  varying vec2 vUv;

  float logoAt(vec2 q, float index) {
    if (abs(q.x) > 0.5 || abs(q.y) > 0.5) return 0.0;
    vec2 uv = vec2((q.x + 0.5 + index) / ${LOGO_COUNT}.0, 0.5 - q.y);
    return texture2D(uLogos, uv).r;
  }

  // Um "slot" da ramificação: o logo do clube se formando. Com progresso baixo, só os pontos mais
  // claros do dither aparecem; conforme o scroll avança, o logo vai se completando.
  // slot = (x, y, tamanho) em px de tela
  float slotValue(vec2 px, vec3 slot, float logoIndex, float progress) {
    if (progress < 0.01 || distance(px, slot.xy) > slot.z * 0.75) return 0.0;
    vec2 q = (px - slot.xy) / max(slot.z, 1.0);
    float shimmer = 0.35 + 0.5 * fbm(q * 3.5 + vec2(uTime * 0.12, -uTime * 0.08));
    return logoAt(q, logoIndex) * (0.7 + 0.3 * shimmer) * progress;
  }

  void main() {
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;

    // Fluxo de fundo: anda com o tempo e com o scroll; some nas seções que não o usam
    float flow = 0.0;
    if (uFlow > 0.01) {
      vec2 p = (px + vec2(0.0, uScroll * 0.35)) / 520.0;
      vec2 drift = vec2(uTime * 0.03, uTime * 0.017);
      float warp = fbm(p * 0.7 + drift);
      float n = fbm(p + vec2(warp * 1.7, warp * 0.8) - drift * 0.5);
      flow = smoothstep(0.58, 0.95, n) * 0.5 * uFlow;
      vec2 c = vUv - 0.5;
      flow *= mix(0.55, 1.15, smoothstep(0.15, 0.7, length(c * vec2(1.4, 1.0))));
      flow += 0.16 * uFlow * exp(-pow(distance(px, uMouse) / 230.0, 2.0));
    }

    // Elemento central
    vec2 q = (px - uShapeCenter) / max(uShapeSize, 1.0);
    float shimmer = 0.35 + 0.5 * fbm(q * 3.5 + vec2(uTime * 0.12, -uTime * 0.08));
    float d = sdShape(q, uShapeIndex, uTime);
    float inside = 1.0 - smoothstep(-0.015, 0.015, d);
    float halo = exp(-max(d, 0.0) * 9.0) * 0.26;
    float shape = inside * shimmer + halo;

    // Logo: troca entre células do atlas com um cruzamento suave
    float i0 = floor(uLogoIndex);
    float logo = mix(logoAt(q, i0), logoAt(q, min(i0 + 1.0, ${LOGO_COUNT - 1}.0)), fract(uLogoIndex));
    logo *= 0.7 + 0.3 * shimmer;

    float element = mix(shape, logo, uLogoMix) * uShapeIntensity;

    // Arco que carrega: acende o anel da esquerda (0) até a direita (1), passando pelo topo
    if (uArc > 0.001) {
      float along = 1.0 - atan(-q.y, q.x) / 3.14159265;
      float lit = 1.0 - smoothstep(uArc - 0.03, uArc, along);
      float band = 1.0 - smoothstep(-0.015, 0.015, sdRing(q));
      element = max(element, band * lit * (0.48 + 0.18 * shimmer) * step(q.y, 0.02));
    }

    if (uSplitIntensity > 0.01) {
      float slots = max(slotValue(px, uSlot0, uSlotLogo.x, uSlotProgress.x),
                    max(slotValue(px, uSlot1, uSlotLogo.y, uSlotProgress.y),
                        slotValue(px, uSlot2, uSlotLogo.z, uSlotProgress.z)));
      element = max(element, slots * uSplitIntensity);
    }

    float v = max(flow, element);
    // Valores muito baixos virariam uma grade regular de pontos; melhor deixar o fundo limpo
    if (v < 0.08) discard;
    vec3 inked = inkRamp(v, threshold());
    if (inked == uInk0) discard;
    gl_FragColor = vec4(inked, 1.0);
  }
`;

const pointer = { x: -9999, y: -9999 };
addEventListener('pointermove', event => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
}, { passive: true });

/**
 * Configuração vinda dos atributos data-shape-* da seção ativa. Ela é lida a cada quadro,
 * então o JS da página pode trocar a forma no meio da seção (como faz a trajetória).
 */
function readConfig(section, width, height) {
  const d = section.dataset;
  const anchor = d.shapeAnchor ? section.querySelector(d.shapeAnchor) : null;
  let x = parseFloat(d.shapeX ?? 0.5) * width;
  let y = parseFloat(d.shapeY ?? 0.5) * height;
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    // "start": ponto fixo a partir do canto do elemento (data-shape-dx/dy, em px), ex.: o ponto de uma etapa;
    // "bottom": centro na borda de baixo do elemento, ex.: o meio anel no fim das páginas de projeto
    const start = d.shapeAlign === 'start';
    x = start ? rect.left + parseFloat(d.shapeDx ?? 20) : rect.left + rect.width / 2;
    y = start ? rect.top + parseFloat(d.shapeDy ?? 20) : d.shapeAlign === 'bottom' ? rect.bottom : rect.top + rect.height / 2;
  }
  let size = d.shapePx ? parseFloat(d.shapePx) : parseFloat(d.shapeSize ?? 0.5) * height;
  // "fit": em telas estreitas, a forma não passa da largura (ex.: o meio anel no celular)
  if (d.shapeFit === 'width') size = Math.min(size, width * 1.05);
  return {
    x,
    y,
    size,
    shape: d.shape in SHAPES ? SHAPES[d.shape] : null,
    logo: d.shape === 'logo' ? LOGOS[d.shapeLogo] ?? 0 : null,
    intensity: d.shape === 'none' ? 0 : parseFloat(d.shapeIntensity ?? 0.5),
    flow: parseFloat(d.shapeFlow ?? 0)
  };
}

export class DitherField {
  static async create(options) {
    const logos = await loadTexture(logosAtlas);
    return new DitherField(logos, options);
  }

  constructor(logos, { flow = 1 } = {}) {
    this.sections = [...document.querySelectorAll('[data-shape]')];
    this.flowScale = flow;
    this.current = { x: innerWidth / 2, y: innerHeight / 2, size: 300, shape: 0, logo: 0, logoMix: 0, intensity: 0, flow: 0 };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        ...inkUniforms(),
        uLogos: { value: logos },
        uPixel: { value: 3 },
        uRes: { value: new THREE.Vector2() },
        uMouse: { value: new THREE.Vector2(-9999, -9999) },
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uShapeCenter: { value: new THREE.Vector2() },
        uShapeSize: { value: 300 },
        uShapeIndex: { value: 0 },
        uShapeIntensity: { value: 0 },
        uLogoIndex: { value: 0 },
        uLogoMix: { value: 0 },
        uFlow: { value: 0 },
        uSplit: { value: 0 },
        uSplitIntensity: { value: 0 },
        uSlot0: { value: new THREE.Vector3() },
        uSlot1: { value: new THREE.Vector3() },
        uSlot2: { value: new THREE.Vector3() },
        uSlotLogo: { value: new THREE.Vector3() },
        uSlotProgress: { value: new THREE.Vector3() },
        uArc: { value: 0 }
      },
      depthTest: false,
      depthWrite: false
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.renderOrder = -1;
  }

  // A seção que cruza o meio da tela manda no elemento central
  activeSection(height) {
    const middle = height / 2;
    let best = this.sections[0];
    for (const section of this.sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= middle && rect.bottom >= middle) return section;
      if (rect.top <= middle) best = section;
    }
    return best;
  }

  update(stage, delta) {
    const { width, height } = stage;
    this.mesh.scale.set(width, height, 1);

    const section = this.activeSection(height);
    const target = section ? readConfig(section, width, height) : null;
    const c = this.current;

    // Primeiro quadro: começa direto na forma da seção visível, sem passar pelas outras
    if (target && !this.started) {
      this.started = true;
      Object.assign(c, {
        x: target.x,
        y: target.y,
        size: target.size,
        shape: target.shape ?? c.shape,
        logo: target.logo ?? c.logo,
        logoMix: target.logo !== null ? 1 : 0,
        flow: target.flow * this.flowScale
      });
    }

    // Logo que ainda não está visível troca na hora, para não "passar" pelos outros logos do atlas
    if (target?.logo != null && c.logoMix < 0.05) c.logo = target.logo;

    // Ao trocar de seção, tudo anda devagar (inclusive a posição) por um instante;
    // depois a posição volta a seguir rápido, para acompanhar âncoras como o marcador da trajetória
    if (section !== this.activeSectionRef) {
      this.activeSectionRef = section;
      this.changedAt = stage.time;
    }
    const settling = stage.time - (this.changedAt ?? -10) < 1.4;
    const fast = 1 - Math.exp(-delta * 7);
    const slow = 1 - Math.exp(-delta * 2.4);
    const follow = settling ? slow : fast;
    if (target) {
      c.x += (target.x - c.x) * follow;
      c.y += (target.y - c.y) * follow;
      c.size += (target.size - c.size) * slow;
      if (target.shape !== null) c.shape += (target.shape - c.shape) * slow;
      if (target.logo !== null) c.logo += (target.logo - c.logo) * slow;
      c.logoMix += ((target.logo !== null ? 1 : 0) - c.logoMix) * slow;
      c.intensity += (target.intensity - c.intensity) * slow;
      c.flow += (target.flow * this.flowScale - c.flow) * slow;
    }

    const u = this.material.uniforms;
    u.uPixel.value = 3 * stage.dpr;
    u.uRes.value.set(width, height);
    u.uMouse.value.set(pointer.x, pointer.y);
    u.uTime.value = stage.time;
    u.uScroll.value = scrollY;
    u.uShapeCenter.value.set(c.x, c.y);
    u.uShapeSize.value = c.size;
    u.uShapeIndex.value = c.shape;
    u.uShapeIntensity.value = c.intensity;
    u.uLogoIndex.value = c.logo;
    u.uLogoMix.value = c.logoMix;
    u.uFlow.value = c.flow;
    // Progresso do arco no fim da página (data-arc, escrito pelo case.js; já vem suavizado)
    u.uArc.value = parseFloat(section?.dataset.arc ?? 0);
    this.updateSplit(stage, delta);
  }

  /**
   * Ramificação ([data-split]): o progresso vem do scroll (data-split, de 0 a 1, escrito pelo home.js)
   * e é suavizado aqui. Cada logo se forma no lugar da sua imagem, um pouco depois do anterior,
   * crescendo levemente enquanto aparece.
   */
  updateSplit(stage, delta) {
    const u = this.material.uniforms;
    this.branch ??= document.querySelector('[data-split]');
    const branch = this.branch;
    const section = branch?.closest('[data-shape]');
    const c = this.current;
    const slow = 1 - Math.exp(-delta * 3);

    c.split = (c.split ?? 0) + ((parseFloat(branch?.dataset.split ?? 0)) - (c.split ?? 0)) * slow;
    c.splitIntensity = (c.splitIntensity ?? 0) + ((section?.dataset.inBranch ? 1 : 0) - (c.splitIntensity ?? 0)) * slow;
    u.uSplit.value = c.split;
    u.uSplitIntensity.value = c.splitIntensity;
    if (!branch || c.splitIntensity < 0.01) return;

    const logos = [...branch.querySelectorAll('[data-split-logo]')];
    const slots = [u.uSlot0, u.uSlot1, u.uSlot2];
    logos.slice(0, 3).forEach((logo, i) => {
      // Escalonado: cada logo começa quando o anterior está na metade
      const local = THREE.MathUtils.clamp((c.split - i * 0.18) / 0.64, 0, 1);
      const ease = local * local * (3 - 2 * local);
      const r = logo.getBoundingClientRect();
      slots[i].value.set(r.left + r.width / 2, r.top + r.height / 2, r.width * 1.05 * (0.88 + 0.12 * ease));
      u.uSlotLogo.value.setComponent(i, LOGOS[logo.dataset.splitLogo] ?? 0);
      u.uSlotProgress.value.setComponent(i, ease);
    });
  }
}
