import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // VITE_API_BASE_URL을 비우면 프론트는 상대경로 /api 로 호출하고,
    // dev 서버가 운영 API로 프록시한다 (로컬 백엔드 없이 실데이터 검증용).
    proxy: {
      "/api": {
        target: "https://api.unifile.store",
        changeOrigin: true,
      },
    },
  },
})
