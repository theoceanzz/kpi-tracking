/**
 * Ma trận xếp loại hiệu quả ở phía client: (điểm hành vi) × (% hoàn thành KPI) → xếp loại 1–5.
 *
 * Bản sao có chủ ý của `PerformanceMatrixResolver` phía backend — màn chấm cần hiện xếp loại
 * NGAY khi người dùng kéo điểm, trước khi có lượt lưu nào để hỏi server. Hai bản phải đọc dải
 * y hệt nhau, nên chỉ được có MỘT bản ở frontend: mọi màn chấm đều import từ đây.
 */

/** Điểm hạnh kiểm quy về thang hành vi 0–5 của ma trận (cùng luật với ConductAxisResolver). */
export const conductAsBehavior = (score: number | null, max: number | null): number | null =>
  score == null || !max || max <= 0 ? null : Math.round((score / max) * 5 * 100) / 100

/** Điểm hạnh kiểm quy về trục cột (%) của ma trận. */
export const conductAsCompletion = (score: number | null, max: number | null): number | null =>
  score == null || !max || max <= 0 ? null : Math.round((score / max) * 100 * 100) / 100

/**
 * Chỉ số dải cho một giá trị theo nhãn dải tăng dần (VD "<2", "≥2 và <3", "≥120%").
 * Lấy số lớn nhất trong nhãn làm cận trên, dải cuối bắt hết phần còn lại —
 * khớp đúng `bandIndex()` ở PerformanceMatrixResolver phía backend.
 */
export function bandIndex(value: number, bands: string[]): number {
  for (let i = 0; i < bands.length; i++) {
    if (i === bands.length - 1) return i
    const nums = String(bands[i]).match(/[0-9]+(?:\.[0-9]+)?/g)
    if (!nums?.length) continue
    const upper = Math.max(...nums.map(Number))
    if (value < upper) return i
  }
  return bands.length - 1
}

/** Tra ma trận hiệu suất của tổ chức. Thiếu một trục ⇒ null, không bịa trục để ép ra hạng. */
export function lookupMatrixRating(
  behavior: number | null, completion: number | null, matrixJson?: string | null,
): number | null {
  if (behavior == null || completion == null || !matrixJson) return null
  try {
    const m = JSON.parse(matrixJson)
    if (!m?.rows || !m?.cols || !m?.cells) return null
    return m.cells?.[bandIndex(behavior, m.rows)]?.[bandIndex(completion, m.cols)] ?? null
  } catch {
    return null
  }
}

/**
 * Hai trục đưa vào ma trận sau khi điểm hạnh kiểm lấp trục còn TRỐNG — bản sao của
 * `ConductAxisResolver` phía backend.
 *
 * Ma trận cần đủ hai trục, mà một loại KPI chỉ cấp được một trục. Tổ chức chỉ chấm KPI định
 * lượng thì thiếu trục hàng, chỉ chấm định tính thì thiếu trục cột — hạnh kiểm lấp đúng chỗ
 * đó. Đủ cả hai trục rồi thì hạnh kiểm KHÔNG chen vào, nó vẫn là một phiếu độc lập.
 */
export function resolveMatrixAxes(
  behavior: number | null, completion: number | null,
  conductScore: number | null, conductMax: number | null,
): { behavior: number | null; completion: number | null } {
  if (conductScore == null) return { behavior, completion }
  if (behavior == null) return { behavior: conductAsBehavior(conductScore, conductMax), completion }
  if (completion == null) return { behavior, completion: conductAsCompletion(conductScore, conductMax) }
  return { behavior, completion }
}
