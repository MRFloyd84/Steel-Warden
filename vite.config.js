import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

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
  // Title screen: version and build date
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [classicScriptForFileProtocol()],
  // Environment models (assets/props) are embedded as data URLs (?inline)
  assetsInclude: ['**/*.glb'],
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
  server: { open: true },
});
