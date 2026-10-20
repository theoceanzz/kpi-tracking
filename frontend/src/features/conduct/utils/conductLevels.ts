import type { ConductLevelDescriptions } from '../api/conductApi'

/** Thang dài hơn số mức này thì không định nghĩa theo mức (cũng là lúc phiếu chấm thôi hiện nút từng mức). */
export const MAX_DEFINED_LEVELS = 10

/**
 * Các mức định nghĩa được của thang `min..max`, từ CAO xuống THẤP (phiếu giấy đọc mức tốt nhất trước).
 * Thang không nguyên hoặc quá dài ⇒ rỗng: khi đó không có "mức" rõ ràng để mô tả.
 */
export function conductLevels(min: number, max: number): number[] {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max <= min || max - min + 1 > MAX_DEFINED_LEVELS) return []
  return Array.from({ length: max - min + 1 }, (_, i) => max - i)
}

/** Mô tả của đúng một mức; điểm lẻ (3.5) hay mức chưa định nghĩa ⇒ null. */
export function levelText(levels: ConductLevelDescriptions | null | undefined, score: number | null | undefined): string | null {
  if (!levels || score == null || !Number.isInteger(score)) return null
  const text = levels[String(score)]?.trim()
  return text ? text : null
}

/** Các mức đã định nghĩa trong thang, cao → thấp — để hiện bảng mức dưới tiêu chí. */
export function definedLevels(levels: ConductLevelDescriptions | null | undefined, min: number, max: number) {
  return conductLevels(min, max)
    .map(level => ({ level, text: levelText(levels, level) }))
    .filter((l): l is { level: number; text: string } => l.text != null)
}

/** Bản gửi lên server: bỏ mức ngoài thang và mô tả trống; không còn gì ⇒ null. */
export function cleanLevels(levels: ConductLevelDescriptions | null | undefined, min: number, max: number): ConductLevelDescriptions | null {
  const out: ConductLevelDescriptions = {}
  for (const { level, text } of definedLevels(levels, min, max)) out[String(level)] = text
  return Object.keys(out).length ? out : null
}
