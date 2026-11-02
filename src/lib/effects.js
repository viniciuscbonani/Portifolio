import { canUseEffects, isSmallScreen } from './env.js';

/**
 * Liga o palco WebGL com o fundo em dither e, conforme a página, o retrato,
 * os cards curvados, os cards retos (grade de projetos) ou a capa do estudo de caso. Devolve o palco, ou null quando
 * o aparelho não suporta (ou a pessoa pediu menos movimento).
 */
export async function startEffects({ portrait, cards = [], flatCards = [], cover } = {}) {
  if (!canUseEffects()) return null;

  try {
    const [{ Stage }, { DitherField }, { HeroPortrait }, { WorkCard }] = await Promise.all([
      import('../gl/stage.js'),
      import('../gl/field.js'),
      import('../gl/hero.js'),
      import('../gl/cards.js')
    ]);

    const items = [await DitherField.create({ flow: isSmallScreen() ? 0.7 : 1 })];

    // Sem image.decode(): no Chrome ela pode nunca resolver com a aba em segundo plano,
    // e o carregador de texturas já espera a imagem baixar
    if (portrait) {
      items.push(await HeroPortrait.create(portrait));
    }

    // Cards curvados só em telas largas; no celular ficam retos e coloridos
    const curvedCards = cards.length > 0 && !isSmallScreen();
    if (curvedCards) {
      items.push(...await Promise.all(cards.map(image => WorkCard.create(image))));
    }

    // Cards retos (bend 0): entram em dither e se revelam em cores no centro da tela
    if (flatCards.length) {
      items.push(...await Promise.all(flatCards.map(image => WorkCard.create(image, { bend: 0 }))));
    }

    if (cover) {
      items.push(await WorkCard.create(cover, { mode: 'reveal' }));
    }

    const stage = new Stage();
    items.forEach(item => stage.add(item));
    const root = document.documentElement;
    root.classList.add('gl-on');
    root.classList.toggle('gl-cards', curvedCards);
    root.classList.toggle('gl-cover', Boolean(cover));
    root.classList.toggle('gl-flat', flatCards.length > 0);
    return stage;
  } catch (error) {
    // Se algo falhar no WebGL, o site continua com as imagens normais
    console.warn('WebGL desativado:', error);
    document.documentElement.classList.remove('gl-on', 'gl-cards', 'gl-cover', 'gl-flat');
    document.querySelector('.gl-stage')?.remove();
    return null;
  }
}
