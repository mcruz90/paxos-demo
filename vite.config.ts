/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Unit tests cover extracted pure functions — node env, no DOM needed.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
