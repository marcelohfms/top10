/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { pluginApi } from './src/servidor/vite-plugin-api'

export default defineConfig({
  plugins: [react(), pluginApi()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setup-testes.ts'],
  },
})
