import type { Step, StepTarget } from 'react-joyride'
import type { TourRequirement, TourStep } from './registry'

/**
 * Phần logic thuần của bộ chạy hướng dẫn — tách khỏi `TourHost` để test được không cần DOM thật
 * của Joyride.
 */

/** Một bước đã gắn khoá ổn định (`id`), sẵn sàng chạy. */
export type ArmedStep = TourStep & { id: string }

export function meetsRequirement(req: TourRequirement | undefined, permissions: readonly string[]): boolean {
  if (req == null) return true
  if (typeof req === 'function') {
    try {
      return req()
    } catch {
      return false
    }
  }
  const codes = Array.isArray(req) ? req : [req]
  return codes.length === 0 || codes.some((code) => permissions.includes(code))
}

/**
 * Gắn khoá cho từng bước THEO VỊ TRÍ TRONG BÀI ĐẦY ĐỦ rồi mới lọc theo quyền. Khoá theo vị trí sau
 * khi lọc thì cùng một bước mang khoá khác nhau ở hai vai trò, và "học tiếp từ bước x" trỏ nhầm.
 */
export function armSteps(steps: readonly TourStep[], permissions: readonly string[]): ArmedStep[] {
  return steps
    .map((step, i) => ({ ...step, id: step.id ?? `s${i}` }))
    .filter((step) => meetsRequirement(step.requires, permissions))
}

/** Bỏ các trường riêng của app và đặt hành vi mặc định trước khi đưa bước cho Joyride. */
export function toJoyrideStep(step: ArmedStep): Step {
  const rest: Partial<ArmedStep> = { ...step }
  delete rest.requires
  delete rest.prepare
  delete rest.interactive
  delete rest.advanceOnClick
  delete rest.waitTimeout
  const target = step.target
  return {
    ...(rest as Step),
    // Joyride tự `querySelector` thì vớ phải bản đang ẩn của neo — đưa nó đúng phần tử đang vẽ.
    target: typeof target === 'string' && target !== 'body'
      ? () => resolveTarget(target) as HTMLElement | null
      : target,
    // Neo đã được chờ sẵn trước khi chuyển bước; Joyride chỉ cần tìm lại một lần.
    targetWaitTimeout: 0,
    blockTargetInteraction: !(step.interactive || step.advanceOnClick),
    skipBeacon: true,
  }
}

/**
 * Phần tử của một neo. Cùng một neo thường có hai bản — bảng cho màn rộng, thẻ cho điện thoại,
 * bản kia `display: none` — nên lấy bản ĐANG ĐƯỢC VẼ đầu tiên; không bản nào được vẽ thì trả
 * bản đầu (để `waitForTarget` biết là có mà đang ẩn).
 */
export function resolveTarget(target: StepTarget): Element | null {
  if (typeof target === 'string') {
    if (target === 'body') return document.body
    try {
      const all = document.querySelectorAll(target)
      for (const el of all) if (el.getClientRects().length > 0) return el
      return all[0] ?? null
    } catch {
      return null
    }
  }
  if (typeof target === 'function') return target()
  if (target instanceof HTMLElement) return target
  return target?.current ?? null
}

/** Có trên trang VÀ đang được vẽ (phần tử `display:none` / `hidden md:flex` trên điện thoại thì không). */
export function isTargetVisible(target: StepTarget): boolean {
  if (target === 'body') return true
  const el = resolveTarget(target)
  return !!el && el.getClientRects().length > 0
}

/**
 * Phần tử CÓ trong DOM mà vẫn không được vẽ sau chừng này thì coi là bị ẩn có chủ đích (vd.
 * `hidden md:flex` trên điện thoại) — không bắt người học ngồi chờ hết `timeout`.
 */
const HIDDEN_GRACE_MS = 300

/** Trần chờ khi trang còn đang tải dữ liệu (xem `keepWaiting`). */
export const MAX_LOADING_WAIT_MS = 10_000

