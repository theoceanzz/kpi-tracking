import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Loader2, Mail, Send, Info } from 'lucide-react'
import { notificationApi } from '@/features/notifications/api/notificationApi'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/lib/utils'

export interface ReminderRecipient {
  userId: string
  fullName: string
  email: string
  orgUnitName?: string | null
  assignedKpi?: number
  approvedSubmissions?: number
}

interface KpiReminderModalProps {
  open: boolean
  onClose: () => void
  recipient: ReminderRecipient | null
  periodName?: string
}

/** Nội dung mặc định — soạn sẵn theo tiến độ thật để người gửi chỉ việc đọc lại rồi sửa. */
function draftFor(recipient: ReminderRecipient, periodName?: string, senderName?: string) {
  const done = recipient.approvedSubmissions ?? 0
  const total = recipient.assignedKpi ?? 0
  const percent = Math.round((done / (total || 1)) * 100)
  const periodLabel = periodName ? ` kỳ ${periodName}` : ''

  const closing = total === 0
    ? 'Hiện bạn chưa được giao KPI nào trong kỳ. Bạn phản hồi lại giúp mình nếu đây là nhầm lẫn nhé.'
    : done >= total
      ? 'Cảm ơn bạn đã hoàn thành đầy đủ KPI trong kỳ.'
      : `Nhờ bạn bổ sung và nộp minh chứng cho ${total - done} KPI còn lại trước khi kỳ đóng nhé.`

  return {
    subject: `[KeyGo] Tiến độ KPI${periodLabel} — ${recipient.fullName}`,
    body: [
      `Chào ${recipient.fullName},`,
      '',
      `Tiến độ KPI của bạn${periodLabel} tính đến ngày ${new Date().toLocaleDateString('vi-VN')}:`,
      `- Đơn vị: ${recipient.orgUnitName || 'Chưa gán'}`,
      `- KPI đã được duyệt: ${done}/${total} (${percent}%)`,
      '',
      closing,
      '',
      'Trân trọng,',
      senderName || '',
    ].join('\n'),
  }
}

export default function KpiReminderModal({ open, onClose, recipient, periodName }: KpiReminderModalProps) {
  const { user } = useAuthStore()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Mở lại cho người khác thì phải soạn lại từ đầu, không giữ nội dung của người trước
  useEffect(() => {
    if (open && recipient) {
      const draft = draftFor(recipient, periodName, user?.fullName)
      setSubject(draft.subject)
      setBody(draft.body)
    }
  }, [open, recipient, periodName, user?.fullName])

  const sendMutation = useMutation({
    mutationFn: () => notificationApi.sendKpiReminder({
      userId: recipient!.userId,
      subject: subject.trim(),
      body: body.trim(),
    }),
    onSuccess: () => {
      toast.success(`Đã gửi email tới ${recipient?.email}`)
      onClose()
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || 'Gửi email thất bại')
    },
  })

  if (!open || !recipient) return null

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sendMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !sendMutation.isPending && onClose()} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">

        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Mail size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Nhắc tiến độ KPI</h3>
              <p className="text-xs font-medium text-slate-500">Xem lại và chỉnh nội dung trước khi gửi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={sendMutation.isPending}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center font-black text-xs text-indigo-600 shrink-0">
              {getInitials(recipient.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate">{recipient.fullName}</p>
              <p className="text-xs font-bold text-slate-500 truncate">{recipient.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiêu đề</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm font-bold transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nội dung</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={11}
              maxLength={5000}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none text-sm leading-relaxed transition-all resize-y"
            />
          </div>

          <div className="flex items-start gap-2 text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
            <Info size={14} className="shrink-0 mt-0.5 text-slate-400" />
            <span>
              Thư gửi từ địa chỉ hệ thống, phần trả lời sẽ về hộp thư {user?.email || 'của bạn'}.
              Nhân sự cũng nhận được thông báo trong ứng dụng.
            </span>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-end gap-3 rounded-b-[28px]">
          <button
            onClick={onClose}
            disabled={sendMutation.isPending}
            className="px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-40"
          >
            Huỷ
          </button>
          <button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
          >
            {sendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sendMutation.isPending ? 'Đang gửi...' : 'Gửi email'}
          </button>
        </div>
      </div>
    </div>
  )
}
