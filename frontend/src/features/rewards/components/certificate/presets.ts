import { intlLocale } from '@/i18n/format'
import { CertificateOrientation } from '../../types'
import type { CertificateTemplate } from '../../types'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

/**
 * Bộ thiết kế chứng nhận dựng sẵn.
 *
 * <p>Bản VẼ nằm ở frontend, không ở database: khung viền, hoa văn và cách xếp chữ là
 * chuyện của trình duyệt, nhồi xuống DB thì chỉnh một khoảng cách cũng phải chạy
 * migration. Mẫu đã lưu của tổ chức chỉ trỏ về đây bằng khoá `preset` và ghi đè phần
 * nội dung, màu sắc, chữ ký.
 *
 * <p>Vì vậy tổ chức chưa soạn mẫu nào VẪN in được ngay: sáu preset dưới đây tự nó đã là
 * sáu mẫu hoàn chỉnh.
 */

// A4 ở 96dpi. Vẽ đúng kích thước thật rồi thu nhỏ bằng transform để xem trước — nhờ vậy
// bản in và ảnh PNG xuất ra khớp từng pixel với thứ người dùng thấy trên màn hình.
//
// Làm TRÒN XUỐNG, không tròn lên: A4 là 1122,5 × 793,7px ở 96dpi. Lấy 1123 × 794 thì tờ
// giấy rộng hơn vùng in được nửa pixel, và trình duyệt đẩy phần thừa sang một trang thứ
// hai gần như trắng — lỗi chỉ lộ ra khi giấy đã chạy qua máy in.
export const CERTIFICATE_PAGE: Record<CertificateOrientation, { width: number; height: number }> = {
  [CertificateOrientation.LANDSCAPE]: { width: 1122, height: 793 },
  [CertificateOrientation.PORTRAIT]: { width: 793, height: 1122 },
}

export type CertificateFrame =
  | 'GOLD_DOUBLE'
  | 'GRADIENT_ARC'
  | 'DECO_CORNERS'
  | 'HAIRLINE'
  | 'CONFETTI'
  | 'LAUREL'

export interface CertificatePreset {
  key: string
  /** Tên hiện trong bộ chọn mẫu. */
  name: string
  tagline: string
  frame: CertificateFrame
  align: 'CENTER' | 'LEFT'
  /** Nền tối: đổi cách pha màu phụ và màu của gạch chân, không phải chuyện trang trí. */
  dark: boolean
  colors: {
    surface: string
    ink: string
    accent: string
  }
  fonts: {
    /** Tiêu đề lớn. */
    display: string
    /** Đoạn văn và nhãn. */
    body: string
    /** Tên người nhận — chỗ duy nhất được phép "bay bổng". */
    name: string
  }
  content: {
    eyebrow: string
    title: string
    subtitle: string
    body: string
    footnote: string
  }
}

const SERIF = "'Playfair Display', 'Times New Roman', Georgia, serif"
const SANS = "'Inter', system-ui, -apple-system, sans-serif"
const SCRIPT = "'Great Vibes', 'Segoe Script', 'Brush Script MT', cursive"

/**
 * Thiết kế dùng khi chưa chọn gì, và cũng là chỗ lùi về khi gặp khoá preset lạ.
 *
 * <p>Tách thành hằng số riêng thay vì viết `CERTIFICATE_PRESETS[0]` ở khắp nơi: chỉ mục
 * mảng luôn có thể là `undefined` dưới mắt trình biên dịch, còn ở đây thì không.
 */
export const DEFAULT_PRESET = perLanguage((): CertificatePreset => ({
  key: 'CLASSIC_GOLD',
  name: i18n.t('rewards:presets.classicGold'),
  tagline: i18n.t('rewards:presets.doubleBorderRaisedBadgeAsFormal'),
  frame: 'GOLD_DOUBLE',
  align: 'CENTER',
  dark: false,
  colors: { surface: '#FFFDF5', ink: '#2A2318', accent: '#B08D2F' },
  fonts: { display: SERIF, body: SANS, name: SERIF },
  content: {
    eyebrow: i18n.t('rewards:presets.certificate'),
    title: i18n.t('rewards:presets.outstandingEmployee'),
    subtitle: i18n.t('rewards:presets.proudlyPresentedTo'),
    body: i18n.t('rewards:presets.forOutstandingContributionsToAndA'),
    footnote: '',
  },
}))

