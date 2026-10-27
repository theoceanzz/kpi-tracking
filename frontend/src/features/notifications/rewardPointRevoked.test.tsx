import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Notification } from '@/types/notification'

/**
 * Thông báo điểm bị TRỪ (`REWARD_POINT_REVOKED` — thu hồi thưởng tay / hoàn tác chương trình) phải hiện khác
 * thông báo được cộng điểm (`REWARD_POINT`): biểu tượng màu cảnh báo, nhãn "Thu hồi điểm thưởng", mở đúng trang
 * điểm của tôi, làm mới đúng dữ liệu ví — và vẫn lọc được như mọi thông báo (tab Tất cả / Chưa đọc).
 */

const revoked: Notification = {
  id: 'n-revoked', type: 'REWARD_POINT_REVOKED', title: 'Thưởng điểm đã bị thu hồi', message: 'Bị trừ 40 điểm',
  referenceId: 'g1', isRead: false, readAt: null, createdAt: '2026-10-19T03:00:00Z',
}
const received: Notification = {
  id: 'n-point', type: 'REWARD_POINT', title: 'Bạn được thưởng 40 điểm', message: 'Từ Vũ Việt Dũng',
  referenceId: 'g2', isRead: true, readAt: '2026-10-19T02:30:00Z', createdAt: '2026-10-19T02:00:00Z',
}

const mutation = { mutate: vi.fn(), isPending: false }
vi.mock('./hooks/useNotifications', () => ({
  useNotifications: () => ({ data: { content: [revoked, received] }, isLoading: false }),
  useNotificationFeed: () => ({
    data: { pages: [{ content: [revoked, received] }] }, isLoading: false,
    hasNextPage: false, fetchNextPage: vi.fn(), isFetchingNextPage: false,
  }),
  useUnreadCount: () => ({ data: 1 }),
  useMarkAsRead: () => mutation,
  useMarkAllRead: () => mutation,
}))

import i18n, { i18nReady } from '@/i18n'
import NotificationDropdown from './components/NotificationDropdown'
import NotificationsPage from './pages/NotificationsPage'
import { notificationLink } from './notificationLink'
import { REFRESH_ON_NOTIFICATION } from './hooks/useWebSocketNotifications'

beforeAll(async () => {
  await i18nReady
  await act(() => i18n.changeLanguage('vi'))
})
afterEach(cleanup)

/** Ô biểu tượng (cha của <svg>) của dòng thông báo có tiêu đề này. */
function iconBoxOf(title: string) {
  const row = screen.getByText(title).closest('[role="button"]') as HTMLElement
  const svg = row.querySelector('svg.lucide-coins')
  expect(svg, `dòng "${title}" phải có biểu tượng đồng xu`).not.toBeNull()
  return svg!.parentElement as HTMLElement
}

describe('REWARD_POINT_REVOKED', () => {
  it('chuông: biểu tượng màu cảnh báo, khác màu tin được cộng điểm', () => {
    render(<MemoryRouter><NotificationDropdown onClose={() => {}} /></MemoryRouter>)
    expect(iconBoxOf(revoked.title).className).toContain('--color-warning')
    expect(iconBoxOf(received.title).className).toContain('--color-info')
  })

  it('trang Thông báo: nhãn "Thu hồi điểm thưởng" + màu cảnh báo; tin được cộng vẫn là "Điểm thưởng"', () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
    const revokedRow = screen.getByText(revoked.title).closest('[role="button"]') as HTMLElement
    const receivedRow = screen.getByText(received.title).closest('[role="button"]') as HTMLElement
    expect(within(revokedRow).getByText('Thu hồi điểm thưởng')).toBeTruthy()
    expect(within(receivedRow).getByText('Điểm thưởng')).toBeTruthy()
    expect(iconBoxOf(revoked.title).className).toContain('--color-warning')
    expect(iconBoxOf(received.title).className).toContain('--color-info')
  })

  it('trang Thông báo: lọc "Chưa đọc" vẫn giữ tin thu hồi chưa đọc, bỏ tin đã đọc', () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)
    const unreadTab = screen.getAllByRole('tab').find((t) => /Chưa đọc/.test(t.textContent ?? ''))!
    fireEvent.click(unreadTab)
    expect(screen.getByText(revoked.title)).toBeTruthy()
    expect(screen.queryByText(received.title)).toBeNull()
  })

  it('bấm thông báo mở trang điểm của tôi', () => {
    expect(notificationLink(revoked)).toBe('/rewards/me')
    expect(notificationLink(revoked)).toBe(notificationLink(received))
  })

  it('về tới thì làm mới đúng dữ liệu ví như tin được cộng điểm', () => {
    expect(REFRESH_ON_NOTIFICATION.REWARD_POINT_REVOKED).toEqual(REFRESH_ON_NOTIFICATION.REWARD_POINT)
    expect(REFRESH_ON_NOTIFICATION.REWARD_POINT_REVOKED).toContain('rewardWallet')
  })
})
