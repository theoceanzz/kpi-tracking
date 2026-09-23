import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, Phone, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/common/BrandLogo'

const LINKS = [
  { href: '#story', label: 'Câu chuyện' },
  { href: '#demo', label: 'Xem demo' },
  { href: '#modules', label: 'Module' },
  { href: '#pricing', label: 'Bảng giá' },
  { href: '#contact', label: 'Liên hệ' },
]

/** Thanh điều hướng dạng viên thuốc nổi + thanh tiến độ cuộn ở mép trên. */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [progress, setProgress] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 40)
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, y / max) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <div
        className="lp-progress fixed inset-x-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600"
        style={{ '--lp-progress': progress } as CSSProperties}
        aria-hidden
      />
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
        <nav
          className={cn(
            'flex w-full max-w-[1440px] items-center justify-between gap-3 rounded-full border px-3 py-2 transition-all duration-500 sm:px-4',
            scrolled
              ? 'border-slate-200 bg-white/85 shadow-[0_10px_40px_-12px_rgba(30,64,175,0.25)] backdrop-blur-xl'
              : 'border-transparent bg-transparent',
          )}
        >
          <Link to="/" className="flex items-center transition-transform duration-300 hover:scale-[1.03]" aria-label="KeyGo">
            <BrandLogo className="h-9" />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:block"
            >
              Đăng nhập
            </Link>
            <Link
              to="/login"
              className="group inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-95"
            >
              Dùng thử
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              type="button"
              aria-label="Mở menu"
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </header>

      {/* Menu di động */}
      <div
        className={cn(
          'fixed inset-x-4 top-[68px] z-40 origin-top rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-300 md:hidden',
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
        )}
      >
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className="block rounded-2xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-100"
          >
            {l.label}
          </a>
        ))}
        <a
          href="tel:0904871813"
          className="mt-1 flex items-center gap-2 rounded-2xl px-4 py-3 text-base font-semibold text-emerald-600 hover:bg-slate-100"
        >
          <Phone className="h-4 w-4" /> 090 4871813
        </a>
      </div>
    </>
  )
}

/** Hai nút Zalo / Hotline nổi góc phải dưới (giữ nguyên số liên hệ). */
export function FloatingContact() {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col items-center gap-3 sm:bottom-8 sm:right-8">
      <a
        href="https://zalo.me/0904871813"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative flex items-center justify-center"
        aria-label="Chat Zalo"
      >
        <div className="absolute inset-0 animate-ping rounded-full bg-[#0068ff] opacity-20" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#0068ff] shadow-lg shadow-blue-600/40 transition-all duration-300 group-hover:-rotate-12 group-hover:scale-110 sm:h-14 sm:w-14">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white sm:h-8 sm:w-8">
            <path d="M12.015 2c-5.523 0-10 4.029-10 9s4.477 9 10 9c.594 0 1.173-.046 1.733-.133l4.316 2.054a.5.5 0 0 0 .708-.553l-.841-3.693C19.782 16.34 22.015 13.88 22.015 11c0-4.971-4.477-9-10-9zm5.342 12.06c-.145.145-.34.226-.542.226-.203 0-.397-.081-.542-.226l-1.5-1.5a.765.765 0 0 1 0-1.085l1.5-1.5c.3-.3.784-.3 1.085 0 .299.3.299.784 0 1.085L16.35 12l1.007.915c.3.3.3.784 0 1.085v.06z" />
          </svg>
        </div>
        <div className="pointer-events-none absolute bottom-full right-0 mb-3 w-52 translate-y-3 rounded-2xl border border-slate-200 bg-white p-3 opacity-0 shadow-2xl transition-all group-hover:translate-y-0 group-hover:opacity-100">
          <img src="/zalo-qr.png" alt="Zalo QR" className="mb-2 w-full rounded-lg" />
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Quét mã để nhắn tin</div>
        </div>
      </a>
      <a
        href="tel:0904871813"
        className="group relative flex items-center justify-center"
        aria-label="Gọi hotline"
      >
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-25" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-600/40 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 sm:h-14 sm:w-14">
          <Phone className="h-[22px] w-[22px] fill-white/20 text-white sm:h-[26px] sm:w-[26px]" />
        </div>
        <div className="pointer-events-none absolute right-full mr-3 translate-x-3 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 opacity-0 shadow-xl transition-all group-hover:translate-x-0 group-hover:opacity-100">
          Hotline: 090 4871813
        </div>
      </a>
    </div>
  )
}
