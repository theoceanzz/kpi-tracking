import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Target, ShieldCheck, ArrowRight, CheckCircle2,
  BarChart3, LayoutDashboard, Database, Key, Check, X,
  Sparkles, Building2, Globe, Server, Search, Phone,
  Bot, Gauge, HeartHandshake, Gift, Wallet, Link2, Mic,
  FileSpreadsheet, GitBranch, Bell, Coins, ListChecks, ToggleRight
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

          <div className="hidden md:flex items-center gap-5 lg:gap-8 font-bold text-sm text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Tính năng</a>
            <a href="#ai" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Trợ lý K.AI</a>
            <a href="#modules" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Module</a>
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
            KeyGo là giải pháp quản trị doanh nghiệp toàn diện: thiết lập OKR &amp; KPI, dựng thẻ điểm cân bằng BSC, chấm hạnh kiểm, ghi nhận &amp; thưởng cho nhân viên — tất cả có trợ lý AI đi kèm để hỏi số liệu và điền hộ biểu mẫu.
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
                          { blob: 'bg-indigo-500/10', bar: 'bg-indigo-500', fill: 'w-[60%]', w: 'w-10 sm:w-16' },
                          { blob: 'bg-emerald-500/10', bar: 'bg-emerald-500', fill: 'w-[75%]', w: 'w-10 sm:w-24' },
                          { blob: 'bg-amber-500/10', bar: 'bg-amber-500', fill: 'w-[90%]', w: 'w-10 sm:w-20' }
                        ].map((stat, i) => (
                          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 shadow-sm flex flex-col gap-2 sm:gap-4 relative overflow-hidden group">
                            <div className={cn("absolute right-0 top-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110", stat.blob)} />
                            <div className="h-2 w-10 sm:h-3 sm:w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                            <div className="flex items-end gap-2">
                              <div className={cn("h-5 sm:h-8 bg-slate-200 dark:bg-slate-700 rounded-lg", stat.w)} />
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 sm:h-2 rounded-full mt-1 sm:mt-2 overflow-hidden">
                              <div className={cn("h-full", stat.bar, stat.fill)} />
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
      <section id="features" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 bg-white dark:bg-slate-900 relative">
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

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
            <FeatureCard 
              icon={Target}
              title="Quản lý OKR & KPI"
              description="Mục tiêu khát vọng (OKR) và chỉ tiêu đo lường (KPI) trên cùng một trục. Phân rã chỉ tiêu theo thác nước từ công ty xuống từng đơn vị và cá nhân."
              color="indigo"
            />
            <FeatureCard 
              icon={ListChecks}
              title="Đánh giá theo đợt & theo kỳ"
              description="Nhân viên tự chấm và nộp minh chứng, quản lý duyệt từng đợt, hệ thống tổng hợp nhiều đợt thành kết quả của cả kỳ. Có luồng xin điều chỉnh chỉ tiêu giữa kỳ."
              color="purple"
            />
            <FeatureCard 
              icon={HeartHandshake}
              title="Chấm hạnh kiểm"
              description="Bộ tiêu chí hành vi có trọng số riêng, nhân viên tự chấm kèm dẫn chứng. Ma trận đánh giá ánh xạ điểm hành vi và % KPI ra xếp loại cuối cùng."
              color="emerald"
            />
            <FeatureCard 
              icon={Gauge}
              title="Thẻ điểm cân bằng (BSC)"
              description="Dựng bộ tiêu chí từng kỳ theo bốn lĩnh vực, gán trọng số cho từng hạng mục, nhập nhanh từ Excel và theo dõi kết quả theo từng hạng mục."
              color="rose"
            />
            <FeatureCard 
              icon={Bot}
              title="Trợ lý AI K.AI"
              description="Hỏi số liệu KPI, OKR, BSC bằng tiếng Việt và nhận trả lời theo đúng quyền của bạn. Trợ lý điền hộ biểu mẫu đang mở, mọi thao tác ghi đều chờ bạn xác nhận."
              color="blue"
            />
            <FeatureCard 
              icon={BarChart3}
              title="Phân tích & báo cáo tự tạo"
              description="Dashboard widget kéo thả và ghim, khoan sâu theo từng cấp đơn vị. Tự tạo nguồn dữ liệu dạng bảng rồi dựng báo cáo riêng, xuất Excel."
              color="cyan"
            />
            <FeatureCard 
              icon={Gift}
              title="Thưởng, điểm danh & quà tặng"
              description="Đề nghị thưởng theo ngân sách, chương trình thưởng chạy tự động, điểm danh hằng ngày, cửa hàng quà và giấy chứng nhận cho nhân viên."
              color="amber"
            />
            <FeatureCard 
              icon={Wallet}
              title="Ví điểm & ví tiền"
              description="Số dư điểm và tiền của từng nhân sự, nạp tiền qua SePay, quy đổi tiền trong ví sang điểm thưởng theo tỉ giá, sổ cái giao dịch và công cụ đối soát."
              color="teal"
            />
            <FeatureCard 
              icon={Bell}
              title="Tự động hóa & nhắc nhở"
              description="Thông báo trong ứng dụng theo thời gian thực và email tóm tắt định kỳ, gửi đúng cấp quản lý cần xử lý thay vì cả cây tổ chức. Nhắc hạn nộp, nhắc duyệt và lịch chạy thưởng tự động."
              color="sky"
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="Phân quyền đa tầng"
              description="Cây đơn vị nhiều cấp tùy cấu hình, phân quyền theo vai trò (role-based) và theo đơn vị (unit-based) tới từng thao tác."
              color="purple"
            />
            <FeatureCard 
              icon={FileSpreadsheet}
              title="Nhập liệu & tích hợp"
              description="Đăng nhập qua Lark, mẫu email tự biên soạn, nhập cơ cấu tổ chức / OKR / BSC từ Excel với bước xem trước trước khi ghi vào hệ thống."
              color="indigo"
            />
            <FeatureCard 
              icon={Server}
              title="SaaS & triển khai riêng"
              description="Hỗ trợ cả mô hình SaaS multi-tenant linh hoạt và Dedicated Environment / On-site cho các tập đoàn lớn."
              color="slate"
            />
          </div>
        </div>
      </section>

      {/* AI Assistant Spotlight */}
      <section id="ai" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 relative overflow-hidden border-t border-slate-200 dark:border-slate-800">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            <div className="flex-1 space-y-6 sm:space-y-8 w-full">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-black uppercase tracking-widest">
                <Bot size={14} className="shrink-0" /> Mới &middot; Trợ lý K.AI
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white text-balance">
                Hỏi bằng tiếng Việt, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">trả lời bằng số liệu thật</span>
              </h2>
              <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                K.AI đọc đúng dữ liệu bạn được phép xem, tự mở biểu mẫu và điền hộ những ô bạn đang nhìn thấy. Bạn vẫn là người bấm nút cuối cùng.
              </p>

              <div className="space-y-4 sm:space-y-5">
                <AiCapability
                  icon={Database}
                  title="Đọc số liệu theo đúng quyền của bạn"
                  description="KPI, bài nộp, đánh giá, OKR, BSC, nhân sự và cơ cấu đơn vị — trợ lý chỉ thấy phần bạn được xem."
                />
                <AiCapability
                  icon={ListChecks}
                  title="Điền hộ biểu mẫu đang mở"
                  description="Chỉ những ô đang hiển thị trên màn hình, kèm bản xem trước từng ô trước khi áp vào form."
                />
                <AiCapability
                  icon={ShieldCheck}
                  title="Mọi thao tác ghi đều chờ xác nhận"
                  description="Tạo chỉ tiêu, duyệt bài nộp, chấm điểm… đều hiện thẻ xác nhận. Bạn đồng ý bằng nút hoặc bằng chính câu chat."
                />
                <AiCapability
                  icon={Mic}
                  title="Trả lời theo dòng, nhập bằng giọng nói"
                  description="Câu trả lời hiện dần theo luồng, và bạn có thể đọc câu hỏi thay vì gõ."
                />
                <AiCapability
                  icon={Coins}
                  title="Hạn mức token chia theo đơn vị"
                  description="Quản trị viên phân bổ token AI cho từng đơn vị cấp dưới và theo dõi mức tiêu thụ."
                />
              </div>
            </div>

            {/* Chat mock */}
            <div className="flex-1 w-full">
              <div className="rounded-[24px] sm:rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                  <span className="font-black text-sm text-slate-900 dark:text-white">K.AI</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Trực tuyến
                  </span>
                </div>

                <div className="p-4 sm:p-6 space-y-4 bg-slate-50/30 dark:bg-[#020617]/40">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-indigo-600 text-white text-xs sm:text-sm font-bold leading-relaxed">
                      Phòng Kinh doanh quý này đạt bao nhiêu %?
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <Database size={11} className="shrink-0" /> Đã đọc dữ liệu KPI
                      </div>
                      <p>Phòng Kinh doanh đạt <span className="font-black text-emerald-600 dark:text-emerald-400">92%</span> kế hoạch quý, xếp loại <span className="font-black">Tốt</span>. Còn 3 bài nộp chờ bạn duyệt.</p>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full w-[92%] bg-gradient-to-r from-emerald-500 to-teal-500" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-indigo-600 text-white text-xs sm:text-sm font-bold leading-relaxed">
                      Duyệt giúp mình 3 bài đó
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-900/20 p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                      <ShieldCheck size={12} className="shrink-0" /> Cần bạn xác nhận
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                      Duyệt 3 bài nộp của Phòng Kinh doanh, đợt Tháng 9.
                    </p>
                    <div className="flex gap-2">
                      <div className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black">Xác nhận</div>
                      <div className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black">Hủy</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <span className="flex-1 text-[11px] sm:text-xs font-bold text-slate-400">Hỏi K.AI về số liệu của bạn…</span>
                    <Mic size={14} className="text-slate-400 shrink-0" />
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                      <ArrowRight size={12} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-500">
                Hình minh họa giao diện trợ lý K.AI
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-4 sm:mb-6">
              <ToggleRight size={14} className="shrink-0" /> Bật/tắt theo nhu cầu
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4 sm:mb-6 text-slate-900 dark:text-white text-balance">
              Dùng đến đâu, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">bật đến đó</span>
            </h2>
            <p className="text-sm sm:text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Mỗi module là một công tắc riêng cho từng tổ chức. Module chưa bật sẽ không xuất hiện trên menu, nên nhân viên không bao giờ thấy màn hình mình không dùng đến.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <ModuleCard icon={Target} name="OKR" description="Mục tiêu và kết quả then chốt của toàn tổ chức" />
            <ModuleCard icon={Gauge} name="BSC" description="Thẻ điểm cân bằng theo bốn lĩnh vực, có trọng số" />
            <ModuleCard icon={HeartHandshake} name="Hạnh kiểm" description="Chấm điểm hành vi theo bộ tiêu chí có trọng số" />
            <ModuleCard icon={GitBranch} name="Thác nước" description="Phân rã chỉ tiêu từ cấp trên xuống cấp dưới" />
            <ModuleCard icon={Sparkles} name="Đánh giá định tính" description="Xếp loại theo mức, không chỉ theo điểm số" />
            <ModuleCard icon={Gift} name="Thưởng & quà" description="Điểm thưởng, điểm danh, quà tặng và chứng nhận" />
            <ModuleCard icon={Wallet} name="Ví tiền" description="Số dư tiền, nạp qua SePay và đổi sang điểm thưởng" />
            <ModuleCard icon={Bot} name="Trợ lý AI" description="K.AI hỏi đáp số liệu và điền hộ biểu mẫu" />
          </div>

          <div className="mt-8 sm:mt-12 grid sm:grid-cols-3 gap-3 sm:gap-5">
            <SupportCard icon={Link2} title="Đăng nhập Lark" description="Nhân viên đăng nhập bằng tài khoản Lark sẵn có, cấu hình trong Thiết lập API." />
            <SupportCard icon={FileSpreadsheet} title="Nhập từ Excel" description="Cơ cấu tổ chức, OKR, BSC — xem trước rồi mới ghi vào hệ thống." />
            <SupportCard icon={LayoutDashboard} title="Dashboard tùy biến" description="Widget kéo thả, ghim thẻ quan trọng lên đầu trang." />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="scroll-mt-24 py-16 sm:py-24">
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
                  "Đo lường chính xác cả kết quả lẫn hành vi",
                  "Ghi nhận và thưởng kịp thời cho nỗ lực của nhân viên",
                  "Hỏi trợ lý AI thay vì chờ báo cáo thủ công",
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
      <section id="pricing" className="scroll-mt-24 py-16 sm:py-24 lg:py-32 bg-slate-50 dark:bg-[#020617] relative border-t border-slate-200 dark:border-slate-800">
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
                { text: "Đánh giá KPI theo đợt & theo kỳ", included: true },
                { text: "Chấm hạnh kiểm & ma trận xếp loại", included: true },
                { text: "Báo cáo & Export tiêu chuẩn", included: true },
                { text: "Dashboard mặc định", included: true },
                { text: "OKR, BSC, Thưởng & Ví", included: false },
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
                { text: "Thẻ điểm cân bằng (BSC)", included: true },
                { text: "Thưởng, điểm danh & quà tặng", included: true },
                { text: "Dashboard động & báo cáo tự tạo", included: true },
                { text: "White Label (Logo + Powered by KeyGo)", included: true },
                { text: "Hỗ trợ SLA 24h", included: true },
                { text: "Trợ lý AI K.AI", included: "Tính phí riêng" },
                { text: "API Integration / SSO (Lark)", included: "Tính phí riêng" },
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
                { text: "Trọn bộ module: OKR, BSC, Hạnh kiểm, Thưởng", included: true },
                { text: "Ví tiền & đối soát nạp tiền (SePay)", included: true },
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
              <li><a href="#features" className="hover:text-indigo-600 transition-colors">Quản lý OKR &amp; KPI</a></li>
              <li><a href="#features" className="hover:text-indigo-600 transition-colors">Thẻ điểm cân bằng (BSC)</a></li>
              <li><a href="#features" className="hover:text-indigo-600 transition-colors">Chấm hạnh kiểm</a></li>
              <li><a href="#features" className="hover:text-indigo-600 transition-colors">Thưởng, quà tặng &amp; Ví</a></li>
              <li><a href="#ai" className="hover:text-indigo-600 transition-colors">Trợ lý AI K.AI</a></li>
              <li><a href="#modules" className="hover:text-indigo-600 transition-colors">Module &amp; Tích hợp</a></li>
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


function AiCapability({ icon: Icon, title, description }: { icon: LucideIcon, title: string, description: string }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-0.5 sm:mb-1">{title}</h3>
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function ModuleCard({ icon: Icon, name, description }: { icon: LucideIcon, name: string, description: string }) {
  return (
    <div className="group p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 hover:border-emerald-300 dark:hover:border-emerald-800 hover:-translate-y-1 transition-all duration-300 cursor-default">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div className="w-9 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center px-0.5 justify-end">
          <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-sm" />
        </div>
      </div>
      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1">{name}</h3>
      <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

function SupportCard({ icon: Icon, title, description }: { icon: LucideIcon, title: string, description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 sm:p-5 rounded-[20px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-0.5">{title}</h3>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: LucideIcon, title: string, description: string, color: string }) {
  const colorStyles: Record<string, string> = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white dark:group-hover:bg-purple-500",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white dark:group-hover:bg-emerald-500",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white dark:group-hover:bg-amber-500",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-500",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white dark:group-hover:bg-rose-500",
    cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white dark:group-hover:bg-cyan-500",
    teal: "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white dark:group-hover:bg-teal-500",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white dark:group-hover:bg-sky-500",
    slate: "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 group-hover:bg-slate-700 group-hover:text-white dark:group-hover:bg-slate-600",
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
        glowColor === 'purple' ? "bg-purple-500" : "bg-indigo-500"
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
