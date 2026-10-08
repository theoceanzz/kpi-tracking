import { defineConfig } from '@playwright/test'

/**
 * Test đầu-cuối chạy trên app THẬT (frontend dev + backend + DB dev đang chạy sẵn):
 *   E2E_PASSWORD=<mật khẩu tài khoản mẫu> npm run e2e
 * Dùng Chrome đã cài trên máy (channel 'chrome') nên không phải tải trình duyệt riêng.
 */
export default defineConfig({
  testDir: './e2e',
  // Mỗi vai trò đi ~20 màn trên app thật.
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    channel: 'chrome',
    headless: true,
    locale: 'vi-VN',
  },
})
