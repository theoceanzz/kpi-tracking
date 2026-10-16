import { describe, expect, it } from 'vitest'
import { dueCountdown } from './taskUtils'

// 2026-10-14 10:00 giờ Việt Nam
const now = Date.parse('2026-10-14T10:00:00+07:00')
const task = (dueDate: string | null, dueTime: string | null, status: 'TODO' | 'DONE' = 'TODO') => ({ dueDate, dueTime, status })

describe('dueCountdown', () => {
  it('đếm ngược theo giờ / phút trong 24 giờ tới, "sắp" khi còn ≤ 2 giờ', () => {
    expect(dueCountdown(task('2026-10-14', '12:00:00'), now)).toMatchObject({ overdue: false, soon: true })
    expect(dueCountdown(task('2026-10-14', '10:20:00'), now)).toMatchObject({ overdue: false, soon: true })
    expect(dueCountdown(task('2026-10-15', '09:00:00'), now)).toMatchObject({ overdue: false, soon: false })
  })
  it('quá hạn chưa tới 24 giờ thì báo đã quá', () => {
    expect(dueCountdown(task('2026-10-14', '09:30:00'), now)).toMatchObject({ overdue: true })
  })
  it('không giờ hạn, quá xa, hoặc việc đã xong thì không đếm ngược', () => {
    expect(dueCountdown(task('2026-10-14', null), now)).toBeNull()
    expect(dueCountdown(task('2026-10-16', '10:00:00'), now)).toBeNull()
    expect(dueCountdown(task('2026-10-14', '12:00:00', 'DONE'), now)).toBeNull()
  })
})

import { sortOrderForMove } from './taskUtils'

describe('sortOrderForMove', () => {
  const s = [{ id: 'a', sortOrder: 1 }, { id: 'b', sortOrder: 2 }, { id: 'c', sortOrder: 3 }]
  it('kéo sang phải ⇒ nằm sau nhóm đích; sang trái ⇒ nằm trước', () => {
    expect(sortOrderForMove(s, 'a', 'b')).toBe(2.5) // a sau b, trước c
    expect(sortOrderForMove(s, 'a', 'c')).toBe(4) // a cuối
    expect(sortOrderForMove(s, 'c', 'a')).toBe(0) // c đầu
    expect(sortOrderForMove(s, 'c', 'b')).toBe(1.5) // c giữa a và b
  })
  it('thả lên chính nó hoặc nhóm lạ ⇒ không đổi', () => {
    expect(sortOrderForMove(s, 'a', 'a')).toBeNull()
    expect(sortOrderForMove(s, 'x', 'a')).toBeNull()
  })
})
