import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_LANGUAGE, detectBrowserLanguage, isSupportedLanguage, type Language } from '@/i18n/languages'

/**
 * Ngôn ngữ giao diện phía trình duyệt. Khi đã đăng nhập, nguồn chuẩn là `preferredLanguage` trên server —
 * store này chỉ là bản sao để render ngay khi tải trang, và là nguồn duy nhất khi CHƯA đăng nhập.
 * Luồng đồng bộ hai bên nằm ở `i18n/languageSync.ts` (§7 I18N_DESIGN).
 */
interface LanguageState {
  language: Language
  /** true = người dùng tự chọn; false = đoán từ trình duyệt / mặc định tổ chức, không đẩy lên server. */
  explicit: boolean
  /** Có lựa chọn chưa lưu được lên server (PATCH lỗi) — sẽ gửi lại lần sau. */
  pendingSync: boolean
  update: (patch: Partial<Pick<LanguageState, 'language' | 'explicit' | 'pendingSync'>>) => void
}

export const LANGUAGE_STORAGE_KEY = 'language-storage'

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: detectBrowserLanguage() ?? DEFAULT_LANGUAGE,
      explicit: false,
      pendingSync: false,
      update: (patch) => set(patch),
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ language: s.language, explicit: s.explicit, pendingSync: s.pendingSync }),
      // Bản lưu bị sửa tay hoặc từ phiên bản có ngôn ngữ đã bị bỏ: về lại giá trị mặc định.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LanguageState>
        return isSupportedLanguage(p.language)
          ? { ...current, language: p.language, explicit: !!p.explicit, pendingSync: !!p.pendingSync }
          : current
      },
    }
  )
)
