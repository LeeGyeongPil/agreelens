import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// Content-Security-Policy injected into the production build only (the dev server needs HMR websockets).
// connect-src 'none' means the built page cannot make any network request: data never leaves the browser.
export const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'"

function cspForBuild(): Plugin {
  return {
    name: 'agreelens-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      // Insert the tag as plain text so the apostrophes stay literal (tag objects would escape them as &#39;).
      handler(html: string) {
        return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), cspForBuild()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // minify is off on purpose: with Vite 8's minifier papaparse's `_config` handling breaks in the built page
  // ("Cannot read properties of undefined (reading 'skipEmptyLines')"), which unit tests cannot see.
  build: { target: 'es2022', minify: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
