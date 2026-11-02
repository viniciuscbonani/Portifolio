import { startEffects } from './lib/effects.js';
import { reducedMotion } from './lib/env.js';
import { revealOnScroll, scrambleOnScroll, setupMotion } from './lib/motion.js';

let stage = null;
const { gsap, ScrollTrigger } = setupMotion(delta => stage?.render(delta));

revealOnScroll('.case-block > *, .fact-sheet div, .next-project');
scrambleOnScroll('.case-block h2');

if (!reducedMotion) {
  gsap.from('.case-hero > :not(.fact-sheet):not(.case-cover)', { opacity: 0, y: 24, duration: 0.6, ease: 'steps(6)', stagger: 0.08, delay: 0.1 });
}

startEffects({ cover: document.querySelector('.case-cover img') }).then(result => { stage = result; });

// Pipeline: a linha "corre" conforme o scroll e cada etapa acende quando a linha chega nela
document.querySelectorAll('.flow').forEach(flow => {
  const steps = [...flow.querySelectorAll(':scope > li')];
  flow.classList.add('is-animated');
  steps[0]?.classList.add('is-current');

  if (reducedMotion) {
    flow.style.setProperty('--progress', 1);
    steps.forEach(step => step.classList.add('is-active'));
    return;
  }

  ScrollTrigger.create({
    trigger: flow,
    start: 'top 70%',
    end: 'bottom 55%',
    scrub: true,
    onUpdate: ({ progress }) => {
      flow.style.setProperty('--progress', progress.toFixed(4));
      let current = 0;
      steps.forEach((step, index) => {
        const active = progress >= index / steps.length;
        step.classList.toggle('is-active', active);
        if (active) current = index;
      });
      // A estrela do fundo segue a etapa atual (ver data-shape-anchor no HTML)
      steps.forEach((step, index) => step.classList.toggle('is-current', index === current));
    }
  });
});

/**
 * Fim da página: a rolagem para no título do próximo projeto. Parado ali, rolar mais para baixo
 * carrega o meio anel da esquerda para a direita e, cheio, leva ao próximo projeto (pelo mesmo
 * clique do link, com a cortina de transição). A rolagem que trouxe você até o fim não conta:
 * só vale um novo gesto, depois de uma pausa. Soltando antes de encher, o arco esvazia.
 * Sem hover (celular) ou com movimento reduzido, fica só o link.
 */
function setupNextLoader() {
  const next = document.querySelector('[data-next]');
  const link = next?.querySelector('.next-project');
  if (!link || reducedMotion || !matchMedia('(hover: hover)').matches) return;

  const CHARGE_PX = 450; // quanto de rolagem enche o arco (uns 4 ou 5 cliques de roda)
  const PAUSE_MS = 300; // pausa sem rolar, já no fim, antes de começar a valer
  const IDLE_MS = 350; // sem rolar por esse tempo, o arco começa a esvaziar
  let charge = 0;
  let fill = 0;
  let armed = false;
  let gone = false;
  let lastWheel = 0;

  const atBottom = () => next.getBoundingClientRect().bottom <= innerHeight + 4;

  addEventListener('wheel', event => {
    const now = performance.now();
    const quiet = now - lastWheel >= PAUSE_MS;
    lastWheel = now;
    if (gone || !atBottom()) return;
    // A inércia do trackpad chega como uma sequência contínua; só arma depois de uma pausa
    if (!armed && quiet) armed = true;
    if (!armed) return;
    const lines = event.deltaMode === 1 ? 40 : 1;
    charge = Math.min(1, Math.max(0, charge + (event.deltaY * lines) / CHARGE_PX));
  }, { passive: true });

  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(deltaMs, 100) / 1000;
    if (!atBottom()) {
      armed = false;
      charge = 0;
    } else if (!gone && charge < 1 && performance.now() - lastWheel > IDLE_MS) {
      charge = Math.max(0, charge - dt * 1.4);
    }
    if (gone) charge = 1;
    fill += (charge - fill) * (1 - Math.exp(-dt * 12));
    next.dataset.arc = fill.toFixed(4);
    if (charge >= 1 && fill > 0.97 && !gone) {
      gone = true;
      link.click();
    }
  });

  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    armed = false;
    gone = false;
    charge = 0;
    fill = 0;
  });
}

setupNextLoader();
