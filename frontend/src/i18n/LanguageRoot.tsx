import { Fragment, useEffect, useState, type ReactElement } from 'react'
import i18n from 'i18next'

/**
 * Dựng lại toàn bộ cây React khi đổi ngôn ngữ. Chữ dịch nằm cả ngoài component (`i18n.t()` trong hàm
 * tiện ích, hằng số `perLanguage()`), những chỗ đó không tự vẽ lại theo `useTranslation` — remount là cách
 * duy nhất chắc chắn mọi chữ trên màn hình đổi cùng lúc. Đổi ngôn ngữ là thao tác hiếm, mất trạng thái
 * tạm (dialog đang mở, ô đang gõ dở) là chấp nhận được; URL và cache dữ liệu (React Query) vẫn giữ.
 */
export default function LanguageRoot({ render }: { render: () => ReactElement }) {
  const [language, setLanguage] = useState(i18n.language)
  useEffect(() => {
    const onChange = (lng: string) => setLanguage(lng)
    i18n.on('languageChanged', onChange)
    return () => i18n.off('languageChanged', onChange)
  }, [])
  return <Fragment key={language}>{render()}</Fragment>
}
