import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { CheckCircle2 } from 'lucide-react'
import { BrandLogo } from '@/components/common/BrandLogo'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="h-screen w-full flex bg-[var(--color-background)] overflow-hidden">
      {/* Left Pane - Branding & Graphic (Visible only on lg screens) */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative bg-[var(--color-primary-deep)] text-white overflow-hidden items-center justify-center flex-col p-12">

        <div className="relative z-10 max-w-xl w-full">
          <Link to="/" className="mb-10 inline-flex items-center transition-opacity hover:opacity-80" aria-label="KeyGo">
            <BrandLogo variant="white" className="h-12" />
          </Link>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-6">
            Key Insights.<br/>
            <span className="text-white/60">Go Smarter.</span>
          </h1>
          
          <p className="text-lg text-white/75 mb-12 leading-relaxed max-w-md">
            Nền tảng quản trị mục tiêu & hiệu suất hiện đại
          </p>

          <div className="space-y-4">
            {[
              'Theo dõi hiệu suất theo thời gian thực',
              'Tích hợp Trí tuệ Nhân tạo (AI)',
              'Tự động hóa chu trình duyệt chỉ tiêu',
              'Báo cáo tự động bằng đồ thị trực quan'
            ].map((feature, idx) => (
               <div key={idx} className="flex items-center gap-3 text-white/90 font-medium bg-white/5 border border-white/15 w-fit px-4 py-2.5 rounded-full">
                  <CheckCircle2 size={18} className="text-white/80" aria-hidden="true" />
                  {feature}
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Pane - Form Area */}
      <div className="w-full lg:w-1/2 min-w-0 h-full flex flex-col items-center overflow-y-auto overflow-x-hidden px-6 py-12 sm:px-12 custom-scrollbar relative">
        <div className="absolute inset-0 bg-[var(--color-muted)] -z-10"></div>
        <div className="w-full max-w-md my-auto">
          {/* Logo for mobile only */}
          <Link to="/" className="lg:hidden flex justify-center mb-8 transition-transform" aria-label="KeyGo">
            <BrandLogo className="h-12 dark:hidden" />
            <BrandLogo variant="white" className="hidden h-12 dark:block" />
          </Link>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
