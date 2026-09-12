import { BotOff } from 'lucide-react'

export default function AiDisabledPage() {
  return (
    <div className="relative min-h-full w-full flex items-center justify-center overflow-hidden bg-[var(--color-card)] font-sans">
      {/* Background blobs */}

      <div className="relative z-10 max-w-lg w-full px-6 text-center space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative p-5 rounded-widget bg-[var(--color-card)] border border-[var(--color-border)]">
            <div className="absolute inset-0 rounded-widget bg-[var(--color-primary)] opacity-5 blur-xl"/>
            <BotOff className="h-12 w-12 text-[var(--color-ai)]" strokeWidth={1.5} aria-hidden="true" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-3">
          <span className="inline-block text-eyebrow text-[var(--color-primary)]">
            Tính năng bị tắt
          </span>
          <h1 className="text-page-title text-4xl md:text-5xl text-[var(--color-foreground)]">
            Trợ lý AI
          </h1>
          <p className="text-lg text-[var(--color-muted-foreground)] leading-relaxed">
            Tính năng Trợ lý AI Analytics chưa được kích hoạt cho tổ chức của bạn.
          </p>
        </div>

        {/* Info card */}
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-5 flex items-start gap-4 text-left">
          <div className="w-9 h-9 rounded-card bg-[var(--color-warning-solid)] flex items-center justify-center shrink-0">
            <span className="text-white text-sm">💡</span>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-foreground)] mb-1">Cần hỗ trợ?</p>
            <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
              Vui lòng liên hệ quản trị viên của tổ chức để được kích hoạt tính năng này.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
