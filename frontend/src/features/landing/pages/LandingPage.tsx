import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Target, ShieldCheck, Users, ArrowRight, CheckCircle2,
  BarChart3, Zap, LayoutDashboard, Database, Key, Check, X,
  Sparkles, Building2, Globe, Server, Search, Phone
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b",
        scrolled 
          ? "bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl border-slate-200 dark:border-slate-800 shadow-sm py-2.5 sm:py-3"
          : "bg-transparent border-transparent py-4 sm:py-5"
      )}>
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 group cursor-pointer shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <Target className="text-white w-5 h-5 sm:w-[22px] sm:h-[22px]" />
            </div>
            <span className="font-black text-xl sm:text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              KeyGo
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-bold text-sm text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Tính năng</a>
            <a href="#benefits" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Ưu điểm</a>
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Bảng giá</a>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              to="/login"
              className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors hidden sm:block"
            >
              Đăng nhập
            </Link>
            <Link
              to="/login"
              className="group relative px-4 sm:px-6 py-2 sm:py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-black rounded-full transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/10 overflow-hidden flex items-center gap-1.5 sm:gap-2 whitespace-nowrap"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10 group-hover:text-white transition-colors">Bắt đầu ngay</span>
              <ArrowRight size={14} className="relative z-10 shrink-0 group-hover:translate-x-1 transition-transform group-hover:text-white sm:w-4 sm:h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Floating Contact Buttons */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-[100] flex flex-col gap-3 sm:gap-5 items-center">
        {/* Zalo Button */}
        <a 
          href="https://zalo.me/0904871813" 
          target="_blank" 
          rel="noopener noreferrer"
          className="group relative flex items-center justify-center"
        >
          <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-[#0068ff] rounded-full animate-ping opacity-20" />
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-[#0068ff] rounded-full flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-300">
             <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8 fill-white">
                <path d="M12.015 2c-5.523 0-10 4.029-10 9s4.477 9 10 9c.594 0 1.173-.046 1.733-.133l4.316 2.054a.5.5 0 0 0 .708-.553l-.841-3.693C19.782 16.34 22.015 13.88 22.015 11c0-4.971-4.477-9-10-9zm5.342 12.06c-.145.145-.34.226-.542.226-.203 0-.397-.081-.542-.226l-1.5-1.5a.765.765 0 0 1 0-1.085l1.5-1.5c.3-.3.784-.3 1.085 0 .299.3.299.784 0 1.085L16.35 12l1.007.915c.3.3.3.784 0 1.085v.06z"/>
             </svg>
          </div>
          {/* QR Code Tooltip - Visible on Hover */}
          <div className="absolute bottom-full right-0 mb-4 px-3 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0 pointer-events-none w-56">
            <img src="/zalo-qr.png" alt="Zalo QR" className="w-full h-auto rounded-lg mb-2" />
            <div className="text-[10px] font-black text-center text-slate-500 dark:text-slate-400 uppercase tracking-wider">Quét mã để nhắn tin</div>
          </div>
          <div className="absolute right-full mr-4 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs font-black text-slate-900 dark:text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 pointer-events-none">
            Chat Zalo: 090 4871813
          </div>
        </a>

        {/* Phone Button */}
        <a 
          href="tel:0904871813"
          className="group relative flex items-center justify-center"
        >
          <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-25" />
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/30 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
            <Phone className="text-white fill-white/20 w-[22px] h-[22px] sm:w-[26px] sm:h-[26px]" />
          </div>
          <div className="absolute right-full mr-4 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs font-black text-slate-900 dark:text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 pointer-events-none">
            Hotline: 090 4871813
          </div>
        </a>
      </div>

      {/* Hero Section */}
      <section className="relative pt-28 pb-14 sm:pt-40 sm:pb-20 lg:pt-52 lg:pb-32 px-5 sm:px-6 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none -z-10 animate-pulse" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-indigo-600 dark:text-indigo-400 text-[9px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-5 sm:mb-8 group hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors cursor-default">
            <Sparkles size={12} className="text-amber-500 shrink-0 sm:w-3.5 sm:h-3.5" />
            Nền tảng quản trị mục tiêu hàng đầu
          </div>

          <h1 className="text-[32px] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[80px] font-black tracking-tight leading-[1.15] sm:leading-[1.1] mb-5 sm:mb-8 text-slate-900 dark:text-white text-balance">
            Kiến tạo thành công với <br className="hidden md:block" />
            <span className="relative inline-block mt-1 sm:mt-2">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] animate-gradient-x">
                Mục tiêu rõ ràng
              </span>
              <svg className="absolute -bottom-2 sm:-bottom-4 left-0 w-full h-2.5 sm:h-4 text-indigo-500/30" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="4" fill="none" />
              </svg>
            </span>
          </h1>

          <p className="text-sm sm:text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-8 sm:mb-12 font-medium leading-relaxed">
            KeyGo là giải pháp phần mềm quản trị doanh nghiệp toàn diện giúp bạn thiết lập OKR, theo dõi KPI, đánh giá hiệu suất 360 độ và xây dựng một đội ngũ gắn kết, minh bạch.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-base font-black rounded-full transition-all shadow-xl shadow-indigo-600/25 active:scale-95 flex items-center justify-center gap-2 group"
            >
              Trải nghiệm ngay <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform sm:w-[18px] sm:h-[18px]" />
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-sm sm:text-base font-black rounded-full transition-all active:scale-95 flex items-center justify-center shadow-sm"
            >
              Xem báo giá
            </a>
          </div>
        </div>

        {/* Dashboard Floating Preview */}
        <div className="max-w-[1200px] mx-auto mt-12 sm:mt-24 relative z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
           <div className="relative rounded-[20px] sm:rounded-[32px] p-1.5 sm:p-2 bg-gradient-to-b from-white/40 to-white/10 dark:from-slate-800/40 dark:to-slate-900/10 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-500/10 mix-blend-overlay" />
              <div className="rounded-[14px] sm:rounded-[24px] overflow-hidden border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-inner relative flex flex-col aspect-[4/3] sm:aspect-[16/9] max-h-[700px]">

                 {/* Fake Header */}
                 <div className="h-10 sm:h-14 border-b border-slate-100 dark:border-slate-800 flex items-center px-3 sm:px-6 gap-3 sm:gap-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                    <div className="flex gap-1.5 sm:gap-2">
                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-400" />
                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-amber-400" />
                      <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="ml-2 sm:ml-4 w-32 sm:w-64 h-5 sm:h-7 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md flex items-center px-2 sm:px-3">
                      <Search size={12} className="text-slate-400" />
                    </div>
                 </div>

                 {/* Fake Body */}
                 <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 border-r border-slate-100 dark:border-slate-800 p-6 space-y-4 shrink-0 hidden md:block">
                      <div className="flex items-center gap-3 text-indigo-600 mb-8">
                        <Target size={24} /> <div className="h-4 w-24 bg-indigo-100 dark:bg-indigo-900/50 rounded" />
                      </div>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-10 flex items-center gap-3 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                          <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-700" />
                          <div className="h-2 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      ))}
                    </div>

                    {/* Main Area */}
                    <div className="flex-1 p-4 sm:p-6 md:p-10 bg-slate-50/30 dark:bg-[#020617]/50 flex flex-col gap-4 sm:gap-8 overflow-hidden relative">
                      {/* Floating glowing orbs */}
                      <div className="absolute top-10 right-10 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full" />

                      <div className="flex justify-between items-end">
                        <div className="space-y-2">
                          <div className="h-4 w-28 sm:h-6 sm:w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
                          <div className="h-2 w-20 sm:h-3 sm:w-32 bg-slate-100 dark:bg-slate-800/50 rounded-md" />
                        </div>
                        <div className="w-20 h-7 sm:w-32 sm:h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                          <div className="h-2 w-10 sm:w-16 bg-white/50 rounded" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-6 shrink-0">
                        {[
                          { c: 'indigo', w: 'w-10 sm:w-16' },
                          { c: 'emerald', w: 'w-10 sm:w-24' },
                          { c: 'amber', w: 'w-10 sm:w-20' }
                        ].map((stat, i) => (
                          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 shadow-sm flex flex-col gap-2 sm:gap-4 relative overflow-hidden group">
                            <div className={`absolute right-0 top-0 w-24 h-24 bg-${stat.c}-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`} />
                            <div className="h-2 w-10 sm:h-3 sm:w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="flex items-end gap-2">
                              <div className={cn("h-5 sm:h-8 bg-slate-200 dark:bg-slate-700 rounded-lg", stat.w)} />
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 sm:h-2 rounded-full mt-1 sm:mt-2 overflow-hidden">
                              <div className={`bg-${stat.c}-500 h-full w-[${60 + i*15}%]`} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 overflow-hidden">
                        <div className="h-3 w-24 sm:h-4 sm:w-32 bg-slate-100 dark:bg-slate-800 rounded mb-4 sm:mb-8" />
                        <div className="space-y-3 sm:space-y-4">
                          {[1,2,3].map(i => (
                            <div key={i} className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800/50 pb-3 sm:pb-4">
                              <div className="flex items-center gap-2.5 sm:gap-4">
                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
                                <div className="space-y-1.5 sm:space-y-2">
                                  <div className="h-2 w-20 sm:h-3 sm:w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                                  <div className="h-1.5 w-12 sm:h-2 sm:w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                                </div>
                              </div>
                              <div className="w-14 h-6 sm:w-24 sm:h-8 rounded-lg bg-slate-50 dark:bg-slate-800 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Brands / Trusted by */}
      <section className="py-8 sm:py-10 border-y border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/20">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6 flex flex-col md:flex-row items-center justify-center gap-5 md:gap-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <p className="text-[10px] sm:text-sm font-bold uppercase tracking-widest text-slate-500 md:mr-8 shrink-0">Được tin dùng bởi</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 sm:gap-x-12 sm:gap-y-6 text-slate-400 font-black text-sm sm:text-xl tracking-tighter">
            <span className="flex items-center gap-1.5 sm:gap-2"><Building2 className="w-4 h-4 sm:w-6 sm:h-6"/> GlobalSoft</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><Globe className="w-4 h-4 sm:w-6 sm:h-6"/> TechCorp</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><LayoutDashboard className="w-4 h-4 sm:w-6 sm:h-6"/> StartupInc</span>
            <span className="flex items-center gap-1.5 sm:gap-2"><Database className="w-4 h-4 sm:w-6 sm:h-6"/> DataSystem</span>
          </div>
        </div>
      </section>


      {/* Features Matrix Section */}
      <section id="features" className="py-16 sm:py-24 lg:py-32 bg-white dark:bg-slate-900 relative">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-20 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-4 sm:mb-6">
              Giải pháp tối ưu
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 sm:mb-6 text-slate-900 dark:text-white text-balance">
              Tại sao chọn <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">KeyGo</span>?
            </h2>
            <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Số hóa toàn diện quy trình giao việc, đánh giá, và quản lý mục tiêu. Phù hợp cho mọi quy mô doanh nghiệp từ SME đến Enterprise.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-8">
            <FeatureCard 
              icon={Target}
              title="Quản lý OKR & KPI"
              description="Kết hợp mục tiêu khát vọng (OKR) và chỉ số đo lường (KPI) giúp đội ngũ đi đúng hướng và đo lường chính xác hiệu quả."
              color="indigo"
            />
            <FeatureCard 
              icon={Users}
              title="Đánh giá 360 Độ"
              description="Quy trình đánh giá minh bạch: Tự đánh giá, Quản lý đánh giá và Chốt kết quả theo luồng phân quyền chặt chẽ."
              color="purple"
            />
            <FeatureCard 
              icon={BarChart3}
              title="Báo Cáo Thời Gian Thực"
              description="Dashboard động với số liệu trực quan, xuất báo cáo Excel/PDF nhanh chóng. Giúp ra quyết định dựa trên dữ liệu."
              color="emerald"
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="Phân Quyền Đa Tầng"
              description="Thiết lập cơ cấu tổ chức sâu rộng, phân quyền theo vai trò (Role-based) và theo đơn vị (Unit-based)."
              color="amber"
            />
            <FeatureCard 
              icon={Zap}
              title="Tự Động Hóa & Nhắc Nhở"
              description="Hệ thống thông báo thông minh, theo dõi trạng thái Pending/Approved tự động, tiết kiệm 50% thời gian HR."
              color="blue"
            />
            <FeatureCard 
              icon={Server}
              title="SaaS & Triển khai riêng"
              description="Hỗ trợ cả mô hình SaaS Multi-tenant linh hoạt và Dedicated Environment / On-site cho các tập đoàn lớn."
              color="rose"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-16 sm:py-24">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 space-y-6 sm:space-y-8">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white text-balance">
                Chuyển đổi cách doanh nghiệp bạn <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Vận hành</span>
              </h2>
              <div className="space-y-4 sm:space-y-6">
                {[
                  "Minh bạch hóa mục tiêu công ty đến từng cá nhân",
                  "Gắn kết đội ngũ bằng các mục tiêu chung",
                  "Đo lường chính xác hiệu quả công việc",
                  "Tạo động lực phát triển cho nhân viên",
                  "Ra quyết định dựa trên dữ liệu thực tế"
                ].map((benefit, idx) => (
                  <div key={idx} className="flex items-center gap-3 sm:gap-4">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} className="sm:w-4 sm:h-4" />
                    </div>
                    <span className="text-sm sm:text-lg font-bold text-slate-700 dark:text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="aspect-square bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-full absolute inset-0 blur-3xl -z-10" />
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-3 sm:space-y-4 pt-8 sm:pt-12">
                  <StatCard number="40%" label="Tăng năng suất" />
                  <StatCard number="2x" label="Tốc độ hoàn thành mục tiêu" />
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <StatCard number="95%" label="Tỷ lệ hài lòng" />
                  <StatCard number="100%" label="Minh bạch dữ liệu" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (From Image) */}
      <section id="pricing" className="py-16 sm:py-24 lg:py-32 bg-slate-50 dark:bg-[#020617] relative border-t border-slate-200 dark:border-slate-800">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-20">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 sm:mb-6 text-slate-900 dark:text-white">
              Bảng giá <span className="text-indigo-600 dark:text-indigo-400">Đầu tư</span>
            </h2>
            <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
              Các gói giải pháp được thiết kế linh hoạt, phù hợp với từng giai đoạn phát triển và quy mô của tổ chức.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-5 sm:gap-8 items-stretch max-w-6xl mx-auto">
            {/* Standard Plan */}
            <PricingCard 
              tier="Standard"
              price="Liên hệ"
              unit=""
              description="Phù hợp cho các nhóm nhỏ (< 200 user) cần số hóa đánh giá nhân sự cơ bản."
              features={[
                { text: "SaaS Multi-tenant, dùng chung Domain", included: true },
                { text: "Quản trị người dùng & Phân quyền", included: true },
                { text: "Hệ thống đánh giá KPI", included: true },
                { text: "Báo cáo & Export tiêu chuẩn", included: true },
                { text: "Dashboard mặc định", included: true },
                { text: "Quản lý mục tiêu OKR", included: false },
                { text: "White Label (Logo riêng)", included: false },
              ]}
              buttonText="Bắt đầu dùng thử"
              buttonVariant="outline"
            />

            {/* Professional Plan */}
            <PricingCard 
              tier="Professional"
              price="Liên hệ"
              unit=""
              description="Giải pháp toàn diện cho doanh nghiệp tầm trung (< 500 user) quản trị OKR & KPI."
              isPopular
              features={[
                { text: "SaaS Multi-tenant, dùng chung Domain", included: true },
                { text: "Quản lý mục tiêu OKR & KPI", included: true },
                { text: "Dashboard động tùy chỉnh", included: true },
                { text: "White Label (Logo + Powered by KeyGo)", included: true },
                { text: "Báo cáo chuyên sâu", included: true },
                { text: "Hỗ trợ SLA 24h", included: true },
                { text: "API Integration / SSO", included: "Tính phí riêng" },
              ]}
              buttonText="Đăng ký ngay"
              buttonVariant="primary"
            />

            {/* Enterprise Plan */}
            <PricingCard 
              tier="Enterprise"
              price="Liên hệ"
              unit=""
              description="Giải pháp Dedicated / Onsite cho các tổ chức lớn, bảo mật cao (> 500 user)."
              features={[
                { text: "Subdomain riêng hoặc Onsite triển khai", included: true },
                { text: "Tenant & Database riêng biệt", included: true },
                { text: "Tùy chỉnh Dashboard không giới hạn", included: true },
                { text: "White Label toàn diện (Màu sắc, Login page)", included: true },
                { text: "SLA hỗ trợ Online 12h / Online-meeting", included: true },
                { text: "Hỗ trợ kỹ thuật & Nâng cấp định kỳ", included: true },
                { text: "Tùy chỉnh luồng nghiệp vụ mức độ cao", included: true },
              ]}
              buttonText="Liên hệ chuyên viên"
              buttonVariant="outline"
              glowColor="purple"
            />
          </div>

          <div className="mt-10 sm:mt-16 text-center text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            * Vui lòng liên hệ để nhận báo giá chi tiết. Các tính năng <span className="font-bold text-slate-700 dark:text-slate-300">AI Assistant / AI Insight</span> sẽ được tư vấn theo nhu cầu thực tế của từng doanh nghiệp.
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 px-5 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-slate-900 dark:bg-slate-950" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-full blur-[120px] opacity-40 mix-blend-screen animate-pulse duration-1000" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-5 sm:space-y-8">
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tight text-white text-balance">
            Sẵn sàng nâng tầm <br className="hidden sm:block" /> quản trị doanh nghiệp?
          </h2>
          <p className="text-sm sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed">
            Tạo tài khoản ngay hôm nay và trải nghiệm môi trường quản lý mục tiêu chuyên nghiệp nhất dành cho doanh nghiệp của bạn.
          </p>
          <div className="pt-4 sm:pt-8 flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 bg-white text-slate-900 hover:bg-indigo-50 text-sm sm:text-lg font-black rounded-full transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:-translate-y-1 active:scale-95"
            >
              Bắt đầu miễn phí <ArrowRight size={18} className="sm:w-5 sm:h-5" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-10 py-3.5 sm:py-4 bg-transparent border border-white/30 text-white hover:bg-white/10 text-sm sm:text-lg font-black rounded-full transition-all active:scale-95"
            >
              Liên hệ tư vấn
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#020617] border-t border-slate-200 dark:border-slate-800 py-12 sm:py-16 px-5 sm:px-6 relative z-10">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Target className="text-white" size={18} />
              </div>
              <span className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white">KeyGo</span>
            </div>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-md">
              Hệ thống Quản trị Mục tiêu và Đánh giá hiệu suất nhân sự toàn diện. Giúp doanh nghiệp minh bạch hóa mục tiêu, tối ưu hiệu suất và kiến tạo văn hóa làm việc xuất sắc.
            </p>
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-white mb-4 sm:mb-6 uppercase tracking-widest text-xs sm:text-sm">Sản phẩm</h4>
            <ul className="space-y-3 sm:space-y-4 text-sm sm:text-base font-medium text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Quản lý OKR</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Đánh giá KPI</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Báo cáo & Phân tích</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Tích hợp hệ thống</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-white mb-4 sm:mb-6 uppercase tracking-widest text-xs sm:text-sm">Hỗ trợ</h4>
            <ul className="space-y-3 sm:space-y-4 text-sm sm:text-base font-medium text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Tài liệu HDSD</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Trung tâm trợ giúp</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Liên hệ kinh doanh</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Chính sách bảo mật</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
            © {new Date().getFullYear()} KeyGo Platform.
          </p>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors">
              <Globe size={16} />
            </div>
            {/* Social Icons Placeholders */}
          </div>
        </div>
      </footer>
    </div>
  )
}


function FeatureCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
  const colorStyles: Record<string, string> = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-500",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-500",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white dark:group-hover:bg-rose-500",
  }

  return (
    <div className="p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group cursor-default">
      <div className={cn("w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 transition-all duration-300 shadow-inner group-hover:shadow-lg group-hover:rotate-6", colorStyles[color])}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
      <h3 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mb-2 sm:mb-4 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</h3>
      <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{description}</p>
    </div>
  )
}

function PricingCard({ 
  tier, price, unit, description, features, isPopular, buttonText, buttonVariant, glowColor = 'indigo' 
}: { 
  tier: string, price: string, unit: string, description: string, 
  features: { text: string, included: boolean | string }[], 
  isPopular?: boolean, buttonText: string, buttonVariant: 'primary' | 'outline', glowColor?: string 
}) {
  return (
    <div className={cn(
      "relative bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[40px] p-6 sm:p-8 border transition-all duration-500 flex flex-col hover:-translate-y-2 hover:shadow-2xl",
      isPopular
        ? "border-indigo-500 shadow-xl shadow-indigo-500/10 lg:scale-105 z-10"
        : "border-slate-200 dark:border-slate-800 shadow-sm"
    )}>
      {isPopular && (
        <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg whitespace-nowrap">
          Lựa chọn phổ biến
        </div>
      )}
      
      {/* Background Glow */}
      <div className={cn(
        "absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 pointer-events-none transition-transform group-hover:scale-150",
        `bg-${glowColor}-500`
      )} />

      <div className="mb-5 sm:mb-8">
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">{tier}</h3>
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed lg:h-10">{description}</p>
      </div>

      <div className="mb-5 sm:mb-8 flex items-baseline gap-2">
        <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">{price}</span>
        <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest">{unit}</span>
      </div>

      <div className="flex-1 space-y-3 sm:space-y-4 mb-6 sm:mb-8">
        {features.map((feat, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {feat.included === true ? (
                <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 flex items-center justify-center">
                  <Check size={12} strokeWidth={3} />
                </div>
              ) : feat.included === false ? (
                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <X size={12} strokeWidth={3} />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center">
                  <Key size={10} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex-1">
              <span className={cn(
                "text-xs sm:text-sm font-bold leading-relaxed",
                feat.included === false ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300"
              )}>
                {feat.text}
              </span>
              {typeof feat.included === 'string' && (
                <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase mt-0.5">({feat.included})</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/login"
        className={cn(
          "w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black transition-all text-center mt-auto",
          buttonVariant === 'primary' 
            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/25 active:scale-95" 
            : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95"
        )}
      >
        {buttonText}
      </Link>
    </div>
  )
}

function StatCard({ number, label }: { number: string, label: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-[20px] sm:rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-lg text-center hover:-translate-y-2 transition-transform duration-300">
      <div className="text-3xl sm:text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-1 sm:mb-2">
        {number}
      </div>
      <div className="text-[10px] sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sm:tracking-widest leading-tight">{label}</div>
    </div>
  )
}
