import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Target, CheckCircle2 } from 'lucide-react'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="h-screen w-full flex bg-[var(--color-background)] overflow-hidden">
      {/* Left Pane - Branding & Graphic (Visible only on lg screens) */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative bg-gradient-to-br from-indigo-900 to-slate-900 text-white overflow-hidden items-center justify-center flex-col p-12">
        {/* Abstract background elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,1)_0%,rgba(0,0,0,0)_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-indigo-500/30 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-400/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 max-w-xl w-full">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl shadow-black/20">
              <Target className="text-cyan-400" size={24} />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">KeyGo</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Key Insights.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Go Smarter.</span>
          </h1>
          
          <p className="text-lg text-indigo-100/80 mb-12 leading-relaxed max-w-md">
            Hệ sinh thái quản trị mục tiêu chuyên nghiệp dành riêng cho chủ doanh nghiệp và thế hệ quản lý hiện đại.
          </p>

          <div className="space-y-4">
            {[
              'Theo dõi hiệu suất theo thời gian thực',
              'Đánh giá chéo 360 độ minh bạch',
              'Tự động hóa chu trình duyệt chỉ tiêu',
              'Báo cáo tự động bằng đồ thị trực quan'
            ].map((feature, idx) => (
               <div key={idx} className="flex items-center gap-3 text-indigo-50 font-medium bg-white/5 backdrop-blur-sm border border-white/10 w-fit px-4 py-2.5 rounded-full">
                  <CheckCircle2 size={18} className="text-cyan-400" />
                  {feature}
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Pane - Form Area */}
      <div className="w-full lg:w-1/2 h-full flex flex-col items-center overflow-y-auto px-6 py-12 sm:px-12 custom-scrollbar relative">
        <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 -z-10"></div>
        <div className="w-full max-w-md my-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Logo for mobile only */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-lg shadow-[var(--color-primary)]/20">
              <Target className="text-white" size={26} />
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
