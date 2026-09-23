import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInView } from '../hooks/useInView'

/** Khối xuất hiện dần khi cuộn tới. `delay` tính bằng ms, `from` là hướng bay vào. */
export function Reveal({
  children,
  delay = 0,
  from = 'up',
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  delay?: number
  from?: 'up' | 'left' | 'right' | 'zoom'
  className?: string
  as?: 'div' | 'section' | 'li' | 'p' | 'h2' | 'h3'
}) {
  const { ref, inView } = useInView<HTMLElement>()
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      data-inview={inView}
      style={{ '--lp-delay': `${delay}ms` } as CSSProperties}
      className={cn(
        'lp-reveal',
        from === 'left' && 'lp-reveal--left',
        from === 'right' && 'lp-reveal--right',
        from === 'zoom' && 'lp-reveal--zoom',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/** Nhãn nhỏ kiểu "CHƯƠNG 01 · ĐẶT MỤC TIÊU" đặt phía trên tiêu đề. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-[0.25em] text-blue-600/90',
        className,
      )}
    >
      <span className="h-px w-6 bg-gradient-to-r from-transparent to-blue-500" />
      {children}
    </div>
  )
}

/** Tiêu đề khối lớn, chữ trắng, có thể chèn <em> để tô gradient. */
export function Headline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'lp-headline text-3xl sm:text-4xl lg:text-[52px] font-black tracking-tight leading-[1.08] text-slate-900 text-balance',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl text-pretty', className)}>
      {children}
    </p>
  )
}

export function PrimaryButton({
  to,
  children,
  className,
  size = 'md',
}: {
  to: string
  children: ReactNode
  className?: string
  size?: 'md' | 'lg'
}) {
  return (
    <Link
      to={to}
      className={cn(
        'lp-sheen group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-bold text-white',
        'bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 bg-[length:200%_auto] hover:bg-right',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_50px_-12px_rgba(37,99,235,0.55)]',
        'transition-[background-position,transform,box-shadow] duration-500 active:scale-95',
        size === 'lg' ? 'px-8 py-4 text-base' : 'px-6 py-3 text-sm',
        className,
      )}
    >
      <span className="relative z-10">{children}</span>
      <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

export function GhostButton({
  href,
  children,
  className,
  size = 'md',
}: {
  href: string
  children: ReactNode
  className?: string
  size?: 'md' | 'lg'
}) {
  return (
    <a
      href={href}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-bold text-slate-800',
        'border border-slate-200 bg-white shadow-sm hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50',
        'transition-all active:scale-95',
        size === 'lg' ? 'px-8 py-4 text-base' : 'px-6 py-3 text-sm',
        className,
      )}
    >
      {children}
    </a>
  )
}

/** Khung kính (glass) dùng cho mọi mock sản phẩm. */
export function GlassFrame({ children, className, glow = true }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl sm:rounded-3xl border border-slate-200 bg-white',
        'shadow-[0_30px_80px_-24px_rgba(30,64,175,0.25),0_1px_0_rgba(255,255,255,0.9)_inset]',
        className,
      )}
    >
      {glow && <div className="lp-border-glow" aria-hidden />}
      {children}
    </div>
  )
}

/** Thanh tiêu đề cửa sổ giả (ba chấm + địa chỉ). */
export function WindowBar({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      <div className="mx-auto hidden sm:block rounded-md bg-slate-100 px-3 py-0.5 text-[10px] font-medium text-slate-500">
        {title}
      </div>
    </div>
  )
}

/** Ảnh chụp màn hình thật của app trong khung cửa sổ. `overlay` để đặt thẻ/toast nổi lên trên ảnh. */
export function Screenshot({
  src,
  alt,
  title,
  overlay,
  className,
  priority,
}: {
  src: string
  alt: string
  title: string
  overlay?: ReactNode
  className?: string
  priority?: boolean
}) {
  return (
    <GlassFrame className={cn('lp-shot overflow-hidden', className)}>
      <WindowBar title={title} />
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-50">
        <img
          src={src}
          alt={alt}
          width={2560}
          height={1600}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="block h-full w-full object-cover object-top"
        />
        {overlay}
      </div>
    </GlassFrame>
  )
}

/** Nút "Xem thêm / Thu gọn" + khối nội dung mở ra mượt. */
export function MoreToggle({
  children,
  labelOpen = 'Xem chi tiết',
  labelClose = 'Thu gọn',
  className,
}: {
  children: ReactNode
  labelOpen?: string
  labelClose?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={className}>
      <div className="lp-expand" data-open={open} aria-hidden={!open}>
        <div>{children}</div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
      >
        {open ? labelClose : labelOpen}
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>
    </div>
  )
}
