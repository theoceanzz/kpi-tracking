/**
 * Dòng phụ mô tả con số của một hạng mục BSC, dùng chung cho dropdown chọn hạng mục ở form KPI
 * và form OKR.
 *
 * <p>Chỉ có tên hạng mục thì người gán không biết mình đang gắn chỉ tiêu vào cái gì: mục tiêu bao
 * nhiêu, sàn ở đâu, hạng mục đó nặng bao nhiêu phần trong bộ tiêu chí. Ba con số đó quyết định
 * chỉ tiêu vừa nhập đóng góp được bao nhiêu, nên phải thấy ngay lúc chọn.
 */
export function perspectiveHint(input: {
  targetValue?: number | null
  minimumValue?: number | null
  unit?: string | null
  weightPercentage?: number | null
}): string | null {
  const { targetValue, minimumValue, unit, weightPercentage } = input
  const withUnit = (v: number) => `${v.toLocaleString('vi-VN')}${unit ? ` ${unit}` : ''}`

  const parts: string[] = []
  if (targetValue != null) parts.push(`MT ${withUnit(targetValue)}`)
  if (minimumValue != null) parts.push(`sàn ${withUnit(minimumValue)}`)
  if (weightPercentage != null) parts.push(`${weightPercentage}%`)
  return parts.length > 0 ? parts.join(' · ') : null
}
