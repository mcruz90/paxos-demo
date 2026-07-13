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
    // Hermetic: api.test.ts asserts relative URLs, so a developer-local .env
    // enabling live mode (VITE_API_BASE_URL) must not leak into the suite.
    env: { VITE_API_BASE_URL: '' },
  },
})
