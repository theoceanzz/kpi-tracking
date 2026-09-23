import { Mail, Phone } from 'lucide-react'
import { BrandLogo } from '@/components/common/BrandLogo'

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 px-5 py-12 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandLogo className="h-9" />
          <p className="mt-4 max-w-sm text-sm text-slate-500">
            Nền tảng quản trị mục tiêu & hiệu suất: OKR, KPI, BSC, hạnh kiểm, thưởng và trợ lý AI cho doanh nghiệp Việt.
          </p>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Sản phẩm</div>
          <ul className="mt-4 space-y-2 text-sm text-slate-500">
            <li><a href="#story" className="hover:text-slate-900">Câu chuyện</a></li>
            <li><a href="#demo" className="hover:text-slate-900">Xem demo</a></li>
            <li><a href="#modules" className="hover:text-slate-900">Module & tích hợp</a></li>
            <li><a href="#pricing" className="hover:text-slate-900">Bảng giá</a></li>
            <li><a href="#contact" className="hover:text-slate-900">Đăng ký tư vấn</a></li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Liên hệ</div>
          <ul className="mt-4 space-y-2 text-sm text-slate-500">
            <li><a href="tel:0904871813" className="flex items-center gap-2 hover:text-slate-900"><Phone className="h-3.5 w-3.5" /> 090 4871813</a></li>
            <li><a href="https://zalo.me/0904871813" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-slate-900"><Mail className="h-3.5 w-3.5" /> Zalo KeyGo</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-[1440px] flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400 sm:flex-row">
        <span>© {new Date().getFullYear()} KeyGo Platform. All rights reserved.</span>
        <span>Made in Vietnam 🇻🇳</span>
      </div>
    </footer>
  )
}
