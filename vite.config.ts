import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: Pon aquí el nombre de tu repositorio entre barras
  base: '/editor-libros-escom/', 
})