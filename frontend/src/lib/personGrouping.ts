/**
 * Gom danh sách theo NGƯỜI để các màn hình KPI hiển thị lấy con người làm trung tâm:
 * mỗi người là một dòng chính, sổ xuống mới ra chỉ tiêu/đánh giá/yêu cầu của người đó.
 *
 * <p>Trước đây các trang này đổ ra danh sách phẳng trộn lẫn KPI của nhiều người rồi bắt
 * người dùng lọc bằng dropdown "Nhân viên". Gom nhóm ở đây thay cho bộ lọc đó.
 */

export interface PersonRef {
  id: string
  name: string
  avatarUrl?: string | null
  orgUnitName?: string | null
}

export interface PersonGroup<T> extends PersonRef {
  items: T[]
}

/** Nhóm gom các bản ghi chưa gắn với ai — luôn nằm cuối danh sách. */
export const UNASSIGNED_ID = '__UNASSIGNED__'
export const UNASSIGNED_NAME = 'Chưa giao'

/**
 * Gom `items` theo người.
 *
 * `extract` trả về DANH SÁCH người của một item chứ không phải một người, vì một KPI có
 * thể giao cho nhiều người ({@code KpiCriteria.assignees}) — khi đó KPI xuất hiện ở nhóm
 * của từng người được giao. Trả về mảng rỗng ⇒ item rơi vào nhóm "Chưa giao".
 *
 * Thứ tự item bên trong mỗi nhóm giữ nguyên theo thứ tự đầu vào (server đã sort sẵn theo
 * `sortBy`/`sortDir`), chỉ thứ tự các NHÓM là sắp lại theo tên.
 */
export function groupByPerson<T>(items: T[], extract: (item: T) => PersonRef[]): PersonGroup<T>[] {
  const groups = new Map<string, PersonGroup<T>>()

  const push = (person: PersonRef, item: T) => {
    const existing = groups.get(person.id)
    if (existing) {
      existing.items.push(item)
      // Bản ghi sau có thể mang thông tin đầy đủ hơn (ảnh, phòng ban) — vá dần vào nhóm.
      if (!existing.avatarUrl && person.avatarUrl) existing.avatarUrl = person.avatarUrl
      if (!existing.orgUnitName && person.orgUnitName) existing.orgUnitName = person.orgUnitName
      return
    }
    groups.set(person.id, { ...person, items: [item] })
  }

  items.forEach(item => {
    const people = extract(item).filter(p => p?.id)
    if (people.length === 0) {
      push({ id: UNASSIGNED_ID, name: UNASSIGNED_NAME }, item)
      return
    }
    people.forEach(p => push(p, item))
  })

  return Array.from(groups.values()).sort((a, b) => {
    if (a.id === UNASSIGNED_ID) return 1
    if (b.id === UNASSIGNED_ID) return -1
    return a.name.localeCompare(b.name, 'vi')
  })
}

export interface UnitRef {
  id: string
  name: string
}

export interface UnitGroup<T> extends UnitRef {
  /** Người trong đơn vị này, đã gom sẵn. */
  people: PersonGroup<T>[]
  /** Toàn bộ bản ghi của đơn vị (chưa tách theo người) — dùng để đếm số liệu tóm tắt. */
  items: T[]
}

/** Nhóm gom các bản ghi không xác định được đơn vị — luôn nằm cuối danh sách. */
export const UNKNOWN_UNIT_ID = '__NO_UNIT__'
export const UNKNOWN_UNIT_NAME = 'Chưa rõ đơn vị'

/**
 * Gom hai cấp: Đơn vị → Người. Mỗi bản ghi thuộc đúng một đơn vị, nhưng vẫn có thể nằm ở
 * nhiều nhóm người bên trong đơn vị đó (KPI giao cho nhiều người).
 *
 * `unitOrder` là thứ tự đơn vị trong cây tổ chức (index trong danh sách đã làm phẳng) để
 * các đơn vị hiện theo đúng trật tự cây thay vì theo bảng chữ cái; đơn vị không có trong
 * map và nhóm "Chưa rõ đơn vị" bị đẩy xuống cuối.
 */
export function groupByUnitThenPerson<T>(
  items: T[],
  extractUnit: (item: T) => UnitRef | null,
  extractPeople: (item: T) => PersonRef[],
  unitOrder?: Map<string, number>,
): UnitGroup<T>[] {
  const byUnit = new Map<string, { unit: UnitRef; items: T[] }>()

  items.forEach(item => {
    const found = extractUnit(item)
    const unit: UnitRef = found?.id ? found : { id: UNKNOWN_UNIT_ID, name: UNKNOWN_UNIT_NAME }
    const entry = byUnit.get(unit.id)
    if (entry) entry.items.push(item)
    else byUnit.set(unit.id, { unit, items: [item] })
  })

  return Array.from(byUnit.values())
    .map(({ unit, items: list }) => ({
      ...unit,
      items: list,
      people: groupByPerson(list, extractPeople),
    }))
    .sort((a, b) => {
      if (a.id === UNKNOWN_UNIT_ID) return 1
      if (b.id === UNKNOWN_UNIT_ID) return -1
      const ia = unitOrder?.get(a.id)
      const ib = unitOrder?.get(b.id)
      if (ia != null && ib != null) return ia - ib
      if (ia != null) return -1
      if (ib != null) return 1
      return a.name.localeCompare(b.name, 'vi')
    })
}

/**
 * Khoá gấp/mở của một nhóm người. Phải kèm đơn vị vì một người có thể xuất hiện ở nhiều
 * đơn vị (KPI của họ nằm ở đơn vị khác) — dùng chung id người sẽ làm hai chỗ mở/đóng theo nhau.
 */
export const personGroupKey = (unitId: string, personId: string) => `${unitId}::${personId}`
