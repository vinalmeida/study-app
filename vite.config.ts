import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "src"),
  publicDir: resolve(__dirname, "public"),
  envDir: __dirname,
  // Em desenvolvimento, as chamadas de dados vão para o servidor local (pnpm server).
  server: {
    proxy: { "/api": "http://127.0.0.1:5174" },
  },
  css: {
    postcss: {},
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
