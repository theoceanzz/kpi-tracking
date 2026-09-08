import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowRight, CalendarRange, Check, Loader2, Plus, SkipForward } from 'lucide-react'
import { cn, FREQUENCY_MAP } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '../../hooks/useKpiCycles'
import CycleFormModal from '../../components/CycleFormModal'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import { WORKFLOW_PARAMS } from '../../workflow/hooks/useWorkflowNavigator'

type Mode = 'pick' | 'create'

/**
 * Bước 1 — Kỳ.
 *
 * Kỳ là **tuỳ chọn**: cột `kpi_periods.cycle_id` vốn nullable, nên bỏ qua bước này vẫn tạo đợt
 * được. Vì thế màn hình cho cả ba đường: chọn kỳ có sẵn, tạo kỳ mới, hoặc bỏ qua.
 */
export default function CycleStep() {
  const { goNext, goBack, cycleId } = useKpiSetupFlow()
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId

  const [mode, setMode] = useState<Mode>('pick')

  const { data, isLoading, createCycle, isCreating } = useKpiCycles({
    page: 0,
    size: 20,
    organizationId,
    sortBy: 'startDate',
    direction: 'desc',
  })
  const cycles = data?.content ?? []

  const pick = (id: string) => goNext({ [WORKFLOW_PARAMS.cycle]: id })
  const skip = () => goNext({ [WORKFLOW_PARAMS.cycle]: null })

  return (
    <StepShell
      title="Chọn hoặc tạo kỳ đánh giá"
      description="Kỳ gom nhiều đợt để chấm điểm tổng thể cuối kỳ. Chưa cần thì bỏ qua — bạn gán đợt vào kỳ sau cũng được."
      onBack={goBack}
      backLabel="Về trang chủ"
      footer={
        <button
          type="button"
          onClick={skip}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <SkipForward size={14} />
          Bỏ qua bước này
        </button>
      }
    >
      <div className="mb-6 flex gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/60">
        <ModeTab active={mode === 'pick'} onClick={() => setMode('pick')} label="Chọn kỳ có sẵn" />
        <ModeTab active={mode === 'create'} onClick={() => setMode('create')} label="Tạo kỳ mới" icon={<Plus size={13} />} />
      </div>

      {mode === 'create' ? (
        <CycleFormModal
          variant="inline"
          onClose={() => setMode('pick')}
          editCycle={null}
          organizationId={organizationId!}
          isSubmitting={isCreating}
          submitLabel="Tạo kỳ & tiếp tục"
          onSubmit={async payload => {
            const created = await createCycle(payload)
            if (created?.id) pick(created.id)
          }}
        />
      ) : isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
          <CalendarRange className="mx-auto mb-3 text-slate-300" size={28} />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Chưa có kỳ nào</p>
          <p className="mt-1 text-xs font-medium text-slate-400">Tạo kỳ mới, hoặc bỏ qua để đi thẳng tới bước tạo đợt.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cycles.map(cycle => {
            const selected = cycle.id === cycleId
            return (
              <li key={cycle.id}>
                <button
                  type="button"
                  onClick={() => pick(cycle.id)}
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
                    {selected ? <Check size={18} strokeWidth={3} /> : <CalendarRange size={18} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900 dark:text-white">{cycle.name}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                      {FREQUENCY_MAP[cycle.cycleType]}
                      {cycle.startDate && cycle.endDate && (
                        <> · {format(new Date(cycle.startDate), 'dd/MM/yyyy')} – {format(new Date(cycle.endDate), 'dd/MM/yyyy')}</>
                      )}
                      {cycle.periodCount > 0 && <> · {cycle.periodCount} đợt</>}
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
