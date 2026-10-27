import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const siteOrigin = process.env.RUNIC_SITE_ORIGIN ?? 'https://runic-artifex.eu';

if (new URL(siteOrigin).origin !== siteOrigin) {
  throw new Error('RUNIC_SITE_ORIGIN must be an absolute URL origin');
}

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({
        precompress: true,
        strict: true,
      }),
      files: { assets: 'static' },
      paths: { origin: siteOrigin },
    }),
  ],
  build: { target: 'es2022' },
  server:
    process.env.CODEX_SANDBOX === 'seatbelt'
      ? { watch: { usePolling: true } }
      : undefined,
});
