import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Info } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import TierEditor, { maxTierCost, tierError } from './TierEditor'
import { useQuery } from '@tanstack/react-query'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usesPerformanceMatrix } from '@/lib/scoring'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { kpiCycleApi } from '@/features/kpi/api/kpiCycleApi'
import { kpiPeriodApi } from '@/features/kpi/api/kpiPeriodApi'
import { useAuthStore } from '@/store/authStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRewardPrograms } from '../hooks/usePrograms'
import { programSchema, type ProgramFormData } from '../schemas/programSchema'
import { numOrUndefined } from '../schemas/giftSchema'
import {
  RewardProgramScope,
  RewardRankingMetric,
  RewardTiePolicy,
  type RewardProgram,
} from '../types'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

const DEFAULT_TIERS = [
  { fromRank: 1, toRank: 1, points: 500 },
  { fromRank: 2, toRank: 3, points: 300 },
]

interface ProgramFormModalProps {
  open: boolean
  onClose: () => void
  editProgram?: RewardProgram | null
}

/**
 * Chỉ số phù hợp với từng phạm vi. Backend cũng chặn, nhưng để người dùng chọn được một
 * cặp không hợp lệ rồi mới báo lỗi là thiết kế tồi — lọc luôn ở đây.
 *
 * <p>{@code MATRIX_RATING} còn phụ thuộc tổ chức có bật KPI định tính hay không, nên
 * được lọc thêm một lượt nữa lúc chạy — xem `availableMetrics`.
 */
const METRICS_BY_SCOPE = perLanguage((): Record<RewardProgramScope, { value: RewardRankingMetric; label: string }[]> => ({
  [RewardProgramScope.CYCLE]: [
    { value: RewardRankingMetric.FINAL_SCORE, label: i18n.t('rewards:ProgramFormModal.cycleFinalizedScore') },
    { value: RewardRankingMetric.MATRIX_RATING, label: i18n.t('rewards:ProgramFormModal.ratingMatrix') },
  ],
  [RewardProgramScope.PERIOD]: [
    { value: RewardRankingMetric.PERFORMANCE, label: i18n.t('rewards:ProgramFormModal.periodPerformanceScore') },
    { value: RewardRankingMetric.MATRIX_RATING, label: i18n.t('rewards:ProgramFormModal.ratingMatrix') },
  ],
}))

