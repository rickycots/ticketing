import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

function versionPlugin() {
  return {
    name: 'version-json',
    closeBundle() {
      try {
        const versionFile = fs.readFileSync(path.resolve(__dirname, 'src/version.js'), 'utf8')
        const match = versionFile.match(/APP_VERSION\s*=\s*'([^']+)'/)
        if (match) {
          fs.writeFileSync(path.resolve(__dirname, 'dist/version.json'), JSON.stringify({ version: match[1] }))
        }
      } catch(e) {}
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), versionPlugin()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  }
})
