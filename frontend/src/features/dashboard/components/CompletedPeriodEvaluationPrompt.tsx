import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useMySubmissions } from '@/features/submissions/hooks/useMySubmissions'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'

/**
 * Khi một kỳ đã hoàn tất mà chưa có phiếu tự đánh giá, mở sẵn form một lần.
 * Nằm ngoài lưới widget vì đây là luồng bắt buộc, không phải nội dung tuỳ chỉnh được.
 */
export default function CompletedPeriodEvaluationPrompt() {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: myKpis } = useMyKpi({ size: 100 })
  const { data: allSubmissions } = useMySubmissions({ size: 100 })
  const { data: evaluations } = useEvaluations({ userId: user?.id, size: 50 })

  const completedPeriod = useMemo(() => {
    if (!periodsData?.content || !myKpis?.content || !allSubmissions?.content || !evaluations?.content) return null

    const sorted = [...periodsData.content].sort(
      (a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime()
    )

    for (const period of sorted) {
      if (evaluations.content.some(e => e.kpiPeriodId === period.id)) continue
      const periodKpis = myKpis.content.filter(k => k.kpiPeriodId === period.id)
      if (periodKpis.length === 0) continue

      const isCompleted = periodKpis.every(kpi => {
        const approved = allSubmissions.content.filter(s => s.kpiCriteriaId === kpi.id && s.status === 'APPROVED')
        return kpi.frequency === 'UNLIMITED' || approved.length >= kpi.expectedSubmissions
      })
      if (isCompleted) return period
    }
    return null
  }, [periodsData, myKpis, allSubmissions, evaluations])

  useEffect(() => {
    if (completedPeriod && !shown) { setOpen(true); setShown(true) }
  }, [completedPeriod, shown])

  if (!open || !completedPeriod) return null
  return (
    <EvaluationFormModal
      open={open}
      onClose={() => setOpen(false)}
      initialPeriodId={completedPeriod.id}
      readOnly={false}
    />
  )
}
