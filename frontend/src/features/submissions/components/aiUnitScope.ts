import type { AiCriteriaSet } from '../api/aiReviewApi'

/** Giá trị "cả tổ chức" của ô chọn đơn vị — Radix không cho `SelectItem value=""`. */
export const ALL_UNITS = '__all__'

/** Khoá phạm vi của một bộ: id đơn vị, hoặc {@link ALL_UNITS} cho cả tổ chức. */
export const scopeKey = (orgUnitId?: string | null) => orgUnitId ?? ALL_UNITS

/**
 * Dấu trên một đơn vị của ô chọn:
 * - `own`: đang áp tài liệu mình quản (dấu tích) — mỗi đơn vị một tài liệu, phải ngừng tài liệu đó trước;
 * - `locked`: đang áp tài liệu do cấp trên áp (ổ khoá) — chỉ gửi đề nghị được.
 * `selectable` = vẫn cho chọn (để hiện lý do + nút gửi đề nghị).
 */
export interface UnitMark {
  kind: 'own' | 'locked'
  title: string
  selectable?: boolean
}

/** Tài liệu đang áp ở đúng phạm vi `unitId` (null = cả tổ chức), bỏ qua `exceptId`. */
export function activeAt(sets: AiCriteriaSet[], unitId: string | null | undefined, exceptId?: string) {
  return sets.find(s => s.status === 'CONFIRMED' && s.id !== exceptId && scopeKey(s.orgUnitId) === scopeKey(unitId))
}

/**
 * Dấu cho ô chọn đơn vị từ danh sách bộ: mọi tài liệu ĐANG ÁP trừ chính `exceptId`. `lockedSelectable` = đơn vị
 * cấp trên đang áp vẫn chọn được (nhân bản / áp lại → gửi đề nghị).
 */
export function unitMarks(sets: AiCriteriaSet[], exceptId: string | undefined, lockedSelectable: boolean) {
  const marks = new Map<string, UnitMark>()
  for (const s of sets) {
    if (s.status !== 'CONFIRMED' || s.id === exceptId) continue
    marks.set(scopeKey(s.orgUnitId), s.locked
      ? { kind: 'locked', title: s.lockReason ?? `Đang áp «${s.title}» do cấp trên áp dụng`, selectable: lockedSelectable }
      : { kind: 'own', title: `Đang áp «${s.title}» — ngừng áp dụng tài liệu đó trước`, selectable: false })
  }
  return marks
}
