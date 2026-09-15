import type { UnitBellTarget, UnitClassBellCurve } from '../api/organizationApi'

/** Làm tròn 1 chữ số — % hiển thị, không cần hơn. */
export const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * Trần % → SỐ người. GIỐNG HỆT `UnitClassificationService.maxQuota` ở backend: luôn chừa ít
 * nhất một suất khi trần > 0, nếu không 10% của 7 người thành 0 suất và khung biến thành lệnh
 * cấm mức đó. Số hiện trên màn cấu hình phải đúng bằng số backend sẽ chặn.
 */
export const maxQuota = (percent: number, headcount: number) =>
  percent <= 0 ? 0 : Math.max(1, Math.round((percent * headcount) / 100))

/** Sàn % → số người: làm tròn thường (sàn chỉ để nhắc, không cần ưu ái như trần). */
export const minQuota = (percent: number, headcount: number) => Math.round((percent * headcount) / 100)

export const sumTargets = (targets: UnitBellTarget[]) =>
  r1(targets.reduce((a, t) => a + (Number(t.percent) || 0), 0))

/** Làm tròn bộ % về số nguyên mà TỔNG vẫn đúng 100 — phần dư dồn vào mức lớn nhất. */
export function roundTo100(levelNames: string[], percents: number[]): UnitBellTarget[] {
  const rounded = percents.map(p => Math.round(p))
  const drift = 100 - rounded.reduce((a, b) => a + b, 0)
  if (drift !== 0 && rounded.length) {
    let big = 0
    rounded.forEach((v, i) => { if (v > rounded[big]!) big = i })
    rounded[big] = Math.max(0, rounded[big]! + drift)
  }
  return levelNames.map((level, i) => ({ level, percent: rounded[i] ?? 0 }))
}

/**
 * Bộ tỷ lệ hình chuông cho thang hiện tại.
 *
 * @param levelNames mức CAO → THẤP (thứ tự chuẩn của org)
 * @param shift      dịch đỉnh chuông: âm = siết (đỉnh về phía mức thấp), dương = nới
 * @param spread     độ "bè" của chuông; càng lớn càng dàn đều
 */
export function bellTargets(levelNames: string[], shift = 0, spread = 4): UnitBellTarget[] {
  const n = levelNames.length
  if (!n) return []
  // Trục vị trí tính từ mức THẤP nhất (x = 0) để đỉnh chuông rơi vào khoảng giữa thang.
  const peak = (n - 1) / 2 + shift
  const sigma = Math.max(0.6, n / spread)
  const raw = levelNames.map((_, i) => {
    const x = n - 1 - i
    return Math.exp(-((x - peak) ** 2) / (2 * sigma * sigma))
  })
  const sum = raw.reduce((a, b) => a + b, 0) || 1
  return roundTo100(levelNames, raw.map(v => (v * 100) / sum))
}

/** Khung mặc định khi người dùng vừa bật bell curve lần đầu — chưa bật chế độ chặn. */
export function defaultBellCurve(levelNames: string[]): UnitClassBellCurve {
  return { enabled: true, mode: 'warn', minMembers: 5, tolerance: 5, targets: bellTargets(levelNames) }
}

/**
 * Khung đọc từ cấu hình đã lưu, quy về ĐÚNG thang hiện tại: thiếu mức nào thì bù 0%, khung khai
 * toàn tên mức đã biến mất (đổi ma trận / sửa thang điểm) thì bỏ hẳn — giữ lại chỉ tạo ra hạn
 * mức treo trên những mức không còn tồn tại.
 */
export function bellCurveForLevels(
  bc: UnitClassBellCurve | undefined, levelNames: string[],
): UnitClassBellCurve | undefined {
  if (!bc || !levelNames.length) return undefined
  const byLevel = new Map((bc.targets ?? []).map(t => [t.level, Number(t.percent) || 0]))
  if (![...byLevel.keys()].some(l => levelNames.includes(l))) return undefined
  return {
    enabled: !!bc.enabled,
    mode: bc.mode === 'block' ? 'block' : 'warn',
    minMembers: Number.isFinite(bc.minMembers) ? bc.minMembers : 5,
    tolerance: Number.isFinite(bc.tolerance) ? bc.tolerance : 5,
    targets: levelNames.map(level => ({ level, percent: byLevel.get(level) ?? 0 })),
  }
}
