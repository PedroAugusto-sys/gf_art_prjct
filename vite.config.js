import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Configuracao do Vite.
// - plugin-react: Fast Refresh + JSX.
// - tailwindcss: Tailwind CSS v4 integrado ao pipeline do Vite.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O Rapier e distribuido como WASM. O Vite lida com isso nativamente,
  // mas excluimos do pre-bundle para evitar problemas de otimizacao do esbuild.
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  server: {
    host: true, // permite abrir no celular pela rede local (ex.: http://SEU_IP:5173)
  },
})
