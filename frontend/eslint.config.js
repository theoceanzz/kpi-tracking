import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noVietnameseLiteral from './eslint-rules/no-vietnamese-literal.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Đa ngôn ngữ: chữ hiển thị nằm ở src/locales/, không viết cứng trong code (docs/I18N_DESIGN.md §4.2).
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      // Tên riêng của ngân hàng theo VietQR — dữ liệu, không dịch.
      'src/features/wallet/constants/banks.ts',
      // Test không hiển thị gì cho người dùng; tên test viết tiếng Việt như phần còn lại của dự án.
      'src/**/*.test.{ts,tsx}',
    ],
    plugins: { local: { rules: { 'no-vietnamese-literal': noVietnameseLiteral } } },
    rules: { 'local/no-vietnamese-literal': 'error' },
  },
])
