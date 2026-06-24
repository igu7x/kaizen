// vite.config.ts
import { defineConfig } from "file:///C:/Users/sgrocha/Documents/Projetos/kaizen/kaizen_base/kaizen_ft/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/sgrocha/Documents/Projetos/kaizen/kaizen_base/kaizen_ft/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { viteSourceLocator } from "file:///C:/Users/sgrocha/Documents/Projetos/kaizen/kaizen_base/kaizen_ft/node_modules/@metagptx/vite-plugin-source-locator/dist/index.mjs";
var __vite_injected_original_dirname = "C:\\Users\\sgrocha\\Documents\\Projetos\\kaizen\\kaizen_base\\kaizen_ft";
var vite_config_default = defineConfig(({ mode }) => ({
  // Base URL - raiz do domínio (sem subpath)
  base: "/",
  plugins: [
    viteSourceLocator({
      prefix: "mgx"
    }),
    react()
  ],
  server: {
    port: 5173,
    // Porta padrão do Vite (8080 conflita com Apache local)
    watch: {
      usePolling: true,
      interval: 800
      /* 300~1500 */
    }
  },
  build: {
    // Gera sourcemaps apenas em development
    sourcemap: mode === "development",
    // Otimizações de build
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzZ3JvY2hhXFxcXERvY3VtZW50c1xcXFxQcm9qZXRvc1xcXFxrYWl6ZW5cXFxca2FpemVuX2Jhc2VcXFxca2FpemVuX2Z0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxzZ3JvY2hhXFxcXERvY3VtZW50c1xcXFxQcm9qZXRvc1xcXFxrYWl6ZW5cXFxca2FpemVuX2Jhc2VcXFxca2FpemVuX2Z0XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9zZ3JvY2hhL0RvY3VtZW50cy9Qcm9qZXRvcy9rYWl6ZW4va2FpemVuX2Jhc2Uva2FpemVuX2Z0L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2MnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgdml0ZVNvdXJjZUxvY2F0b3IgfSBmcm9tICdAbWV0YWdwdHgvdml0ZS1wbHVnaW4tc291cmNlLWxvY2F0b3InO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcclxuICAvLyBCYXNlIFVSTCAtIHJhaXogZG8gZG9tXHUwMEVEbmlvIChzZW0gc3VicGF0aClcclxuICBiYXNlOiAnLycsXHJcbiAgcGx1Z2luczogW1xyXG4gICAgdml0ZVNvdXJjZUxvY2F0b3Ioe1xyXG4gICAgICBwcmVmaXg6ICdtZ3gnLFxyXG4gICAgfSksXHJcbiAgICByZWFjdCgpLFxyXG4gIF0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTczLCAvLyBQb3J0YSBwYWRyXHUwMEUzbyBkbyBWaXRlICg4MDgwIGNvbmZsaXRhIGNvbSBBcGFjaGUgbG9jYWwpXHJcbiAgICB3YXRjaDogeyB1c2VQb2xsaW5nOiB0cnVlLCBpbnRlcnZhbDogODAwIC8qIDMwMH4xNTAwICovIH0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgLy8gR2VyYSBzb3VyY2VtYXBzIGFwZW5hcyBlbSBkZXZlbG9wbWVudFxyXG4gICAgc291cmNlbWFwOiBtb2RlID09PSAnZGV2ZWxvcG1lbnQnLFxyXG4gICAgLy8gT3RpbWl6YVx1MDBFN1x1MDBGNWVzIGRlIGJ1aWxkXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgdmVuZG9yOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1ksU0FBUyxvQkFBb0I7QUFDL1osT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHlCQUF5QjtBQUhsQyxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBO0FBQUEsRUFFekMsTUFBTTtBQUFBLEVBQ04sU0FBUztBQUFBLElBQ1Asa0JBQWtCO0FBQUEsTUFDaEIsUUFBUTtBQUFBLElBQ1YsQ0FBQztBQUFBLElBQ0QsTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQUUsWUFBWTtBQUFBLE1BQU0sVUFBVTtBQUFBO0FBQUEsSUFBbUI7QUFBQSxFQUMxRDtBQUFBLEVBQ0EsT0FBTztBQUFBO0FBQUEsSUFFTCxXQUFXLFNBQVM7QUFBQTtBQUFBLElBRXBCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLFFBQVEsQ0FBQyxTQUFTLGFBQWEsa0JBQWtCO0FBQUEsUUFDbkQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
