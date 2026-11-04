// @ts-expect-error Shared build configuration is a JavaScript module.
import { sites } from './scripts/site-config.mjs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Self-contained app: public/ (including public/data/*.json) is served in dev
// and copied into dist/ on build. The data files are placeholders for the
// pipeline's published output; in production the same paths are served next
// to the app (GitHub Pages or CloudFront).
//
// base './' keeps every asset and data URL relative, so the build works at a
// domain root and under a sub-path such as /dhde-app/ on GitHub Pages.
if (process.env.VITE_SITE && !Object.hasOwn(sites, process.env.VITE_SITE)) throw new Error(`Unknown VITE_SITE: ${process.env.VITE_SITE}. Expected ${Object.keys(sites).join(', ')}`)

export default defineConfig({
  base: './',
  publicDir: process.env.VITE_SITE ? `build/site-public/${process.env.VITE_SITE}` : 'public',
  build: { outDir: process.env.VITE_SITE ? `dist/${process.env.VITE_SITE}` : 'dist' },
  plugins: [react(), tailwindcss()],
})
