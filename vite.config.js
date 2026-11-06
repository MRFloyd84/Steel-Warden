import { defineConfig } from 'vite';

// Browsers block ES-module scripts on file:// URLs. For the offline build we
// bundle everything into one classic (IIFE) script so dist/index.html can be
// opened by double-click without a web server.
function classicScriptForFileProtocol() {
  return {
    name: 'classic-script-for-file-protocol',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"')
        .replace(/<link rel="modulepreload"[^>]*>/g, '');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [classicScriptForFileProtocol()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
  server: { open: true },
});
