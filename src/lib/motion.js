import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { reducedMotion } from './env.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll suave (Lenis) ligado ao relógio do GSAP, para que ScrollTrigger e WebGL
 * leiam a mesma posição de scroll no mesmo quadro.
 * `onFrame` recebe o delta em segundos e roda depois do scroll ser atualizado.
 */
export function setupMotion(onFrame) {
  let lenis = null;

  if (!reducedMotion) {
    lenis = new Lenis({ lerp: 0.11, anchors: { offset: -72 } });
    lenis.on('scroll', ScrollTrigger.update);
  }

  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time, deltaMs) => {
    lenis?.raf(time * 1000);
    onFrame?.(Math.min(deltaMs / 1000, 0.05));
  });

  return { gsap, ScrollTrigger, lenis };
}

/**
 * Entrada "retrô" dos blocos: a opacidade e o deslocamento andam em degraus,
 * como a animação de um jogo de poucos quadros.
 */
export function revealOnScroll(selector) {
  const elements = gsap.utils.toArray(selector);
  if (reducedMotion || !elements.length) return;

  gsap.set(elements, { opacity: 0, y: 28 });
  ScrollTrigger.batch(elements, {
    start: 'top 90%',
    once: true,
    onEnter: batch => gsap.to(batch, {
      opacity: 1,
      y: 0,
      duration: 0.55,
      ease: 'steps(6)',
      stagger: 0.08
    })
  });
}

const GLYPHS = '01<>/\\{}[]#%*+=?';

// Título "decodificado": cada letra passa por caracteres aleatórios antes de assentar, da esquerda para a direita
function scramble(element, duration = 800) {
  const text = element.textContent;
  const start = performance.now();
  const order = [...text].map((_, i) => (i / text.length) * 0.65 + Math.random() * 0.35);

  const frame = now => {
    const t = Math.min(1, (now - start) / duration);
    element.textContent = [...text]
      .map((char, i) => (char === ' ' || t >= order[i] ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
      .join('');
    if (t < 1) requestAnimationFrame(frame);
    else element.textContent = text;
  };
  requestAnimationFrame(frame);
}

export function scrambleOnScroll(selector) {
  if (reducedMotion) return;
  gsap.utils.toArray(selector).forEach(element => {
    element.setAttribute('aria-label', element.textContent);
    ScrollTrigger.create({ trigger: element, start: 'top 88%', once: true, onEnter: () => scramble(element) });
  });
}
