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

// ── Tiếng chúc mừng (điểm danh, đổi quà, được thưởng) ──────────────────────────
//
// Chỗ gọi chỉ biết TÊN tiếng (`SoundCue`), không biết tiếng được tạo ra thế nào. Muốn đổi sang file
// mp3 thì đặt file vào `public/sounds/` rồi thay một dòng trong `CUE_SOURCES` bằng `fileCue('/sounds/x.mp3')`
// — không phải sửa nơi nào gọi `playCue`.
//
// Dùng chung công tắc tiếng thông báo: người đã tắt tiếng "ting" thì cũng không muốn nghe kèn.
// Lỗi âm thanh (AudioContext bị khoá vì chưa có thao tác, trình duyệt không hỗ trợ, file hỏng) luôn bị
// nuốt im lặng — hiệu ứng hình vẫn phải chạy dù tiếng hỏng.

export type SoundCue = 'chime' | 'fanfare' | 'fanfareLong' | 'fireworks'

type CueSource =
  | { kind: 'synth'; play: (ctx: AudioContext, at: number, volume: number) => void }
  | { kind: 'file'; url: string }

/** Âm lượng tối đa của tiếng chúc mừng (0–1). Cố ý nhỏ: văn phòng, không phải phòng game. */
const CELEBRATION_VOLUME = 0.12

/** Một nốt có đường bao tấn công nhanh rồi tắt dần — viên gạch của mọi tiếng tổng hợp ở dưới. */
function tone(ctx: AudioContext, freq: number, at: number, dur: number, peak: number, type: OscillatorType = 'triangle') {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

/** Tiếng "bụp" của pháo: nhiễu trắng ngắn qua lọc thông dải, tắt rất nhanh. */
function pop(ctx: AudioContext, at: number, peak: number) {
  const length = Math.floor(ctx.sampleRate * 0.25)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 900 + Math.random() * 1400
  filter.Q.value = 0.8
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(peak, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start(at)
  src.stop(at + 0.25)
}

// Đô–Mi–Sol–Đô (C5 E5 G5 C6).
const ARPEGGIO = [523.25, 659.25, 783.99, 1046.5]

const CUE_SOURCES: Record<SoundCue, CueSource> = {
  // Cấp nhỏ: hai nốt cao lấp lánh, ~0,4s.
  chime: {
    kind: 'synth',
    play: (ctx, at, v) => {
      tone(ctx, 1318.51, at, 0.3, v)
      tone(ctx, 1975.53, at + 0.09, 0.4, v * 0.8)
    },
  },
  // Cấp vừa: arpeggio đi lên, nốt cuối ngân — tổng ~1,5s.
  fanfare: {
    kind: 'synth',
    play: (ctx, at, v) => {
      ARPEGGIO.forEach((f, i) => tone(ctx, f, at + i * 0.11, i === 3 ? 1.1 : 0.25, v))
      tone(ctx, 2093, at + 0.33, 0.9, v * 0.25, 'sine')
    },
  },
  // Cấp lớn: arpeggio hai lượt rồi hợp âm Đô trưởng ngân dài.
  fanfareLong: {
    kind: 'synth',
    play: (ctx, at, v) => {
      ARPEGGIO.forEach((f, i) => tone(ctx, f, at + i * 0.1, 0.22, v * 0.9))
      ARPEGGIO.forEach((f, i) => tone(ctx, f * 2, at + 0.45 + i * 0.08, 0.2, v * 0.6))
      const chordAt = at + 0.85
      ARPEGGIO.forEach((f) => tone(ctx, f, chordAt, 1.6, v * 0.55))
      tone(ctx, 261.63, chordAt, 1.6, v * 0.5, 'sine')
    },
  },
  // Pháo hoa: một loạt tiếng bụp rải ngẫu nhiên ~2s.
  fireworks: {
    kind: 'synth',
    play: (ctx, at, v) => {
      for (let i = 0; i < 6; i++) pop(ctx, at + 0.15 + i * 0.32 + Math.random() * 0.12, v * 1.6)
    },
  },
}

/** Cho bảng `CUE_SOURCES`: phát một file trong `public/sounds/` thay cho tiếng tổng hợp. */
export const fileCue = (url: string): CueSource => ({ kind: 'file', url })

/** Phát một tiếng chúc mừng. Không bao giờ ném lỗi. */
export function playCue(cue: SoundCue) {
  if (!isNotificationSoundEnabled()) return
  try {
    const source = CUE_SOURCES[cue]
    if (source.kind === 'file') {
      const audio = new Audio(source.url)
      audio.volume = CELEBRATION_VOLUME
      audio.play().catch(() => {})
      return
    }
    const ctx = getAudioContext()
    // Trình duyệt chưa cho phát (chưa có thao tác nào với trang): im lặng, hiệu ứng hình vẫn chạy.
    if (!ctx || ctx.state !== 'running') return
    source.play(ctx, ctx.currentTime + 0.01, CELEBRATION_VOLUME)
  } catch {
    // Âm thanh chỉ là phần phụ — hỏng thì thôi.
  }
}

export const playChime = () => playCue('chime')
export const playFanfare = (long = false) => playCue(long ? 'fanfareLong' : 'fanfare')
export const playFireworks = () => playCue('fireworks')

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
