import { startEffects } from './lib/effects.js';
import { reducedMotion } from './lib/env.js';
import { revealOnScroll, scrambleOnScroll, setupMotion } from './lib/motion.js';

let stage = null;
const { gsap, ScrollTrigger } = setupMotion(delta => stage?.render(delta));

revealOnScroll([
  '.work-head .label',
  '.work-left',
  '.work-right',
  '.section-head .label',
  '.section-lead',
  '.more-projects',
  '.about-text',
  '.journey-intro .label',
  '.journey-lead',
  '.branch-label',
  '.stack-group',
  '.contact .label',
  '.contact-row'
].join(','));
scrambleOnScroll('[data-scramble]');

// Entrada do hero: o texto aparece em degraus, logo depois do carregamento
if (!reducedMotion) {
  gsap.from('.hero-grid > div > *', { opacity: 0, y: 24, duration: 0.6, ease: 'steps(6)', stagger: 0.07, delay: 0.15 });
}

setupJourney();
setupBranch();
setupCursorBadge();

startEffects({
  portrait: document.querySelector('.portrait .photo'),
  cards: [...document.querySelectorAll('.work-card .shot img')]
}).then(result => { stage = result; });

/**
 * Trajetória: a linha se preenche com o scroll, o marcador desce junto
 * (e o brilho em dither do fundo o acompanha) e o item mais perto do centro acende.
 */
function setupJourney() {
  const list = document.querySelector('.journey-list');
  const line = document.querySelector('.journey-line');
  if (!list || !line) return;
  const section = list.closest('section');
  const items = [...list.querySelectorAll('.journey-item')];

  const update = progress => {
    line.style.setProperty('--progress', progress.toFixed(4));
    const middle = innerHeight / 2;
    let active = 0;
    items.forEach((item, index) => {
      if (item.getBoundingClientRect().top < middle) active = index;
    });
    items.forEach((item, index) => {
      item.classList.toggle('is-active', index === active);
      item.classList.toggle('is-past', index < active);
    });

    // O elemento em dither do fundo vira a forma ou o logo do marco ativo
    // (na ramificação dos clubes quem manda é setupBranch)
    if (section.dataset.inBranch) return;
    const mark = items[active].dataset;
    section.dataset.shapeAnchor = '.journey-marker';
    section.dataset.shape = mark.mark;
    if (mark.logo) section.dataset.shapeLogo = mark.logo;
    section.dataset.shapePx = mark.mark === 'logo' ? '132' : '110';
  };

  // Sem animação, todos os marcos ficam acesos e a linha cheia
  if (reducedMotion) {
    line.style.setProperty('--progress', 1);
    items.forEach(item => item.classList.add('is-active'));
    return;
  }

  update(0);
  ScrollTrigger.create({
    trigger: list,
    start: 'top center',
    end: 'bottom center',
    onUpdate: ({ progress }) => update(progress)
  });
}


// Sobre os cards de projeto, um selo "abrir" acompanha o cursor
function setupCursorBadge() {
  if (!matchMedia('(hover: hover)').matches) return;
  const badge = document.createElement('div');
  badge.className = 'cursor-badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = 'abrir';
  document.body.append(badge);

  const moveX = gsap.quickTo(badge, 'x', { duration: 0.35, ease: 'power3' });
  const moveY = gsap.quickTo(badge, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', event => {
    moveX(event.clientX);
    moveY(event.clientY);
  }, { passive: true });

  document.querySelectorAll('.work-card .shot').forEach(shot => {
    shot.addEventListener('pointerenter', () => badge.classList.add('is-visible'));
    shot.addEventListener('pointerleave', () => badge.classList.remove('is-visible'));
  });
}


/**
 * Ramificação depois da Cocamar: a linha da trajetória desce até um ponto e se divide em três
 * caminhos, um para cada clube. Os caminhos se desenham com o scroll e, no fim de cada um,
 * o logo do clube se forma em dither, um depois do outro.
 */
function setupBranch() {
  const branch = document.querySelector('.journey-branch');
  const line = document.querySelector('.journey-line');
  if (!branch || !line) return;
  const section = branch.closest('section');
  const svg = branch.querySelector('.branch-lines');
  const fork = branch.querySelector('.journey-fork');
  const label = branch.querySelector('.branch-label');
  const logos = [...branch.querySelectorAll('.branch-logo')];
  let paths = [];
  let drawn = reducedMotion ? 1 : 0;

  const setDrawn = value => {
    drawn = value;
    paths.forEach(path => { path.style.strokeDashoffset = String(1 - drawn); });
  };

  const layout = () => {
    const box = branch.getBoundingClientRect();
    const lineBox = line.getBoundingClientRect();
    const x = lineBox.left + lineBox.width / 2 - box.left;
    const forkY = parseFloat(getComputedStyle(branch).paddingTop) * 0.45;
    fork.style.left = `${x}px`;
    fork.style.top = `${forkY}px`;
    // O rótulo fica ao lado da divisão, fora do caminho das linhas
    label.style.left = `${x + 90}px`;
    label.style.top = `${forkY}px`;

    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.innerHTML = logos.map(logo => {
      const r = logo.getBoundingClientRect();
      const tx = r.left + r.width / 2 - box.left;
      const ty = r.top - box.top - 12;
      const bend = (ty - forkY) * 0.6;
      return `<path pathLength="1" stroke-dasharray="1" d="M ${x} 0 V ${forkY} C ${x} ${forkY + bend}, ${tx} ${ty - bend}, ${tx} ${ty}"/>`;
    }).join('');
    paths = [...svg.querySelectorAll('path')];
    setDrawn(drawn);
  };

  layout();
  addEventListener('resize', layout);
  // As imagens e as fontes mudam a altura dos itens depois de carregar
  addEventListener('load', layout);
  document.fonts.ready.then(layout);

  if (reducedMotion) return;

  // Os caminhos se desenham e os logos se formam no ritmo do scroll, terminando com os logos
  // ainda no meio da tela; o field.js suaviza o progresso, então fica suave mesmo com o scroll rápido
  const list = branch.querySelector('.branch-list');
  ScrollTrigger.create({
    trigger: branch,
    start: 'top 85%',
    endTrigger: list,
    end: 'center 60%',
    scrub: true,
    onUpdate: ({ progress }) => {
      setDrawn(Math.min(1, progress / 0.6));
      branch.dataset.split = Math.max(0, (progress - 0.3) / 0.7).toFixed(4);
    }
  });

  // Enquanto a ramificação está na tela, o fundo desenha os logos (e não o elemento da trajetória)
  ScrollTrigger.create({
    trigger: branch,
    start: 'top 60%',
    end: 'bottom top',
    onToggle: ({ isActive }) => {
      if (isActive) {
        section.dataset.inBranch = 'true';
        section.dataset.shape = 'none';
      } else {
        delete section.dataset.inBranch;
      }
    }
  });
}
