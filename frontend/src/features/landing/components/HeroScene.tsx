import { type CSSProperties } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { GhostButton, PrimaryButton, Screenshot } from './primitives'

/** Cảnh mở màn: cực quang + lưới phối cảnh + tiêu đề trồi chữ + ảnh dashboard thật. */
export function HeroScene() {
  return (
    <section
      className="relative isolate overflow-hidden px-5 pb-16 pt-32 sm:px-8 sm:pt-40 lg:px-12 lg:pt-44"
    >
      {/* Nền: cực quang & lưới */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="lp-aurora left-[10%] top-[-10%] h-[420px] w-[620px] bg-blue-300 opacity-60" />
        <div className="lp-aurora right-[5%] top-[5%] h-[380px] w-[520px] bg-sky-200 opacity-70" style={{ animationDelay: '-8s' }} />
        <div className="lp-aurora left-[35%] top-[35%] h-[300px] w-[420px] bg-violet-200 opacity-50" style={{ animationDelay: '-15s' }} />
        <div className="lp-grid absolute inset-x-0 top-[30%] h-[80vh]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,#ffffff_80%)]" />
      </div>

      <div className="mx-auto max-w-5xl text-center">
        <div
          className="lp-word mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold uppercase leading-none tracking-[0.2em] text-blue-700 shadow-sm"
          style={{ '--lp-delay': '0ms' } as CSSProperties}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>Nền tảng OKR · KPI · BSC có trợ lý AI</span>
        </div>

        {/* Mỗi câu một dòng. Dòng gradient dùng background-clip:text nên phải có padding
            dưới — không thì dấu nặng (ụ, ợ) nằm ngoài hộp và bị cắt. */}
        <h1 className="mx-auto max-w-5xl text-[38px] font-black leading-[1.15] tracking-tight text-slate-900 sm:text-6xl lg:text-[80px]">
          <span className="lp-word block pb-[0.08em]" style={{ '--lp-delay': '120ms' } as CSSProperties}>
            Mục tiêu rõ ràng.
          </span>
          <span
            className="lp-word lp-gradient-text block px-[0.05em] pb-[0.18em] -mb-[0.1em]"
            style={{ '--lp-delay': '300ms' } as CSSProperties}
          >
            Hiệu suất nhìn thấy được.
          </span>
        </h1>

        <p
          className="lp-word mx-auto mt-6 max-w-3xl text-base text-slate-600 sm:text-xl"
          style={{ '--lp-delay': '650ms' } as CSSProperties}
        >
          Giao · đo · đánh giá · thưởng trên một màn hình. Hỏi K.AI thay vì chờ báo cáo.
        </p>

        <div
          className="lp-word mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ '--lp-delay': '800ms' } as CSSProperties}
        >
          <PrimaryButton to="/login" size="lg" className="w-full sm:w-auto">
            Trải nghiệm miễn phí
          </PrimaryButton>
          <GhostButton href="#demo" size="lg" className="w-full sm:w-auto">
            Xem KeyGo vận hành
          </GhostButton>
        </div>
      </div>

      {/* Ảnh dashboard thật — không nghiêng, không đè gì lên để giữ nét và đúng nội dung */}
      <div className="lp-frame-in relative mx-auto mt-16 max-w-[1440px] sm:mt-24">
        <div className="pointer-events-none absolute -inset-x-10 -bottom-10 top-1/3 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.28),transparent_65%)] blur-2xl" />
        <Screenshot
          src="/landing/dashboard.webp"
          alt="Màn hình Tổng quan của KeyGo: chỉ số KPI đơn vị, bộ lọc, danh sách nhân sự cần can thiệp"
          title="app.keygo.vn/dashboard"
          priority
        />
      </div>

      <a
        href="#story"
        className="mx-auto mt-14 flex w-fit flex-col items-center gap-1 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 transition-colors hover:text-slate-700"
      >
        Cuộn để xem câu chuyện
        <ChevronDown className="lp-scroll-hint h-5 w-5" />
      </a>
    </section>
  )
}
