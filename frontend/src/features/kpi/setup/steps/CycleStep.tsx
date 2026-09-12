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
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

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
        <Button variant="outline" type="button" onClick={skip}>
          <SkipForward aria-hidden="true" />
          Bỏ qua bước này
        </Button>
      }
    >
      <div className="mb-6 flex gap-2 rounded-card bg-[var(--color-muted)] p-1.5">
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
          <Loader2 className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] p-10 text-center">
          <CalendarRange className="mx-auto mb-3 text-[var(--color-subtle-foreground)]" size={28} />
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Chưa có kỳ nào</p>
          <p className="mt-1 text-xs font-medium text-[var(--color-subtle-foreground)]">Tạo kỳ mới, hoặc bỏ qua để đi thẳng tới bước tạo đợt.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cycles.map(cycle => {
            const selected = cycle.id === cycleId
            return (
              <li key={cycle.id}>
                <ChoiceChip selected={!(selected)} className="w-full text-left" onClick={() => pick(cycle.id)}>
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-card',
                      selected ? 'bg-[var(--color-success-solid)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]',
                    )}
                  >
                    {selected ? <Check strokeWidth={3} /> : <CalendarRange />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">{cycle.name}</span>
                    <span className="mt-0.5 block text-caption">
                      {FREQUENCY_MAP[cycle.cycleType]}
                      {cycle.startDate && cycle.endDate && (
                        <> · {format(new Date(cycle.startDate), 'dd/MM/yyyy')} – {format(new Date(cycle.endDate), 'dd/MM/yyyy')}</>
                      )}
                      {cycle.periodCount > 0 && <> · {cycle.periodCount} đợt</>}
                    </span>
                  </span>

                  <ArrowRight className="shrink-0 text-[var(--color-subtle-foreground)]" />
                </ChoiceChip>
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
    <ChoiceChip selected={active} className="flex-1 py-2.5" onClick={onClick}>
      {icon}
      {label}
    </ChoiceChip>
  )
}
