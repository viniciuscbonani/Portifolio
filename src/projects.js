import { startEffects } from './lib/effects.js';
import { reducedMotion } from './lib/env.js';
import { revealOnScroll, setupMotion } from './lib/motion.js';

let stage = null;
const { gsap } = setupMotion(delta => stage?.render(delta));

const VIEW_KEY = 'vb-projects-view';
const projects = document.querySelector('.projects');
const list = document.querySelector('.projects-list');

revealOnScroll('.projects-head, .project');

if (!reducedMotion) {
  gsap.from('.projects-title, .view-switch', { opacity: 0, y: 30, duration: 0.6, ease: 'steps(6)', stagger: 0.1, delay: 0.15 });
}

setupViewSwitch();
setupPreview();
startEffects({ flatCards: [...document.querySelectorAll('.project-media img')] }).then(result => { stage = result; });

// Lista ou grade; a escolha fica guardada para a próxima visita
function setupViewSwitch() {
  const buttons = [...document.querySelectorAll('[data-view][aria-pressed]')];

  const apply = view => {
    projects.dataset.view = view;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  };

  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === 'list' || saved === 'grid') apply(saved);
  } catch { /* sem localStorage, começa na lista */ }

  buttons.forEach(button => {
    button.addEventListener('click', () => {
      apply(button.dataset.view);
      try { localStorage.setItem(VIEW_KEY, button.dataset.view); } catch { /* segue sem guardar */ }
    });
  });
}

// Na lista, a imagem do projeto aparece numa moldura que segue o cursor
function setupPreview() {
  const hoverable = matchMedia('(hover: hover)').matches;
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
  addEventListener('pointermove', event => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  }, { passive: true });

  let preview, image, moveX, moveY;
  let visible = false;
  if (hoverable) {
    preview = document.createElement('div');
    preview.className = 'project-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = '<img alt=""><span class="project-preview-cta">ver</span>';
    document.body.append(preview);
    image = preview.querySelector('img');
    // Centrada no cursor (pelo GSAP, que também cuida da posição e da escala)
    gsap.set(preview, { xPercent: -50, yPercent: -50 });
    moveX = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
    moveY = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
    addEventListener('pointermove', () => {
      moveX(pointer.x);
      moveY(pointer.y);
    }, { passive: true });
  }

  const show = state => {
    if (!preview || state === visible) return;
    // Ao aparecer, a moldura nasce já no cursor (sem "voar" a partir do canto da tela)
    if (state) gsap.set(preview, { x: pointer.x, y: pointer.y });
    visible = state;
    gsap.to(preview, { scale: state ? 1 : 0, duration: 0.45, ease: 'power3.out', overwrite: 'auto' });
  };

  list.querySelectorAll('.project').forEach(item => {
    item.addEventListener('pointerenter', () => {
      if (!preview || projects.dataset.view !== 'list') return;
      const source = item.querySelector('img');
      image.src = source.currentSrc || source.src;
      show(true);
    });
  });
  list.addEventListener('pointerleave', () => show(false));
  // Trocar de visualização com o mouse ainda sobre a lista não pode deixar a prévia presa na tela
  document.querySelectorAll('[data-view][aria-pressed]').forEach(button => {
    button.addEventListener('click', () => show(false));
  });
}
