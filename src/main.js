import { setupPageTransitions } from './lib/transition.js';

setupPageTransitions();

// Cada página carrega só o JS que usa
const page = document.body.dataset.page;
if (page === 'home') import('./home.js');
if (page === 'case') import('./case.js');
if (page === 'projects') import('./projects.js');

// Copia o email para a área de transferência e confirma no próprio botão
document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = 'copiado ✓';
    } catch {
      button.textContent = 'não deu :(';
    }
    setTimeout(() => { button.textContent = 'copiar'; }, 1800);
  });
});


// Marca no topo a seção que está no meio da tela
const navLinks = [...document.querySelectorAll('.topbar nav a[href^="#"]')];
const sections = navLinks
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

if (sections.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${entry.target.id}`) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    });
  }, { rootMargin: '-50% 0px -50% 0px' });

  sections.forEach(section => observer.observe(section));
}
