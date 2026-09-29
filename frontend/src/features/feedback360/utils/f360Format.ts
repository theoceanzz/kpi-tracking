import { intlDateLocale } from '@/i18n/format'
/** Hàm định dạng dùng chung của tính năng 360 — tách khỏi file component để fast refresh chạy đúng. */

/** Ngày giờ ISO → "dd/MM/yyyy". */
export function fmtDate(iso?: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(intlDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** ISO → giá trị cho DateTimePicker ("yyyy-MM-ddTHH:mm", giờ địa phương). */
export function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "yyyy-MM-ddTHH:mm" (giờ địa phương) → ISO; rỗng → null. */
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null
}

export function fmtScore(v?: number | null, digits = 2) {
  return v == null ? '-' : v.toFixed(digits).replace(/\.?0+$/, '')
}

export interface PickedUser {
  id: string
  fullName: string
  email?: string
  avatarUrl?: string | null
}
