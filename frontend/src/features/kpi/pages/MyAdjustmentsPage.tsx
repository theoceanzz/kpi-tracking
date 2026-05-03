import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import { useMyAdjustments } from '../hooks/useMyAdjustments'
import { formatDateTime, formatNumber } from '@/lib/utils'
import {
  AlertCircle, ChevronRight, ChevronLeft, 
  Target, Award, Clock, History
} from 'lucide-react'

export default function MyAdjustmentsPage() {
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)

  const { data, isLoading } = useMyAdjustments({
    page,
    size: pageSize,
  })

  const adjustments = data?.content ?? []

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <History size={20} />
            <span className="text-xs font-black uppercase tracking-[2px]">Lịch sử điều chỉnh</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Yêu cầu thay đổi KPI
          </h1>
          <p className="text-sm text-slate-500 font-medium">Theo dõi trạng thái các yêu cầu thay đổi mục tiêu hoặc trọng số của bạn.</p>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : adjustments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-20 shadow-sm">
          <EmptyState
            title="Chưa có yêu cầu nào"
            description="Bạn chưa gửi yêu cầu điều chỉnh KPI nào. Các yêu cầu sẽ xuất hiện tại đây sau khi bạn thực hiện điều chỉnh từ danh sách KPI."
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Chỉ tiêu</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Thay đổi</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Lý do</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Thời gian</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Phản hồi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {adjustments.map((adj) => (
                <tr key={adj.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <StatusBadge status={adj.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{adj.kpiCriteriaName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      {adj.deactivationRequest ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-100 dark:border-red-900/30 w-fit">
                          <AlertCircle size={12} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Yêu cầu dừng</span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                           {adj.requestedTargetValue !== null && adj.requestedTargetValue !== adj.currentTargetValue && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border border-indigo-100 dark:border-indigo-900/30">
                              <Target size={12} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{formatNumber(adj.requestedTargetValue)}</span>
                            </div>
                           )}
                           {adj.requestedWeight !== null && adj.requestedWeight !== adj.currentWeight && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 border border-violet-100 dark:border-violet-900/30">
                              <Award size={12} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{adj.requestedWeight}%</span>
                            </div>
                           )}
                           {adj.requestedMinimumValue !== null && adj.requestedMinimumValue !== adj.currentMinimumValue && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 border border-amber-100 dark:border-amber-900/30">
                              <AlertCircle size={12} />
                              <span className="text-[10px] font-black uppercase tracking-widest">{formatNumber(adj.requestedMinimumValue)}</span>
                            </div>
                           )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 max-w-xs italic">
                      "{adj.reason}"
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={12} />
                      <span className="text-[11px] font-bold">{formatDateTime(adj.createdAt).split(' ')[0]}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {adj.reviewerNote ? (
                      <p className="text-xs font-medium text-slate-500 max-w-[200px] ml-auto line-clamp-2 italic">
                        "{adj.reviewerNote}"
                      </p>
                    ) : (
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Chưa có phản hồi</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalElements > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.totalElements)} / {data.totalElements} yêu cầu
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.totalPages - 1, p + 1))}
              disabled={page === data.totalPages - 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
