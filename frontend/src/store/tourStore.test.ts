import { beforeEach, describe, expect, it } from 'vitest'
import { isTourRunning, tourSeenStatus, useTourStore } from './tourStore'

describe('tourSeenStatus — bài được viết lại không tự chạy với người đã xem bản cũ', () => {
  it('chưa xem bản nào → unseen (tự chạy)', () => {
    expect(tourSeenStatus(undefined, 2)).toBe('unseen')
  })

  it('dữ liệu cũ `true` tính là đã xem bản 1', () => {
    expect(tourSeenStatus(true, 1)).toBe('current')
    expect(tourSeenStatus(true, 2)).toBe('outdated')
  })

  it('đã xem đúng bản hiện tại → current', () => {
    expect(tourSeenStatus(2, 2)).toBe('current')
  })
})

describe('tourStore', () => {
  beforeEach(() => {
    useTourStore.setState({ seenToursByUser: {}, progressByUser: {}, activeTour: null })
  })

  it('markSeen không hạ phiên bản đã xem', () => {
    const { markSeen } = useTourStore.getState()
    markSeen('dashboard/staff', 'u1', 2)
    markSeen('dashboard/staff', 'u1', 1)
    expect(useTourStore.getState().seenToursByUser.u1?.['dashboard/staff']).toBe(2)
  })

  it('lưu và xoá bước đang dở theo từng người', () => {
    const { saveProgress, clearProgress } = useTourStore.getState()
    saveProgress('dashboard/staff', 'u1', { stepId: 'library-card', version: 2 })
    expect(useTourStore.getState().progressByUser.u1?.['dashboard/staff']).toEqual({ stepId: 'library-card', version: 2 })
    expect(useTourStore.getState().progressByUser.u2).toBeUndefined()

    clearProgress('dashboard/staff', 'u1')
    expect(useTourStore.getState().progressByUser.u1?.['dashboard/staff']).toBeUndefined()
  })

  it('đặt lại toàn bộ xoá cả bước đang dở', () => {
    const s = useTourStore.getState()
    s.saveProgress('k', 'u1', { stepId: 's3', version: 1 })
    s.markSeen('k', 'u1')
    s.resetAll()
    expect(useTourStore.getState().progressByUser).toEqual({})
    expect(useTourStore.getState().seenToursByUser).toEqual({})
  })

  it('isTourRunning theo activeTour', () => {
    expect(isTourRunning()).toBe(false)
    useTourStore.getState().startTour('dashboard/staff')
    expect(isTourRunning()).toBe(true)
    useTourStore.getState().stopTour()
    expect(isTourRunning()).toBe(false)
  })
})
