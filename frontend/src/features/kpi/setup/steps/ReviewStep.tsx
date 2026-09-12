import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useKpiCriteria } from '../../hooks/useKpiCriteria'
import { useBulkSubmitKpi } from '../../hooks/useBulkSubmitKpi'
import { useWorkflowNavigator } from '../../workflow/hooks/useWorkflowNavigator'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import { Button } from '@/components/ui/button'

/**
 * Bước 4 — Xem lại và gửi duyệt. Đây là lúc "chốt đơn".
 *
 * Tổ chức tắt bước phê duyệt chỉ tiêu thì chỉ tiêu ra đời đã ở trạng thái ĐÃ DUYỆT, không còn gì
 * để gửi — màn hình này khi đó chỉ tổng kết và kết thúc luồng.
 */
export default function ReviewStep() {
  const navigate = useNavigate()
  const { goBack, periodId, orgUnitId, approvalEnabled } = useKpiSetupFlow()
  const { goToNext } = useWorkflowNavigator()
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const [done, setDone] = useState(false)
  const bulkSubmit = useBulkSubmitKpi()

  const { data, isLoading } = useKpiCriteria(
    {
      page: 0,
      size: 100,
      status: 'DRAFT',
      kpiPeriodId: periodId ?? undefined,
      orgUnitId: orgUnitId ?? undefined,
      organizationId,
      sortBy: 'createdAt',
      sortDir: 'asc',
    },
    { enabled: !!periodId },
  )
  const items = data?.content ?? []
  const total = items.reduce((sum, k) => sum + (k.weight ?? 0), 0)
  const periodName = items[0]?.kpiPeriod?.name
  const unitName = items[0]?.orgUnitName

  const finish = () => {
    // Đích lấy từ cấu hình luồng: có bước duyệt thì sang màn duyệt, không thì sang bước kế tiếp
    // còn bật. Không viết cứng một đường dẫn nào ở đây.
    const moved = goToNext('CRITERIA_DRAFT', { periodId }, { openCreate: false })
    if (!moved) navigate('/kpi-criteria')
  }

  const submit = () => {
    if (!approvalEnabled) return finish()
    bulkSubmit.mutate(items.map(k => k.id), { onSuccess: () => setDone(true) })
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-10 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center animate-in zoom-in-95 duration-500">
        <div className="relative">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-card bg-[var(--color-success-solid)]">
            <CheckCircle2 className="h-14 w-14 text-white" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-page-title">Đã gửi duyệt</h3>
          <p className="font-medium leading-relaxed text-[var(--color-muted-foreground)]">
            {items.length} chỉ tiêu của đợt <b>{periodName}</b> đã chuyển sang cấp trên phê duyệt.
          </p>
        </div>

        <Button className="w-full" onClick={finish}>
          <Sparkles aria-hidden="true" className="text-[var(--color-warning)]" />
          Tới bước tiếp theo
        </Button>
      </div>
    )
  }

  return (
    <StepShell
      title={approvalEnabled ? 'Xem lại & gửi duyệt' : 'Xem lại & hoàn tất'}
      description={
        approvalEnabled
          ? 'Kiểm tra lần cuối trước khi chuyển toàn bộ chỉ tiêu sang cấp trên phê duyệt.'
          : 'Tổ chức đã tắt bước duyệt chỉ tiêu nên các chỉ tiêu này có hiệu lực ngay.'
      }
      onBack={goBack}
      footer={
        <Button type="button" onClick={submit} disabled={bulkSubmit.isPending || items.length === 0}>
          {bulkSubmit.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {approvalEnabled ? `Gửi duyệt ${items.length} chỉ tiêu` : 'Hoàn tất'}
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm font-medium text-[var(--color-subtle-foreground)]">
          Không còn chỉ tiêu NHÁP nào trong đợt này — có thể bạn đã gửi duyệt rồi.
        </p>
      ) : (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Summary label="Đợt" value={periodName ?? '—'} />
            <Summary label="Đơn vị" value={unitName ?? '—'} />
            <Summary label="Số chỉ tiêu" value={String(items.length)} />
          </dl>

          <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-card border border-[var(--color-border)]">
            {items.map(kpi => (
              <li key={kpi.id} className="flex items-center gap-4 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{kpi.name}</span>
                  <span className="mt-0.5 block text-caption">
                    {kpi.kpiType === 'QUALITATIVE' ? 'Định tính' : 'Định lượng'}
                    {kpi.assigneeNames?.length > 0 && <> · {kpi.assigneeNames.join(', ')}</>}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-foreground)]">{kpi.weight ?? 0}%</span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between rounded-card bg-[var(--color-muted)] px-5 py-4">
            <span className="text-eyebrow">Tổng trọng số</span>
            <span className={cn('text-xl font-semibold tabular-nums', Math.abs(total - 100) < 0.001 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]')}>
              {total.toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </StepShell>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-[var(--color-muted)] px-4 py-3">
      <dt className="text-eyebrow">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-[var(--color-foreground)]">{value}</dd>
    </div>
  )
}
