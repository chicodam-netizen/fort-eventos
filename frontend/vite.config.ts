import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function resolverCommitHash(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(resolverCommitHash()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8002', changeOrigin: true },
    },
  },
})
