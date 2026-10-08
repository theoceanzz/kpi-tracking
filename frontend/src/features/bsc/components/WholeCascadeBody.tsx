import { LocaleNumberInput } from '@/components/ui/number-input'
import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { useWholeCascade } from '../hooks/useBscCascade'
import { useFixedPerspectives } from '../hooks/useBsc'
import { BscFixedPerspective, type ScorecardResponse, type WholeCascadeRequest } from '../types'

interface UnitOption { id: string; name: string; level: number }

interface Props {
  scorecard: ScorecardResponse
  /** Đơn vị được phép nhận (đã lọc chỉ cấp dưới của thẻ) — dùng chung luật với giao từng chỉ tiêu. */
  units: UnitOption[]
  ownUnitIds: Set<string>
  formId: string
  onSubmit: (data: WholeCascadeRequest) => void
}

interface Draft { selected: boolean; weight: string }

/**
 * Giao CẢ BỘ tiêu chí: mỗi đơn vị nhận MỘT dòng "Kết quả cấp trên" chỉ có trọng số — điểm của
 * dòng đó là kết quả tổng của thẻ này trong cùng đợt. Không có đóng góp, không có loại liên kết.
 *
 * Bỏ tick một đơn vị ĐÃ nhận là thu hồi: dòng bị gỡ khỏi thẻ của họ khi lưu.
 */
export default function WholeCascadeBody({ scorecard, units, ownUnitIds, formId, onSubmit }: Props) {
  const { t } = useTranslation('bsc')
  const { data: current } = useWholeCascade(scorecard.id)
  const { data: fixedPerspectives } = useFixedPerspectives()

  const [itemName, setItemName] = useState<string | null>(null)
  const [fixed, setFixed] = useState<BscFixedPerspective | null>(null)
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

  const effectiveFixed = fixed ?? current?.fixedPerspective ?? BscFixedPerspective.FINANCIAL
  const defaultName = t('WholeCascadeBody.defaultItemName', { name: scorecard.name })
  const effectiveName = itemName ?? current?.itemName ?? ''

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
    const bad = selected.filter(u => {
      const w = Number(rowOf(u).weight)
      return rowOf(u).weight.trim() === '' || !(w > 0 && w <= 100)
    })
    if (bad.length > 0) {
      toast.error(t('WholeCascadeBody.weightRangeFor', { units: bad.map(u => u.name).join(', ') }))
      return
    }
    if (selected.length === 0 && revoking.length === 0) {
      toast.error(t('WholeCascadeBody.chooseAtLeastOneUnit'))
      return
    }
    onSubmit({
      itemName: effectiveName.trim() || null,
      fixedPerspective: effectiveFixed,
      targets: selected.map(u => ({ orgUnitId: u.id, weightPercentage: Number(rowOf(u).weight) })),
      revokeOrgUnitIds: revoking.map(u => u.id),
    })
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-label" htmlFor={`${formId}-name`}>{t('WholeCascadeBody.itemName')}</label>
          <Input id={`${formId}-name`} value={effectiveName} placeholder={defaultName}
            onChange={e => setItemName(e.target.value)} />
          <p className="text-caption ml-1">{t('WholeCascadeBody.itemNameHint')}</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-label">{t('WholeCascadeBody.area')}</label>
          <Select value={effectiveFixed} onValueChange={v => setFixed(v as BscFixedPerspective)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent className="z-[1100]">
              {(fixedPerspectives ?? []).map(fp => (
                <SelectItem key={fp.code} value={fp.code}>
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fp.color }} />
                    {fp.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-caption ml-1">{t('WholeCascadeBody.areaHint')}</p>
        </div>
      </div>

      <div className="rounded-card border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-[40vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-muted)] sticky top-0 z-10">
          <span className="w-4 shrink-0" />
          <span className="text-eyebrow flex-1">{t('CascadeModal.unit2')}</span>
          <span className="text-eyebrow w-20 text-right">{t('CascadeModal.weight')}</span>
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
            <div key={u.id} className="flex items-center gap-3 px-4 py-2">
              <ChoiceChip selected={r.selected} variant="solid" className="shrink-0" onClick={() => patch(u, { selected: !r.selected })}>
                {r.selected && <span className="text-xs font-semibold">✓</span>}
              </ChoiceChip>
              <span className="flex-1 min-w-0 text-sm font-medium text-[var(--color-foreground)] truncate" style={{ paddingLeft: u.level * 12 }}>
                {u.name}
                {prev && !r.selected && <span className="ml-1.5 text-caption text-[var(--color-warning)]">{t('WholeCascadeBody.willBeRevoked')}</span>}
                {prev && r.selected && offTotal && (
                  <span className="ml-1.5 text-caption text-[var(--color-warning)]">
                    {t('WholeCascadeBody.cardTotal', { value: Math.round(prev.total * 10) / 10 })}
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

      {selected.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-caption">{t('WholeCascadeBody.sameWeightForAll')}</span>
          <LocaleNumberInput type="number" step="0.1" min={0} max={100} value={bulkWeight}
            onChange={e => setBulkWeight(e.target.value)}
            aria-label={t('WholeCascadeBody.sameWeightForAll')}
            className="w-20 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none" />
          <Button type="button" variant="secondary" size="sm" onClick={applyBulk} disabled={bulkWeight.trim() === ''}>
            {t('WholeCascadeBody.apply')}
          </Button>
        </div>
      )}

      {revoking.length > 0 && (
        <div className={cn('rounded-card px-4 py-3 text-xs font-medium flex items-start gap-2',
          'bg-[var(--color-warning-bg)] text-[var(--color-warning)]')}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {t('WholeCascadeBody.revokeNotice', { units: revoking.map(u => u.name).join(', ') })}
        </div>
      )}

      <p className="text-caption">{t('WholeCascadeBody.explainer')}</p>
    </form>
  )
}
