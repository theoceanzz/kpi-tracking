import 'i18next'

/**
 * Không khai báo `resources`: với ~26 namespace và hàng nghìn key, kiểu hoá toàn bộ key làm `tsc` chậm
 * và dễ vỡ ("type instantiation is excessively deep"). Thay vào đó `npm run i18n:check` kiểm tra mọi key
 * dùng trong code (`t('…')`, `i18n.t('ns:…')`) đều có trong bản gốc tiếng Việt.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    returnNull: false
  }
}
