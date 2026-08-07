import { useState, useMemo } from 'react'
import { cn, getInitials, formatNumber } from '@/lib/utils'
import type { CycleUserEvaluation } from '@/types/kpi'
import { X, Search, Mail, Loader2, AlertTriangle, Check } from 'lucide-react'

/**
 * Chọn nhân viên để gửi kết quả đánh giá kỳ qua email.
 * Nội dung email lấy từ template `cycle_evaluation_result` — tổ chức tự chỉnh
 * được ở Cài đặt hệ thống → Template email.
 */
export default function SendEvaluationModal({
  onClose, members, cycleName, orgUnitName, isFinalized, isSending, onSend,
}: {
  onClose: () => void
  members: CycleUserEvaluation[]
  cycleName?: string
  orgUnitName?: string
  /** Chưa chốt kỳ thì điểm còn có thể đổi — cảnh báo trước khi gửi. */
  isFinalized: boolean
  isSending: boolean
  onSend: (userIds: string[]) => Promise<unknown>
}) {
  // Component chỉ được mount khi modal mở (parent render có điều kiện), nên
  // lựa chọn tự reset mỗi lần mở — không cần effect dọn dẹp.
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? members.filter(m => m.userName?.toLowerCase().includes(q)) : members
  }, [members, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selected.has(m.userId))

  const toggle = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  // "Chọn tất cả" chỉ tác động lên danh sách ĐANG lọc, để không âm thầm
  // chọn cả những người bị ẩn bởi ô tìm kiếm.
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(m => next.delete(m.userId))
      else filtered.forEach(m => next.add(m.userId))
      return next
    })
  }

  const handleSend = async () => {
    if (!selected.size) return
    try {
      await onSend([...selected])
      onClose()
    } catch { /* toast ở hook */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
              <Mail size={20} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Gửi kết quả đánh giá</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {cycleName ? <b>{cycleName}</b> : 'Kỳ đánh giá'}
                {orgUnitName && <> · {orgUnitName}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {!isFinalized && (
          <div className="flex items-start gap-2.5 mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
              Đơn vị này <b>chưa chốt kỳ</b>. Điểm gửi đi vẫn có thể thay đổi — nên chốt trước khi gửi cho nhân viên.
            </p>
          </div>
        )}

        {/* Tìm kiếm + chọn tất cả */}
        <div className="px-6 pt-4 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm nhân viên..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={toggleAll}
              disabled={!filtered.length}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-colors disabled:opacity-40"
            >
              <span className={cn(
                'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors',
                allFilteredSelected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-600',
              )}>
                {allFilteredSelected && <Check size={11} className="text-white" strokeWidth={3} />}
              </span>
              {allFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              {search.trim() && <span className="normal-case font-bold opacity-60">(trong kết quả tìm)</span>}
            </button>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">
              Đã chọn {selected.size}/{members.length}
            </span>
          </div>
        </div>

        {/* Danh sách */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-10">Không tìm thấy nhân viên phù hợp.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(m => {
                const checked = selected.has(m.userId)
                return (
                  <button
                    key={m.userId}
                    onClick={() => toggle(m.userId)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left',
                      checked
                        ? 'bg-emerald-50/60 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40',
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors',
                      checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-600',
                    )}>
                      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[10px] shrink-0">
                      {getInitials(m.userName || '')}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{m.userName}</span>
                      <span className="block text-[10px] text-slate-400 font-medium truncate">{m.orgUnitName || 'Nhân viên'}</span>
                    </span>
                    <span className="text-sm font-black text-emerald-600 shrink-0">
                      {m.finalScore != null ? formatNumber(m.finalScore) : '—'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <button
            onClick={onClose}
            className="px-5 h-11 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={handleSend}
            disabled={!selected.size || isSending}
            className="flex items-center gap-2 px-6 h-11 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {isSending ? 'Đang gửi...' : `Gửi cho ${selected.size} người`}
          </button>
        </div>
      </div>
    </div>
  )
}
