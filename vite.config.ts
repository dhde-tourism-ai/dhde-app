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
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
