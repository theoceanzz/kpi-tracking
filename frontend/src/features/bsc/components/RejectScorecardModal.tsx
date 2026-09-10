import { useState } from 'react'
import { X, Undo2, Loader2 } from 'lucide-react'

interface RejectScorecardModalProps {
  open: boolean
  onClose: () => void
  /** Tên thẻ đang trả lại — để người duyệt chắc chắn mình đang trả đúng thẻ. */
  scorecardName: string
  pending: boolean
  onSubmit: (reason: string) => void
}

/**
 * Nhập lý do trả lại một bộ tiêu chí đang chờ duyệt.
 *
 * <p>Trước đây dùng `window.prompt`: hộp thoại của trình duyệt không theo theme (luôn sáng, lệch hẳn
 * ở dark mode), không đặt được nhãn dài, và chỉ cho một dòng — trong khi lý do trả lại là thứ đơn vị
 * đọc để biết phải sửa gì nên thường vài câu.
 */
export default function RejectScorecardModal({
  open, onClose, scorecardName, pending, onSubmit,
}: RejectScorecardModalProps) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const trimmed = reason.trim()

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white">
              <Undo2 size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Trả lại để sửa</h3>
              <p className="text-[11px] font-bold text-slate-400 truncate">{scorecardName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
            Lý do trả lại <span className="text-red-500">*</span>
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={4}
            placeholder="Đơn vị cần biết phải sửa gì: hạng mục nào thiếu, chỉ tiêu nào chưa hợp lý..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all resize-none"
          />
          <p className="text-[11px] font-medium text-slate-400 leading-relaxed ml-1">
            Thẻ quay về trạng thái <b>Nháp</b> để đơn vị sửa rồi trình lại.
          </p>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            Huỷ
          </button>
          <button onClick={() => trimmed && onSubmit(trimmed)} disabled={!trimmed || pending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40">
            {pending && <Loader2 size={14} className="animate-spin" />}
            Trả lại
          </button>
        </div>
      </div>
    </div>
  )
}
