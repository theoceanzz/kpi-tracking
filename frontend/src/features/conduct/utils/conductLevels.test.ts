import { describe, expect, it } from 'vitest'
import { cleanLevels, conductLevels, definedLevels, levelText } from './conductLevels'

describe('conductLevels', () => {
  it('liệt kê mức từ cao xuống thấp', () => {
    expect(conductLevels(1, 5)).toEqual([5, 4, 3, 2, 1])
  })

  it('thang lẻ hoặc quá dài thì không có mức', () => {
    expect(conductLevels(1, 4.5)).toEqual([])
    expect(conductLevels(1, 20)).toEqual([])
    expect(conductLevels(5, 5)).toEqual([])
  })
})

describe('levelText', () => {
  const levels = { '5': ' Luôn chủ động ', '1': 'Thường xuyên trễ', '3': '  ' }

  it('trả mô tả của đúng mức', () => {
    expect(levelText(levels, 5)).toBe('Luôn chủ động')
    expect(levelText(levels, 1)).toBe('Thường xuyên trễ')
  })

  it('mức trống, điểm lẻ hoặc chưa chấm ⇒ null', () => {
    expect(levelText(levels, 3)).toBeNull()
    expect(levelText(levels, 4.5)).toBeNull()
    expect(levelText(levels, null)).toBeNull()
    expect(levelText(null, 5)).toBeNull()
  })

  it('definedLevels chỉ lấy mức có mô tả trong thang', () => {
    expect(definedLevels({ ...levels, '7': 'ngoài thang' }, 1, 5).map(l => l.level)).toEqual([5, 1])
  })

  it('cleanLevels bỏ mức trống / ngoài thang, rỗng thì null', () => {
    expect(cleanLevels({ ...levels, '7': 'x' }, 1, 5)).toEqual({ '5': 'Luôn chủ động', '1': 'Thường xuyên trễ' })
    expect(cleanLevels({ '2': ' ' }, 1, 5)).toBeNull()
  })
})
