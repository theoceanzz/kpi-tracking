import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from './format'
import { DEFAULT_LANGUAGE, isSupportedLanguage } from './languages'

/**
 * Bộ định dạng gắn với ngôn ngữ hiện tại; component dùng hook này sẽ tự vẽ lại khi người dùng đổi
 * ngôn ngữ (gọi thẳng các hàm trong `format.ts` thì không).
 */
export function useFormat() {
  const { i18n } = useTranslation()
  const resolved = i18n.resolvedLanguage ?? i18n.language
  const lang = isSupportedLanguage(resolved) ? resolved : DEFAULT_LANGUAGE

  return useMemo(
    () => ({
      lang,
      number: (value: number | null | undefined, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, options, lang),
      currency: (value: number | null | undefined) => formatCurrency(value, lang),
      percent: (value: number | null | undefined, options?: Intl.NumberFormatOptions) =>
        formatPercent(value, options, lang),
      date: (value: string | number | Date | null | undefined) => formatDate(value, lang),
      dateTime: (value: string | number | Date | null | undefined) => formatDateTime(value, lang),
    }),
    [lang]
  )
}
