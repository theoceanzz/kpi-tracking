import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Dùng chung alias `@` và plugin với vite.config; chỉ thêm môi trường DOM (localStorage, sự kiện storage).
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
}))
