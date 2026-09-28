/**
 * Danh sách ngôn ngữ hỗ trợ — khớp `SupportedLanguages` ở backend. Thêm ngôn ngữ: thêm mã vào đây,
 * thêm thư mục `src/locales/<mã>/`, thêm vào `INTL_LOCALES` / `DATE_FNS_LOCALES` trong `dateLocales.ts`
 * và `review-status.json`. Thiết kế: `docs/I18N_DESIGN.md`.
 */
export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'vi'

/** Tên ngôn ngữ viết bằng CHÍNH ngôn ngữ đó, để người không đọc được ngôn ngữ hiện tại vẫn tìm ra. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  // eslint-disable-next-line local/no-vietnamese-literal -- tên ngôn ngữ luôn viết bằng chính nó, không dịch
  vi: 'Tiếng Việt',
  en: 'English',
}

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

/** Ngôn ngữ đầu tiên của trình duyệt mà app hỗ trợ ("en-US" → "en"); không có thì null. */
export function detectBrowserLanguage(): Language | null {
  if (typeof navigator === 'undefined') return null
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of candidates) {
    const base = tag?.toLowerCase().split('-')[0]
    if (isSupportedLanguage(base)) return base
  }
  return null
}
