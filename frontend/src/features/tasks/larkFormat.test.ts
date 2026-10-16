import { describe, expect, it, vi, afterEach } from 'vitest'
import { larkDay, larkRange, statusPreset } from './taskUtils'

describe('ngày kiểu Lark', () => {
  afterEach(() => vi.useRealTimers())

  it('ngày + tháng ngắn, có giờ thì thêm ", HH:mm"; khác năm thì kèm năm', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T03:00:00Z'))
    expect(larkDay('2026-10-20', '18:00:00').endsWith(', 18:00')).toBe(true)
    expect(larkDay('2026-10-20')).not.toContain(',')
    expect(larkDay('2027-01-05')).toContain('2027')
  })

  it('khoảng bắt đầu - hạn; chỉ có bắt đầu thì kết thúc bằng "-"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T03:00:00Z'))
    const both = larkRange({ startDate: '2026-10-18', startTime: null, dueDate: '2026-10-20', dueTime: '09:30:00' })
    expect(both).toContain(' - ')
    expect(both.endsWith(', 09:30')).toBe(true)
    expect(larkRange({ startDate: '2026-10-20', startTime: null, dueDate: null, dueTime: null }).endsWith(' -')).toBe(true)
    expect(larkRange({ startDate: null, startTime: null, dueDate: null, dueTime: null })).toBe('')
  })
})

describe('ô "Đang làm ▾"', () => {
  it('nhận ra ba lựa chọn của Lark', () => {
    expect(statusPreset(['TODO', 'IN_PROGRESS'])).toBe('ongoing')
    expect(statusPreset(['IN_PROGRESS', 'TODO'])).toBe('ongoing')
    expect(statusPreset(['DONE'])).toBe('completed')
    expect(statusPreset([])).toBe('all')
    expect(statusPreset(['TODO'])).toBe('custom')
  })
})
