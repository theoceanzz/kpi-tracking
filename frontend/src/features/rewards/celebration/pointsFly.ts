/**
 * Hiệu ứng nhỏ của điểm danh: nút nảy, ngọn lửa lắc, "+N" bay từ nút tới số dư điểm.
 *
 * Viết thẳng bằng DOM + Web Animations thay vì state React: phần tử chỉ sống ~1 giây, nằm ngoài
 * mọi cây component, và vị trí phải đo từ hai phần tử ở hai nơi khác nhau trên trang.
 *
 * Đích bay: phần tử có `data-celebrate-target="reward-balance"` (số dư ở trang Điểm của tôi). Đích
 * không có hoặc đang khuất khỏi màn hình thì "+N" chỉ bay lên tại chỗ rồi mờ đi.
 */
export const BALANCE_TARGET = 'reward-balance'
export const FLAME_MARKER = 'checkin-flame'

/** Gắn một lớp animation CSS rồi gỡ khi chạy xong, để lần sau gắn lại vẫn chạy. */
export function replayClass(el: Element | null | undefined, cls: string) {
  if (!el) return
  el.classList.remove(cls)
  // Ép trình duyệt tính lại kiểu để animation chạy lại từ đầu.
  void (el as HTMLElement).offsetWidth
  el.classList.add(cls)
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true })
}

const inViewport = (r: DOMRect) =>
  r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth

export function flyPoints(label: string, origin?: HTMLElement | null) {
  if (typeof document === 'undefined') return
  const from = origin?.getBoundingClientRect()
  const startX = from ? from.left + from.width / 2 : window.innerWidth / 2
  const startY = from ? from.top : window.innerHeight / 2

  const el = document.createElement('div')
  el.className = 'celebration-fly'
  el.setAttribute('aria-hidden', 'true')
  el.textContent = label
  el.style.left = `${startX}px`
  el.style.top = `${startY}px`
  document.body.appendChild(el)

  const target = document.querySelector<HTMLElement>(`[data-celebrate-target="${BALANCE_TARGET}"]`)
  const to = target?.getBoundingClientRect()
  const centre = 'translate(-50%, -50%)'

  let animation: Animation
  if (target && to && inViewport(to)) {
    const dx = to.left + to.width / 2 - startX
    const dy = to.top + to.height / 2 - startY
    animation = el.animate(
      [
        { transform: `${centre} translate(0, 0) scale(0.6)`, opacity: 0 },
        { transform: `${centre} translate(0, -28px) scale(1.25)`, opacity: 1, offset: 0.25 },
        { transform: `${centre} translate(${dx}px, ${dy}px) scale(0.8)`, opacity: 0.9, offset: 0.92 },
        { transform: `${centre} translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(.45,.05,.4,1)' }
    )
    animation.onfinish = () => replayClass(target, 'celebrate-pop')
  } else {
    animation = el.animate(
      [
        { transform: `${centre} translate(0, 0) scale(0.6)`, opacity: 0 },
        { transform: `${centre} translate(0, -24px) scale(1.2)`, opacity: 1, offset: 0.3 },
        { transform: `${centre} translate(0, -64px) scale(1)`, opacity: 0 },
      ],
      { duration: 1000, easing: 'ease-out' }
    )
  }
  const cleanup = () => el.remove()
  animation.addEventListener('finish', cleanup)
  animation.addEventListener('cancel', cleanup)
}
