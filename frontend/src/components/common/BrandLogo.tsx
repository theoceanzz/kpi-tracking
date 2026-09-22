import { cn } from '@/lib/utils'

/**
 * Logo KeyGo dùng chung toàn app. Ba file trong public/images (cắt từ ảnh gốc, ảnh gốc không giữ trong repo):
 * - logo.png        wordmark (icon + chữ) cho nền sáng
 * - logo-white.png  wordmark chữ trắng cho nền tối (icon giữ nguyên màu)
 * - logo-icon.png   riêng ô vuông icon — sidebar thu gọn, chỗ chật
 * Cả ba đều nền trong suốt; đặt chiều cao bằng `className` (h-8, h-10…), chiều rộng tự theo.
 */
export function BrandLogo({
  variant = 'default',
  className,
}: {
  variant?: 'default' | 'white' | 'icon'
  className?: string
}) {
  const src =
    variant === 'icon' ? '/images/logo-icon.png' : variant === 'white' ? '/images/logo-white.png' : '/images/logo.png'
  return (
    <img
      src={src}
      alt="KeyGo"
      decoding="async"
      className={cn('block w-auto select-none object-contain', variant === 'icon' ? 'aspect-square' : '', className)}
      draggable={false}
    />
  )
}
