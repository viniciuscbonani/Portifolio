import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos para funcionar no GitHub Pages (/Portifolio/) sem configuração extra
  base: './',
  build: {
    // O three.js sozinho passa de 500 kB (≈133 kB com gzip) e só carrega na home
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        projetos: resolve(import.meta.dirname, 'projetos/index.html'),
        cocamar: resolve(import.meta.dirname, 'projetos/cocamar.html'),
        tractian: resolve(import.meta.dirname, 'projetos/tractian.html'),
        nvidia: resolve(import.meta.dirname, 'projetos/nvidia.html'),
        suno: resolve(import.meta.dirname, 'projetos/suno.html')
      }
    }
  }
});