export default function ProgramFormModal({ open, onClose, editProgram }: ProgramFormModalProps) {
  const { t: tr } = useTranslation('rewards')
  const isEdit = !!editProgram
  const hasIssued = (editProgram?.issuedRunCount ?? 0) > 0

  const formApi = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema()),
    defaultValues: {
      name: '', description: '', scope: RewardProgramScope.CYCLE, orgUnitId: '', fixedTargetId: '',
      metric: RewardRankingMetric.FINAL_SCORE, tiePolicy: RewardTiePolicy.SHARE_ALL,
      minMetricValue: undefined, maxPointsPerRun: undefined,
      includeUnitHeads: true, enabled: true, autoTrigger: false, tiers: DEFAULT_TIERS,
    },
  })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `reward-program:${editProgram?.id ?? 'new'}`, enabled: open })

  // Toàn bộ phần dưới là Select / thẻ bấm / TierEditor chứ không phải ô nhập, nên đọc
  // bằng watch và ghi bằng setValue.
  const scope = watch('scope')
  const orgUnitId = watch('orgUnitId')
  const fixedTargetId = watch('fixedTargetId')
  const metric = watch('metric')
  const tiePolicy = watch('tiePolicy')
  const autoTrigger = watch('autoTrigger')
  const tiers = watch('tiers')

  const { data: treeData } = useOrgUnitTree()
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: organization } = useOrganization(orgId ?? '')
  const { createProgram, updateProgram, isCreating, isUpdating } = useRewardPrograms()

  // Xếp loại ma trận chỉ có dữ liệu khi tổ chức ra được xếp loại (KPI định tính hoặc chấm
  // hạnh kiểm). Hiện nó lúc tắt cả hai sẽ dẫn tới chương trình luôn xếp hạng ra danh sách rỗng.
  const isCycle = scope === RewardProgramScope.CYCLE
  const scopeWord = isCycle ? tr('ProgramFormModal.cycle') : tr('ProgramFormModal.periods')

  const { data: cycles } = useQuery({
    queryKey: ['kpiCycles', 'programForm', orgId],
    queryFn: () => kpiCycleApi.getAll({ page: 0, size: 100, organizationId: orgId }),
    enabled: open && isCycle && !!orgId,
  })
  const { data: periods } = useQuery({
    queryKey: ['kpiPeriods', 'programForm', orgId],
    queryFn: () =>
      kpiPeriodApi.getAll({
        page: 0,
        size: 100,
        sortBy: 'startDate',
        direction: 'desc',
        organizationId: orgId,
      }),
    enabled: open && !isCycle && !!orgId,
  })
  const targetOptions = ((isCycle ? cycles?.content : periods?.content) ?? []) as any[]

  // Xếp hạng theo ma trận chỉ có nghĩa khi org thực sự ra được xếp loại ma trận — KPI
  // định tính hoặc chấm hạnh kiểm (điểm hạnh kiểm lấp trục còn trống của ma trận).
  const hasMatrix = usesPerformanceMatrix(organization)
  const availableMetrics = useMemo(
    () =>
      METRICS_BY_SCOPE()[scope].filter(
        (m) => m.value !== RewardRankingMetric.MATRIX_RATING || hasMatrix,
      ),
    [scope, hasMatrix],
  )

  const flatUnits = useMemo(() => {
    const flatten = (nodes: any[], level = 0): { id: string; label: string }[] => {
      let out: { id: string; label: string }[] = []
      nodes?.forEach((n) => {
        out.push({ id: n.id, label: '—'.repeat(level) + (level > 0 ? ' ' : '') + n.name })
        if (n.children?.length) out = out.concat(flatten(n.children, level + 1))
      })
      return out
    }
    return treeData ? flatten(treeData as any[]) : []
  }, [treeData])

  useEffect(() => {
    if (!open) return
    reset({
      name: editProgram?.name ?? '',
      description: editProgram?.description ?? '',
      scope: editProgram?.scope ?? RewardProgramScope.CYCLE,
      // Chương trình cũ lưu null = toàn tổ chức; effect bên dưới sẽ tự chọn đơn vị gốc,
      // vốn bao trọn cây con nên cùng phạm vi.
      orgUnitId: editProgram?.orgUnitId ?? '',
      fixedTargetId: editProgram?.fixedTargetId ?? '',
      metric: editProgram?.metric ?? RewardRankingMetric.FINAL_SCORE,
      tiePolicy: editProgram?.tiePolicy ?? RewardTiePolicy.SHARE_ALL,
      minMetricValue: editProgram?.minMetricValue ?? undefined,
      maxPointsPerRun: editProgram?.maxPointsPerRun ?? undefined,
      includeUnitHeads: editProgram?.includeUnitHeads ?? true,
      enabled: editProgram?.enabled ?? true,
      autoTrigger: editProgram?.autoTrigger ?? false,
      tiers: editProgram?.tiers?.length ? [...editProgram.tiers] : DEFAULT_TIERS,
    })
  }, [open, editProgram, reset])

  // Đổi phạm vi có thể làm chỉ số hiện tại thành không hợp lệ — tự chuyển sang chỉ số
  // đầu tiên của phạm vi mới thay vì để người dùng gửi đi rồi nhận lỗi.
  useEffect(() => {
    const allowed = availableMetrics.map((m) => m.value)
    const fallback = allowed[0]
    if (fallback && !allowed.includes(metric)) setValue('metric', fallback)
  }, [availableMetrics, metric, setValue])

  // Mặc định là đơn vị gốc — nó bao trọn cây con nên tương đương toàn tổ chức, nhưng
  // hiện tên cụ thể để người dùng biết chương trình đang xếp hạng trong phạm vi nào.
  useEffect(() => {
    const root = flatUnits[0]
    if (!orgUnitId && root) setValue('orgUnitId', root.id)
  }, [flatUnits, orgUnitId, setValue])

  // Cảnh báo bậc thưởng phải hiện NGAY khi sửa chứ không đợi bấm Lưu, nên vẫn tính tại
  // chỗ; schema gọi cùng hàm này để chặn lúc gửi, hai bên không thể lệch luật.
  const tierMsg = tierError(tiers)

  const onSubmit = async (data: ProgramFormData) => {
    const payload = {
      name: data.name.trim(),
      description: data.description.trim() || undefined,
      scope: data.scope,
      orgUnitId: data.orgUnitId || null,
      fixedTargetId: data.fixedTargetId || null,
      metric: data.metric,
      tiePolicy: data.tiePolicy,
      minMetricValue: data.minMetricValue ?? null,
      maxPointsPerRun: data.maxPointsPerRun ?? null,
      includeUnitHeads: data.includeUnitHeads,
      enabled: data.enabled,
      autoTrigger: data.autoTrigger,
      tiers: [...data.tiers].sort((a, b) => a.fromRank - b.fromRank),
    }
    if (isEdit && editProgram) {
      await updateProgram({ id: editProgram.id, data: payload })
    } else {
      await createProgram(payload)
    }
    onClose()
  }

  const inputCls =
    'w-full rounded-control border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm'
  const totalIfFull = maxTierCost(tiers)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!(isCreating || isUpdating)}
      title={isEdit ? tr('ProgramFormModal.editRewardProgram') : tr('ProgramFormModal.createAnAutomaticRewardProgram')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isCreating || isUpdating}>{tr('ProgramFormModal.cancel')}</Button>}
          primary={
            <Button onClick={handleSubmit(onSubmit)} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isEdit ? tr('ProgramFormModal.save') : tr('ProgramFormModal.createProgram')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <div>
          <label className="text-label mb-1.5 block font-medium">{tr('ProgramFormModal.programName')}</label>
          <input
            {...register('name')}
            placeholder={tr('ProgramFormModal.eGHonorTheTop3')}
            className={inputCls}
          />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
        </div>

        {/* Quyết định NGAY TỪ ĐẦU: luật thường trực hay chỉ cho một kỳ. Trước đây phải
            vào màn hình chạy mới tuỳ biến được, người dùng phải hiểu hai khái niệm rời
            nhau mới dùng nổi. */}
        <div>
          <label className="text-label mb-2 block font-medium">{tr('ProgramFormModal.appliesTo')}</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setValue('fixedTargetId', '')}
              className={`rounded-card border px-4 py-3 text-left text-sm transition-colors ${
                !fixedTargetId
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="font-medium">{tr('ProgramFormModal.every')} {scopeWord}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {tr('ProgramFormModal.aStandingRuleEachRunYou')} {scopeWord} {tr('ProgramFormModal.toAward')}
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                const first = targetOptions[0]
                if (first) setValue('fixedTargetId', first.id)
              }}
              disabled={targetOptions.length === 0}
              className={`rounded-card border px-4 py-3 text-left text-sm transition-colors disabled:opacity-40 ${
                fixedTargetId
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="font-medium">{tr('ProgramFormModal.one')} {scopeWord} {tr('ProgramFormModal.specific')}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {tr('ProgramFormModal.forAOneOffRewardE')}
              </div>
            </button>
          </div>

          {fixedTargetId && (
            <div className="mt-2">
              <Select value={fixedTargetId} onValueChange={v => setValue('fixedTargetId', v)}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder={tr('ProgramFormModal.choose', { scopeWord })} />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {targetOptions.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-label mb-1.5 block font-medium">{tr('ProgramFormModal.rankBy')}</label>
            <Select
              value={scope}
              onValueChange={(v) => setValue('scope', v as RewardProgramScope)}
              disabled={hasIssued}
            >
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                <SelectItem value={RewardProgramScope.CYCLE}>{tr('ProgramFormModal.evaluationCycles')}</SelectItem>
                <SelectItem value={RewardProgramScope.PERIOD}>{tr('ProgramFormModal.evaluationPeriods')}</SelectItem>
              </SelectContent>
            </Select>
            {hasIssued && (
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {tr('ProgramFormModal.rewardsHaveBeenGivenSoThe')}
              </p>
            )}
          </div>

          <div>
            <label className="text-label mb-1.5 block font-medium">{tr('ProgramFormModal.rankingMetric')}</label>
            <Select value={metric} onValueChange={(v) => setValue('metric', v as RewardRankingMetric)}>
              <SelectTrigger className={inputCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                {availableMetrics.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasMatrix && (
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {tr('ProgramFormModal.turnOnQualitativeKpisOrConduct')}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="text-label mb-1.5 block font-medium">{tr('ProgramFormModal.unitScope')}</label>
          <Select value={orgUnitId} onValueChange={v => setValue('orgUnitId', v)}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            {/* Không có "Toàn tổ chức": đơn vị gốc đã bao trọn cây con nên hai lựa
                chọn cho ra cùng một tập người. */}
            <SelectContent className="z-[1100]">
              {flatUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Bậc thưởng ── */}
        <div>
          <label className="text-label mb-2 block font-medium">{tr('ProgramFormModal.defaultRewardTiers')}</label>
          <TierEditor tiers={tiers} onChange={t => setValue('tiers', t, { shouldValidate: true })} />

          {tierMsg ? (
            <p className="mt-2 text-xs text-[var(--color-error)]">{tierMsg}</p>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              {tr('ProgramFormModal.ifEveryRankIsFilledOne')}{' '}
              <b>{totalIfFull.toLocaleString(intlLocale())} {tr('ProgramFormModal.points')}</b>{tr('ProgramFormModal.theseTiersAreOnlyDefaultsEach')}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-label mb-1.5 block font-medium">
              {tr('ProgramFormModal.minimumScore')} <span className="font-normal text-[var(--color-muted-foreground)]">{tr('ProgramFormModal.optional')}</span>
            </label>
            <LocaleNumberInput
              type="number"
              {...register('minMetricValue', { setValueAs: numOrUndefined })}
              placeholder={tr('ProgramFormModal.noRequirement')}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {tr('ProgramFormModal.belowThisNoRewardIsGiven')}
            </p>
          </div>
          <div>
            <label className="text-label mb-1.5 block font-medium">
              {tr('ProgramFormModal.pointCapPerRun')}{' '}
              <span className="font-normal text-[var(--color-muted-foreground)]">{tr('ProgramFormModal.optional')}</span>
            </label>
            <LocaleNumberInput
              type="number"
              min={1}
              {...register('maxPointsPerRun', { setValueAs: numOrUndefined })}
              placeholder={tr('ProgramFormModal.unlimited')}
              className={inputCls}
            />
            {errors.maxPointsPerRun && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{errors.maxPointsPerRun.message}</p>
            )}
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {tr('ProgramFormModal.preventsAMisconfigurationFromGivingOut')}
            </p>
          </div>
        </div>

        <div>
          <label className="text-label mb-1.5 block font-medium">{tr('ProgramFormModal.whenPeopleTie')}</label>
          <Select value={tiePolicy} onValueChange={(v) => setValue('tiePolicy', v as RewardTiePolicy)}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              <SelectItem value={RewardTiePolicy.SHARE_ALL}>
                {tr('ProgramFormModal.sameRankSameRewardTop3')}
              </SelectItem>
              <SelectItem value={RewardTiePolicy.STRICT}>
                {tr('ProgramFormModal.payExactlyThatManyPeopleTies')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label className="text-label flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            {...register('includeUnitHeads')}
            className="rounded border-[var(--color-border)]"
          />
          {tr('ProgramFormModal.includeUnitHeadsDeputiesInThe')}
        </label>

        <label className="text-label flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            {...register('enabled')}
            className="rounded border-[var(--color-border)]"
          />
          {tr('ProgramFormModal.on')}
        </label>

        <div className="rounded-card border border-[var(--color-border)] px-4 py-3">
          <label className="text-label flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              {...register('autoTrigger')}
              className="mt-0.5 rounded border-[var(--color-border)]"
            />
            <span>
              <span className="font-medium">{tr('ProgramFormModal.automaticallyAwardWhen')} {scopeWord} {tr('ProgramFormModal.ends')}</span>
              <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                {tr('ProgramFormModal.theSystemChecksDailyOncePast')} {scopeWord} {tr('ProgramFormModal.itAwardsWithoutAnyoneClickingYou')}
              </span>
            </span>
          </label>

          {/* Tự động nghĩa là điểm vào ví mà không ai soát lại. Nói thẳng rủi ro và
              chỉ ra cái van an toàn, thay vì để người dùng phát hiện khi đã muộn. */}
          {autoTrigger && (
            <div className="mt-2 flex items-start gap-2 rounded-control bg-[var(--color-warning-bg)] px-3 py-2 text-xs">
              <Info size={13} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
              <span>
                {tr('ProgramFormModal.pointsGoIntoWalletsWithoutAnyone')} <b>{tr('ProgramFormModal.pointCapPerRun2')}</b> {tr('ProgramFormModal.aboveToLimitTheDamageFrom')}
              </span>
            </div>
          )}
        </div>

        {!autoTrigger && (
          <div className="flex items-start gap-2 rounded-card bg-[var(--color-muted)]/50 px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              {tr('ProgramFormModal.theProgramDoesNotRunBy')} <b>{tr('ProgramFormModal.preview')}</b> {tr('ProgramFormModal.forA')} {scopeWord}{tr('ProgramFormModal.checkTheListAndOnlyThen')} <b>{tr('ProgramFormModal.award')}</b>.
            </span>
          </div>
        )}
      </div>
    </Dialog>
  )
}
