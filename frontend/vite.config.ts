import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy chart library isolated so it can be cached separately
          'vendor-recharts': ['recharts'],
          // Animation library
          'vendor-motion': ['motion'],
          // Radix UI primitives
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-accordion',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
          ],
          // React + router core
          'vendor-react': ['react', 'react-dom', 'react-router'],
        },
      },
    },
    // Raise the warning threshold — recharts alone is ~384KB
    chunkSizeWarningLimit: 600,
  },
  server: {
    headers: {
      // Dev server: always revalidate
      'Cache-Control': 'no-cache',
    },
  },
  preview: {
    headers: {
      // HTML: revalidate so users always get latest entry point
      'Cache-Control': 'no-cache',
    },
  },
})
