import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import { useMyKpi } from '../hooks/useMyKpi'
import { Link } from 'react-router-dom'
import { Target, FileText } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'

const frequencyMap: Record<string, string> = {
  DAILY: 'Hàng ngày', WEEKLY: 'Hàng tuần', MONTHLY: 'Hàng tháng', QUARTERLY: 'Hàng quý', YEARLY: 'Hàng năm',
}

export default function MyKpiPage() {
  const { data, isLoading } = useMyKpi()
  const kpis = data?.content ?? []

  return (
    <div>
      <PageHeader
        title="KPI của tôi"
        description="Danh sách các chỉ tiêu KPI được giao cho bạn"
        action={
          <Link to="/submissions/new" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition">
            <FileText size={16} /> Nộp bài
          </Link>
        }
      />

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : kpis.length === 0 ? (
        <EmptyState title="Chưa có KPI nào" description="Bạn chưa được giao chỉ tiêu KPI nào." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ kpi }: { kpi: KpiCriteria }) {
  return (
    <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
          <Target size={20} />
        </div>
        <StatusBadge status={kpi.status} />
      </div>
      <h3 className="font-semibold text-sm mb-1">{kpi.name}</h3>
      {kpi.description && <p className="text-xs text-[var(--color-muted-foreground)] mb-3 line-clamp-2">{kpi.description}</p>}

      <div className="space-y-1.5 text-xs text-[var(--color-muted-foreground)]">
        {kpi.targetValue != null && (
          <div className="flex justify-between">
            <span>Mục tiêu</span>
            <span className="font-medium text-[var(--color-foreground)]">{kpi.targetValue} {kpi.unit ?? ''}</span>
          </div>
        )}
        {kpi.weight != null && (
          <div className="flex justify-between">
            <span>Trọng số</span>
            <span className="font-medium text-[var(--color-foreground)]">{kpi.weight}%</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tần suất</span>
          <span className="font-medium text-[var(--color-foreground)]">{frequencyMap[kpi.frequency] ?? kpi.frequency}</span>
        </div>
        {kpi.startDate && kpi.endDate && (
          <div className="flex justify-between">
            <span>Thời gian</span>
            <span className="font-medium text-[var(--color-foreground)]">{kpi.startDate.split('T')[0]} → {kpi.endDate.split('T')[0]}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
        <Link to={`/submissions/new?kpiId=${kpi.id}`} className="text-xs text-[var(--color-primary)] font-medium hover:underline">
          Nộp bài cho chỉ tiêu này →
        </Link>
      </div>
    </div>
  )
}
