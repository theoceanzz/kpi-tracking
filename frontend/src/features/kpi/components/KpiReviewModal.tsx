import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { X, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'

interface KpiReviewModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
}

export default function KpiReviewModal({ open, onClose, kpi }: KpiReviewModalProps) {
  const [rejectReason, setRejectReason] = useState('')
  const [mode, setMode] = useState<'view' | 'reject'>('view')
  const qc = useQueryClient()

  const approveMutation = useMutation({
    mutationFn: () => kpiApi.approve(kpi!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã duyệt chỉ tiêu'); onClose(); setMode('view') },
    onError: () => toast.error('Duyệt thất bại'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => kpiApi.reject(kpi!.id, { reason: rejectReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã từ chối chỉ tiêu'); setRejectReason(''); setMode('view'); onClose() },
    onError: () => toast.error('Từ chối thất bại'),
  })

  if (!open || !kpi) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
  const isPending = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Xét duyệt chỉ tiêu</h3>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X size={20} /></button>
        </div>

        {/* KPI info */}
        <div className="bg-[var(--color-muted)]/50 rounded-lg p-4 mb-4 space-y-2 text-sm">
          <div><span className="text-[var(--color-muted-foreground)]">Tên:</span> <span className="font-medium">{kpi.name}</span></div>
          {kpi.description && <div><span className="text-[var(--color-muted-foreground)]">Mô tả:</span> {kpi.description}</div>}
          {kpi.departmentName && <div><span className="text-[var(--color-muted-foreground)]">Phòng ban:</span> {kpi.departmentName}</div>}
          {kpi.assignedToName && <div><span className="text-[var(--color-muted-foreground)]">Giao cho:</span> {kpi.assignedToName}</div>}
          {kpi.targetValue != null && <div><span className="text-[var(--color-muted-foreground)]">Mục tiêu:</span> {kpi.targetValue} {kpi.unit ?? ''}</div>}
          {kpi.weight != null && <div><span className="text-[var(--color-muted-foreground)]">Trọng số:</span> {kpi.weight}%</div>}
          {kpi.createdByName && <div><span className="text-[var(--color-muted-foreground)]">Tạo bởi:</span> {kpi.createdByName}</div>}
        </div>

        {mode === 'reject' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Lý do từ chối <span className="text-red-500">*</span></label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Nhập lý do từ chối..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setMode('view')} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--color-accent)] transition-colors">Quay lại</button>
              <button onClick={() => rejectMutation.mutate()} disabled={!rejectReason.trim() || isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition flex items-center justify-center gap-2">
                {rejectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Từ chối
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setMode('reject')} disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center gap-2">
              <XCircle size={16} /> Từ chối
            </button>
            <button onClick={() => approveMutation.mutate()} disabled={isPending} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Phê duyệt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