export const CERTIFICATE_PRESETS = perLanguage((): CertificatePreset[] => ([
  DEFAULT_PRESET(),
  {
    key: 'MODERN_GRADIENT',
    name: i18n.t('rewards:presets.modernGradient'),
    tagline: i18n.t('rewards:presets.gradientColorBlocksBoldDecisiveType'),
    frame: 'GRADIENT_ARC',
    align: 'LEFT',
    dark: false,
    colors: { surface: '#FFFFFF', ink: '#0F172A', accent: '#6366F1' },
    fonts: { display: SANS, body: SANS, name: SANS },
    content: {
      eyebrow: 'EMPLOYEE OF THE WEEK',
      title: i18n.t('rewards:presets.employeeOfTheWeek'),
      subtitle: i18n.t('rewards:presets.congratulations'),
      body: i18n.t('rewards:presets.thankYouForAWeekOf'),
      footnote: '',
    },
  },
  {
    key: 'ELEGANT_NAVY',
    name: i18n.t('rewards:presets.midnightLuxury'),
    tagline: i18n.t('rewards:presets.deepBlueBackgroundWithGoldDetails'),
    frame: 'DECO_CORNERS',
    align: 'CENTER',
    dark: true,
    colors: { surface: '#0E1B33', ink: '#F3F6FF', accent: '#D8B25C' },
    fonts: { display: SERIF, body: SANS, name: SCRIPT },
    content: {
      eyebrow: i18n.t('rewards:presets.certificateOfMerit'),
      title: i18n.t('rewards:presets.outstandingDedication'),
      subtitle: i18n.t('rewards:presets.proudlyHonoring'),
      body: i18n.t('rewards:presets.recognizingDedicationAndResultsBeyondExpectation'),
      footnote: '',
    },
  },
  {
    key: 'MINIMAL_MONO',
    name: i18n.t('rewards:presets.minimal'),
    tagline: i18n.t('rewards:presets.oneLineLargeTypeLotsOf'),
    frame: 'HAIRLINE',
    align: 'LEFT',
    dark: false,
    colors: { surface: '#FFFFFF', ink: '#111827', accent: '#111827' },
    fonts: { display: SANS, body: SANS, name: SERIF },
    content: {
      eyebrow: i18n.t('rewards:presets.recognition'),
      title: i18n.t('rewards:presets.thankYouForMakingADifference'),
      subtitle: '',
      body: i18n.t('rewards:presets.yourContributionToHasBeenSeen'),
      footnote: '',
    },
  },
  {
    key: 'FESTIVE_CONFETTI',
    name: i18n.t('rewards:presets.vibrant'),
    tagline: i18n.t('rewards:presets.confettiAndRibbonsFunGreatFor'),
    frame: 'CONFETTI',
    align: 'CENTER',
    dark: false,
    colors: { surface: '#FFF8ED', ink: '#3B2A1A', accent: '#F97316' },
    fonts: { display: SANS, body: SANS, name: SERIF },
    content: {
      eyebrow: i18n.t('rewards:presets.congratulations2'),
      title: i18n.t('rewards:presets.starOfTheMonth'),
      subtitle: i18n.t('rewards:presets.thisTitleIsAwardedTo'),
      body: i18n.t('rewards:presets.forTheEnergyAndResultsYou'),
      footnote: '',
    },
  },
  {
    key: 'BOTANICAL_LAUREL',
    name: i18n.t('rewards:presets.laurel'),
    tagline: i18n.t('rewards:presets.aLaurelWreathAroundTheRecipients'),
    frame: 'LAUREL',
    align: 'CENTER',
    dark: false,
    colors: { surface: '#F7F6F0', ink: '#1F2A21', accent: '#2F6B4F' },
    fonts: { display: SERIF, body: SANS, name: SCRIPT },
    content: {
      eyebrow: 'VINH DANH',
      title: i18n.t('rewards:presets.outstandingAchievement'),
      subtitle: i18n.t('rewards:presets.weProudlyPresentThisTo'),
      body: i18n.t('rewards:presets.recognizingPersistentEffortAndResultsTo'),
      footnote: '',
    },
  },
]))

/**
 * Tra preset theo khoá, LUÔN trả về một preset.
 *
 * <p>Khoá lạ (mẫu cũ trỏ về thiết kế đã bị gỡ) lùi về preset đầu tiên thay vì ném lỗi:
 * người dùng cần in được tờ giấy khen, không cần biết danh mục thiết kế đã đổi.
 */
export const getPreset = (key?: string | null): CertificatePreset =>
  CERTIFICATE_PRESETS().find((p) => p.key === key) ?? DEFAULT_PRESET()

// ── Dữ liệu điền vào chứng nhận ──────────────────────────────────

export interface CertificateData {
  recipientName: string
  points: number
  reason: string
  /** Đã định dạng sẵn theo tiếng Việt — component vẽ không tự format ngày. */
  dateLabel: string
  grantorName: string
  orgUnitName: string
  organizationName: string
  organizationLogoUrl?: string | null
}

