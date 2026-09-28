import i18n, { type BackendModule, type ReadCallback } from 'i18next'
import { initReactI18next } from 'react-i18next'
import reviewStatus from '@/locales/review-status.json'
import { useLanguageStore } from '@/store/languageStore'
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './languages'

/**
 * Khởi tạo i18next. Thiết kế: `docs/I18N_DESIGN.md` §4.
 *
 * - Mỗi feature một namespace (`src/locales/<ngôn ngữ>/<namespace>.json`), mỗi file một chunk riêng. Mọi
 *   namespace của ngôn ngữ đang dùng (và tiếng Việt làm dự phòng) được nạp TRƯỚC khi render (`main.tsx`):
 *   `i18n.t()` ngoài component và các hằng số `perLanguage()` không suspend được như hook, nên phải chắc
 *   chữ đã có sẵn. Ngôn ngữ còn lại chỉ tải khi người dùng chuyển sang.
 * - Tiếng Việt là bản gốc và là `fallbackLng`: key nào bản dịch chưa có thì hiện tiếng Việt.
 * - Bản dịch chưa được người đọc lại (`review-status.json` ≠ "reviewed") KHÔNG được nạp — người dùng thấy
 *   tiếng Việt thay vì bản dịch máy. Người review bật `VITE_I18N_SHOW_UNREVIEWED=true` để xem bản nháp.
 */

type ReviewStatus = Record<string, Record<string, string>>

const loaders = import.meta.glob<{ default: Record<string, unknown> }>('../locales/*/*.json')

const SHOW_UNREVIEWED = import.meta.env.VITE_I18N_SHOW_UNREVIEWED === 'true'

/** Danh sách namespace = các file của bản gốc tiếng Việt. */
export const NAMESPACES = Object.keys(loaders)
  .map((file) => /\.\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(file))
  .filter((m): m is RegExpExecArray => !!m && m[1] === DEFAULT_LANGUAGE)
  .map((m) => m[2] as string)

function isServed(lng: string, ns: string): boolean {
  if (lng === DEFAULT_LANGUAGE || SHOW_UNREVIEWED) return true
  return (reviewStatus as unknown as ReviewStatus)[lng]?.[ns] === 'reviewed'
}

const lazyBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(lng: string, ns: string, callback: ReadCallback) {
    const load = loaders[`../locales/${lng}/${ns}.json`]
    // Không có file, hoặc chưa được review: trả rỗng để i18next rơi về tiếng Việt.
    if (!load || !isServed(lng, ns)) {
      callback(null, {})
      return
    }
    load()
      .then((module) => callback(null, module.default as never))
      .catch((error: unknown) => callback(error as Error, null))
  },
}

export const i18nReady = i18n
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    lng: useLanguageStore.getState().language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: 'languageOnly',
    ns: NAMESPACES,
    defaultNS: 'common',
    // Nạp tiếng Việt kèm theo ngay từ đầu: key nào bản dịch thiếu thì rơi về đây mà không phải chờ tải.
    preload: [DEFAULT_LANGUAGE],
    // React đã escape khi render; escape thêm sẽ hiện `&amp;` trong câu.
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  .then(() => {
    document.documentElement.lang = i18n.language
  })

export default i18n
