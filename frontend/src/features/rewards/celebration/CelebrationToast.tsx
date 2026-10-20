import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import LottieObject from './LottieObject'
import { isGentleMode } from './celebrationSettings'

interface Props {
  variant: 'streak' | 'gift'
  title: string
  description?: string
  onDismiss: () => void
}

/**
 * Toast chúc mừng cấp "vừa" (chạm mốc chuỗi điểm danh, đổi quà xong ngay). Hiện THAY toast thành
 * công cũ — không cộng thêm một cái — nên câu chữ mô tả vẫn giữ đúng nội dung của toast cũ. Vật thể Lottie:
 * rương (mốc chuỗi điểm danh) / hộp quà (đổi quà); bản nhẹ thì đứng ở khung cuối.
 */
export default function CelebrationToast({ variant, title, description, onDismiss }: Props) {
  const { t } = useTranslation('rewards')
  return (
    <div
      role="status"
      className="relative flex w-[380px] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-card border border-[var(--color-warning-border)] bg-[var(--color-card)] p-4 shadow-lg"
    >
      <div className="-my-2 -ml-2 shrink-0">
        <LottieObject name={variant === 'streak' ? 'chest' : 'gift'} size={64} still={isGentleMode()} />
      </div>
      <div className="min-w-0 flex-1 pr-5">
        <p className="celebration-rise text-base font-semibold leading-snug text-[var(--color-foreground)]">{title}</p>
        {description && (
          <p className="celebration-rise mt-1 text-sm leading-relaxed text-[var(--color-muted-foreground)]" style={{ animationDelay: '120ms' }}>
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('Celebration.close')}
        className="absolute right-2 top-2 rounded-control p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