/** Bảng chỗ giữ hiện cho người soạn mẫu, và cũng là bảng tra lúc thay. */
export const CERTIFICATE_PLACEHOLDERS = perLanguage((): { token: string; label: string }[] => ([
  { token: '{{ten}}', label: i18n.t('rewards:presets.recipientName') },
  { token: '{{diem}}', label: i18n.t('rewards:presets.rewardPoints') },
  { token: '{{lyDo}}', label: i18n.t('rewards:presets.rewardReason') },
  { token: '{{ngay}}', label: i18n.t('rewards:presets.awardedOn') },
  { token: '{{nguoiThuong}}', label: i18n.t('rewards:presets.awardedBy') },
  { token: '{{donVi}}', label: i18n.t('rewards:presets.unit') },
  { token: '{{congTy}}', label: i18n.t('rewards:presets.companyName') },
]))

/**
 * Thay chỗ giữ bằng dữ liệu thật.
 *
 * <p>Chỗ giữ không nhận ra được thì để NGUYÊN VĂN chứ không xoá: người soạn gõ sai
 * `{{Ten}}` sẽ nhìn thấy ngay lỗi của mình trên bản xem trước, thay vì thấy một khoảng
 * trống rồi mang đi in.
 */
export function fillPlaceholders(text: string | null | undefined, data: CertificateData): string {
  if (!text) return ''

  const map: Record<string, string> = {
    '{{ten}}': data.recipientName,
    '{{diem}}': data.points.toLocaleString(intlLocale()),
    '{{lyDo}}': data.reason,
    '{{ngay}}': data.dateLabel,
    '{{nguoiThuong}}': data.grantorName,
    '{{donVi}}': data.orgUnitName,
    '{{congTy}}': data.organizationName,
  }

  return Object.entries(map).reduce(
    (acc, [token, value]) => acc.split(token).join(value),
    text
  )
}

// ── Hợp nhất preset + mẫu đã lưu ─────────────────────────────────

/** Bản thiết kế cuối cùng để vẽ: đã gộp preset với phần tổ chức ghi đè. */
export interface ResolvedDesign {
  preset: CertificatePreset
  orientation: CertificateOrientation
  surface: string
  ink: string
  accent: string
  eyebrow: string
  title: string
  subtitle: string
  body: string
  footnote: string
  signerName: string
  signerTitle: string
  signatureUrl?: string | null
  logoUrl?: string | null
  backgroundUrl?: string | null
  showLogo: boolean
  showPoints: boolean
  showReason: boolean
}

/**
 * Gộp một mẫu đã lưu (hoặc chỉ một khoá preset) thành bản thiết kế để vẽ.
 *
 * <p>Trường màu để trống nghĩa là "giữ màu gốc của preset" — đây là lý do mọi chỗ vẽ
 * phải đi qua hàm này thay vì đọc thẳng `template.accentColor`, nếu không mẫu chưa tuỳ
 * biến sẽ vẽ ra màu rỗng.
 */
export function resolveDesign(
  source: CertificateTemplate | { preset: string } | null | undefined
): ResolvedDesign {
  const template = (source && 'id' in source ? source : null) as CertificateTemplate | null
  const preset = getPreset(source?.preset)

  return {
    preset,
    orientation: template?.orientation ?? CertificateOrientation.LANDSCAPE,
    surface: template?.surfaceColor || preset.colors.surface,
    ink: template?.inkColor || preset.colors.ink,
    accent: template?.accentColor || preset.colors.accent,
    // Nội dung dùng `??` chứ không phải `||`: chuỗi rỗng là lựa chọn CÓ Ý THỨC của người
    // soạn ("không muốn có dòng phụ đề"), không phải "chưa nhập".
    eyebrow: template ? (template.eyebrow ?? '') : preset.content.eyebrow,
    title: template ? template.title : preset.content.title,
    subtitle: template ? (template.subtitle ?? '') : preset.content.subtitle,
    body: template ? (template.body ?? '') : preset.content.body,
    footnote: template ? (template.footnote ?? '') : preset.content.footnote,
    signerName: template?.signerName ?? '',
    signerTitle: template?.signerTitle ?? i18n.t('rewards:presets.awardedBy'),
    signatureUrl: template?.signatureUrl,
    logoUrl: template?.logoUrl,
    backgroundUrl: template?.backgroundUrl,
    showLogo: template?.showLogo ?? true,
    showPoints: template?.showPoints ?? true,
    showReason: template?.showReason ?? true,
  }
}

/**
 * Pha màu với độ mờ, trả về `rgba()`.
 *
 * <p>KHÔNG dùng `color-mix()` hay thuộc tính `opacity` cho chữ và nét vẽ ở đây:
 * html-to-image rasterise lại cây DOM và không phải trình duyệt nào cũng cho ra kết quả
 * giống hệt với `color-mix`, còn `opacity` thì làm mờ cả phần tử con.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value.split('').map((c) => c + c).join('')
      : value.padEnd(6, '0').slice(0, 6)

  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
