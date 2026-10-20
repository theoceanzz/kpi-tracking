import { afterEach, describe, expect, it } from 'vitest'
import {
  getCelebrationMode,
  isCelebrationEnabled,
  isGentleMode,
  parseCelebrationMode,
  setCelebrationMode,
} from './celebrationSettings'

describe('mức hiệu ứng chúc mừng', () => {
  afterEach(() => localStorage.clear())

  it('mặc định là đầy đủ — kể cả máy báo giảm chuyển động (không đọc cài đặt hệ điều hành)', () => {
    expect(getCelebrationMode()).toBe('full')
    expect(isGentleMode()).toBe(false)
    expect(isCelebrationEnabled()).toBe(true)
  })

  it('hiểu giá trị cũ của công tắc bật/tắt', () => {
    expect(parseCelebrationMode('on')).toBe('full')
    expect(parseCelebrationMode('off')).toBe('off')
    expect(parseCelebrationMode(null)).toBe('full')
    expect(parseCelebrationMode('rác')).toBe('full')
  })

  it('người đã TẮT từ trước vẫn tắt sau khi nâng cấp', () => {
    localStorage.setItem('keygo.celebrations', 'off')
    expect(isCelebrationEnabled()).toBe(false)
  })

  it('chọn nhẹ ⇒ vẫn bật nhưng là bản nhẹ, và gắn cờ cho CSS', () => {
    setCelebrationMode('gentle')
    expect(isCelebrationEnabled()).toBe(true)
    expect(isGentleMode()).toBe(true)
    expect(document.documentElement.dataset.celebrationMode).toBe('gentle')
  })

  it('chọn tắt ⇒ không hiệu ứng', () => {
    setCelebrationMode('off')
    expect(isCelebrationEnabled()).toBe(false)
    expect(document.documentElement.dataset.celebrationMode).toBe('off')
  })
})
