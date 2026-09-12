import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Một màu chủ đạo = hai bộ giá trị, vì cùng một sắc không thể vừa đủ đậm cho chữ trắng
 * trên nền sáng, vừa đủ sáng cho chữ trên nền tối.
 *
 * Bản sáng: tông 600–700, chữ TRẮNG, kiểm từng màu đạt ≥ 4.5:1 (amber và sky phải xuống
 * tận 700 mới qua). Bản tối: tông 300–400, chữ slate-900 (#0f172a), đều ≥ 6:1.
 *
 * `value` là mã màu người dùng nhìn thấy trên ô chọn và cũng là khoá lưu trong
 * localStorage — giữ nguyên các mã cũ để thiết lập đã lưu của người dùng không bị mất.
 */
export interface ThemeColor {
  name: string
  value: string
  light: { primary: string; hover: string; foreground: string }
  dark: { primary: string; hover: string; foreground: string }
}

const DARK_FG = '#0f172a'

const DEFAULT_COLOR = '#6366f1'

export const THEME_COLORS: ThemeColor[] = [
  { name: 'Indigo',  value: '#6366f1', light: { primary: '#4f46e5', hover: '#4338ca', foreground: '#ffffff' }, dark: { primary: '#818cf8', hover: '#a5b4fc', foreground: DARK_FG } },
  { name: 'Blue',    value: '#3b82f6', light: { primary: '#2563eb', hover: '#1d4ed8', foreground: '#ffffff' }, dark: { primary: '#60a5fa', hover: '#93c5fd', foreground: DARK_FG } },
  { name: 'Sky',     value: '#0ea5e9', light: { primary: '#0369a1', hover: '#075985', foreground: '#ffffff' }, dark: { primary: '#38bdf8', hover: '#7dd3fc', foreground: DARK_FG } },
  { name: 'Emerald', value: '#10b981', light: { primary: '#047857', hover: '#065f46', foreground: '#ffffff' }, dark: { primary: '#34d399', hover: '#6ee7b7', foreground: DARK_FG } },
  { name: 'Rose',    value: '#f43f5e', light: { primary: '#e11d48', hover: '#be123c', foreground: '#ffffff' }, dark: { primary: '#fb7185', hover: '#fda4af', foreground: DARK_FG } },
  { name: 'Amber',   value: '#f59e0b', light: { primary: '#b45309', hover: '#92400e', foreground: '#ffffff' }, dark: { primary: '#fbbf24', hover: '#fcd34d', foreground: DARK_FG } },
  { name: 'Violet',  value: '#8b5cf6', light: { primary: '#7c3aed', hover: '#6d28d9', foreground: '#ffffff' }, dark: { primary: '#a78bfa', hover: '#c4b5fd', foreground: DARK_FG } },
  { name: 'Slate',   value: '#475569', light: { primary: '#475569', hover: '#334155', foreground: '#ffffff' }, dark: { primary: '#94a3b8', hover: '#cbd5e1', foreground: DARK_FG } },
]

// ── Tính toán cho màu tự chọn (ô "Màu tùy chỉnh") ───────────────────────────
// Người dùng gõ mã bất kỳ thì không có bộ giá trị soạn sẵn; suy ra tại chỗ theo cùng
// nguyên tắc: chữ trắng nếu đủ tương phản, không thì chữ tối; hover là màu đậm/nhạt
// hơn 12 %.

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(c: [number, number, number], target: [number, number, number], t: number): [number, number, number] {
  return [c[0] + (target[0] - c[0]) * t, c[1] + (target[1] - c[1]) * t, c[2] + (target[2] - c[2]) * t]
}

/** Sắc (hue, 0–360) của màu — để nhận ra dải tím dù người dùng gõ mã tuỳ ý. */
function hue([r, g, b]: [number, number, number]): number {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === rr) h = ((gg - bb) / d) % 6
  else if (max === gg) h = (bb - rr) / d + 2
  else h = (rr - gg) / d + 4
  return (h * 60 + 360) % 360
}

function saturation([r, g, b]: [number, number, number]): number {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255
  return max === 0 ? 0 : (max - min) / max
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]

function resolvePalette(color: string, isDark: boolean): { primary: string; hover: string; foreground: string } {
  const preset = THEME_COLORS.find(c => c.value.toLowerCase() === color.toLowerCase())
  if (preset) return isDark ? preset.dark : preset.light

  const rgb = hexToRgb(color) ?? hexToRgb(DEFAULT_COLOR) ?? [79, 70, 229]
  const foreground = contrast(rgb, WHITE) >= 4.5 ? '#ffffff' : DARK_FG
  // Nền tối: hover sáng lên; nền sáng: hover đậm xuống.
  const hover = rgbToHex(mix(rgb, isDark ? WHITE : BLACK, 0.12))
  return { primary: rgbToHex(rgb), hover, foreground }
}

/** Màu chọn có nằm trong dải tím không (đụng nhận diện K.AI). */
function isVioletLike(color: string): boolean {
  const rgb = hexToRgb(color)
  if (!rgb) return false
  const h = hue(rgb)
  return h >= 250 && h <= 290 && saturation(rgb) > 0.35
}

/**
 * Ghi bộ màu chủ đạo lên <html>. Gọi ở mọi chỗ đổi màu hoặc đổi sáng/tối, và một lần
 * khi app khởi động (App.tsx) vì giá trị persist chỉ nằm trong localStorage.
 */
export function applyTheme(color: string, isDark: boolean) {
  const root = document.documentElement
  const p = resolvePalette(color, isDark)
  root.classList.toggle('dark', isDark)
  root.style.setProperty('--color-primary', p.primary)
  root.style.setProperty('--color-primary-hover', p.hover)
  root.style.setProperty('--color-primary-foreground', p.foreground)
  if (isVioletLike(p.primary)) root.setAttribute('data-theme-color', 'violet')
  else root.removeAttribute('data-theme-color')
}

// ThemeCustomizer dùng để hiện ghi chú khi màu chọn đụng nhận diện K.AI.
export { isVioletLike }

interface ThemeState {
  primaryColor: string
  isDark: boolean
  setPrimaryColor: (color: string) => void
  toggleDark: () => void
  setDark: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      primaryColor: DEFAULT_COLOR,
      isDark: false,
      setPrimaryColor: (color) => {
        applyTheme(color, get().isDark)
        set({ primaryColor: color })
      },
      toggleDark: () => {
        const isDark = !get().isDark
        applyTheme(get().primaryColor, isDark)
        set({ isDark })
      },
      setDark: (isDark) => {
        applyTheme(get().primaryColor, isDark)
        set({ isDark })
      },
    }),
    { name: 'kpi-theme' }
  )
)
