import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Controller, type UseFormReturn, type FieldValues, type Path } from 'react-hook-form'
import { AlertTriangle, BarChart3, LayoutGrid, SlidersHorizontal, Target, Unlink } from 'lucide-react'
import { FREQUENCY_MAP, cn, formatDateTime, formatNumber } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { Section } from '@/components/common/ScoreForm'
import { useFixedPerspectives } from '@/features/bsc/hooks/useBsc'
import type { ScorecardPerspectiveResponse } from '@/features/bsc/types'
import { Field, Hint, SourceCard, Stat, ToggleCard } from './KpiFormParts'
import type { NewKpiFields } from '../schemas/urgentTaskSchema'
import { useTranslation } from 'react-i18next'

type Source = 'FREE' | 'BSC' | 'OKR'

const frequencyOptions = (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'] as const)

export interface UrgentKpiContext {
  period?: { id: string; name: string; startDate: string | null; endDate: string | null }
  enableOkr: boolean
  enableQualitative: boolean
  enableBsc: boolean
  /** Mục tiêu OKR của đơn vị đang chọn. */
  objectives: any[]
  perspectives: any[]
  /** Hạng mục CÓ trong bộ tiêu chí của đơn vị (null = không lọc). */
  availablePerspectiveIds?: Set<string> | null
  /** Dòng phụ "MT … · sàn … · …%" của từng hạng mục. */
  perspectiveHints?: Map<string, string | null>
  /** Dòng của bộ tiêu chí hiệu lực — nguồn số để điền sẵn. */
  scorecardRows?: ScorecardPerspectiveResponse[]
  /** Tên bộ tiêu chí hiệu lực, hiện trên thẻ nguồn. */
  scorecardName?: string | null
}

/**
 * Khối "② Nguồn chỉ tiêu → ③ Nội dung" của KPI MỚI trong việc khẩn — cùng thứ tự và cùng luật
 * điền sẵn / cảnh báo với form tạo chỉ tiêu, để hai chỗ tạo KPI không hai kiểu.
 *
 * Nhận cả `form` (react-hook-form) của tab bọc ngoài vì các trường KPI mới nằm chung form với
 * phần riêng của tab (KPI cần thay thế / bảng trọng số). Kiểu `Path<T>` để tên trường vẫn
 * được kiểm tra dù form của hai tab khác nhau.
 */
export function UrgentKpiFields<T extends NewKpiFields & FieldValues>({
  form, ctx, weightSlot, contextSlot,
}: {
  form: UseFormReturn<T>
  ctx: UrgentKpiContext
  /** Ô trọng số của tab Điều chỉnh (tab Thay thế kế thừa trọng số nên không có). */
  weightSlot?: ReactNode
  /** Phần bối cảnh riêng của tab (KPI cần thay thế / bảng trọng số), vẽ dưới tần suất + hạn chót. */
  contextSlot?: ReactNode
}) {
  const { t: tr } = useTranslation('kpi')
  const { register, watch, setValue, getValues, control, formState: { errors } } = form
  const f = (name: keyof NewKpiFields) => name as Path<T>
  const err = (name: keyof NewKpiFields) => (errors as any)?.[name]?.message as string | undefined

  const kpiType = watch(f('kpiType')) as NewKpiFields['kpiType']
  const isQual = kpiType === 'QUALITATIVE'
  const isReverse = !!watch(f('isReverseKpi'))
  const isBonus = !!watch(f('isBonusKpi'))
  const keyResultId = watch(f('keyResultId')) as string
  const perspectiveId = watch(f('perspectiveId')) as string
  const unit = (watch(f('unit')) as string) || ''
  const targetStr = watch(f('targetValue')) as string

  const [source, setSource] = useState<Source>('FREE')
  const prefilledRef = useRef<Partial<Record<'name' | 'unit' | 'targetValue' | 'minimumValue', unknown>>>({})

  const { data: fixedPerspectives } = useFixedPerspectives()
  const grouped = useMemo(() => {
    const order = (fixedPerspectives || []).map((fp: any) => fp.code)
    const nameByCode = new Map((fixedPerspectives || []).map((fp: any) => [fp.code, fp.name]))
    const list = ctx.availablePerspectiveIds
      ? (ctx.perspectives || []).filter((p: any) => ctx.availablePerspectiveIds!.has(p.id))
      : (ctx.perspectives || [])
    const groups = list.reduce((acc: any, p: any) => {
      const key = p.fixedPerspective || 'INTERNAL_PROCESS'
      ;(acc[key] = acc[key] || []).push(p)
      return acc
    }, {} as Record<string, any[]>)
    const keys = order.length ? order.filter((k: string) => groups[k]) : Object.keys(groups)
    return keys.map((k: string) => ({ code: k, name: nameByCode.get(k) || k, items: groups[k] as any[] }))
  }, [ctx.perspectives, fixedPerspectives, ctx.availablePerspectiveIds])

  const selectedPerspective = useMemo(
    () => (ctx.perspectives || []).find((p: any) => p.id === perspectiveId) ?? null,
    [ctx.perspectives, perspectiveId],
  )
  const selectedRow = useMemo(
    () => (ctx.scorecardRows || []).find(r => r.perspectiveId === perspectiveId) ?? null,
    [ctx.scorecardRows, perspectiveId],
  )
  const selectedKr = useMemo(() => {
    if (!keyResultId || keyResultId === 'NONE') return null
    for (const obj of ctx.objectives || []) {
      const kr = obj.keyResults?.find((k: any) => k.id === keyResultId)
      if (kr) return { kr, obj }
    }
    return null
  }, [keyResultId, ctx.objectives])

  // Điền sẵn: chỉ ghi đè ô trống hoặc ô còn giữ đúng giá trị lần điền trước.
  const prefill = (name: keyof typeof prefilledRef.current, value: string) => {
    const current = getValues(f(name)) as unknown
    if (current !== '' && current != null && current !== prefilledRef.current[name]) return
    setValue(f(name), value as any, { shouldValidate: true, shouldDirty: true })
    prefilledRef.current[name] = value
  }

  useEffect(() => {
    if (source !== 'BSC' || !selectedRow || isQual) return
    if (selectedRow.unit) prefill('unit', selectedRow.unit)
    if (selectedRow.targetValue != null) prefill('targetValue', String(selectedRow.targetValue))
    if (selectedRow.minimumValue != null) prefill('minimumValue', String(selectedRow.minimumValue))
    if (selectedPerspective?.name) prefill('name', ctx.period ? `${selectedPerspective.name} — ${ctx.period.name}` : selectedPerspective.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, selectedRow?.id, isQual])

  useEffect(() => {
    if (source !== 'OKR' || !selectedKr || isQual) return
    const { kr } = selectedKr
    if (kr.unit) prefill('unit', kr.unit)
    if (kr.targetValue != null) {
      const remaining = kr.targetValue - (kr.currentValue ?? 0)
      prefill('targetValue', String(remaining > 0 ? Math.round(remaining * 100) / 100 : kr.targetValue))
    }
    if (kr.name) prefill('name', kr.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, selectedKr?.kr?.id, isQual])

  const changeSource = (next: Source) => {
    setSource(next)
    if (next !== 'BSC') setValue(f('perspectiveId'), 'NONE' as any)
    if (next !== 'OKR') setValue(f('keyResultId'), 'NONE' as any)
    if (next === 'FREE') prefilledRef.current = {}
  }

  const warnings = useMemo(() => {
    const out: string[] = []
    if (isQual) return out
    const t = targetStr?.trim() ? Number(targetStr) : null
    if (source === 'BSC' && selectedRow) {
      if (t != null && selectedRow.targetValue != null && t > selectedRow.targetValue + 0.001) {
        out.push(tr('UrgentKpiFields.targetExceedsTheTargetOfItem', { t: formatNumber(t), name: selectedPerspective?.name, targetValue: formatNumber(selectedRow.targetValue), value: selectedRow.unit ? ` ${selectedRow.unit}` : '' }))
      }
      if (selectedRow.unit && unit && unit.trim().toLowerCase() !== selectedRow.unit.trim().toLowerCase()) {
        out.push(tr('UrgentKpiFields.unitOfMeasureDiffersFromThe', { unit, unit2: selectedRow.unit }))
      }
    }
    if (source === 'OKR' && selectedKr) {
      const { kr } = selectedKr
      if (t != null && kr.targetValue != null && t > kr.targetValue + 0.001) {
        out.push(tr('UrgentKpiFields.targetExceedsTheTargetOfKr', { t: formatNumber(t), name: kr.name, targetValue: formatNumber(kr.targetValue), value: kr.unit ? ` ${kr.unit}` : '' }))
      }
      if (kr.unit && unit && unit.trim().toLowerCase() !== kr.unit.trim().toLowerCase()) {
        out.push(tr('UrgentKpiFields.unitOfMeasureDiffersFromThe2', { unit, unit2: kr.unit }))
      }
    }
    return out
  }, [isQual, targetStr, source, selectedRow, selectedPerspective, selectedKr, unit, tr])

  const canPickSource = ctx.enableBsc || ctx.enableOkr
  const targetLabel = isReverse ? tr('UrgentKpiFields.targetThresholdLowerIsBetter') : tr('UrgentKpiFields.desiredTarget')
  const minLabel = isReverse ? tr('UrgentKpiFields.maximumAcceptableThreshold') : tr('UrgentKpiFields.minimumTarget')

  return (
    <>
      {/* ── ① phần chung của bối cảnh: tần suất, hạn chót, rồi phần riêng của tab ── */}
      <Section title={tr('UrgentKpiFields.context')} hint={tr('UrgentKpiFields.theCycleAndUnitChosenAbove')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr('UrgentKpiFields.closingFrequency')} required>
            <Controller name={f('frequency')} control={control} render={({ field }) => (
              <Select value={(field.value as string) || ''} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder={tr('UrgentKpiFields.chooseFrequency')} /></SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map(v => <SelectItem key={v} value={v}>{FREQUENCY_MAP()[v]}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </Field>
          <Field label={tr('UrgentKpiFields.deadline')} hint={ctx.period ? tr('UrgentKpiFields.emptyEndOfPeriod', { endDate: formatDateTime(ctx.period.endDate) }) : undefined}>
            <Controller name={f('deadline')} control={control} render={({ field }) => (
              <DateTimePicker value={(field.value as string) || ''} onChange={field.onChange} placeholder={tr('UrgentKpiFields.defaultFromThePeriod')} className={cn(!ctx.period && 'pointer-events-none opacity-50')} />
            )} />
          </Field>
        </div>
        {contextSlot}
      </Section>

      {/* ── ② Nguồn ── */}
      {canPickSource && (
        <Section title={tr('UrgentKpiFields.kpiSource')} hint={tr('UrgentKpiFields.chooseTheSourceFirstTargetAnd')}>
          <div className="flex flex-wrap gap-2">
            <ChoiceChip selected={source === 'FREE'} onClick={() => changeSource('FREE')}><Unlink /> {tr('UrgentKpiFields.freeForm')}</ChoiceChip>
            {ctx.enableBsc && <ChoiceChip selected={source === 'BSC'} onClick={() => changeSource('BSC')}><LayoutGrid /> {tr('UrgentKpiFields.bscItem')}</ChoiceChip>}
            {ctx.enableOkr && <ChoiceChip selected={source === 'OKR'} onClick={() => changeSource('OKR')}><Target /> {tr('UrgentKpiFields.keyResultOkr')}</ChoiceChip>}
          </div>

          {source === 'BSC' && (
            <div className="space-y-3">
              <Controller name={f('perspectiveId')} control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={(field.value as string) || 'NONE'}>
                  <SelectTrigger><SelectValue placeholder={tr('UrgentKpiFields.chooseItem')} /></SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="NONE">{tr('UrgentKpiFields.noItemChosen')}</SelectItem>
                    {grouped.map(group => (
                      <SelectGroup key={group.code}>
                        <SelectLabel>{group.name}</SelectLabel>
                        {group.items.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}
                            extra={ctx.perspectiveHints?.get(p.id) && <span className="ml-auto pl-3 text-caption whitespace-nowrap">{ctx.perspectiveHints.get(p.id)}</span>}>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color || '#94a3b8' }} />
                              <span className="truncate">{p.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {!!ctx.availablePerspectiveIds && grouped.length === 0 && (
                <Hint tone="warning">{tr('UrgentKpiFields.thisUnitsScorecard')} <b>{tr('UrgentKpiFields.hasNoItemsYet')}</b> {tr('UrgentKpiFields.orThePeriodHasNoScorecard')}</Hint>
              )}
              {selectedRow && selectedPerspective && (
                <SourceCard color={selectedPerspective.color || '#94a3b8'} title={selectedPerspective.name} subtitle={ctx.scorecardName}>
                  <Stat label={tr('UrgentKpiFields.itemTarget')} value={selectedRow.targetValue != null ? `${formatNumber(selectedRow.targetValue)}${selectedRow.unit ? ` ${selectedRow.unit}` : ''}` : '—'} />
                  <Stat label={tr('UrgentKpiFields.minimum')} value={selectedRow.minimumValue != null ? formatNumber(selectedRow.minimumValue) : '—'} />
                  <Stat label={tr('UrgentKpiFields.itemWeight')} value={`${selectedRow.weightPercentage}%`} hint={tr('UrgentKpiFields.n100KpiFullItem')} />
                </SourceCard>
              )}
            </div>
          )}

          {source === 'OKR' && (
            <div className="space-y-3">
              <Controller name={f('keyResultId')} control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} value={(field.value as string) || 'NONE'}>
                  <SelectTrigger><SelectValue placeholder={tr('UrgentKpiFields.chooseKeyResult')} /></SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="NONE">{tr('UrgentKpiFields.noKrChosen')}</SelectItem>
                    {(ctx.objectives || []).map((obj: any) => (
                      <SelectGroup key={obj.id}>
                        <SelectLabel className="flex items-center justify-between gap-2"><span>OBJ: {obj.name}</span><Badge variant="outline">OKR</Badge></SelectLabel>
                        {obj.keyResults.map((kr: any) => (
                          <SelectItem key={kr.id} value={kr.id}
                            extra={kr.targetValue != null && <span className="ml-auto pl-3 text-caption whitespace-nowrap">{formatNumber(kr.targetValue)}{kr.unit ? ` ${kr.unit}` : ''}</span>}>
                            <span className="truncate" title={kr.name}>{kr.name}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )} />
              {(ctx.objectives || []).length === 0 && <Hint tone="warning">{tr('UrgentKpiFields.thisUnitHasNoOkrObjectives')}</Hint>}
              {selectedKr && (
                <SourceCard color={selectedKr.obj.perspectiveColor || '#8b5cf6'} title={selectedKr.kr.name} subtitle={`OBJ: ${selectedKr.obj.name}`}>
                  <Stat label={tr('UrgentKpiFields.krTarget')} value={selectedKr.kr.targetValue != null ? `${formatNumber(selectedKr.kr.targetValue)}${selectedKr.kr.unit ? ` ${selectedKr.kr.unit}` : ''}` : '—'} />
                  <Stat label={tr('UrgentKpiFields.achieved')} value={selectedKr.kr.currentValue != null ? `${formatNumber(selectedKr.kr.currentValue)} (${Math.round(selectedKr.kr.progress ?? 0)}%)` : '—'} />
                  {selectedKr.obj.perspectiveName && <Stat label={tr('UrgentKpiFields.inheritedBscItem')} value={selectedKr.obj.perspectiveName} />}
                </SourceCard>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── ③ Nội dung ── */}
      <Section title={canPickSource ? tr('UrgentKpiFields.newKpiContent') : tr('UrgentKpiFields.newKpiContent2')} hint={source !== 'FREE' ? tr('UrgentKpiFields.prefilledFromTheSourceEditAnything') : undefined}>
        {ctx.enableQualitative && (
          <Controller name={f('kpiType')} control={control} render={({ field }) => (
            <div className="grid grid-cols-2 gap-1 rounded-control bg-[var(--color-muted)] p-1">
              <ChoiceChip selected={field.value !== 'QUALITATIVE'} variant="segment" className="h-9" onClick={() => field.onChange('QUANTITATIVE')}><BarChart3 /> {tr('UrgentKpiFields.quantitative')}</ChoiceChip>
              <ChoiceChip selected={field.value === 'QUALITATIVE'} variant="segment" className="h-9" onClick={() => field.onChange('QUALITATIVE')}><SlidersHorizontal /> {tr('UrgentKpiFields.qualitative')}</ChoiceChip>
            </div>
          )} />
        )}

        <div className="flex flex-wrap gap-2">
          {!isQual && (
            <Controller name={f('isReverseKpi')} control={control} render={({ field }) => (
              <ToggleCard on={!!field.value} onToggle={() => field.onChange(!field.value)} tone="warning" title={tr('UrgentKpiFields.inverseKpi')} desc={tr('UrgentKpiFields.lowerIsBetterErrorRateCost')} />
            )} />
          )}
          <Controller name={f('isBonusKpi')} control={control} render={({ field }) => (
            <ToggleCard on={!!field.value} onToggle={() => field.onChange(!field.value)} tone="success" title={tr('UrgentKpiFields.bonusKpi')} desc={tr('UrgentKpiFields.optionalNotPartOfThe100')} />
          )} />
        </div>

        <Field label={tr('UrgentKpiFields.newKpiName')} required error={err('name')} prefilled={prefilledRef.current.name !== undefined && watch(f('name')) === prefilledRef.current.name}>
          <Input {...register(f('name'))} invalid={!!err('name')} placeholder={tr('UrgentKpiFields.eGHandleUrgentRequestsIn')} />
        </Field>
        <Field label={tr('UrgentKpiFields.detailedDescription')}>
          <Textarea {...register(f('description'))} rows={2} placeholder={tr('UrgentKpiFields.provideContextAndHowItIs')} />
        </Field>

        {isQual ? (
          <Hint tone="success">{tr('UrgentKpiFields.qualitativeKpisHaveNoNumericTarget')}</Hint>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={targetLabel} required error={err('targetValue')} prefilled={prefilledRef.current.targetValue !== undefined && targetStr === prefilledRef.current.targetValue}>
              <Input {...register(f('targetValue'))} type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()} invalid={!!err('targetValue')} placeholder="1000" suffix={<span className="text-xs">{unit}</span>} />
            </Field>
            <Field label={minLabel} required error={err('minimumValue')}>
              <Input {...register(f('minimumValue'))} type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()} invalid={!!err('minimumValue')} placeholder="800" suffix={<span className="text-xs">{unit}</span>} />
            </Field>
            <Field label={tr('UrgentKpiFields.unitOfMeasure')} required error={err('unit')} prefilled={prefilledRef.current.unit !== undefined && unit === prefilledRef.current.unit}>
              <Input {...register(f('unit'))} invalid={!!err('unit')} placeholder={tr('UrgentKpiFields.vndKpi')} />
            </Field>
          </div>
        )}

        {weightSlot && (
          <div className={cn(isBonus && 'opacity-90')}>
            {weightSlot}
          </div>
        )}

        {warnings.map((w, i) => <Hint key={i} tone="warning" icon={<AlertTriangle size={14} aria-hidden="true" />}>{w}</Hint>)}
      </Section>
    </>
  )
}
