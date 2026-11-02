// Trechos GLSL compartilhados: matriz de Bayer, rampa de 4 tintas e ajuste de "cover"
// A paleta e a matriz são as mesmas de scripts/dither.py

export const INKS = ['#081a14', '#1e4636', '#5e9c80', '#c4dbd0'];

export const ditherChunk = /* glsl */ `
  uniform vec3 uInk0;
  uniform vec3 uInk1;
  uniform vec3 uInk2;
  uniform vec3 uInk3;
  uniform float uPixel;

  // Bayer 8x8 recursivo: devolve um limiar em [0, 1) para cada célula da tela
  float bayer2(vec2 a) {
    a = floor(a);
    return fract(dot(a, vec2(0.5, a.y * 0.75)));
  }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

  // O meio-passo (0.5 / 64) evita limiar zero, que acenderia uma célula a cada 8x8 mesmo no preto
  float threshold() {
    return bayer8(gl_FragCoord.xy / uPixel) + 0.0078125;
  }

  // Quantiza um valor de 0 a 1 nas 4 tintas, usando o limiar para decidir a fronteira
  vec3 inkRamp(float v, float t) {
    float x = clamp(v, 0.0, 1.0) * 3.0;
    float index = floor(x) + step(t, fract(x));
    if (index < 0.5) return uInk0;
    if (index < 1.5) return uInk1;
    if (index < 2.5) return uInk2;
    return uInk3;
  }

  float luma(vec3 c) {
    return dot(c, vec3(0.299, 0.587, 0.114));
  }
`;

export const coverChunk = /* glsl */ `
  // Mesmo comportamento de object-fit: cover
  vec2 coverUv(vec2 uv, vec2 box, vec2 image) {
    float boxRatio = box.x / box.y;
    float imageRatio = image.x / image.y;
    vec2 scale = boxRatio > imageRatio
      ? vec2(1.0, imageRatio / boxRatio)
      : vec2(boxRatio / imageRatio, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }
`;

export const noiseChunk = /* glsl */ `
  // Ruído de valor 2D + fbm, suficiente para um fluxo lento de fundo
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.0, 9.0);
      a *= 0.5;
    }
    return v;
  }
`;

// Formas do elemento central: estrela, anel e ondas. q é a posição normalizada
// pelo tamanho da forma; valores negativos = dentro. Não são SDFs exatas, só precisam ser
// contínuas e numa escala parecida para o "derretimento" entre elas ficar suave.
export const shapeChunk = /* glsl */ `
  float sdSparkle(vec2 q) {
    q = abs(q) + 1e-4;
    return (pow(q.x, 0.55) + pow(q.y, 0.55) - 0.62) * 0.6;
  }
  float sdRing(vec2 q) {
    return abs(length(q) - 0.42) - 0.045;
  }
  // Anéis concêntricos, como um radar
  float sdWaves(vec2 q) {
    float r = length(q);
    float rings = abs(mod(r + 0.07, 0.15) - 0.075) - 0.022;
    return max(rings, r - 0.46);
  }
  float sdShape(vec2 q, float index, float time) {
    float d0 = sdSparkle(q);
    float d1 = sdRing(q);
    float d2 = sdWaves(q);
    float i = clamp(index, 0.0, 2.0);
    float a = i < 1.0 ? d0 : d1;
    float b = i < 1.0 ? d1 : d2;
    return mix(a, b, fract(i) + step(2.0, i));
  }
`;
