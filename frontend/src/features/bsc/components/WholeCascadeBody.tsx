import { LocaleNumberInput } from '@/components/ui/number-input'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import { useWholeCascade } from '../hooks/useBscCascade'
import { type ScorecardResponse, type WholeCascadeRequest } from '../types'

interface UnitOption { id: string; name: string; level: number }

/** Tóm tắt lựa chọn để modal cha ghi nút lưu giống bên giao từng chỉ tiêu ("Phân rã cho 3 đơn vị"). */
export interface WholeCascadeSummary { selected: number; hasAssigned: boolean }

interface Props {
  scorecard: ScorecardResponse
  /** Đơn vị được phép nhận (đã lọc chỉ cấp dưới của thẻ) — dùng chung luật với giao từng chỉ tiêu. */
  units: UnitOption[]
  ownUnitIds: Set<string>
  formId: string
  onSubmit: (data: WholeCascadeRequest) => void
  onSummary?: (s: WholeCascadeSummary) => void
}

interface Draft { selected: boolean; weight: string }

/**
 * Giao CẢ BỘ tiêu chí: mỗi đơn vị nhận TOÀN BỘ chỉ tiêu của thẻ này (dòng khoá, cùng chịu chung). Trọng
 * số X% đặt ở đây được chia cho các chỉ tiêu theo tỉ lệ của thẻ này; (100 − X)% còn lại là hạng mục riêng
 * của đơn vị. Thẻ này tự ra số: mỗi chỉ tiêu = trung bình % đạt của các đơn vị nhận.
 *
 * Bố cục cố ý giống phần giao từng chỉ tiêu (khung thẻ, "Cách tính" lên đầu, thanh trạng thái, bảng
 * đơn vị cùng cột) để hai tab đọc như hai cách của cùng một việc, không phải hai màn khác nhau.
 *
 * Bỏ tick một đơn vị ĐÃ nhận là thu hồi: dòng bị gỡ khỏi thẻ của họ khi lưu.
 */
