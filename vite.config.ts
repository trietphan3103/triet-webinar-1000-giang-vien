import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': '/src' }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: env.DISABLE_HMR !== 'true',
      proxy: {
        '/api/analytics': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/api/submit': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
