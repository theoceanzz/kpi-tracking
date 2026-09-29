import { toast } from 'sonner'
import i18n from 'i18next'
import { authApi } from '@/features/auth/api/authApi'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from '@/store/authStore'
import { LANGUAGE_STORAGE_KEY, useLanguageStore } from '@/store/languageStore'
import type { UserInfo } from '@/types/auth'
import { isSupportedLanguage, type Language } from './languages'

/**
 * Đồng bộ ngôn ngữ giữa trình duyệt (localStorage) và tài khoản (server). Bảng tình huống:
 * `docs/I18N_DESIGN.md` §7.2.
 *
 * - Chưa đăng nhập: chỉ localStorage.
 * - Đã đăng nhập: server là nguồn chuẩn. Đổi ngôn ngữ thì giao diện đổi ngay rồi PATCH lên server;
 *   PATCH lỗi thì giữ giao diện, đặt `pendingSync` và gửi lại lần sau.
 * - Vừa đăng nhập: server đã có lựa chọn → dùng server; server chưa có mà máy này có lựa chọn do người
 *   dùng tự chọn → đẩy lên server; chỉ là ngôn ngữ đoán từ trình duyệt → không đẩy, theo tổ chức.
 */

const store = () => useLanguageStore.getState()

/** Đổi ngôn ngữ giao diện (không đụng tới server). */
function applyLanguage(lang: Language) {
  if (i18n.language === lang) return
  void i18n.changeLanguage(lang).then(() => {
    document.documentElement.lang = lang
  })
  // Dữ liệu server trả câu đã dịch (lỗi, nhãn) theo Accept-Language cũ — lấy lại theo ngôn ngữ mới.
  void queryClient.invalidateQueries()
}

let inFlight: Promise<void> | null = null
let queued: { lang: Language; notify: boolean } | null = null

/**
 * PATCH lựa chọn lên server. Người dùng đổi liên tiếp trong lúc request trước chưa xong thì chỉ gửi
 * lựa chọn CUỐI sau khi request trước kết thúc, để server không dừng ở một giá trị cũ.
 */
function pushToServer(lang: Language, notify: boolean) {
  queued = { lang, notify }
  if (inFlight) return
  inFlight = (async () => {
    while (queued) {
      const current = queued
      queued = null
      try {
        const user = await authApi.updateMyPreferences({ language: current.lang })
        if (!queued) {
          store().update({ pendingSync: false })
          useAuthStore.getState().setUser(user)
        }
      } catch {
        store().update({ pendingSync: true })
        if (!queued && current.notify) toast.warning(i18n.t('language.saveFailed'))
      }
    }
  })().finally(() => {
    inFlight = null
  })
}

/** Người dùng chọn ngôn ngữ ở ô chọn. */
export function chooseLanguage(lang: Language) {
  const authenticated = useAuthStore.getState().isAuthenticated
  // pendingSync bật TRƯỚC khi gửi: đóng tab giữa chừng thì lần mở sau vẫn biết phải gửi lại,
  // thay vì để giá trị cũ trên server ghi đè lựa chọn vừa rồi.
  store().update({ language: lang, explicit: true, pendingSync: authenticated })
  applyLanguage(lang)
  if (authenticated) pushToServer(lang, true)
}

/** Gọi mỗi khi hồ sơ người dùng đổi (đăng nhập, tải lại /auth/me, PATCH xong). */
function reconcileWithServer(user: UserInfo) {
  const local = store()

  // Có lựa chọn chưa lưu được: lựa chọn trên máy là thao tác mới nhất, gửi lại (im lặng nếu lại lỗi).
  if (local.pendingSync && local.explicit) {
    pushToServer(local.language, false)
    return
  }

  // Hồ sơ cache từ bản cũ chưa có field này — chờ lần tải /auth/me kế tiếp.
  if (!('preferredLanguage' in user)) return

  const server = user.preferredLanguage
  if (isSupportedLanguage(server)) {
    if (server !== local.language || !local.explicit) store().update({ language: server, explicit: true })
    applyLanguage(server)
    return
  }

  if (local.explicit) {
    store().update({ pendingSync: true })
    pushToServer(local.language, false)
    return
  }

  // Chưa ai tự chọn: theo ngôn ngữ mặc định của tổ chức, và KHÔNG đẩy lên server (vẫn là "theo tổ chức").
  const effective = isSupportedLanguage(user.effectiveLanguage) ? user.effectiveLanguage : local.language
  if (effective !== local.language) store().update({ language: effective })
  applyLanguage(effective)
}

let started = false

export function initLanguageSync() {
  if (started) return
  started = true

  useAuthStore.subscribe((state, prev) => {
    if (state.user && state.user !== prev.user) reconcileWithServer(state.user)
  })

  const { user, isAuthenticated } = useAuthStore.getState()
  if (isAuthenticated && user) reconcileWithServer(user)

  // Tab khác đổi ngôn ngữ: đọc lại localStorage và áp dụng.
  window.addEventListener('storage', (event) => {
    if (event.key !== LANGUAGE_STORAGE_KEY) return
    void Promise.resolve(useLanguageStore.persist.rehydrate()).then(() => applyLanguage(store().language))
  })

  // Có mạng lại thì gửi lựa chọn còn treo.
  window.addEventListener('online', () => {
    const local = store()
    if (local.pendingSync && local.explicit && useAuthStore.getState().isAuthenticated) {
      pushToServer(local.language, false)
    }
  })
}
