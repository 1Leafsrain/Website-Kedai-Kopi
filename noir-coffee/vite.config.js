import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),   // enables HTTPS with auto-generated self-signed cert
  ],
  server: {
    https: true,
    port: 5173,
    proxy: {
      '/api': {
        // Target the HTTPS backend; disable cert verification for self-signed certs
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,    // accept self-signed backend cert in dev
      },
    },
  },
})
