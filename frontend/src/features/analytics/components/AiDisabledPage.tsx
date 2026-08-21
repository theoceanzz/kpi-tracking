import { BotOff } from 'lucide-react'

export default function AiDisabledPage() {
  return (
    <div className="relative min-h-full w-full flex items-center justify-center overflow-hidden bg-white dark:bg-slate-950 font-sans">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-violet-500 to-violet-500 blur-[120px] opacity-[0.07] animate-pulse" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-violet-500 to-violet-500 blur-[100px] opacity-[0.05]" />
      </div>

      <div className="relative z-10 max-w-lg w-full px-6 text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative p-5 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800/50">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500 to-violet-500 opacity-5 blur-xl" />
            <BotOff className="w-12 h-12 text-violet-500" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.3))' }} />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <span className="inline-block text-sm font-bold tracking-[0.2em] uppercase bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-violet-500">
            Tính năng bị tắt
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            Trợ lý AI
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
            Tính năng Trợ lý AI Analytics chưa được kích hoạt cho tổ chức của bạn.
          </p>
        </div>

        {/* Info card */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-5 flex items-start gap-4 text-left backdrop-blur-sm">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-200/50">
            <span className="text-white text-sm">💡</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Cần hỗ trợ?</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Vui lòng liên hệ quản trị viên của tổ chức để được kích hoạt tính năng này.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
