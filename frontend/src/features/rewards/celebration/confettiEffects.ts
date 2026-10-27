import type { CreateTypes, Options } from 'canvas-confetti'

/**
 * Confetti / pháo hoa trên MỘT canvas riêng phủ toàn màn hình.
 *
 * - Thư viện chỉ tải (import động) ở lần ăn mừng đầu tiên — không nằm trong bundle chính.
 * - Canvas riêng thay vì canvas mặc định của thư viện để tự đặt lớp: z 1200 — trên Dialog/Drawer
 *   (1000) và dropdown (1100) để pháo bay qua hộp chúc mừng, dưới bài hướng dẫn (1400);
 *   `pointer-events: none` nên không bao giờ chặn cú bấm.
 * - `useWorker`: CSP của nginx đã cho `worker-src 'self' blob:` nên vẽ được ngoài luồng chính.
 * - Không dùng `disableForReducedMotion` của thư viện: mức hiệu ứng do người dùng chọn trong app (bản nhẹ thì
 *   host không gọi các hàm ở đây), không theo cài đặt hệ điều hành — xem `celebrationSettings.ts`.
 */
const PALETTE = ['#FFC93C', '#FF7A45', '#4ADE80', '#38BDF8', '#A78BFA', '#F472B6']

let instance: Promise<CreateTypes | null> | null = null
/** Tăng mỗi lần dọn / bắn loạt mới để vòng pháo hoa cũ tự dừng. */
let fireworksRun = 0

function getConfetti(): Promise<CreateTypes | null> {
  if (instance) return instance
  instance = import('canvas-confetti')
    .then(({ default: confetti }) => {
      const canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      canvas.className = 'celebration-canvas'
      document.body.appendChild(canvas)
      return confetti.create(canvas, { resize: true, useWorker: true })
    })
    .catch(() => {
      // Mạng hỏng lúc tải chunk: lần sau thử lại, lần này bỏ qua hiệu ứng.
      instance = null
      return null
    })
  return instance
}

const fire = (fx: CreateTypes, opts: Options) => fx({ colors: PALETTE, ...opts })

/** Cấp nhỏ: một chùm confetti nhỏ bung ngay tại phần tử (nút điểm danh) — không phủ màn hình. */
export async function burstFrom(el?: HTMLElement | null) {
  const r = el?.getBoundingClientRect()
  if (r && r.width > 0) {
    await burstAt((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight)
  } else {
    await burstAt(0.5, 0.5)
  }
}

/** Chùm confetti nhỏ tại toạ độ tỉ lệ (0..1) của màn hình. */
export async function burstAt(x: number, y: number) {
  const fx = await getConfetti()
  if (!fx) return
  fire(fx, { particleCount: 40, spread: 70, startVelocity: 28, gravity: 1.1, ticks: 120, scalar: 0.8, origin: { x, y }, zIndex: 1200 })
}

/** Cấp vừa: hai luồng confetti bắn chéo từ hai góc dưới. */
export async function burstCorners() {
  const fx = await getConfetti()
  if (!fx) return
  const common: Options = { particleCount: 70, spread: 60, startVelocity: 55, ticks: 220, zIndex: 1200 }
  fire(fx, { ...common, angle: 60, origin: { x: 0, y: 0.95 } })
  fire(fx, { ...common, angle: 120, origin: { x: 1, y: 0.95 } })
  setTimeout(() => {
    fire(fx, { ...common, particleCount: 35, angle: 70, origin: { x: 0.1, y: 1 } })
    fire(fx, { ...common, particleCount: 35, angle: 110, origin: { x: 0.9, y: 1 } })
  }, 250)
}

/** Cấp lớn: pháo hoa nổ ngẫu nhiên khắp màn hình trong `durationMs`. */
export async function fireworks(durationMs: number) {
  const fx = await getConfetti()
  if (!fx) return
  const run = ++fireworksRun
  const end = Date.now() + durationMs
  const rand = (min: number, max: number) => Math.random() * (max - min) + min
  const burst = () => {
    const left = end - Date.now()
    if (left <= 0 || run !== fireworksRun) return
    const particleCount = Math.round(50 * (left / durationMs)) + 20
    const common: Options = { particleCount, spread: 360, startVelocity: 30, ticks: 70, gravity: 0.9, zIndex: 1200 }
    fire(fx, { ...common, origin: { x: rand(0.1, 0.35), y: rand(0.1, 0.45) } })
    fire(fx, { ...common, origin: { x: rand(0.65, 0.9), y: rand(0.1, 0.45) } })
    setTimeout(burst, 280)
  }
  burst()
}

/** Mưa xu vàng rơi từ mép trên trong `durationMs` — đi kèm lớp cả màn hình. */
export async function coinRain(durationMs: number) {
  const fx = await getConfetti()
  if (!fx) return
  const run = fireworksRun
  const end = Date.now() + durationMs
  const drop = () => {
    if (Date.now() > end || run !== fireworksRun) return
    fx({
      particleCount: 6,
      angle: 270,
      spread: 40,
      startVelocity: 12,
      gravity: 1.3,
      ticks: 260,
      scalar: 1.5,
      shapes: ['circle'],
      colors: ['#FFD95E', '#FFC93C', '#F59E0B', '#FFF1B8'],
      origin: { x: Math.random(), y: -0.05 },
      zIndex: 1200,
    })
    setTimeout(drop, 90)
  }
  drop()
}

/** Dọn pháo còn bay (đóng hộp sớm). */
export async function resetConfetti() {
  fireworksRun++
  if (!instance) return
  const fx = await instance
  fx?.reset()
}
