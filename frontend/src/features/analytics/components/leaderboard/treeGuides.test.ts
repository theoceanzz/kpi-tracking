import { describe, expect, it } from 'vitest'
import { treeGuides } from './treeGuides'

/**
 * Cây mẫu đúng hình cây đơn vị demo:
 *
 *   Chi nhánh Hà Nội        depth 0
 *   ├── Phòng IT            depth 1
 *   │   ├── Team Backend    depth 2
 *   │   └── Team Frontend   depth 2
 *   └── Phòng Truyền Thông  depth 1
 *       └── Team Design     depth 2
 */
const ROWS = [{ depth: 0 }, { depth: 1 }, { depth: 2 }, { depth: 2 }, { depth: 1 }, { depth: 2 }]

describe('treeGuides', () => {
  it('đánh dấu hàng cuối của mỗi nhánh', () => {
    const g = treeGuides(ROWS)
    expect(g.map(x => x.isLast)).toEqual([
      true,   // gốc: không có anh em
      false,  // Phòng IT: còn Phòng Truyền Thông bên dưới
      false,  // Team Backend: còn Team Frontend
      true,   // Team Frontend: hết nhánh IT
      true,   // Phòng Truyền Thông: phòng cuối
      true,   // Team Design: hàng cuối cùng
    ])
  })

  it('nét dọc của tổ tiên chỉ chạy tiếp khi cấp đó còn hàng bên dưới', () => {
    const g = treeGuides(ROWS)
    // Team Backend / Frontend nằm dưới Phòng IT, mà cấp 1 còn Phòng Truyền Thông ⇒ còn nét dọc.
    expect(g[2]!.ancestorContinues).toEqual([false, true])
    expect(g[3]!.ancestorContinues).toEqual([false, true])
    // Team Design nằm dưới phòng CUỐI ⇒ cấp 1 hết hàng, không vẽ nét dọc nữa.
    expect(g[5]!.ancestorContinues).toEqual([false, false])
  })

  it('gốc không có cấp tổ tiên nào', () => {
    expect(treeGuides(ROWS)[0]!.ancestorContinues).toEqual([])
  })

  it('depth thiếu coi như 0, danh sách rỗng trả rỗng', () => {
    expect(treeGuides([])).toEqual([])
    expect(treeGuides([{ depth: null }, {}])).toEqual([
      { isLast: false, ancestorContinues: [] },
      { isLast: true, ancestorContinues: [] },
    ])
  })
})
