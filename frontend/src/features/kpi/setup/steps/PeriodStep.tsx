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
import { ChoiceChip } from '@/components/ui/choice-chip'

/** Hàng chọn đợt/kỳ: khối bo góc, chọn thì viền + nền xanh, rê chuột thì ngả sang primary. */
const ROW_CLS =
  'flex w-full items-center gap-4 rounded-card border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2'
const ROW_SELECTED_CLS = 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]'
const ROW_IDLE_CLS =
  'border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'

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
        <div className="mb-6 flex gap-2 rounded-card bg-[var(--color-muted)] p-1.5">
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
          <Loader2 className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] p-10 text-center">
          <Layers className="mx-auto mb-3 text-[var(--color-subtle-foreground)]" size={28} />
          <p className="text-sm font-medium text-[var(--color-muted-foreground)]">Chưa có đợt nào</p>
          <p className="mt-1 text-xs font-medium text-[var(--color-subtle-foreground)]">{canCreate ? 'Chuyển sang thẻ "Tạo đợt mới" để bắt đầu.':'Hãy nhờ quản lý tạo đợt trước khi bạn giao chỉ tiêu.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {periods.map(period => {
            const selected = period.id === periodId
            return (
              <li key={period.id}>
                {/* Hàng chọn hai dòng, KHÔNG phải ChoiceChip: chip cao 32px và cấm xuống dòng, nhét
                    ô icon 40px + hai dòng chữ vào là tràn. Kiểu hàng viết tại chỗ, dùng token chung. */}
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(period.id)}
                  className={cn(ROW_CLS, selected ? ROW_SELECTED_CLS : ROW_IDLE_CLS)}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-card',
                      selected ? 'bg-[var(--color-success-solid)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]',
                    )}
                  >
                    {selected ? <Check size={18} strokeWidth={3} /> : <Layers size={18} />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--color-foreground)]">{period.name}</span>
                    <span className="mt-0.5 block text-caption">
                      {FREQUENCY_MAP[period.periodType]}
                      {period.startDate && period.endDate && (
                        <> · {format(new Date(period.startDate), 'dd/MM/yyyy')} – {format(new Date(period.endDate), 'dd/MM/yyyy')}</>
                      )}
                      {period.cycleName && <> · thuộc kỳ {period.cycleName}</>}
                    </span>
                  </span>

                  <ArrowRight size={16} className="shrink-0 text-[var(--color-subtle-foreground)]" />
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
    <ChoiceChip selected={active} className="flex-1 py-2.5" onClick={onClick}>
      {icon}
      {label}
    </ChoiceChip>
  )
}
