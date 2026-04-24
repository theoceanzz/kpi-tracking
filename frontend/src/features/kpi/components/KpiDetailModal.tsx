import { X, Target, Building2, Users, BarChart3, Award, Calendar, Info, Clock, CheckCircle2 } from 'lucide-react'
import { formatNumber, formatDateTime } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng',
  QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: Info },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Clock },
  APPROVED: { label: 'Đang thực hiện', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: X },
}

interface KpiDetailModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
}

export default function KpiDetailModal({ open, onClose, kpi }: KpiDetailModalProps) {
  if (!open || !kpi) return null

  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Chi tiết Chỉ tiêu KPI</h3>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mt-1 ${status.bgColor} ${status.color}`}>
                <StatusIcon size={10} /> {status.label}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all hover:rotate-90"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Overview & Description */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tên chỉ tiêu</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{kpi.name}</h4>
            </div>
            {kpi.description && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mô tả chi tiết</p>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                   <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                     {kpi.description}
                   </p>
                </div>
              </div>
            )}
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricBox 
              icon={Target} 
              label="Mục tiêu yêu cầu" 
              value={kpi.targetValue != null ? formatNumber(kpi.targetValue) : '—'}
              unit={kpi.unit ?? ''}
              color="text-indigo-600"
            />
            <MetricBox 
              icon={Award} 
              label="Trọng số (%)" 
              value={`${kpi.weight ?? '—'}%`}
              color="text-blue-600"
            />
            <MetricBox 
              icon={BarChart3} 
              label="Tần suất báo cáo" 
              value={frequencyMap[kpi.frequency] ?? kpi.frequency}
              color="text-purple-600"
            />
            <MetricBox 
              icon={Clock} 
              label="Thời hạn kỳ này" 
              value={kpi.kpiPeriod?.endDate ? new Date(kpi.kpiPeriod.endDate).toLocaleDateString('vi-VN') : '—'}
              color="text-amber-600"
            />
          </div>

          {/* Secondary Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Building2 size={14} /> Thông tin đơn vị
              </h5>
              <div className="space-y-3">
                <InfoRow label="Phòng ban" value={kpi.orgUnitName ?? '—'} />
                <InfoRow label="Đợt đánh giá" value={kpi.kpiPeriod?.name ?? '—'} />
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Users size={14} /> Người thực hiện
              </h5>
              <div className="flex flex-wrap gap-2">
                {kpi.assigneeNames?.map((name, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {name}
                  </span>
                )) || <span className="text-xs text-slate-400">Chưa được giao cho ai</span>}
              </div>
            </div>
          </div>

          {/* Reject Reason if any */}
          {kpi.status === 'REJECTED' && kpi.rejectReason && (
             <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-900/30">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <X size={18} className="shrink-0" />
                  <span className="text-xs font-black uppercase tracking-widest">Lý do từ chối</span>
                </div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300 leading-relaxed">
                   {kpi.rejectReason}
                </p>
             </div>
          )}

          {/* Audit Trail */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-8 gap-y-4">
             <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày tạo: {formatDateTime(kpi.createdAt)}</span>
             </div>
             {kpi.approvedByName && (
               <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duyệt bởi: {kpi.approvedByName}</span>
               </div>
             )}
          </div>
        </div>

        {/* Footer Section */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-8 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricBox({ icon: Icon, label, value, unit, color }: { icon: any; label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-slate-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-black ${color}`}>{value}</span>
        {unit && <span className="text-xs font-bold text-slate-400 uppercase">{unit}</span>}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-900 dark:text-white text-right">{value}</span>
    </div>
  )
}
