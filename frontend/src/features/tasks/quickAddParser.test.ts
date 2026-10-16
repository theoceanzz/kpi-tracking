import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from './quickAddParser'

const people = [
  { id: 'u1', name: 'Nguyễn Văn Nam' },
  { id: 'u2', name: 'Trần Thị Mai' },
  { id: 'u3', name: 'Lê Nam Anh' },
]
const tags = [{ id: 't1', name: 'Sale' }, { id: 't2', name: 'Khách VIP' }]
const ctx = { people, tags, today: '2026-10-14' } // thứ 4

describe('parseQuickAdd', () => {
  it('hiểu người, ngày, giờ, ưu tiên, nhãn và giữ phần còn lại làm tên', () => {
    const r = parseQuickAdd('Họp khách @Nam ngày mai 15h !cao #sale', ctx)
    expect(r.title).toBe('Họp khách')
    expect(r.assigneeIds).toEqual(['u1']) // "Nam" là tên gọi (chữ cuối) của u1, chỉ là chữ giữa của u3
    expect(r.dueDate).toBe('2026-10-15')
    expect(r.dueTime).toBe('15:00')
    expect(r.priority).toBe('HIGH')
    expect(r.tagIds).toEqual(['t1'])
  })

  it('khớp cả họ tên, không phân biệt dấu', () => {
    const r = parseQuickAdd('Gửi báo cáo @tran thi mai', ctx)
    expect(r.assigneeIds).toEqual(['u2'])
    expect(r.title).toBe('Gửi báo cáo')
  })

  it('chữ "mai" đứng một mình không phải ngày (dễ trùng tên người)', () => {
    const r = parseQuickAdd('Gọi cho chị Mai', ctx)
    expect(r.dueDate).toBeUndefined()
    expect(r.title).toBe('Gọi cho chị Mai')
  })

  it('thứ trong tuần là lần kế tiếp sau hôm nay; dd/mm đã qua thì sang năm sau', () => {
    expect(parseQuickAdd('Việc thứ 2', ctx).dueDate).toBe('2026-10-19')
    expect(parseQuickAdd('Việc thứ 4', ctx).dueDate).toBe('2026-10-21')
    expect(parseQuickAdd('Việc 20/10', ctx).dueDate).toBe('2026-10-20')
    expect(parseQuickAdd('Việc 01/02', ctx).dueDate).toBe('2027-02-01')
  })

  it('nhãn nhiều chữ, giờ dạng 15:30 và 3pm, ưu tiên tiếng Anh', () => {
    const r = parseQuickAdd('Demo #khach vip 3pm !low', ctx)
    expect(r.tagIds).toEqual(['t2'])
    expect(r.dueTime).toBe('15:00')
    expect(r.priority).toBe('LOW')
    expect(r.title).toBe('Demo')
    expect(parseQuickAdd('A hôm nay 9:30', ctx).dueTime).toBe('09:30')
  })

  it('không hiểu thì giữ nguyên', () => {
    const r = parseQuickAdd('Liên hệ @ai đó !gấp #lạ', ctx)
    expect(r.assigneeIds).toEqual([])
    expect(r.priority).toBeUndefined()
    expect(r.tagIds).toEqual([])
    expect(r.title).toBe('Liên hệ @ai đó !gấp #lạ')
  })
})
