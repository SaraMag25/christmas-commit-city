import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Split heavy vendor libraries so app updates preserve CDN & browser cache across deploys.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/phaser')) return 'phaser'
          if (id.includes('node_modules/react')) return 'react'
          return undefined
        },
      },
    },
  },
})
