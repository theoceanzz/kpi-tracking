/**
 * Báo cho người dùng biết có thông báo mới: tiếng "ting" và (khi đang ở tab khác) thông báo của hệ điều hành.
 *
 * Tiếng tự tổng hợp bằng Web Audio, không cần file âm thanh. Trình duyệt chặn phát tiếng trước lần tương tác đầu
 * tiên với trang, nên AudioContext được tạo/khởi động lại ở lần bấm/gõ phím đầu — trước đó chỉ hiện popup, im lặng.
 *
 * Bật/tắt tiếng là tuỳ chọn riêng của từng máy (localStorage), không lưu lên server.
 */

const SOUND_KEY = 'keygo.notificationSound'
/** Nhiều thông báo về cùng lúc (phát thưởng hàng loạt…) chỉ kêu một lần. */
const SOUND_GAP_MS = 1500

let audioCtx: AudioContext | null = null
let lastPlayedAt = 0
let primed = false

export function isNotificationSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // Chế độ ẩn danh / chặn lưu trữ: chỉ mất tuỳ chọn, không hỏng gì.
  }
}

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  audioCtx = new Ctor()
  return audioCtx
}

/** Gọi một lần khi khởi động: mở khoá âm thanh ở lần tương tác đầu tiên. */
export function primeNotificationSound() {
  if (primed) return
  primed = true
  const unlock = () => {
    getAudioContext()?.resume().catch(() => {})
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** Hai nốt ngắn đi lên — đủ nghe thấy, không chói. */
export function playNotificationSound() {
  if (!isNotificationSoundEnabled()) return
  const now = Date.now()
  if (now - lastPlayedAt < SOUND_GAP_MS) return
  lastPlayedAt = now

  const ctx = getAudioContext()
  if (!ctx || ctx.state !== 'running') return

  const start = ctx.currentTime
  ;[
    { freq: 880, at: 0 },
    { freq: 1320, at: 0.12 },
  ].forEach(({ freq, at }) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, start + at)
    gain.gain.linearRampToValueAtTime(0.18, start + at + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start + at)
    osc.stop(start + at + 0.4)
  })
}

export function desktopNotificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (desktopNotificationPermission() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/**
 * Thông báo của hệ điều hành — chỉ khi tab đang ẩn (đang ở tab/ứng dụng khác) và người dùng đã cho phép. Tab đang
 * mở thì popup trong trang là đủ, hiện thêm cả hai là thừa.
 */
export function showDesktopNotification(opts: { id: string; title: string; body: string; onClick: () => void }) {
  if (!document.hidden || desktopNotificationPermission() !== 'granted') return
  try {
    const n = new Notification(opts.title, { body: opts.body, tag: opts.id, icon: '/favicon.png' })
    n.onclick = () => {
      window.focus()
      opts.onClick()
      n.close()
    }
  } catch {
    // Một số trình duyệt di động chỉ cho tạo thông báo qua service worker — bỏ qua, đã có popup trong trang.
  }
}
