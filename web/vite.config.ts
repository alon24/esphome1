import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../components/react_spa/dist',
    emptyOutDir: true,
    minify: 'terser'
  }
})
