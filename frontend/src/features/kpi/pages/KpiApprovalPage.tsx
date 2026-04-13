import { useState } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import KpiCriteriaTable from '../components/KpiCriteriaTable'
import KpiReviewModal from '../components/KpiReviewModal'
import { useKpiCriteria } from '../hooks/useKpiCriteria'
import type { KpiCriteria } from '@/types/kpi'

export default function KpiApprovalPage() {
  const { data, isLoading } = useKpiCriteria({ status: 'PENDING' })
  const [reviewKpi, setReviewKpi] = useState<KpiCriteria | null>(null)

  return (
    <div>
      <PageHeader title="Duyệt chỉ tiêu KPI" description="Duyệt hoặc từ chối chỉ tiêu từ các phòng ban" />
      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : !data || data.content.length === 0 ? (
        <EmptyState title="Không có chỉ tiêu chờ duyệt" description="Tất cả chỉ tiêu đã được xử lý." />
      ) : (
        <KpiCriteriaTable data={data.content} onAction={setReviewKpi} />
      )}

      <KpiReviewModal open={!!reviewKpi} onClose={() => setReviewKpi(null)} kpi={reviewKpi} />
    </div>
  )
}
