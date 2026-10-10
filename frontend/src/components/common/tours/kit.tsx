import i18n from 'i18next'
import { findNavItem } from '@/config/navigation'
import type { TourStep } from './registry'
import { tourTarget } from './anchors'
import { runTourAction } from './actions'
import { isTargetVisible, resolveTarget, waitForTarget } from './engine'

/**
 * Bộ dựng bài hướng dẫn theo khuôn chung: mỗi bước một phần tử nhỏ, một tiêu đề, một–hai câu.
 *
 * Chữ của bước nằm ở `shared:<ns>.<id>.t` (tiêu đề) và `shared:<ns>.<id>.b` (thân), nên bài chỉ
 * còn khai id, neo và vị trí:
 *
 *   const { s, intro } = tourKit('tourSetupCompany')
 *   steps: [intro('users.intro'), s('users.add', tourTarget(…tên neo…), 'left')]
 *
 * Neo luôn viết thẳng lời gọi tourTarget tại chỗ gọi (không truyền tên neo qua biến) để
 * `anchors.test.ts` dò được và bắt lỗi gõ sai tên.
 */
export function tourKit(ns: string) {
  const t = (key: string) => i18n.t(`shared:${ns}.${key}`)

  /** Một bước neo vào phần tử. */
  const s = (id: string, target: string, placement: TourStep['placement'] = 'bottom', extra: Partial<TourStep> = {}): TourStep => ({
    id,
    target,
    title: t(`${id}.t`),
    content: <p>{t(`${id}.b`)}</p>,
    placement,
    ...extra,
  })

  /** Bước mở đầu đứng giữa màn hình — nói bài này dạy gì, không chỉ vào đâu. */
  const intro = (id: string): TourStep => ({
    id,
    target: 'body',
    title: t(`${id}.t`),
    content: <p>{t(`${id}.b`)}</p>,
    placement: 'center',
  })

  /**
   * Bài cấp trang của một trang gộp: bước mở đầu rồi MỖI THẺ một bước, theo đúng thứ tự cây nav.
   * Tiêu đề lấy nhãn thẻ trong cây nav; thân là `cards.<id>.b` (thiếu thì dùng mô tả của thẻ). Thẻ
   * bị ẩn vì quyền hay cờ tính năng tự rơi khỏi bài, nên "Bước x / y" đúng theo từng người.
   */
  const sectionCards = (navId: string, introId = 'intro'): TourStep[] => {
    const nav = findNavItem(navId)
    const cards = (nav?.sections ?? []).map((section): TourStep => {
      const key = `cards.${section.id}.b`
      const body = i18n.exists(`shared:${ns}.${key}`) ? t(key) : section.description ?? ''
      return {
        id: `card-${section.id}`,
        target: `[data-tour="section.card.${section.id}"]`,
        title: section.label,
        content: <p>{body}</p>,
        placement: 'bottom',
      }
    })
    return [intro(introId), ...cards]
  }

  /**
   * Bước bên trong một modal mà màn hình mở bằng `useTourModal(action, …)`. Mỗi bước tự mở modal
   * (luỹ đẳng) nên Quay lại / học tiếp giữa chừng vẫn đúng; bài đặt `cleanup: m.close`.
   *
   *   const users = modal('users.form')
   *   steps: [users.step('usersForm.name', tourTarget('users.form.name'), 'right')], cleanup: users.close
   */
  const modal = (action: string) => {
    const open = () => runTourAction(`${action}.open`)
    const close = () => runTourAction(`${action}.close`)
    /** Một ô của modal. */
    const step = (id: string, target: string, placement: TourStep['placement'] = 'bottom', extra: Partial<TourStep> = {}): TourStep =>
      s(id, target, placement, { prepare: open, ...extra })
    /** Bước nút mở modal trên trang: đóng modal trước, bấm vào nút thì sang bước kế. */
    const opener = (id: string, target: string, placement: TourStep['placement'] = 'bottom', extra: Partial<TourStep> = {}): TourStep =>
      s(id, target, placement, { prepare: close, advanceOnClick: true, ...extra })
    return { open, close, step, opener }
  }

  return { t, s, intro, sectionCards, modal }
}

/**
 * Mở một hộp thoại gắn với MỘT DÒNG (nút "Đổi quà" của một món, nút điều chỉnh của một KPI…) bằng
 * cách bấm nút đó trên trang — trang không cần biết dòng nào. Hộp đã mở thì thôi (luỹ đẳng).
 * Chỉ dùng cho nút MỞ giao diện, không bao giờ cho nút ghi dữ liệu.
 *
 *   prepare: clickToOpen(tourTarget('mykpi.adjust'), tourTarget('adjform.dialog'))
 */
export const clickToOpen = (trigger: string, opened: string) => async () => {
  if (isTargetVisible(opened)) return
  const el = resolveTarget(trigger)
  if (el instanceof HTMLElement && el.getClientRects().length > 0) el.click()
  await waitForTarget(opened, 3000)
}

/** Neo dùng chung của các khung có sẵn — viết một lần ở đây cho đỡ gõ lại ở từng bài. */
export const common = {
  /** Hàng tab mảnh của trang gộp (chỉ có khi cụm có từ 2 mục). */
  sectionTabs: tourTarget('section.tabs'),
  /** Khối số liệu trên header của một mục. */
  stats: tourTarget('ws.stats'),
  /** Hàng tab con trong header. */
  wsTabs: tourTarget('ws.tabs'),
  /** Ô tìm kiếm của thanh lọc chuẩn. */
  search: tourTarget('filter.search'),
  /** Nút "Bộ lọc" mở bộ lọc phụ. */
  moreFilters: tourTarget('filter.more'),
  /** Cụm nút cuối thanh lọc (dạng xem, mở/đóng nhóm). */
  filterTrailing: tourTarget('filter.trailing'),
  /** Toàn bộ thanh lọc. */
  filterBar: tourTarget('filter.bar'),
}

export { tourTarget }
