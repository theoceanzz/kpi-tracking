import { LocaleNumberInput } from '@/components/ui/number-input'
import { useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, Info, Check, ChevronDown } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useCascadePolicies, useCascadePolicyMutations } from '../hooks/useBscCascade'
import { BscLinkedWeightEnforce, type CascadePolicyResponse } from '../types'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface CascadePolicyModalProps {
  open: boolean
  onClose: () => void
  organizationId?: string
}

/** Ba phạm vi áp dụng, đúng bộ với bộ tiêu chí (chỉ thêm mức áp dụng cho toàn tổ chức). */
type Scope = 'DEFAULT' | 'CYCLE' | 'PERIOD'

const SCOPE_HINT = perLanguage((): Record<Scope, string> => ({
  DEFAULT: i18n.t('bsc:CascadePolicyModal.appliesToEveryCycleAndPeriod'),
  CYCLE: i18n.t('bsc:CascadePolicyModal.appliesOnlyToThePeriodsOf'),
  PERIOD: i18n.t('bsc:CascadePolicyModal.appliesOnlyToExactlyTheTicked'),
}))

/** Bản nháp cho chính sách MỚI — trùng đúng hằng số mặc định của backend (120 / 60 / cảnh báo). */
const blankPolicy = (): CascadePolicyResponse => ({
  id: '',
  name: '',
  kpiCycleId: null,
  kpiCycleName: null,
  periods: [],
  recognizedCapPercent: 120,
  minBscLinkedWeight: 60,
  linkedWeightEnforce: BscLinkedWeightEnforce.WARN,
  status: 'ACTIVE',
  version: 1,
})

const scopeOf = (p: CascadePolicyResponse): Scope =>
  p.kpiCycleId ? 'CYCLE' : (p.periods?.length ? 'PERIOD' : 'DEFAULT')

/**
 * Chính sách điểm BSC — hai con số tác động tới điểm, cộng phạm vi áp dụng.
 *
 * <p>Phạm vi đi đúng bộ với bộ tiêu chí: gắn theo ĐỢT (tick nhiều), theo KỲ (mọi đợt trong kỳ),
 * hoặc để trống làm bản MẶC ĐỊNH của tổ chức. Lúc chấm, hệ thống tra từ hẹp tới rộng: đợt → kỳ →
 * mặc định → hằng số 120/60 trong BscCascadeService.
 *
 * <p>Vì vậy màn này phải cho TẠO THÊM chính sách chứ không chỉ sửa một bản: đổi phạm vi của bản
 * mặc định là mất luôn mức mặc định của cả tổ chức.
 */
