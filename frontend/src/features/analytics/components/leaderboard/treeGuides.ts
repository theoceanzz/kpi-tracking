/**
 * Nét nối của một cây đã làm phẳng — để cột tên đơn vị trong lưới nhiệt vẽ ra hình cây thay vì
 * một danh sách thụt lề.
 *
 * <p>Danh sách vào đã xếp theo `path` và mỗi hàng mang `depth`, nên quan hệ anh em suy ra được
 * ngay mà không cần server gửi thêm gì: hàng kế tiếp nông hơn là hết nhánh.
 */

export interface TreeRow {
  depth?: number | null
}

export interface TreeGuide {
  /** Hàng cuối trong nhánh của nó — khuỷu `└` thay vì `├`. */
  isLast: boolean
  /**
   * Với mỗi cấp tổ tiên `k < depth`: cấp đó còn hàng nào ở phía dưới nữa không. Có thì vẽ nét dọc
   * chạy qua, không thì để trống — đó là khác biệt giữa một cái cây và một đống gạch dọc.
   */
  ancestorContinues: boolean[]
}

export function treeGuides(rows: TreeRow[]): TreeGuide[] {
  const depth = (r: TreeRow) => Math.max(0, r.depth ?? 0)

  return rows.map((row, i) => {
    const d = depth(row)

    // Hết danh sách, hoặc hàng sau nông hơn ⇒ không còn anh em nào cùng cấp bên dưới.
    let isLast = true
    for (let j = i + 1; j < rows.length; j++) {
      const dj = depth(rows[j]!)
      if (dj < d) break
      if (dj === d) { isLast = false; break }
    }

    const ancestorContinues: boolean[] = []
    for (let k = 0; k < d; k++) {
      let more = false
      for (let j = i + 1; j < rows.length; j++) {
        const dj = depth(rows[j]!)
        if (dj < k) break
        if (dj === k) { more = true; break }
      }
      ancestorContinues.push(more)
    }

    return { isLast, ancestorContinues }
  })
}
