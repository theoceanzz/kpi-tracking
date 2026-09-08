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
      <div className="mx-auto max-w-lg space-y-10 rounded-[48px] border border-slate-200 bg-white p-12 text-center shadow-2xl animate-in zoom-in-95 duration-500 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative">
          <div className="absolute inset-0 scale-150 animate-pulse rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-[40px] bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-2xl shadow-emerald-500/40">
            <CheckCircle2 className="h-14 w-14 text-white" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Đã gửi duyệt</h3>
          <p className="font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {items.length} chỉ tiêu của đợt <b>{periodName}</b> đã chuyển sang cấp trên phê duyệt.
          </p>
        </div>

        <button
          onClick={finish}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 text-sm font-black uppercase tracking-widest text-white shadow-2xl transition-all hover:bg-indigo-600 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-50"
        >
          <Sparkles size={20} className="text-amber-400" />
          Tới bước tiếp theo
        </button>
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
        <button
          type="button"
          onClick={submit}
          disabled={bulkSubmit.isPending || items.length === 0}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {bulkSubmit.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {approvalEnabled ? `Gửi duyệt ${items.length} chỉ tiêu` : 'Hoàn tất'}
        </button>
      }
    >
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm font-medium text-slate-400">
          Không còn chỉ tiêu NHÁP nào trong đợt này — có thể bạn đã gửi duyệt rồi.
        </p>
      ) : (
        <div className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Summary label="Đợt" value={periodName ?? '—'} />
            <Summary label="Đơn vị" value={unitName ?? '—'} />
            <Summary label="Số chỉ tiêu" value={String(items.length)} />
          </dl>

          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {items.map(kpi => (
              <li key={kpi.id} className="flex items-center gap-4 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">{kpi.name}</span>
                  <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                    {kpi.kpiType === 'QUALITATIVE' ? 'Định tính' : 'Định lượng'}
                    {kpi.assigneeNames?.length > 0 && <> · {kpi.assigneeNames.join(', ')}</>}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-black tabular-nums text-slate-900 dark:text-white">{kpi.weight ?? 0}%</span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between rounded-2xl bg-slate-50 px-5 py-4 dark:bg-slate-800/50">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tổng trọng số</span>
            <span className={cn('text-xl font-black tabular-nums', Math.abs(total - 100) < 0.001 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
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
    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{value}</dd>
    </div>
  )
}
