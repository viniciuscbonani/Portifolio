# Portifolio

Portfólio de Vinícius Bonani. Estrutura em HTML e CSS, com uma camada de efeitos em WebGL:
retrato e projetos em dither de 4 tintas verdes (estilo Game Boy) e cards de projeto que se curvam com o scroll.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
```

## Estrutura

```text
index.html              home
projetos/index.html     todos os projetos (lista e grade)
projetos/*.html         estudos de caso
src/main.js             código comum + carrega home.js ou case.js
src/home.js             scroll, revelações, hover e WebGL da home
src/case.js             pipeline animado dos estudos de caso
src/projects.js         lista/grade e prévia que segue o cursor na página de projetos
src/gl/                 three.js: palco, shaders de dither, retrato e cards curvados
src/lib/                ambiente, scroll suave (Lenis + GSAP) e transição de página
src/styles/             tokens, base, home e estudo de caso
public/img/             imagens otimizadas (WebP) e versões estáticas em dither
scripts/dither.py       gera as versões em dither usadas sem WebGL
scripts/club_logos.py   gera os logos dos clubes em dither (ramificação da trajetória)
design/                 foto original em alta resolução
```

## Imagens

- Para trocar uma capa de projeto, substitua `public/img/projetos/<projeto>.webp` (proporção 2:1, 1600×800).
- Cocamar, Tractian, NVIDIA e BTG usam prints reais das interfaces. A Tractian foi capturada em modo
  de contingência (sem LLM) e a NVIDIA pela landing, já que o radar depende da API em Python.
- O Kairos usa a tela do Modo TV do wireframe de alta fidelidade (o app real precisa de PostgreSQL).
- Depois de trocar a foto, rode `python3 scripts/dither.py` para gerar a versão em dither usada sem WebGL.
- Logos dos clubes: coloque o PNG (fundo transparente) em `design/clubes/` (`academy.png`, `junior.png`)
  e rode `python3 scripts/club_logos.py`. Sem o arquivo, o script gera um selo provisório com as iniciais.
- Para acrescentar um projeto à página `projetos/index.html`, copie um `<li class="project">` e troque os dados.
- `src/assets/logos-atlas.png` tem os logos que o elemento do fundo assume (Inteli, Red Bull 24 Horas,
  NVIDIA, Cocamar, o letreiro da Tractian, Inteli Academy, Inteli Júnior e Code Club, nessa ordem), em tons
  de cinza, uma célula de 256×256 para cada um. Os três últimos são os logos em que o anel se divide na ramificação.
  Os logos também aparecem na abertura das páginas de projeto.
  Os logos vieram das pastas dos próprios projetos.

## Sem efeitos

Com `prefers-reduced-motion` ou sem WebGL, o site mostra imagens estáticas em dither e não usa scroll suave.
Em telas com menos de 768 px, os cards ficam retos e coloridos.

## Publicação

O workflow `.github/workflows/deploy.yml` publica no GitHub Pages a cada push na `main`.
Em Settings → Pages, a fonte precisa estar como "GitHub Actions".
