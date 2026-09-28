import i18n from 'i18next'
import { DEFAULT_LANGUAGE } from '@/i18n/languages'

/**
 * Ảnh chụp / video của trang giới thiệu theo ngôn ngữ đang xem.
 *
 * Bản tiếng Việt (gốc) nằm ở `public/landing/<tệp>`; bản ngôn ngữ khác đặt cùng tên trong
 * `public/landing/<mã ngôn ngữ>/<tệp>` (vd. `public/landing/en/dashboard.webp`). Chưa có bản dịch thì
 * `fallback` là bản gốc — nơi dùng chuyển sang nó khi tải lỗi, nên thêm dần từng tệp cũng không vỡ trang.
 */
export function landingMedia(file: string): { src: string; fallback: string } {
  const fallback = `/landing/${file}`
  const lang = i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LANGUAGE
  return { src: lang === DEFAULT_LANGUAGE ? fallback : `/landing/${lang}/${file}`, fallback }
}

/** `onError` cho `<img>`: bản theo ngôn ngữ chưa có thì hiện bản gốc (chỉ đổi một lần, không lặp). */
export function fallbackTo(fallback: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback
  }
}
