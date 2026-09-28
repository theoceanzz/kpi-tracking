import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
/**
 * Bảng màu và nhãn dùng chung giữa định nghĩa node email và giao diện soạn thảo.
 * Tách riêng để `emailNodes.ts` (không có JSX) và `emailNodeViews.tsx` (chỉ có
 * component) không phải import chéo nhau.
 */

export const ALERT_COLORS: Record<string, { color: string; bg: string }> = {
  info: { color: '#1d4ed8', bg: '#eff6ff' },
  success: { color: '#047857', bg: '#ecfdf5' },
  warning: { color: '#b45309', bg: '#fffbeb' },
  danger: { color: '#b91c1c', bg: '#fef2f2' },
}

export const ALERT_LABEL = perLanguage((): Record<string, string> => ({
  info: i18n.t('organization:emailNodeStyles.blue'), success: i18n.t('organization:emailNodeStyles.green'), warning: i18n.t('organization:emailNodeStyles.yellow'), danger: i18n.t('organization:emailNodeStyles.red'),
}))

/** Thứ tự hiện các ô màu cơ bản trên thanh công cụ của khung nhấn mạnh. */
export const ALERT_VARIANTS: string[] = ['info', 'success', 'warning', 'danger']

/**
 * Trộn màu về phía trắng để lấy màu nền nhạt.
 *
 * <p>Trả về mã hex đặc chứ không dùng rgba: Outlook đời cũ bỏ qua màu có kênh alpha,
 * khung nhấn mạnh sẽ mất nền và chữ màu nhạt trở nên khó đọc.
 */
export const tintToWhite = (hex: string, ratio: number): string => {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
  const num = Number.parseInt(full, 16)
  if (!Number.isFinite(num) || full.length !== 6) return '#f1f5f9'
  const mix = (c: number) => Math.round(c + (255 - c) * ratio)
  return '#' + [(num >> 16) & 255, (num >> 8) & 255, num & 255]
    .map(c => mix(c).toString(16).padStart(2, '0'))
    .join('')
}

/** Màu chữ + màu nền của khung nhấn mạnh: ưu tiên màu tự chọn, không có thì theo mẫu sẵn. */
export const resolveAlertColors = (variant?: string | null, color?: string | null) => {
  if (color) return { color, bg: tintToWhite(color, 0.88) }
  return ALERT_COLORS[variant || 'warning'] ?? ALERT_COLORS.warning!
}

/**
 * Bề ngang tối đa của ảnh trong email: khung mail rộng 600px, trừ 40px đệm mỗi bên.
 * Vượt quá mức này ảnh sẽ bị tràn ra ngoài khung ở đa số mail client.
 */
export const EMAIL_CONTENT_WIDTH = 520

export const IMAGE_PRESETS = perLanguage((): { label: string; width: number }[] => ([
  { label: i18n.t('organization:emailNodeStyles.small'), width: 160 },
  { label: i18n.t('organization:emailNodeStyles.medium'), width: 300 },
  { label: i18n.t('organization:emailNodeStyles.large'), width: 420 },
  { label: i18n.t('organization:emailNodeStyles.fullWidth'), width: EMAIL_CONTENT_WIDTH },
]))

export const nodeInputClass =
  'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all'
