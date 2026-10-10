import { LocaleNumberInput } from '@/components/ui/number-input'
import { useState, useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createEvaluationLevelsSchema,
  qualitativeLevelsSchema,
  type EvaluationLevelsFormData,
  type QualitativeLevelsFormData,
} from '../schemas/organizationSchema'
import { toastFirstError } from '@/lib/formErrors'
import { Edit3, Trash2, Plus, RotateCcw, X, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import type { PerformanceMatrix } from '../api/organizationApi'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { SCORING_POOL } from '@/lib/scoring'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'

/**
 * Các khối cấu hình thang điểm & xếp loại, tách khỏi CompanyPage để dùng cho trang
 * "Thang điểm & xếp loại". Nội dung giữ nguyên như khi còn nằm trong CompanyPage.
 */
/** Dải màu mặc định dùng chung cho cả thang điểm định lượng & định tính (thấp → cao). */
const DEFAULT_LEVEL_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#3b82f6', '#10b981']
const FALLBACK_LEVEL_COLOR = '#6366f1'

export function ScoringConfigSection({ org }: { org: any }) {
  const { t } = useTranslation('orgunits')
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [maxScore, setMaxScore] = useState(org?.evaluationMaxScore || 100)

  // Hiển thị từ thấp lên cao (đồng bộ với thang điểm định tính)
  const mapLevels = (levels: any[]) =>
    [...(levels || [])]
      .sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        threshold: l.threshold,
        color: l.color || FALLBACK_LEVEL_COLOR
      }))

  // Trần điểm mức phụ thuộc thang tối đa — state riêng ngoài form — nên schema dựng theo nó.
  const schema = useMemo(() => createEvaluationLevelsSchema(maxScore), [maxScore])

  const { register, control, handleSubmit, reset, watch } = useForm<EvaluationLevelsFormData>({
    resolver: zodResolver(schema),
    defaultValues: { evaluationLevels: mapLevels(org?.evaluationLevels) },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "evaluationLevels"
  })

  const watchedLevels = watch("evaluationLevels")

  useEffect(() => {
    if (org?.evaluationLevels) {
      reset({ evaluationLevels: mapLevels(org.evaluationLevels) })
      setMaxScore(org.evaluationMaxScore || 100)
    }
  }, [org, reset])

  const handleSave = (data: EvaluationLevelsFormData) => {
    // Thang tối đa không nằm trong form (state riêng): chấm luôn tối đa SCORING_POOL
    // (trọng số = điểm), nên thang thấp hơn sẽ khiến ai hoàn thành đủ KPI cũng kịch trần,
    // xếp loại mất ý nghĩa. Backend chặn cùng luật.
    if (maxScore < SCORING_POOL) {
      toast.error(t('ScoringSections.theMaximumScaleMustBeOr', { SCORING_POOL, SCORING_POOL2: SCORING_POOL }))
      return
    }

    updateMutation.mutate({
      evaluationMaxScore: maxScore,
      evaluationLevels: data.evaluationLevels.map(l => ({
        name: l.name,
        threshold: Number(l.threshold),
        color: l.color
      }))
    }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success(t('ScoringSections.scoringScaleUpdatedSuccessfully'))
      },
      onError: (error) => toast.error(getApiErrorMessage(error, t('ScoringSections.couldNotUpdateTheScoringScale')))
    })
  }

  const handleResetToDefault = () => {
    const defaultLevels = [
      { name: t('ScoringSections.weak'), threshold: 0, color: DEFAULT_LEVEL_COLORS[0] },
      { name: t('ScoringSections.average'), threshold: 50, color: DEFAULT_LEVEL_COLORS[1] },
      { name: t('ScoringSections.fair'), threshold: 70, color: DEFAULT_LEVEL_COLORS[2] },
      { name: t('ScoringSections.good'), threshold: 80, color: DEFAULT_LEVEL_COLORS[3] },
      { name: t('ScoringSections.excellent'), threshold: 90, color: DEFAULT_LEVEL_COLORS[4] },
    ]

    updateMutation.mutate({
      evaluationMaxScore: 100,
      evaluationLevels: defaultLevels
    }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success(t('ScoringSections.resetToTheDefaultScoringScale'))
      },
      onError: (error) => toast.error(getApiErrorMessage(error, t('ScoringSections.couldNotResetTheScoringScale')))
    })
  }

  return (
    // Tiêu đề và hai nút sửa/đặt lại nằm trên `WorkspaceHeader` — đó cũng là nơi vẽ
    // hàng tab Định lượng/Định tính, nên không dựng thêm một đầu card nữa ở đây.
    <div className="space-y-5">
      <WorkspaceHeader
        description={t('ScoringSections.theMaximumScaleAndRatingLevels')}
        actions={
          !isEditing && (
            <>
              <Button {...tourAnchor('scoring.reset')} variant="outline" size="icon" aria-label={t('ScoringSections.resetToDefault')} onClick={handleResetToDefault} title={t('ScoringSections.resetToDefault')}>
                <RotateCcw aria-hidden="true" />
              </Button>
              <Button {...tourAnchor('scoring.edit')} onClick={() => setIsEditing(true)}>
                <Edit3 aria-hidden="true" /> {t('ScoringSections.edit')}
              </Button>
            </>
          )
        }
      />

      <section className="mx-auto max-w-3xl overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        {/* Thang điểm tối đa: một hàng số liệu, không tô nền — nó là MẪU SỐ xếp loại, không phải hệ số nhân */}
        <div {...tourAnchor('scoring.max')} id="tour-scoring-max" className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-eyebrow">{t('ScoringSections.maximumScale')}</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {t('ScoringSections.completing100OfKpisAlwaysGives')} {SCORING_POOL} {t('ScoringSections.pointsWeight2525Points')}
              {maxScore > SCORING_POOL
                ? t('ScoringSections.theScaleIsTheRatingDenominator', { maxScore, SCORING_POOL, maxScore2: maxScore, SCORING_POOL2: SCORING_POOL })
                : t('ScoringSections.theRatingLevelsBelowAreSet')}
            </p>
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <LocaleNumberInput
                type="number"
                value={maxScore}
                onChange={e => setMaxScore(Number(e.target.value))}
                aria-label={t('ScoringSections.maximumScale')}
                className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] w-24 text-center tabular-nums"
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
              />
              <span className="text-sm text-[var(--color-muted-foreground)]">{t('ScoringSections.points')}</span>
            </div>
          ) : (
            <p className="shrink-0 text-stat">{maxScore} <span className="text-sm font-normal text-[var(--color-muted-foreground)]">{t('ScoringSections.points')}</span></p>
          )}
        </div>

        <div {...tourAnchor('scoring.levels')} id="tour-scoring-levels" className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-section-title">{t('ScoringSections.ratingLevels')}</h4>
              <p className="text-caption">{t('ScoringSections.scoresFromTheThresholdUpwardFall')}</p>
            </div>
            {isEditing && (
              <Button variant="outline" size="sm" type="button" onClick={() => append({ id: undefined, name: t('ScoringSections.newLevel'), threshold: 0, color: '#3b82f6' })}>
                <Plus aria-hidden="true" /> {t('ScoringSections.addLevel')}
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="mt-4 space-y-2">
              <div className="hidden grid-cols-[1fr_7rem_4rem_2.25rem] gap-3 px-1 sm:grid">
                <span className="text-eyebrow">{t('ScoringSections.levelName')}</span>
                <span className="text-eyebrow">{t('ScoringSections.score')}</span>
                <span className="text-eyebrow">{t('ScoringSections.color')}</span>
                <span className="sr-only">{t('ScoringSections.delete')}</span>
              </div>
              <ol className="space-y-2">
                {fields.map((field, index) => (
                  <li key={field.id} className="grid grid-cols-2 items-end gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3 sm:grid-cols-[1fr_7rem_4rem_2.25rem] sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.levelName')}</label>
                      <input {...register(`evaluationLevels.${index}.name` as const)} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]" aria-label={t('ScoringSections.levelName2', { value: index + 1 })} />
                    </div>
                    <div>
                      <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.score')}</label>
                      <LocaleNumberInput type="number" {...register(`evaluationLevels.${index}.threshold` as const, { valueAsNumber: true })} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] tabular-nums" aria-label={t('ScoringSections.scoreThreshold')} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.color')}</label>
                        <input type="color" {...register(`evaluationLevels.${index}.color` as const)} className="h-9 w-full cursor-pointer rounded-control border border-[var(--color-border)] bg-[var(--color-card)] p-0.5" aria-label={t('ScoringSections.levelColor')} />
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={t('ScoringSections.deleteLevel')} title={t('ScoringSections.deleteLevel')} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)] sm:hidden"><Trash2 aria-hidden="true" /></Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={t('ScoringSections.deleteLevel')} title={t('ScoringSections.deleteLevel')} className="hidden text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)] sm:inline-flex"><Trash2 aria-hidden="true" /></Button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-[var(--color-border)] overflow-hidden rounded-card border border-[var(--color-border)]">
              {fields.map((field, index) => (
                <li key={field.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: watchedLevels[index]?.color || '#cbd5e1' }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-foreground)]">{watchedLevels[index]?.name}</span>
                  <span className="text-sm tabular-nums text-[var(--color-muted-foreground)]">≥ <span className="font-medium text-[var(--color-foreground)]">{watchedLevels[index]?.threshold}</span> {t('ScoringSections.points')}</span>
                </li>
              ))}
            </ol>
          )}

          {isEditing && (
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <Button variant="outline" type="button" onClick={() => { setIsEditing(false); reset() }} disabled={updateMutation.isPending}>{t('ScoringSections.cancel')}</Button>
              <Button onClick={handleSubmit(handleSave, toastFirstError)} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('ScoringSections.saveSettings')}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

const DEFAULT_QUALITATIVE_LEVELS = perLanguage(() => ([
  { name: i18n.t('orgunits:ScoringSections.poor'), value: 0, position: 1, scorePercent: 0, color: DEFAULT_LEVEL_COLORS[0] },
  { name: i18n.t('orgunits:ScoringSections.weak'), value: 2, position: 2, scorePercent: 40, color: DEFAULT_LEVEL_COLORS[1] },
  { name: i18n.t('orgunits:ScoringSections.average'), value: 3, position: 3, scorePercent: 60, color: DEFAULT_LEVEL_COLORS[2] },
  { name: i18n.t('orgunits:ScoringSections.fair'), value: 3.5, position: 4, scorePercent: 80, color: DEFAULT_LEVEL_COLORS[3] },
  { name: i18n.t('orgunits:ScoringSections.good'), value: 4.5, position: 5, scorePercent: 100, color: DEFAULT_LEVEL_COLORS[4] },
]))

export function QualitativeConfigSection({ org }: { org: any }) {
  const { t } = useTranslation('orgunits')
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)

  const mapLevels = (levels: any[]) =>
    [...(levels || [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        value: l.value,
        position: l.position,
        scorePercent: l.scorePercent ?? 0,
        color: l.color || FALLBACK_LEVEL_COLOR,
      }))

  const { register, control, handleSubmit, reset, watch } = useForm<QualitativeLevelsFormData>({
    resolver: zodResolver(qualitativeLevelsSchema()),
    defaultValues: { qualitativeLevels: mapLevels(org?.qualitativeLevels) },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'qualitativeLevels' })
  const watchedLevels = watch('qualitativeLevels')

  useEffect(() => {
    reset({ qualitativeLevels: mapLevels(org?.qualitativeLevels) })
  }, [org, reset])

  const handleSave = (data: QualitativeLevelsFormData) => {
    updateMutation.mutate(
      {
        qualitativeLevels: data.qualitativeLevels.map(l => ({
          name: l.name.trim(),
          value: Number(l.value),
          position: Number(l.position),
          scorePercent: Number(l.scorePercent),
          color: l.color,
        })),
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('ScoringSections.qualitativeScaleUpdatedSuccessfully'))
        },
        onError: (error) => toast.error(getApiErrorMessage(error, t('ScoringSections.couldNotUpdateTheQualitativeScale'))),
      }
    )
  }

  const handleResetToDefault = () => {
    updateMutation.mutate(
      { qualitativeLevels: DEFAULT_QUALITATIVE_LEVELS() },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('ScoringSections.resetToTheDefaultQualitativeScale'))
        },
        onError: (error) => toast.error(getApiErrorMessage(error, t('ScoringSections.couldNotResetTheQualitativeScale'))),
      }
    )
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        description={t('ScoringSections.behavioralEvaluationLevelsAndTheirConverted')}
        actions={
          !isEditing && (
            <>
              <Button {...tourAnchor('qual.reset')} variant="outline" size="icon" aria-label={t('ScoringSections.resetToDefault')} onClick={handleResetToDefault} title={t('ScoringSections.resetToDefault')}>
                <RotateCcw aria-hidden="true" />
              </Button>
              <Button {...tourAnchor('qual.edit')} onClick={() => setIsEditing(true)}>
                <Edit3 aria-hidden="true" /> {t('ScoringSections.edit')}
              </Button>
            </>
          )
        }
      />

      <section className="mx-auto max-w-3xl overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div {...tourAnchor('qual.guide')} id="tour-qualitative-guide" className="border-b border-[var(--color-border)] px-5 py-4">
          <h4 className="text-section-title">{t('ScoringSections.evaluationLevels')}</h4>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('ScoringSections.eachBehavioralLevelConvertsToA')} <b className="font-medium text-[var(--color-foreground)]">{t('ScoringSections.value')}</b> {t('ScoringSections.pointsUsedForThePerformanceMatrix')} <b className="font-medium text-[var(--color-foreground)]">{t('ScoringSections.position')}</b> {t('ScoringSections.isTheColumnOrderInThe')}
            {org?.enableBsc && <> {t('ScoringSections.theColumn')} <b className="font-medium text-[var(--color-foreground)]">% BSC</b> {t('ScoringSections.isTheCorrespondingCompletionLevelWhen')}</>}
          </p>
        </div>

        <div {...tourAnchor('qual.levels')} id="tour-qualitative-levels" className="p-5">
          {isEditing ? (
            <div className="space-y-2">
              <div className="hidden grid-cols-[3.5rem_1fr_5rem_5rem_4rem_2.25rem] gap-3 px-1 sm:grid">
                <span className="text-eyebrow">{t('ScoringSections.position2')}</span>
                <span className="text-eyebrow">{t('ScoringSections.levelName')}</span>
                <span className="text-eyebrow">{t('ScoringSections.value2')}</span>
                <span className="text-eyebrow" title={t('ScoringSections.whatCompletionThisLevelEqualsWhen')}>% BSC</span>
                <span className="text-eyebrow">{t('ScoringSections.color')}</span>
                <span className="sr-only">{t('ScoringSections.delete')}</span>
              </div>
              <ol className="space-y-2">
                {fields.map((field, index) => (
                  <li key={field.id} className="grid grid-cols-2 items-end gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-3 sm:grid-cols-[3.5rem_1fr_5rem_5rem_4rem_2.25rem] sm:items-center sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
                    <div>
                      <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.position2')}</label>
                      <LocaleNumberInput type="number" {...register(`qualitativeLevels.${index}.position` as const, { valueAsNumber: true })} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] tabular-nums" aria-label={t('ScoringSections.position2')} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                    <div>
                      <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.levelName')}</label>
                      <input {...register(`qualitativeLevels.${index}.name` as const)} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]" aria-label={t('ScoringSections.levelName2', { value: index + 1 })} />
                    </div>
                    <div>
                      <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.value2')}</label>
                      <LocaleNumberInput type="number" step="0.5" {...register(`qualitativeLevels.${index}.value` as const, { valueAsNumber: true })} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] tabular-nums" aria-label={t('ScoringSections.value2')} onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                    <div>
                      <label className="text-label mb-1 block sm:sr-only">% BSC</label>
                      <LocaleNumberInput type="number" step="1" min="0" max="100" {...register(`qualitativeLevels.${index}.scorePercent` as const, { valueAsNumber: true })} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] tabular-nums" aria-label="% BSC" onWheel={(e) => (e.target as HTMLInputElement).blur()} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-label mb-1 block sm:sr-only">{t('ScoringSections.color')}</label>
                        <input type="color" {...register(`qualitativeLevels.${index}.color` as const)} className="h-9 w-full cursor-pointer rounded-control border border-[var(--color-border)] bg-[var(--color-card)] p-0.5" aria-label={t('ScoringSections.levelColor')} />
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={t('ScoringSections.deleteLevel')} title={t('ScoringSections.deleteLevel')} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)] sm:hidden"><Trash2 aria-hidden="true" /></Button>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={t('ScoringSections.deleteLevel')} title={t('ScoringSections.deleteLevel')} className="hidden text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)] sm:inline-flex"><Trash2 aria-hidden="true" /></Button>
                  </li>
                ))}
              </ol>
              <Button variant="outline" size="sm" type="button" className="w-full border-dashed" onClick={() => append({ id: undefined, name: t('ScoringSections.newLevel'), value: 0, position: fields.length + 1, scorePercent: 0, color: '#3b82f6' })}>
                <Plus aria-hidden="true" /> {t('ScoringSections.addLevel')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-[var(--color-border)]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th scope="col" className="w-16 px-4 py-2.5 text-left text-eyebrow">{t('ScoringSections.position2')}</th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{t('ScoringSections.levelName')}</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">{t('ScoringSections.value2')}</th>
                    {org?.enableBsc && <th scope="col" className="px-4 py-2.5 text-right text-eyebrow" title={t('ScoringSections.convertedToCompletionWhenComputingThe')}>% BSC</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {fields.map((field, index) => (
                    <tr key={field.id}>
                      <td className="px-4 py-2.5 text-sm tabular-nums text-[var(--color-muted-foreground)]">{watchedLevels[index]?.position}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-foreground)]">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: watchedLevels[index]?.color || '#cbd5e1' }} aria-hidden="true" />
                          {watchedLevels[index]?.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--color-foreground)]">{watchedLevels[index]?.value}</td>
                      {org?.enableBsc && <td className="px-4 py-2.5 text-right text-sm tabular-nums text-[var(--color-muted-foreground)]">{watchedLevels[index]?.scorePercent ?? 0}%</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isEditing && (
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <Button variant="outline" type="button" onClick={() => { setIsEditing(false); reset() }} disabled={updateMutation.isPending}>{t('ScoringSections.cancel')}</Button>
              <Button onClick={handleSubmit(handleSave, toastFirstError)} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {t('ScoringSections.saveSettings')}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

const DEFAULT_PERFORMANCE_MATRIX = perLanguage((): PerformanceMatrix => ({
  rowHeader: i18n.t('orgunits:ScoringSections.conductScore'),
  colHeader: i18n.t('orgunits:ScoringSections.kpiCompletion'),
  rows: ['<2', i18n.t('orgunits:ScoringSections.n2And3'), i18n.t('orgunits:ScoringSections.n3And35'), i18n.t('orgunits:ScoringSections.n35And45'), i18n.t('orgunits:ScoringSections.n45And5')],
  cols: ['< 70%', i18n.t('orgunits:ScoringSections.n70And90'), i18n.t('orgunits:ScoringSections.n90And110'), i18n.t('orgunits:ScoringSections.n110And120'), '≥120%'],
  cells: [
    [1, 1, 1, 2, 2],
    [1, 2, 2, 3, 3],
    [2, 2, 3, 4, 4],
    [2, 3, 3, 4, 5],
    [2, 3, 4, 4, 5],
  ],
}))

const cellColor = (v: number) => {
  const map: Record<number, string> = {
    1: 'bg-[var(--color-error-bg)] text-[var(--color-error)] dark:bg-[var(--color-error-bg)]',
    2: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]',
    3: 'bg-[var(--color-info-bg)] text-[var(--color-info)] dark:bg-[var(--color-info-bg)]',
    4: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    5: 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]',
  }
  return map[v] || 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
}

function parseMatrix(raw?: string): PerformanceMatrix {
  if (!raw) return DEFAULT_PERFORMANCE_MATRIX()
  try {
    const m = JSON.parse(raw)
    if (Array.isArray(m?.rows) && Array.isArray(m?.cols) && Array.isArray(m?.cells)) return m
  } catch {
    /* fall through to default */
  }
  return DEFAULT_PERFORMANCE_MATRIX()
}

export function PerformanceMatrixSection({ org }: { org: any }) {
  const { t } = useTranslation('orgunits')
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [matrix, setMatrix] = useState<PerformanceMatrix>(() => parseMatrix(org?.performanceMatrix))

  useEffect(() => {
    setMatrix(parseMatrix(org?.performanceMatrix))
  }, [org])

  const clone = (m: PerformanceMatrix): PerformanceMatrix => JSON.parse(JSON.stringify(m))

  const setCell = (r: number, c: number, value: string) => {
    const next = clone(matrix)
    if (!next.cells[r]) return
    next.cells[r][c] = value === '' ? 0 : Number(value)
    setMatrix(next)
  }
  const setRowHeader = (r: number, value: string) => {
    const next = clone(matrix)
    next.rows[r] = value
    setMatrix(next)
  }
  const setColHeader = (c: number, value: string) => {
    const next = clone(matrix)
    next.cols[c] = value
    setMatrix(next)
  }
  const addRow = () => {
    const next = clone(matrix)
    next.rows.push(t('ScoringSections.newBand'))
    next.cells.push(next.cols.map(() => 1))
    setMatrix(next)
  }
  const removeRow = (r: number) => {
    if (matrix.rows.length <= 1) return
    const next = clone(matrix)
    next.rows.splice(r, 1)
    next.cells.splice(r, 1)
    setMatrix(next)
  }
  const addCol = () => {
    const next = clone(matrix)
    next.cols.push(t('ScoringSections.newBand'))
    next.cells.forEach(row => row.push(1))
    setMatrix(next)
  }
  const removeCol = (c: number) => {
    if (matrix.cols.length <= 1) return
    const next = clone(matrix)
    next.cols.splice(c, 1)
    next.cells.forEach(row => row.splice(c, 1))
    setMatrix(next)
  }

  const handleSave = () => {
    const cleaned: PerformanceMatrix = {
      ...matrix,
      rowHeader: matrix.rowHeader?.trim(),
      colHeader: matrix.colHeader?.trim(),
      rows: matrix.rows.map(h => h.trim()),
      cols: matrix.cols.map(h => h.trim()),
    }
    if (!cleaned.rows.length || !cleaned.cols.length) {
      toast.error(t('ScoringSections.theMatrixNeedsAtLeast1'))
      return
    }
    if (cleaned.rows.some(h => !h) || cleaned.cols.some(h => !h)) {
      toast.error(t('ScoringSections.rowColumnLabelsCannotBeEmpty'))
      return
    }
    if (new Set(cleaned.rows).size !== cleaned.rows.length) {
      toast.error(t('ScoringSections.rowLabelsCannotRepeat'))
      return
    }
    if (new Set(cleaned.cols).size !== cleaned.cols.length) {
      toast.error(t('ScoringSections.columnLabelsCannotRepeat'))
      return
    }
    const hasInvalidCell = cleaned.cells.some(row => row.some(v => !Number.isInteger(v) || v < 1))
    if (hasInvalidCell) {
      toast.error(t('ScoringSections.cellValuesMustBeIntegersGreater'))
      return
    }
    updateMutation.mutate(
      { performanceMatrix: JSON.stringify(cleaned) },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('ScoringSections.ratingMatrixUpdatedSuccessfully'))
        },
        onError: (error) => toast.error(getApiErrorMessage(error, t('ScoringSections.couldNotUpdateTheRatingMatrix'))),
      }
    )
  }

  const handleCancel = () => {
    setMatrix(parseMatrix(org?.performanceMatrix))
    setIsEditing(false)
  }

  const handleResetToDefault = () => {
    updateMutation.mutate(
      { performanceMatrix: JSON.stringify(DEFAULT_PERFORMANCE_MATRIX()) },
      {
        onSuccess: () => {
          setMatrix(DEFAULT_PERFORMANCE_MATRIX())
          setIsEditing(false)
          toast.success(t('ScoringSections.resetToTheDefaultMatrix'))
        },
        onError: (error) => toast.error(getApiErrorMessage(error, t('ScoringSections.couldNotResetTheRatingMatrix'))),
      }
    )
  }

  const inputCls = 'h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] text-center'

  return (
    <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div id="tour-matrix-header" className="flex flex-col gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-section-title">{t('ScoringSections.ratingMatrix')}</h3>
          <p {...tourAnchor('matrix.guide')} id="tour-matrix-guide" className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
            {t('ScoringSections.maps')} <b className="font-medium text-[var(--color-foreground)]">{t('ScoringSections.conductScore2')}</b> {t('ScoringSections.rowsAnd')} <b className="font-medium text-[var(--color-foreground)]">{t('ScoringSections.kpiCompletion2')}</b> {t('ScoringSections.columnsToTheFinalRatingLevel')}
          </p>
        </div>
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-2">
            <Button {...tourAnchor('matrix.reset')} variant="outline" size="icon" aria-label={t('ScoringSections.resetToDefault')} onClick={handleResetToDefault} title={t('ScoringSections.resetToDefault')}>
              <RotateCcw aria-hidden="true" />
            </Button>
            <Button {...tourAnchor('matrix.edit')} variant="outline" onClick={() => setIsEditing(true)}>
              <Edit3 aria-hidden="true" /> {t('ScoringSections.edit')}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 p-5">
        {isEditing && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-label mb-1 block">{t('ScoringSections.rowAxisName')}</label>
              <input value={matrix.rowHeader || ''} onChange={e => setMatrix({ ...clone(matrix), rowHeader: e.target.value })} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]" />
            </div>
            <div>
              <label className="text-label mb-1 block">{t('ScoringSections.columnAxisName')}</label>
              <input value={matrix.colHeader || ''} onChange={e => setMatrix({ ...clone(matrix), colHeader: e.target.value })} className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]" />
            </div>
          </div>
        )}

        {!isEditing && (
          <p className="sm:hidden text-caption flex items-center gap-1 px-1">
            <ArrowRight size={12} className="animate-pulse" /> {t('ScoringSections.swipeHorizontallyToSeeTheWhole')}
          </p>
        )}

        <div {...tourAnchor('matrix.table')} id="tour-matrix-table" className="overflow-x-auto -mx-2 px-2">
          <table className="border-separate border-spacing-1 min-w-full">
            <thead>
              <tr>
                <th className="p-2 min-w-[88px] sm:min-w-[120px] text-left align-bottom sticky left-0 z-20 bg-[var(--color-card)]">
                  <span className="text-eyebrow leading-tight block">
                    {matrix.rowHeader} ↓
                  </span>
                  <span className="text-eyebrow leading-tight block">
                    {matrix.colHeader} →
                  </span>
                </th>
                {matrix.cols.map((col, ci) => (
                  <th key={ci} className="p-1 min-w-[76px] sm:min-w-[110px]">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <input value={col} onChange={e => setColHeader(ci, e.target.value)} className={inputCls} />
                        <Button variant="ghost" size="icon-sm" className="self-center text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={t('ScoringSections.deleteColumn')} type="button" onClick={() => removeCol(ci)} disabled={matrix.cols.length <= 1} title={t('ScoringSections.deleteColumn')}>
                          <X aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <div className="px-1.5 sm:px-2 py-2 rounded-control bg-[var(--color-muted)] text-xs sm:text-xs font-medium text-[var(--color-foreground)] text-center">
                        {col}
                      </div>
                    )}
                  </th>
                ))}
                {isEditing && (
                  <th className="p-1 align-top">
                    <Button variant="ghost" size="sm" className="whitespace-nowrap" type="button" onClick={addCol}>
                      <Plus aria-hidden="true" /> {t('ScoringSections.theColumn')}
                    </Button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row, ri) => (
                <tr key={ri}>
                  <th className="p-1 min-w-[88px] sm:min-w-[120px] sticky left-0 z-10 bg-[var(--color-card)]">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input value={row} onChange={e => setRowHeader(ri, e.target.value)} className={inputCls + ' text-left'} />
                        <Button variant="ghost" size="icon-sm" className="shrink-0 text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={t('ScoringSections.deleteRow')} type="button" onClick={() => removeRow(ri)} disabled={matrix.rows.length <= 1} title={t('ScoringSections.deleteRow')}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <div className="px-2 py-2 rounded-control bg-[var(--color-muted)] text-xs sm:text-xs font-medium text-[var(--color-foreground)] text-left">
                        {row}
                      </div>
                    )}
                  </th>
                  {matrix.cols.map((_, ci) => {
                    const val = matrix.cells[ri]?.[ci] ?? 0
                    return (
                      <td key={ci} className="p-1">
                        {isEditing ? (
                          <LocaleNumberInput
                            type="number"
                            value={matrix.cells[ri]?.[ci] ?? 0}
                            onChange={e => setCell(ri, ci, e.target.value)}
                            onWheel={e => (e.target as HTMLInputElement).blur()}
                            className={inputCls}
                          />
                        ) : (
                          <div className={cn('py-2 sm:py-2.5 rounded-control text-xs sm:text-sm font-semibold text-center', cellColor(val))}>
                            {val}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  {isEditing && <td />}
                </tr>
              ))}
              {isEditing && (
                <tr>
                  <td className="p-1">
                    <Button variant="ghost" size="sm" className="whitespace-nowrap" type="button" onClick={addRow}>
                      <Plus aria-hidden="true" /> {t('ScoringSections.row')}
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isEditing && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button variant="outline" type="button" onClick={handleCancel} disabled={updateMutation.isPending}>{t('ScoringSections.cancel')}</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('ScoringSections.saveMatrix')}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
