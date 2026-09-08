import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowRight, Check, Layers, Loader2, Plus } from 'lucide-react'
import { cn, FREQUENCY_MAP } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiPeriods } from '../../hooks/useKpiPeriods'
import PeriodFormModal from '../../components/PeriodFormModal'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import { WORKFLOW_PARAMS } from '../../workflow/hooks/useWorkflowNavigator'

type Mode = 'pick' | 'create'

/**
 * Bước 2 — Đợt.
 *
 * Bắt buộc: chỉ tiêu phải gắn vào một đợt (`kpiPeriodId` là trường required của API tạo KPI), nên
 * không có đường bỏ qua ở đây.
 */
export default function PeriodStep() {
  const { goNext, goBack, cycleId, periodId } = useKpiSetupFlow()
  const user = useAuthStore(s => s.user)
  const { hasPermission } = useHasPermission()
  const organizationId = user?.memberships?.[0]?.organizationId

  // Nhân viên chỉ có KPI_PERIOD:VIEW — bày ra tab "Tạo đợt mới" cho họ là mời gọi một thao tác
  // mà backend sẽ từ chối.
  const canCreate = hasPermission('KPI_PERIOD:CREATE')

  // Có kỳ từ bước trước thì mặc định mở thẳng form tạo — người đi xuôi luồng vừa tạo kỳ xong
  // gần như chắc chắn muốn tạo đợt cho nó, không phải chọn một đợt cũ.
  const [mode, setMode] = useState<Mode>(cycleId && canCreate ? 'create' : 'pick')

  const { data, isLoading, createPeriod, isCreating } = useKpiPeriods({
    page: 0,
    size: 20,
    organizationId,
    sortBy: 'startDate',
    direction: 'desc',
  })
  const periods = data?.content ?? []

  const pick = (id: string) => goNext({ [WORKFLOW_PARAMS.period]: id })

  return (
    <StepShell
      title="Chọn hoặc tạo đợt KPI"
      description="Đợt là mốc thời gian mà mọi chỉ tiêu bám vào. Không có đợt thì chưa giao được chỉ tiêu nào."
      onBack={goBack}
    >
      {canCreate && (
        <div className="mb-6 flex gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/60">
          <ModeTab active={mode === 'pick'} onClick={() => setMode('pick')} label="Chọn đợt có sẵn" />
          <ModeTab active={mode === 'create'} onClick={() => setMode('create')} label="Tạo đợt mới" icon={<Plus size={13} />} />
        </div>
      )}

      {canCreate && mode === 'create' ? (
        <PeriodFormModal
          variant="inline"
          onClose={() => setMode('pick')}
          editPeriod={null}
          organizationId={organizationId!}
          initialCycleId={cycleId}
          isSubmitting={isCreating}
          submitLabel="Tạo đợt & tiếp tục"
          onSubmit={async payload => {
            const created = await createPeriod(payload)
            if (created?.id) pick(created.id)
          }}
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
          <Layers className="mx-auto mb-3 text-slate-300" size={28} />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Chưa có đợt nào</p>
          <p className="mt-1 text-xs font-medium text-slate-400">{canCreate ? 'Chuyển sang thẻ "Tạo đợt mới" để bắt đầu.' : 'Hãy nhờ quản lý tạo đợt trước khi bạn giao chỉ tiêu.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {periods.map(period => {
            const selected = period.id === periodId
            return (
              <li key={period.id}>
                <button
                  type="button"
                  onClick={() => pick(period.id)}
                  className={cn(
                    'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all',
                    selected
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/10',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                    )}
                  >
                    {selected ? <Check size={18} strokeWidth={3} /> : <Layers size={18} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{period.name}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                      {FREQUENCY_MAP[period.periodType]}
                      {period.startDate && period.endDate && (
                        <> · {format(new Date(period.startDate), 'dd/MM/yyyy')} – {format(new Date(period.endDate), 'dd/MM/yyyy')}</>
                      )}
                      {period.cycleName && <> · thuộc kỳ {period.cycleName}</>}
                    </span>
                  </span>

                  <ArrowRight size={16} className="shrink-0 text-slate-300" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </StepShell>
  )
}

function ModeTab({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all',
        active
          ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
      )}
    >
      {icon}
      {label}
    </button>
  )
}
