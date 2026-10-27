import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/utils'
import type { Submission } from '@/types/submission'
import { submissionApi } from '../api/submissionApi'
import ReviewModal from './ReviewModal'

/**
 * Bài nộp đang chờ ĐÚNG người xem ở bước hiện tại của quy trình "Báo cáo kết quả KPI". Người giữ
 * bước có thể không quản lý đơn vị của người nộp (vd. quy trình chỉ định đích danh), nên bảng theo
 * đơn vị bên dưới không đủ — khối này liệt kê riêng. Không có bài nào thì không hiện.
 */
export default function AwaitingApprovalPanel() {
  const { t } = useTranslation('submissions')
  const [reviewing, setReviewing] = useState<Submission | null>(null)
  const { data = [] } = useQuery({
    queryKey: ['submissions', 'awaiting-my-approval'],
    queryFn: submissionApi.awaitingMyApproval,
  })
  if (data.length === 0) return null

  return (
    <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch size={16} aria-hidden="true" className="text-[var(--color-primary)]" />
        <h2 className="text-section-title">{t('AwaitingApprovalPanel.title', { count: data.length })}</h2>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{s.kpiCriteriaName}</p>
              <p className="text-caption">
                {s.submittedByName}
                {s.approval && <> · {t('AwaitingApprovalPanel.step', { number: s.approval.stepNumber, total: s.approval.totalSteps })} {s.approval.currentUnitName}</>}
                {s.approval?.pendingSince && <> · {formatDateTime(s.approval.pendingSince)}</>}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setReviewing(s)}>{t('AwaitingApprovalPanel.review')}</Button>
          </li>
        ))}
      </ul>
      <ReviewModal open={!!reviewing} submission={reviewing} onClose={() => setReviewing(null)} />
    </section>
  )
}
