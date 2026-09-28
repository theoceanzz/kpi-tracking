import { enGB, vi } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import type { Language } from './languages'

/** Locale cho `Intl.NumberFormat`: vi dùng `1.000,5`, en dùng `1,000.5`. */
export const INTL_LOCALES: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
}

/**
 * Locale cho `toLocaleDateString` / `Intl.DateTimeFormat`. en dùng en-GB (ngày trước tháng: 26/09/2026) —
 * cùng thứ tự với tiếng Việt, nên người dùng đổi qua lại không bao giờ đọc nhầm ngày với tháng.
 */
export const INTL_DATE_LOCALES: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-GB',
}

/** Locale cho date-fns và react-day-picker. en dùng en-GB: tuần bắt đầu thứ Hai như lịch Việt Nam. */
export const DATE_FNS_LOCALES: Record<Language, Locale> = {
  vi,
  en: enGB,
}

/**
 * Mẫu ngày (date-fns). Khi NHẬP, cả hai ngôn ngữ đều dùng `dd/MM/yyyy` — đã chốt để người dùng chuyển
 * qua lại giữa hai ngôn ngữ không phải đoán ngày trước hay tháng trước. Khi HIỂN THỊ, en viết tháng bằng
 * chữ (`26 Sep 2026`) nên cũng không thể đọc nhầm. Luôn 24 giờ.
 */
export const DATE_PATTERNS: Record<Language, { date: string; dateTime: string; input: string; inputPlaceholder: string }> = {
  vi: { date: 'dd/MM/yyyy', dateTime: 'dd/MM/yyyy HH:mm', input: 'dd/MM/yyyy', inputPlaceholder: 'dd/mm/yyyy' },
  en: { date: 'd MMM yyyy', dateTime: 'd MMM yyyy, HH:mm', input: 'dd/MM/yyyy', inputPlaceholder: 'dd/mm/yyyy' },
}