export default function WholeCascadeBody({ scorecard, units, ownUnitIds, formId, onSubmit, onSummary }: Props) {
  const { t } = useTranslation('bsc')
  const { data: current } = useWholeCascade(scorecard.id)
  // Bộ chỉ tiêu sẽ đưa xuống (bỏ dòng "Kết quả cấp trên" kiểu cũ nếu thẻ này còn).
  const items = scorecard.perspectives.filter(p => !p.sourceScorecardId)
  const itemsTotal = items.reduce((sum, p) => sum + (p.weightPercentage ?? 0), 0)
  /** CHỈ chứa thay đổi người dùng vừa làm; phần đã giao đọc thẳng từ server (xem rowOf). */
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [bulkWeight, setBulkWeight] = useState('')

  const assigned = useMemo(() => {
    const map = new Map<string, { weight: number; total: number }>()
    for (const r of current?.recipients ?? []) {
      if (r.orgUnitId) map.set(r.orgUnitId, { weight: r.weightPercentage ?? 0, total: r.scorecardTotalWeight ?? 0 })
    }
    return map
  }, [current])

  const rowOf = (u: UnitOption): Draft => {
    const d = drafts[u.id]
    if (d) return d
    const prev = assigned.get(u.id)
    return prev ? { selected: true, weight: String(prev.weight) } : { selected: false, weight: '' }
  }
  const patch = (u: UnitOption, next: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [u.id]: { ...rowOf(u), ...next } }))

  const selectable = units.filter(u => !ownUnitIds.has(u.id))
  const selected = selectable.filter(u => rowOf(u).selected)
  const revoking = selectable.filter(u => assigned.has(u.id) && !rowOf(u).selected)
  const missingWeight = selected.filter(u => {
    const w = rowOf(u).weight
    return w.trim() === '' || !(Number(w) > 0 && Number(w) <= 100)
  })

  const selectedCount = selected.length
  const hasAssigned = assigned.size > 0
  useEffect(() => { onSummary?.({ selected: selectedCount, hasAssigned }) }, [onSummary, selectedCount, hasAssigned])

  const applyBulk = () => {
    const w = bulkWeight.trim()
    if (w === '') return
    setDrafts(prev => {
      const next = { ...prev }
      for (const u of selected) next[u.id] = { ...rowOf(u), weight: w }
      return next
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // Trọng số do CẤP TRÊN đặt và bị khoá ở phía đơn vị — để trống hay ngoài (0, 100] là đẩy
    // đơn vị vào ngõ cụt: họ không sửa được mà tổng không bao giờ đủ 100% để trình.
    if (missingWeight.length > 0) {
      toast.error(t('WholeCascadeBody.weightRangeFor', { units: missingWeight.map(u => u.name).join(', ') }))
      return
    }
    if (selected.length === 0 && revoking.length === 0) {
      toast.error(t('WholeCascadeBody.chooseAtLeastOneUnit'))
      return
    }
    onSubmit({
      targets: selected.map(u => ({ orgUnitId: u.id, weightPercentage: Number(rowOf(u).weight) })),
      revokeOrgUnitIds: revoking.map(u => u.id),
    })
  }

  const ready = selected.length > 0 && missingWeight.length === 0

  return (
    <form id={formId} onSubmit={submit} className="space-y-3 rounded-card border border-[var(--color-border)] p-3">
      {/* Cách tính lên ĐẦU như bên giao từng chỉ tiêu — trước đây nằm tận cuối, người dùng điền xong
          mới đọc được dòng này sẽ ra điểm thế nào. */}
      <div className="space-y-1.5">
        <label className="text-label">{t('WholeCascadeBody.method')}</label>
        <div className="flex items-start gap-2 rounded-card bg-[var(--color-muted)] px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{t('WholeCascadeBody.methodHint', { name: scorecard.name })}</span>
        </div>
      </div>

      {/* Đơn vị sẽ nhận đúng các chỉ tiêu này — nói ra trước khi chọn đơn vị. */}
      <div className="space-y-1.5">
        <label className="text-label">{t('WholeCascadeBody.itemsToGive', { count: items.length })}</label>
        {items.length === 0 ? (
          <p className="text-caption text-[var(--color-warning)]">{t('WholeCascadeBody.noItemsToGive')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map(p => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-control bg-[var(--color-muted)] px-2 py-1 text-xs font-medium text-[var(--color-foreground)]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                {p.name}
                <span className="tabular-nums text-[var(--color-muted-foreground)]">{Math.round((p.weightPercentage ?? 0) * 10) / 10}%</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Thanh trạng thái cùng chỗ, cùng kiểu với "Đã phân bổ … / Chia đều" bên giao từng chỉ tiêu. */}
      <div className={cn('rounded-card px-4 py-2.5 text-xs font-medium flex flex-wrap items-center gap-2',
        ready ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]')}>
        {ready ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
        <span>
          {selected.length === 0
            ? t('WholeCascadeBody.noneSelected')
            : t('WholeCascadeBody.nSelected', { count: selected.length })}
          {missingWeight.length > 0 && <> · {t('WholeCascadeBody.nMissingWeight', { count: missingWeight.length })}</>}
        </span>
        {selected.length > 1 && (
          <span className="ml-auto flex items-center gap-1.5 text-[var(--color-foreground)]">
            <span className="font-normal">{t('WholeCascadeBody.sameWeightForAll')}</span>
            <LocaleNumberInput type="number" step="0.1" min={0} max={100} value={bulkWeight}
              onChange={e => setBulkWeight(e.target.value)} placeholder="%"
              aria-label={t('WholeCascadeBody.sameWeightForAll')}
              className="w-16 px-2 py-1.5 rounded-control bg-[var(--color-card)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent" />
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={applyBulk} disabled={bulkWeight.trim() === ''}>
              {t('WholeCascadeBody.apply')}
            </Button>
          </span>
        )}
      </div>

      <div className="rounded-card border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-[40vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-muted)] sticky top-0 z-10">
          <span className="w-8 shrink-0" />
          <span className="text-eyebrow flex-1">{t('CascadeModal.unit2')}</span>
          <span className="text-eyebrow w-20 text-right whitespace-nowrap">{t('CascadeModal.weight')}</span>
        </div>
        {selectable.length === 0 && (
          <div className="px-4 py-6 text-center text-caption">{t('CascadeModal.thisUnitHasNoLowerUnits')}</div>
        )}
        {selectable.map(u => {
          const r = rowOf(u)
          const prev = assigned.get(u.id)
          // Tổng thẻ con đang lệch 100% ⇒ đơn vị phải chia lại trước khi trình; nói luôn ở đây.
          const offTotal = prev && Math.abs(prev.total - 100) > 0.01
          return (
            <div key={u.id} className="flex items-center gap-2 px-3 py-2">
              <ChoiceChip selected={r.selected} variant="check"
                aria-label={u.name} onClick={() => patch(u, { selected: !r.selected })} />
              <span className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5" style={{ paddingLeft: u.level * 12 }}>
                <span className="truncate text-sm font-medium text-[var(--color-foreground)]">{u.name}</span>
                {prev && r.selected && (
                  <span className="shrink-0 rounded-control bg-[var(--color-muted)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-muted-foreground)]">
                    {t('WholeCascadeBody.assignedBadge')}
                  </span>
                )}
                {prev && !r.selected && (
                  <span className="shrink-0 text-caption text-[var(--color-warning)]">{t('WholeCascadeBody.willBeRevoked')}</span>
                )}
                {prev && r.selected && offTotal && (
                  <span className="shrink-0 text-caption text-[var(--color-warning)]">
                    {t('WholeCascadeBody.cardTotal', { value: Math.round(prev.total * 10) / 10 })}
                  </span>
                )}
                {/* Xem trước điểm của đơn vị sẽ được tính thế nào với trọng số đang gõ. */}
                {r.selected && Number(r.weight) > 0 && Number(r.weight) <= 100 && (
                  <span className="w-full text-caption" title={items.map(p =>
                    `${p.name}: ${itemsTotal > 0 ? Math.round((p.weightPercentage ?? 0) / itemsTotal * Number(r.weight) * 100) / 100 : 0}%`).join(' · ')}>
                    {t('WholeCascadeBody.unitPreview', {
                      count: items.length,
                      weight: Math.round(Number(r.weight) * 10) / 10,
                      rest: Math.round((100 - Number(r.weight)) * 10) / 10,
                    })}
                  </span>
                )}
              </span>
              {r.selected && (
                <LocaleNumberInput type="number" step="0.1" min={0} max={100} value={r.weight}
                  onChange={e => patch(u, { weight: e.target.value })}
                  placeholder="0"
                  aria-label={t('CascadeModal.weight')}
                  className="w-20 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent" />
              )}
            </div>
          )
        })}
      </div>

      {revoking.length > 0 && (
        <div className="rounded-card px-4 py-3 text-xs font-medium flex items-start gap-2 bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t('WholeCascadeBody.revokeNotice', { units: revoking.map(u => u.name).join(', ') })}
        </div>
      )}
    </form>
  )
}