export default function CascadePolicyModal({ open, onClose, organizationId }: CascadePolicyModalProps) {
  const { t } = useTranslation('bsc')
  const { data: policies, isLoading } = useCascadePolicies(open ? organizationId : undefined)
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { data: periodsData } = useKpiPeriods({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { createPolicy, updatePolicy, deletePolicy } = useCascadePolicyMutations()

  const cycles = useMemo(() => cyclesData?.content || [], [cyclesData])
  const allPeriods = useMemo(() => periodsData?.content || [], [periodsData])

  /** Đợt gom theo kỳ mẹ — danh sách đợt phẳng thì không nhìn ra đợt nào thuộc kỳ nào. */
  const periodGroups = useMemo(() => {
    const groups = new Map<string, { label: string; items: typeof allPeriods }>()
    for (const p of allPeriods) {
      const key = p.cycleId || '__none__'
      if (!groups.has(key)) groups.set(key, { label: p.cycleName || t('CascadePolicyModal.notInAnyCycle'), items: [] })
      groups.get(key)!.items.push(p)
    }
    return [...groups.entries()]
      .sort((a, b) => (a[0] === '__none__' ? 1 : b[0] === '__none__' ? -1 : 0))
      .map(([, g]) => g)
  }, [allPeriods, t])

  const [editingId, setEditingId] = useState<string | null>(null)
  /**
   * Phạm vi người dùng vừa bấm. PHẢI là state riêng chứ không suy từ dữ liệu: vừa bấm "Kỳ" thì
   * chưa có kỳ nào được chọn, suy từ dữ liệu sẽ vẫn ra "toàn tổ chức" ⇒ nút bấm không ăn gì và
   * ô chọn kỳ không bao giờ hiện ra.
   */
  const [scopeOverride, setScopeOverride] = useState<Scope | null>(null)
  // Đang soạn bản MỚI: tách hẳn khỏi editingId, nếu không thao tác lưu sẽ ghi đè bản đang chọn.
  const [isCreating, setIsCreating] = useState(false)
  // Bản nháp CHỈ tồn tại sau khi người dùng sửa thứ gì đó. Trước đó form đọc thẳng dữ liệu server —
  // nhờ vậy không cần effect đồng bộ, và dữ liệu mới tải về không bị bản nháp rỗng che mất.
  const [draft, setDraft] = useState<CascadePolicyResponse | null>(null)

  const list = policies || []
  const selected = isCreating ? null : (list.find(p => p.id === editingId) ?? list[0] ?? null)
  // Chưa có chính sách nào ⇒ mở thẳng form tạo mới, đừng để modal trống trơn.
  const form = draft ?? selected ?? (isLoading ? null : blankPolicy())
  const creating = isCreating || !selected
  const scope: Scope = scopeOverride ?? (form ? scopeOf(form) : 'DEFAULT')
  const periodIds = (form?.periods || []).map(p => p.id)

  const close = () => {
    setDraft(null); setEditingId(null); setIsCreating(false); setScopeOverride(null); onClose()
  }

  if (!open) return null

  const patch = (next: Partial<CascadePolicyResponse>) =>
    setDraft(prev => ({ ...(prev ?? form ?? blankPolicy()), ...next }))

  const pick = (id: string | null) => {
    setDraft(null)
    setScopeOverride(null)
    setIsCreating(id === null)
    setEditingId(id)
  }

  const setScope = (next: Scope) => {
    setScopeOverride(next)
    // Đổi phạm vi là xoá phạm vi cũ: gửi lên cả kỳ lẫn đợt sẽ bị backend từ chối.
    if (next === 'DEFAULT') patch({ kpiCycleId: null, kpiCycleName: null, periods: [] })
    if (next === 'CYCLE') patch({ periods: [] })
    if (next === 'PERIOD') patch({ kpiCycleId: null, kpiCycleName: null })
  }

  const togglePeriod = (id: string, name: string) => {
    const has = periodIds.includes(id)
    patch({
      periods: has
        ? (form?.periods || []).filter(p => p.id !== id)
        : [...(form?.periods || []), { id, name }],
      kpiCycleId: null,
      kpiCycleName: null,
    })
  }

  const save = () => {
    if (!form || !organizationId) return
    const payload = {
      name: form.name?.trim() || defaultName(form),
      kpiCycleId: scope === 'CYCLE' ? form.kpiCycleId || null : null,
      kpiPeriodIds: scope === 'PERIOD' ? periodIds : [],
      recognizedCapPercent: form.recognizedCapPercent,
      minBscLinkedWeight: form.minBscLinkedWeight,
      linkedWeightEnforce: form.linkedWeightEnforce,
    }
    if (creating) createPolicy.mutate({ organizationId, data: payload }, { onSuccess: close })
    else updatePolicy.mutate({ policyId: selected!.id, data: payload }, { onSuccess: close })
  }

  // Phạm vi đã có chính sách khác giữ thì khoá lại — backend cũng chặn, đây chỉ để người dùng
  // khỏi gõ xong mới ăn lỗi.
  const others = list.filter(p => p.id !== selected?.id)
  const takenCycleIds = new Set(others.filter(p => p.kpiCycleId).map(p => p.kpiCycleId as string))
  const takenPeriodIds = new Set(others.flatMap(p => (p.periods || []).map(x => x.id)))
  const defaultTaken = others.some(p => scopeOf(p) === 'DEFAULT')

  const periodTriggerLabel = periodIds.length === 0
    ? t('CascadePolicyModal.chooseApplicablePeriods')
    : periodIds.length === 1
      ? (form?.periods?.[0]?.name || t('CascadePolicyModal.n1Period'))
      : t('CascadePolicyModal.periodsSelected', { count: periodIds.length })

  const canSave = !!form
    && (scope !== 'CYCLE' || !!form.kpiCycleId)
    && (scope !== 'PERIOD' || periodIds.length > 0)

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      dismissible={!(createPolicy.isPending || updatePolicy.isPending || deletePolicy.isPending)}
      title={t('CascadePolicyModal.bscScorePolicy')}
      description={t('CascadePolicyModal.recognizedScoreCapAndTheRequirement')}
      footer={
        <DialogFooter
          destructive={!creating && selected && (
            <Button
              variant="ghost"
              className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
              onClick={() => deletePolicy.mutate(selected.id, { onSuccess: close })}
              disabled={deletePolicy.isPending}
              title={t('CascadePolicyModal.deleteThisPolicyItsScopeFalls')}
            >
              <Trash2 aria-hidden="true" /> {t('CascadePolicyModal.delete')}
            </Button>
          )}
          secondary={<Button variant="outline" onClick={close}>{t('CascadePolicyModal.cancel')}</Button>}
          primary={
            <Button onClick={save} disabled={!canSave || createPolicy.isPending || updatePolicy.isPending}>
              {(createPolicy.isPending || updatePolicy.isPending)
                ? t('CascadePolicyModal.saving')
                : creating ? t('CascadePolicyModal.createPolicy') : t('CascadePolicyModal.savePolicy')}
            </Button>
          }
        />
      }
    >
      <div className="space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-[var(--color-subtle-foreground)]">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}

        {/* ── Danh sách chính sách + tạo mới ───────────────────── */}
        {!isLoading && (
          <div className="flex flex-wrap items-center gap-1.5">
            {list.map(p => (
              <ChoiceChip selected={!creating && selected?.id === p.id} variant="solid" size="sm" className="py-1.5 max-w-[16rem] truncate" key={p.id} onClick={() => pick(p.id)} title={p.name}>
                {p.scopeLabel || p.name}
              </ChoiceChip>
            ))}
            <ChoiceChip selected={creating} size="sm" className="py-1.5" onClick={() => pick(null)}>
              <Plus /> {t('CascadePolicyModal.newPolicy')}
            </ChoiceChip>
          </div>
        )}

        {!isLoading && (
          <div className="rounded-card bg-[var(--color-muted)] px-4 py-3 flex items-start gap-2">
            <Info size={14} className="text-[var(--color-subtle-foreground)] shrink-0 mt-0.5" />
            <p className="text-caption leading-relaxed">
              {t('CascadePolicyModal.whenScoringAPeriodTheSystem')} <b>{t('CascadePolicyModal.aPolicyAttachedToThatExact')}</b> →
              <b> {t('CascadePolicyModal.thePolicyOfTheCycle')}</b> {t('CascadePolicyModal.containingThatPeriod')} <b>{t('CascadePolicyModal.theDefaultPolicy')}</b> {t('CascadePolicyModal.ifNoneExistsTheBuiltIn')} <b>{t('CascadePolicyModal.n12060WarningOnly')}</b>.
            </p>
          </div>
        )}

        {form && !isLoading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('CascadePolicyModal.policyName')}>
                <input value={form.name} onChange={e => patch({ name: e.target.value })}
                  placeholder={`VD: ${defaultName(form)}`}
                  className="w-full px-3 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium outline-none focus:placeholder:text-transparent" />
              </Field>

              <Field label={t('CascadePolicyModal.appliesTo')} hint={SCOPE_HINT()[scope]}>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { key: 'DEFAULT' as const, label: t('CascadePolicyModal.organizationWide') },
                    { key: 'CYCLE' as const, label: t('CascadePolicyModal.oneCycle') },
                    { key: 'PERIOD' as const, label: t('CascadePolicyModal.somePeriods') },
                  ]).map(opt => (
                    <ChoiceChip selected={scope === opt.key} variant="solid" size="sm" key={opt.key} onClick={() => setScope(opt.key)} disabled={opt.key === 'DEFAULT' && defaultTaken && scope !== 'DEFAULT'} title={opt.key === 'DEFAULT' && defaultTaken
                        ? t('CascadePolicyModal.theOrganizationAlreadyHasAnOrganization')
                        : SCOPE_HINT()[opt.key]}>
                      {opt.label}
                    </ChoiceChip>
                  ))}
                </div>
              </Field>
            </div>

            {scope === 'CYCLE' && (
              <Field label={t('CascadePolicyModal.applicableCycles')} hint={t('CascadePolicyModal.everyPeriodInThisCycleUses')}>
                <Select value={form.kpiCycleId || undefined}
                  onValueChange={v => patch({ kpiCycleId: v, periods: [] })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={t('CascadePolicyModal.chooseEvaluationCycle')} /></SelectTrigger>
                  <SelectContent className="z-[1100]">
                    {cycles.map(c => (
                      <SelectItem key={c.id} value={c.id} disabled={takenCycleIds.has(c.id)}>
                        {c.name}{takenCycleIds.has(c.id) ? t('CascadePolicyModal.alreadyHasAPolicy') : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {scope === 'PERIOD' && (
              <Field label={t('CascadePolicyModal.applicablePeriodsMultiple')}
                hint={t('CascadePolicyModal.tickSeveralPeriodsToShareOne')}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal" type="button">
                      <span className={cn('truncate text-left', periodIds.length === 0 && 'text-[var(--color-subtle-foreground)]')}>
                        {periodTriggerLabel}
                      </span>
                      <ChevronDown aria-hidden="true" className="opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start"
                    className="p-2 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto custom-scrollbar z-[1100]">
                    {allPeriods.length === 0 && (
                      <p className="px-3 py-2 text-caption">{t('CascadePolicyModal.noKpiPeriodsYet')}</p>
                    )}
                    {periodGroups.map(g => (
                      <div key={g.label} className="mb-1 last:mb-0">
                        <div className="px-3 py-1">
                          <span className="text-eyebrow truncate">{g.label}</span>
                        </div>
                        <div className="space-y-1">
                          {g.items.map(p => {
                            const isSelected = periodIds.includes(p.id)
                            const taken = takenPeriodIds.has(p.id)
                            return (
                              <div key={p.id}
                                onClick={() => { if (!taken) togglePeriod(p.id, p.name) }}
                                title={taken ? t('CascadePolicyModal.thisPeriodIsAlreadyCoveredBy') : undefined}
                                className={cn('flex items-center gap-3 px-3 py-2 rounded-card transition-colors group',
                                  taken ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                                  isSelected
                                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                                    : !taken && 'hover:bg-[var(--color-muted)]')}>
                                <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                                  isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]')}>
                                  {isSelected && <Check size={10} strokeWidth={4} />}
                                </div>
                                <span className="text-xs font-medium truncate">{p.name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </PopoverContent>
                </Popover>
              </Field>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('CascadePolicyModal.rawScoreCap')}
                hint={t('CascadePolicyModal.recognizedScoreMinRawScoreThis')}>
                <NumberBox value={form.recognizedCapPercent} onChange={v => patch({ recognizedCapPercent: v })} step={1} />
              </Field>
              <Field label={t('CascadePolicyModal.bscLinkedKpi')}
                hint={t('CascadePolicyModal.theMinimumOfAPersonsTotal')}>
                <NumberBox value={form.minBscLinkedWeight} onChange={v => patch({ minBscLinkedWeight: v })} step={1} />
              </Field>
            </div>

            <Field label={t('CascadePolicyModal.enforcementOfTheBscLinkedKpi')}
              hint={t('CascadePolicyModal.warningOnlyShowsAWarningOn')}>
              <Select value={form.linkedWeightEnforce}
                onValueChange={v => patch({ linkedWeightEnforce: v as BscLinkedWeightEnforce })}>
                <SelectTrigger className="w-full sm:w-auto sm:min-w-64"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[1100]">
                  <SelectItem value={BscLinkedWeightEnforce.WARN}>{t('CascadePolicyModal.warningOnly')}</SelectItem>
                  <SelectItem value={BscLinkedWeightEnforce.BLOCK}>{t('CascadePolicyModal.blockFinalization')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <p className="text-caption">
              {t('CascadePolicyModal.departmentAndCompanyBscResultsAre')}
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}

/** Tên gợi ý khi người dùng để trống — đủ để phân biệt các bản trong danh sách. */
function defaultName(p: CascadePolicyResponse): string {
  if (p.kpiCycleId) return i18n.t('bsc:CascadePolicyModal.policy', { value: p.kpiCycleName || i18n.t('bsc:CascadePolicyModal.byCycle') })
  if (p.periods?.length) return i18n.t('bsc:CascadePolicyModal.policy2', { join: p.periods.map(x => x.name).join(', ') })
  return i18n.t('bsc:CascadePolicyModal.organizationWidePolicy')
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-label block">{label}</label>
      {children}
      {hint && <p className="text-caption leading-relaxed">{hint}</p>}
    </div>
  )
}

function NumberBox({ value, onChange, step }: {
  value?: number | null
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <LocaleNumberInput type="number" step={step ?? 1} value={value ?? ''}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-semibold text-right outline-none" />
  )
}