/**
 * Chờ neo xuất hiện. `true` khi thấy, `false` khi hết giờ, bị ẩn hẳn, hoặc bị huỷ.
 *
 * `keepWaiting`: hết `timeout` mà hàm này còn trả `true` (trang đang tải dữ liệu) thì chờ tiếp,
 * tối đa `MAX_LOADING_WAIT_MS`. Thiếu nó thì lần mở trang đầu tiên sau đăng nhập — lúc lưới widget
 * còn chờ API — mọi bước neo vào lưới đều bị gỡ và bài chỉ còn bước mở đầu với bước cuối.
 */
export function waitForTarget(
  target: StepTarget,
  timeout: number,
  signal?: { cancelled: boolean },
  keepWaiting?: () => boolean,
): Promise<boolean> {
  if (isTargetVisible(target)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const started = Date.now()
    let hiddenSince: number | null = null
    const tick = () => {
      if (signal?.cancelled) return resolve(false)
      if (isTargetVisible(target)) return resolve(true)
      const now = Date.now()
      if (resolveTarget(target)) {
        hiddenSince ??= now
        if (now - hiddenSince >= HIDDEN_GRACE_MS) return resolve(false)
      } else {
        hiddenSince = null
      }
      const elapsed = now - started
      if (elapsed >= timeout && !(keepWaiting?.() && elapsed < MAX_LOADING_WAIT_MS)) return resolve(false)
      setTimeout(tick, 50)
    }
    setTimeout(tick, 50)
  })
}

/**
 * Tìm bước dùng được kế tiếp theo hướng `dir`, bắt đầu TỪ `start`.
 *
 * `probe` chuẩn bị màn hình cho bước rồi báo có neo hay không. Bước không có neo bị GỠ khỏi danh
 * sách luôn (không chỉ nhảy qua) — nhờ vậy "Bước x / y" tính lại ngay, không nhảy cóc 3 → 5, và
 * bấm Quay lại không vấp lại đúng bước đó.
 *
 * Trả `index: -1` khi hết bước theo hướng đó.
 */
export async function seekStep<T>(
  steps: readonly T[],
  start: number,
  dir: 1 | -1,
  probe: (step: T) => Promise<boolean>,
): Promise<{ steps: T[]; index: number }> {
  const list = [...steps]
  let i = start
  while (i >= 0 && i < list.length) {
    if (await probe(list[i]!)) return { steps: list, index: i }
    list.splice(i, 1)
    // Tiến: phần tử sau đã dồn lên đúng chỗ `i`. Lùi: xét phần tử ngay trước.
    if (dir === -1) i -= 1
  }
  return { steps: list, index: -1 }
}

/**
 * Nhìn trước: gỡ các bước PHÍA SAU `index` mà không có `prepare` và neo hiện không có trên trang.
 * Bước không có `prepare` neo vào phần tử tĩnh của màn hình — giờ không có thì lát nữa cũng không
 * (trừ khi trang còn đang tải: `loading` thì không gỡ gì). Nhờ vậy "Bước x / y" đúng ngay, và bước
 * thật sự cuối cùng hiện được nút "Hoàn tất" / "Tiếp: …" thay vì phải bấm thêm một lần vào hư không.
 */
export function pruneAbsentAhead<T extends { target: StepTarget; prepare?: unknown }>(steps: T[], index: number, loading: boolean): T[] {
  if (loading) return steps
  // Bước có CÙNG `prepare` với bước đang hiện thì màn hình đã ở đúng trạng thái nó cần (hành động
  // luỹ đẳng) — xét được ngay như bước không có `prepare`. Nhờ vậy ô "Tìm người nhận" không hiện
  // với nhân viên bị gỡ từ bước trước, và nút "Tiếp: …" nằm đúng ở bước thật sự cuối.
  const current = steps[index]?.prepare
  return steps.filter((step, i) =>
    i <= index
    || (!!step.prepare && step.prepare !== current)
    || step.target === 'body'
    || typeof step.target !== 'string'
    || !!resolveTarget(step.target))
}

/** Phím trong ô nhập thuộc về ô nhập — ← → để di con trỏ chữ, không phải để chuyển bước. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
