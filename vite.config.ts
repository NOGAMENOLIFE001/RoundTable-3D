import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Одна копия three на всё приложение (иначе предупреждение «Multiple instances of Three.js»)
  resolve: { dedupe: ['three'] },
  server: {
    port: 5173,
    // Клиент ходит к своему же origin, Vite проксирует Socket.io на сервер (порт 3001)
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
})
