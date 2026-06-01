import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base URL - raiz do domínio (sem subpath)
  base: '/',
  plugins: [
    viteSourceLocator({
      prefix: 'mgx',
    }),
    react(),
  ],
  server: {
    port: 5173, // Porta padrão do Vite (8080 conflita com Apache local)
    watch: { usePolling: true, interval: 800 /* 300~1500 */ },
  },
  build: {
    // Gera sourcemaps apenas em development
    sourcemap: mode === 'development',
    // Otimizações de build
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
