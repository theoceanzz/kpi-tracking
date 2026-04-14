import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { X, Loader2, CheckCircle, XCircle, Target, Building2, Users, BarChart3, Award, Calendar } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã phê duyệt chỉ tiêu thành công'); onClose(); setMode('view') },
    onError: () => toast.error('Duyệt thất bại'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => kpiApi.reject(kpi!.id, { reason: rejectReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Đã trả lại chỉ tiêu'); setRejectReason(''); setMode('view'); onClose() },
    onError: () => toast.error('Từ chối thất bại'),
  })

  if (!open || !kpi) return null

  const isPending = approveMutation.isPending || rejectMutation.isPending
  const isReviewable = kpi.status === 'PENDING'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-7 py-5 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <Target size={22} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Xét duyệt Chỉ tiêu</h3>
              <p className="text-xs font-medium text-slate-500">{kpi.status === 'PENDING' ? 'Đang chờ phê duyệt' : kpi.status === 'APPROVED' ? 'Đã phê duyệt' : 'Đã từ chối'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">

          {/* KPI Name Highlight */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 border border-indigo-200/50 dark:border-indigo-900/30">
            <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2">{kpi.name}</h4>
            {kpi.description && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{kpi.description}</p>}
          </div>

          {/* Detail Grid */}
          <div className="grid grid-cols-2 gap-3">
            {kpi.departmentName && (
              <DetailCard icon={Building2} label="Phòng ban" value={kpi.departmentName} />
            )}
            {kpi.assignedToName && (
              <DetailCard icon={Users} label="Giao cho" value={kpi.assignedToName} />
            )}
            {kpi.targetValue != null && (
              <DetailCard icon={Target} label="Mục tiêu" value={`${formatNumber(kpi.targetValue)} ${kpi.unit ?? ''}`} />
            )}
            {kpi.weight != null && (
              <DetailCard icon={Award} label="Trọng số" value={`${kpi.weight}%`} />
            )}
            <DetailCard icon={BarChart3} label="Tần suất" value={frequencyMap[kpi.frequency] ?? kpi.frequency} />
            {kpi.createdByName && (
              <DetailCard icon={Calendar} label="Người tạo" value={kpi.createdByName} />
            )}
          </div>

          {/* Reject reason (if already rejected) */}
          {kpi.rejectReason && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-900/30">
              <p className="text-xs font-black uppercase tracking-widest text-red-500 mb-1">Lý do từ chối</p>
              <p className="text-sm text-red-700 dark:text-red-300">{kpi.rejectReason}</p>
            </div>
          )}

          {/* Actions */}
          {isReviewable && (
            <>
              {mode === 'reject' ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">
                      Lý do từ chối <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none transition-all"
                      placeholder="Mô tả lý do cụ thể để người tạo có thể chỉnh sửa..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setMode('view')} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                      Quay lại
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate()}
                      disabled={!rejectReason.trim() || isPending}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    >
                      {rejectMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                      <XCircle size={16} /> Xác nhận Từ chối
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode('reject')}
                    disabled={isPending}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold border-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} /> Trả lại
                  </button>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={isPending}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />}
                    Phê duyệt Ngay
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <Icon size={12} /> {label}
      </div>
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value}</p>
    </div>
  )
}
