import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Disable source maps in production — never expose source code
    sourcemap: false,
    // Minify + mangle variable names
    minify: 'terser',
    terserOptions: {
      compress: {
        // Strip all console.* calls from production bundle
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.error', 'console.info', 'console.debug'],
      },
      mangle: true,
    },
  },
})
