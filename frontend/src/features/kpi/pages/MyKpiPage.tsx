import { useState } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useMyKpi } from '../hooks/useMyKpi'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import {
  Target, Search, PlayCircle, 
  Calendar, Activity, Award, CheckCircle2, ChevronRight, XCircle, AlertCircle
} from 'lucide-react'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  DRAFT: { label: 'Bản nháp', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700', icon: AlertCircle },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/40', icon: Calendar },
  APPROVED: { label: 'Đang thực hiện', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-900/40', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/30 dark:border-red-900/40', icon: XCircle },
}

export default function MyKpiPage() {
  const { data, isLoading } = useMyKpi()
  const [search, setSearch] = useState('')

  const allKpis = (data?.content ?? []).filter(k => k.status === 'APPROVED')
  const filteredKpis = allKpis.filter(k => k.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest">
            <Target size={14} /> Mục tiêu cá nhân
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            KPI của tôi
          </h1>
          <p className="text-slate-500 font-medium max-w-lg">
            Quản lý và theo dõi các chỉ tiêu do quản lý giao phó. Hãy nộp báo cáo đúng tiến độ!
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên KPI..." 
              className="w-full sm:w-80 pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : filteredKpis.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300 dark:border-slate-800 p-16">
          <EmptyState 
            title={search ? "Không tìm thấy KPI" : "Chưa có chỉ tiêu nào"} 
            description={search ? "Không có KPI nào khớp với từ khóa tìm kiếm." : "Bạn chưa được quản lý giao bất kỳ chỉ tiêu KPI nào."} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredKpis.map((kpi, idx) => (
            <MyKpiCard key={kpi.id} kpi={kpi} delay={idx * 50} />
          ))}
        </div>
      )}
    </div>
  )
}

function MyKpiCard({ kpi, delay }: { kpi: KpiCriteria; delay: number }) {
  const status = statusConfig[kpi.status] ?? statusConfig['DRAFT']!
  const StatusIcon = status.icon

  return (
    <div 
      className="group bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-800 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 flex flex-col h-full"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Target Info */}
      <div className="p-6 pb-0 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Target size={24} />
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${status.bgColor} ${status.color}`}>
            <StatusIcon size={12} /> {status.label}
          </div>
        </div>

        <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
          {kpi.name}
        </h3>
        {kpi.description && (
          <p className="text-sm font-medium text-slate-500 mt-2 line-clamp-2">
            {kpi.description}
          </p>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Award size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trọng số</p>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">
              {kpi.weight != null ? `${kpi.weight}%` : '—'}
            </p>
          </div>
          
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={14} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tần suất</p>
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white truncate">
              {frequencyMap[kpi.frequency] ?? kpi.frequency}
            </p>
          </div>
        </div>

        {/* Target Progress Look-alike */}
        {kpi.targetValue != null && (
          <div className="mt-4 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500/60 mb-1">Mục tiêu cần đạt</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{formatNumber(kpi.targetValue)}</span>
              <span className="text-sm font-bold text-indigo-500 mb-1">{kpi.unit ?? ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-6 mt-4 pt-0">
        <Link 
          to={`/submissions/new?kpiId=${kpi.id}`} 
          className="w-full flex items-center justify-between px-6 py-3.5 bg-slate-900 dark:bg-slate-800 text-white hover:bg-blue-600 rounded-2xl font-black text-sm transition-all group/btn shadow-lg"
        >
          <span className="flex items-center gap-2">
            <PlayCircle size={18} /> Nộp bài cáo báo
          </span>
          <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}
