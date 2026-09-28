import i18n from 'i18next'

/**
 * Hằng số cấp module có chữ hiển thị (menu, bảng nhãn, tour, schema Zod...) không thể gọi `t()` lúc
 * import: khi đó i18next chưa khởi tạo xong và giá trị sẽ đứng yên ở một ngôn ngữ. Bọc chúng thành getter:
 *
 *   const STATUS_LABELS = perLanguage(() => ({ DRAFT: i18n.t(…key của câu "Bản nháp"…) }))
 *   STATUS_LABELS().DRAFT
 *
 * Kết quả được cache theo ngôn ngữ hiện tại: cùng một ngôn ngữ thì trả về CÙNG một object, nên dùng
 * làm deps của `useMemo` / `useEffect` không gây vòng lặp render. Đổi ngôn ngữ thì dựng lại.
 */
export function perLanguage<T>(build: () => T): () => T {
  let builtFor: string | undefined
  let hasValue = false
  let value: T
  return () => {
    const lang = i18n.language
    if (!hasValue || lang !== builtFor) {
      value = build()
      builtFor = lang
      hasValue = true
    }
    return value
  }
}
