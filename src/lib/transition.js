import { reducedMotion } from './env.js';

/*
 * Transição entre páginas, no espírito do portfólio do Dennis Snellenberg:
 * 1. ao clicar, a tela é coberta célula a célula (na ordem da matriz de Bayer) e o nome do destino aparece;
 * 2. o navegador troca de página por baixo da cobertura (View Transitions + o script inline no <head>,
 *    que deixa a página nova já coberta desde o primeiro desenho);
 * 3. quando as fontes estão prontas, a cobertura se desfaz célula a célula.
 * A página de destino é baixada quando o mouse passa pelo link, então a troca costuma ser instantânea.
 */

const CELL = 12;
const COVER_MS = 520;
const REVEAL_MS = 640;
const KEY = 'vb-transition';
const INK = '#081a14';

function bayerMatrix() {
  let m = [[0, 2], [3, 1]];
  for (let i = 0; i < 2; i++) {
    const size = m.length;
    const next = Array.from({ length: size * 2 }, () => Array(size * 2));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = 4 * m[y][x];
        next[y][x] = v;
        next[y][x + size] = v + 2;
        next[y + size][x] = v + 3;
        next[y + size][x + size] = v + 1;
      }
    }
    m = next;
  }
  return m.map(row => row.map(v => (v + 0.5) / 64));
}

const BAYER = bayerMatrix();
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function createOverlay(title) {
  const root = document.createElement('div');
  root.className = 'page-transition';
  root.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(innerWidth / CELL);
  canvas.height = Math.ceil(innerHeight / CELL);
  const label = document.createElement('span');
  label.className = 'page-transition-title';
  label.textContent = title;
  root.append(canvas, label);
  document.body.append(root);
  return { root, canvas, label };
}

// progress 0 = tela livre, 1 = tela coberta
function paint(canvas, progress) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (BAYER[y % 8][x % 8] < progress) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function animate(duration, onFrame) {
  return new Promise(resolve => {
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      onFrame(easeInOut(t), t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

function isInternalPage(link) {
  if (link.target === '_blank' || link.hasAttribute('download')) return false;
  const url = new URL(link.href, location.href);
  return url.origin === location.origin && url.pathname !== location.pathname && /(\.html|\/)$/.test(url.pathname);
}

// O nome que aparece na cortina: o atributo do link ou o próprio texto dele
function titleFor(link) {
  if (link.dataset.transitionTitle) return link.dataset.transitionTitle;
  const text = link.textContent.replace(/[→↗←↓]/g, '').replace(/\s+/g, ' ').trim();
  return text.length <= 40 ? text : '';
}

const prefetched = new Set();
function prefetch(link) {
  const url = new URL(link.href, location.href);
  url.hash = '';
  if (prefetched.has(url.href)) return;
  prefetched.add(url.href);
  const hint = document.createElement('link');
  hint.rel = 'prefetch';
  hint.href = url.href;
  document.head.append(hint);
}

async function reveal() {
  const root = document.documentElement;
  const title = root.dataset.transitionTitle || '';
  const { root: overlay, canvas, label } = createOverlay(title);
  paint(canvas, 1);
  // Daqui em diante quem cobre é o canvas, não a cobertura em CSS do <head>
  root.classList.remove('is-entering');

  await document.fonts.ready;
  await new Promise(resolve => setTimeout(resolve, 120));
  await animate(REVEAL_MS, (eased, t) => {
    paint(canvas, 1 - eased);
    label.style.opacity = String(Math.max(0, 1 - t * 2.5));
  });
  overlay.remove();
}

export function setupPageTransitions() {
  const root = document.documentElement;
  if (reducedMotion) {
    root.classList.remove('is-entering');
    return;
  }

  if (root.classList.contains('is-entering')) reveal();

  document.addEventListener('pointerover', event => {
    const link = event.target.closest?.('a[href]');
    if (link && isInternalPage(link)) prefetch(link);
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (!isInternalPage(link)) return;

    event.preventDefault();
    const title = titleFor(link);
    const { canvas, label } = createOverlay(title);
    label.style.opacity = '0';
    animate(COVER_MS, (eased, t) => {
      paint(canvas, eased);
      label.style.opacity = String(Math.max(0, (t - 0.45) * 2));
    }).then(() => {
      try { sessionStorage.setItem(KEY, title); } catch { /* segue sem a cortina na próxima página */ }
      location.href = link.href;
    });
  });

  // Ao voltar pelo histórico, a página pode vir do cache ainda coberta
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    document.querySelectorAll('.page-transition').forEach(el => el.remove());
    root.classList.remove('is-entering');
  });
}
