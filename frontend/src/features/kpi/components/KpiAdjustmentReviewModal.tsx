import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentApi } from '../api/adjustmentApi'
import { toast } from 'sonner'
import { X, Loader2, XCircle, Users, Clock, MessageSquare, AlertTriangle, Calendar } from 'lucide-react'
import { formatNumber, formatDateTime, cn } from '@/lib/utils'
import type { KpiAdjustmentRequest } from '@/types/adjustment'

interface KpiAdjustmentReviewModalProps {
  open: boolean
  onClose: () => void
  request: KpiAdjustmentRequest | null
}

export default function KpiAdjustmentReviewModal({ open, onClose, request }: KpiAdjustmentReviewModalProps) {
  const [note, setNote] = useState('')
  const [reviewMode, setReviewMode] = useState<'view' | 'reject' | 'approve'>('view')
  const qc = useQueryClient()

  const reviewMutation = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED') => 
      adjustmentApi.review(request!.id, { status, reviewerNote: note }),
    onSuccess: (_, status) => { 
      qc.invalidateQueries({ queryKey: ['kpi-adjustments'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success(status === 'APPROVED' ? 'Đã phê duyệt yêu cầu điều chỉnh' : 'Đã từ chối yêu cầu điều chỉnh')
      onClose()
      setReviewMode('view')
      setNote('')
    },
    onError: () => toast.error('Xử lý thất bại'),
  })

  if (!open || !request) return null

  const isPending = reviewMutation.isPending
  const isReviewable = request.status === 'PENDING'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Yêu cầu Điều chỉnh KPI</h3>
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mt-1",
                request.status === 'PENDING' ? 'bg-amber-100 border-amber-200 text-amber-600' : 
                request.status === 'APPROVED' ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 
                'bg-red-100 border-red-200 text-red-600'
              )}>
                <Clock size={10} className={request.status === 'PENDING' ? 'animate-pulse' : ''} /> {
                  request.status === 'PENDING' ? 'Đang chờ xử lý' : 
                  request.status === 'APPROVED' ? 'Đã chấp thuận' : 'Đã từ chối'
                }
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all hover:rotate-90">
            <X size={22} />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Chỉ tiêu bị ảnh hưởng</p>
            <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{request.kpiCriteriaName}</h4>
            
            <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
               <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                 <AlertTriangle size={16} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Lý do điều chỉnh</span>
               </div>
               <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                 {request.reason}
               </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4">
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá trị hiện tại</p>
               <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Mục tiêu</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{formatNumber(request.currentTargetValue)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Trọng số</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{request.currentWeight}%</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tối thiểu</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">{request.currentMinimumValue != null ? formatNumber(request.currentMinimumValue) : '0'}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Đề xuất thay đổi</p>
               <div className="space-y-3">
                  {request.deactivationRequest ? (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 flex items-center justify-center h-full min-h-[140px] flex-col gap-2">
                      <XCircle size={32} className="text-red-500" />
                      <p className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Yêu cầu Huỷ bỏ KPI</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/30">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Mục tiêu mới</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-300">
                          {request.requestedTargetValue != null ? formatNumber(request.requestedTargetValue) : 'Không đổi'}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/30">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Trọng số mới</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-300">
                          {request.requestedWeight != null ? `${request.requestedWeight}%` : 'Không đổi'}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/30">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Tối thiểu mới</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-300">
                          {request.requestedMinimumValue != null ? formatNumber(request.requestedMinimumValue) : 'Không đổi'}
                        </p>
                      </div>
                    </>
                  )}
               </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-8 gap-y-4">
             <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Người yêu cầu: {request.requesterName}</span>
             </div>
             <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày gửi: {formatDateTime(request.createdAt)}</span>
             </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {isReviewable ? (
            reviewMode === 'view' ? (
              <div className="flex gap-4">
                <button
                  onClick={() => setReviewMode('reject')}
                  className="flex-1 px-6 py-4 rounded-2xl text-sm font-black border-2 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                >
                  Từ chối yêu cầu
                </button>
                <button
                  onClick={() => setReviewMode('approve')}
                  className="flex-1 px-6 py-4 rounded-2xl text-sm font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20"
                >
                  Phê duyệt thay đổi
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Ghi chú phản hồi {reviewMode === 'reject' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
                    placeholder="Nhập ghi chú cho nhân viên..."
                  />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setReviewMode('view')} className="flex-1 px-6 py-3 rounded-2xl text-sm font-black text-slate-600 border border-slate-200 hover:bg-white transition-all">
                    Quay lại
                  </button>
                  <button
                    onClick={() => reviewMutation.mutate(reviewMode === 'approve' ? 'APPROVED' : 'REJECTED')}
                    disabled={(reviewMode === 'reject' && !note.trim()) || isPending}
                    className={cn(
                      "flex-1 px-6 py-3 rounded-2xl text-sm font-black text-white transition-all flex items-center justify-center gap-2",
                      reviewMode === 'approve' ? 'bg-emerald-600 shadow-emerald-500/20 shadow-lg' : 'bg-red-600 shadow-red-500/20 shadow-lg',
                      "disabled:opacity-50"
                    )}
                  >
                    {isPending && <Loader2 size={16} className="animate-spin" />}
                    Xác nhận {reviewMode === 'approve' ? 'Phê duyệt' : 'Từ chối'}
                  </button>
                </div>
              </div>
            )
          ) : (
             <div className="space-y-4">
               {request.reviewerNote && (
                 <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Ghi chú từ {request.reviewerName}</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{request.reviewerNote}</p>
                 </div>
               )}
               <div className="flex justify-end">
                 <button onClick={onClose} className="px-10 py-3 rounded-2xl bg-white border border-slate-200 text-sm font-black text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                   Đóng
                 </button>
               </div>
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
