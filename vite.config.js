import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
        admin: resolve(__dirname, 'admin.html'),
        loja: resolve(__dirname, 'loja.html'),
      },
    },
  },
});
