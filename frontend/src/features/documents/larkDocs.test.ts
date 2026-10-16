import { describe, expect, it } from 'vitest'
import { larkTime } from './utils'
import { extractHeadings } from './editor/blocks'

const labels = { today: 'Hôm nay', yesterday: 'Hôm qua' }

describe('larkTime', () => {
  const now = new Date(2026, 9, 15, 18, 0)

  it('hôm nay / hôm qua ghi giờ + chữ', () => {
    expect(larkTime(new Date(2026, 9, 15, 9, 5).toISOString(), labels, now)).toMatch(/^\d{2}:\d{2} Hôm nay$/)
    expect(larkTime(new Date(2026, 9, 14, 23, 59).toISOString(), labels, now)).toMatch(/^\d{2}:\d{2} Hôm qua$/)
  })

  it('cùng năm có giờ + ngày, năm khác chỉ có ngày kèm năm', () => {
    expect(larkTime(new Date(2026, 1, 23, 17, 39).toISOString(), labels, now)).toMatch(/^17:39 /)
    expect(larkTime(new Date(2025, 1, 14, 8, 0).toISOString(), labels, now)).toContain('2025')
  })

  it('không có / hỏng thì gạch', () => {
    expect(larkTime(null, labels, now)).toBe('—')
    expect(larkTime('not-a-date', labels, now)).toBe('—')
  })
})

describe('extractHeadings', () => {
  it('lấy tiêu đề theo thứ tự, cả khối lồng và link, bỏ tiêu đề rỗng', () => {
    const blocks = [
      { id: 'a', type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: '1. Mục đích' }], children: [] },
      { id: 'b', type: 'paragraph', content: [{ type: 'text', text: 'chữ' }], children: [
        { id: 'c', type: 'heading', props: { level: 2 }, content: [{ type: 'link', content: [{ type: 'text', text: 'Phạm vi' }] }], children: [] },
      ] },
      { id: 'd', type: 'heading', props: { level: 3 }, content: [], children: [] },
    ]
    expect(extractHeadings(blocks)).toEqual([
      { id: 'a', level: 1, text: '1. Mục đích' },
      { id: 'c', level: 2, text: 'Phạm vi' },
    ])
  })
})
