import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useMemo, useState } from 'react'
import { Loader2, AlertTriangle, Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getApiErrorMessage } from '@/lib/apiError'
import { bscApi } from '../api/bscApi'
import { useBscInvalidator } from '../hooks/useBsc'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useCascadeMutations, useScorecardCoverage } from '../hooks/useBscCascade'
import { BscLinkType, type ScorecardResponse, type ScorecardPerspectiveResponse } from '../types'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import WholeCascadeBody from './WholeCascadeBody'

/** Giao từng chỉ tiêu (có đóng góp) hay giao CẢ BỘ thành một dòng "Kết quả cấp trên" chỉ có trọng số. */
type CascadeMode = 'item' | 'whole'
const WHOLE_FORM_ID = 'whole-cascade-form'

interface CascadeModalProps {
  open: boolean
  onClose: () => void
  scorecard: ScorecardResponse | null
}

const LINK_LABELS = perLanguage((): Record<BscLinkType, { label: string; hint: string }> => ({
  [BscLinkType.SUM]: { label: i18n.t('bsc:CascadeModal.rollUp'), hint: i18n.t('bsc:CascadeModal.unitContributionsAddUpToThe') },
  [BscLinkType.SHARED]: { label: i18n.t('bsc:CascadeModal.shared'), hint: i18n.t('bsc:CascadeModal.severalUnitsAreJointlyResponsibleFor') },
  [BscLinkType.SUPPORT]: { label: i18n.t('bsc:CascadeModal.supporting'), hint: i18n.t('bsc:CascadeModal.aSupportingUnitCarryingNoContribution') },
  [BscLinkType.CUSTOM]: { label: i18n.t('bsc:CascadeModal.customFormula'), hint: i18n.t('bsc:CascadeModal.theSystemDoesNotInferAnything') },
}))

interface TargetRow {
  orgUnitId: string
  name: string
  level: number
  selected: boolean
  contribution: string
  weight: string
}

/**
 * Phân rã MỘT chỉ tiêu của bộ tiêu chí cha xuống nhiều đơn vị.
 *
 * <p>Đơn vị nhận được một dòng KHOÁ: trưởng đơn vị không sửa mục tiêu/trọng số của dòng đó, chỉ gắn
 * KPI con và cập nhật kết quả. Thanh tổng đóng góp so với mục tiêu cha cập nhật ngay khi gõ, vì đó
 * là thứ người giao việc cần biết trước khi bấm lưu — thiếu hay vượt đều là quyết định có chủ ý.
 */
export default function CascadeModal({ open, onClose, scorecard }: CascadeModalProps) {
  const { t } = useTranslation('bsc')
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { cascadeWhole } = useCascadeMutations()

  const invalidate = useBscInvalidator()
  const [mode, setMode] = useState<CascadeMode>('item')
  /** Các chỉ tiêu đang giao (chọn được nhiều); null = chưa đụng tới ⇒ mặc định chỉ tiêu đầu tiên. */
  const [pickedIds, setPickedIds] = useState<string[] | null>(null)
  /** Chỉ tiêu đang mở bảng đơn vị — mỗi chỉ tiêu có đóng góp / trọng số riêng cho từng đơn vị. */
  const [activeId, setActiveId] = useState<string>('')
  const [linkType, setLinkType] = useState<BscLinkType>(BscLinkType.SUM)
  /** CHỈ chứa thay đổi người dùng vừa gõ, theo từng chỉ tiêu. Phần đã giao đọc thẳng từ độ phủ (xem rowOf). */
  const [rows, setRows] = useState<Record<string, Record<string, TargetRow>>>({})
  const [submitting, setSubmitting] = useState(false)

  const { data: coverage } = useScorecardCoverage(open ? scorecard?.id : undefined)

  // Dòng "Kết quả cấp trên" không có con số để chia — muốn giao tiếp xuống thì giao cả bộ.
  const items: ScorecardPerspectiveResponse[] = useMemo(
    () => (scorecard?.perspectives || []).filter(p => !p.sourceScorecardId)
      .sort((a, b) => a.displayOrder - b.displayOrder),
    [scorecard],
  )
  // Mặc định chọn chỉ tiêu đầu tiên thay vì để trống: modal này chỉ có một việc để làm, bắt người
  // dùng mở dropdown chọn thêm một bước là thừa. Suy ra ở đây chứ không setState trong effect —
  // và cũng nhờ vậy id trỏ tới chỉ tiêu đã bị xoá thì tự rơi khỏi danh sách thay vì kẹt lại.
  const picked = useMemo(() => {
    const ids = pickedIds ?? (items[0] ? [items[0].id] : [])
    return items.filter(i => ids.includes(i.id))
  }, [pickedIds, items])
  const selectedItem = picked.find(i => i.id === activeId) ?? picked[0]
  const togglePick = (id: string) => {
    const cur = picked.map(i => i.id)
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    setPickedIds(next)
    if (!cur.includes(id)) setActiveId(id)
  }

  // Cây đơn vị phẳng, GỒM cả node gốc — mirror cách ScorecardFormModal đang làm.
  const flatUnits = useMemo(() => {
    const flatten = (nodes: { id: string; name: string; children?: unknown[] }[], level = 0):
      { id: string; name: string; level: number }[] => {
      let out: { id: string; name: string; level: number }[] = []
      for (const node of nodes || []) {
        out.push({ id: node.id, name: node.name, level })
        const children = node.children as { id: string; name: string; children?: unknown[] }[] | undefined
        if (children?.length) out = out.concat(flatten(children, level + 1))
      }
      return out
    }
    return flatten((orgUnitTreeData as { id: string; name: string; children?: unknown[] }[]) || [])
  }, [orgUnitTreeData])

  /**
   * Phần ĐÃ GIAO của chỉ tiêu đang chọn, lấy từ báo cáo độ phủ.
   *
   * Thiếu cái này thì mở lại modal sau khi đã phân rã sẽ thấy trắng trơn và báo "còn thiếu 100"
   * trong khi bảng độ phủ ngay trên nói "đủ" — tệ hơn nữa, bấm lưu là ghi đè đóng góp về rỗng.
   */
  const assignedByItem = useMemo(() => {
    const out = new Map<string, Map<string, { contribution: string; weight: string }>>()
    for (const item of coverage?.items ?? []) {
      const map = new Map<string, { contribution: string; weight: string }>()
      for (const child of item.children ?? []) {
        if (!child.orgUnitId) continue
        map.set(child.orgUnitId, {
          contribution: child.contributionValue != null ? String(child.contributionValue) : '',
          weight: child.weightPercentage != null ? String(child.weightPercentage) : '',
        })
      }
      out.set(item.scorecardPerspectiveId, map)
    }
    return out
  }, [coverage])
  const assignedOf = (itemId?: string) => (itemId && assignedByItem.get(itemId)) || new Map<string, { contribution: string; weight: string }>()
  const assigned = assignedOf(selectedItem?.id)

  // Đơn vị đang giữ thẻ cha thì không phân rã xuống chính nó được.
  const ownUnitIds = useMemo(
    () => new Set((scorecard?.orgUnits || []).map(u => u.id)),
    [scorecard],
  )

  /**
   * Chỉ được giao XUỐNG cấp dưới của mình.
   *
   * Không lọc thì từ BSC của một team vẫn tick được phòng cha, và cây BSC sinh ra quan hệ ngược
   * chiều cây tổ chức — thẻ team thành cha của thẻ phòng. Backend cũng chặn, nhưng bày ra rồi mới
   * báo lỗi là bắt người dùng thử mới biết; ẩn đi thì câu hỏi không bao giờ nảy ra.
   *
   * Trả về {@code null} = không giới hạn: thẻ không gắn đơn vị nào là BSC toàn tổ chức dạng cũ.
   */
  const allowedUnitIds = useMemo(() => {
    type Node = { id: string; name: string; children?: Node[] }
    const tree = (orgUnitTreeData as Node[]) || []
    if (ownUnitIds.size === 0) return null

    const out = new Set<string>()
    const collectAll = (nodes: Node[]) => {
      for (const n of nodes) { out.add(n.id); collectAll(n.children ?? []) }
    }
    // Gặp đơn vị của thẻ thì gom TOÀN BỘ cấp dưới của nó — trừ chính nó, vì giao cho chính mình
    // thì không phải phân rã.
    const walk = (nodes: Node[]) => {
      for (const n of nodes) {
        if (ownUnitIds.has(n.id)) collectAll(n.children ?? [])
        else walk(n.children ?? [])
      }
    }
    walk(tree)
    return out
  }, [orgUnitTreeData, ownUnitIds])

  const targetUnits = useMemo(
    () => (allowedUnitIds ? flatUnits.filter(u => allowedUnitIds.has(u.id)) : flatUnits),
    [allowedUnitIds, flatUnits],
  )

  if (!open || !scorecard) return null

  const rowOfItem = (itemId: string, u: { id: string; name: string; level: number }): TargetRow => {
    const draft = rows[itemId]?.[u.id]
    if (draft) return draft
    const prev = assignedOf(itemId).get(u.id)
    return prev
      ? { orgUnitId: u.id, name: u.name, level: u.level, selected: true, ...prev }
      : { orgUnitId: u.id, name: u.name, level: u.level, selected: false, contribution: '', weight: '' }
  }
  const rowOf = (u: { id: string; name: string; level: number }) => rowOfItem(selectedItem?.id ?? '', u)

  const patch = (u: { id: string; name: string; level: number }, next: Partial<TargetRow>) => {
    if (!selectedItem) return
    const itemId = selectedItem.id
    const base = rowOf(u)
    setRows(prev => ({ ...prev, [itemId]: { ...(prev[itemId] ?? {}), [u.id]: { ...base, ...next } } }))
  }

  // Duyệt TOÀN BỘ đơn vị chứ không chỉ các dòng đang có bản nháp — dòng đã giao từ trước
  // cũng phải được tính vào tổng, nếu không thanh độ phủ trong modal lại nói sai.
  const selectedOf = (itemId: string) => flatUnits.map(u => rowOfItem(itemId, u)).filter(r => r.selected)
  const selected = selectedOf(selectedItem?.id ?? '')
  const totalContribution = selected.reduce((s, r) => s + (Number(r.contribution) || 0), 0)
  const parentTarget = selectedItem?.targetValue ?? null
  // Chỉ SUM mới cộng dồn — với SHARED/SUPPORT thì so tổng với mục tiêu cha là vô nghĩa.
  const showCoverage = linkType === BscLinkType.SUM && parentTarget != null && parentTarget > 0
  const gap = showCoverage ? parentTarget - totalContribution : null

  /**
   * Giao lần lượt từng chỉ tiêu đã chọn. Kiểm tra HẾT trước khi gửi cái nào — dừng giữa chừng vì
   * chỉ tiêu thứ ba thiếu trọng số là để hai chỉ tiêu đầu đã giao mà người dùng tưởng chưa có gì.
   */
  const submit = async () => {
    if (picked.length === 0) return
    for (const item of picked) {
      const sel = selectedOf(item.id)
      if (sel.length === 0) {
        setActiveId(item.id)
        toast.error(t('CascadeModal.chooseUnitsFor', { name: item.name }))
        return
      }
      // Trọng số của dòng được giao là do CẤP TRÊN đặt và bị khoá ở phía đơn vị. Bỏ trống ở đây là
      // dồn đơn vị vào ngõ cụt: dòng đó nằm im ở 0%, họ không sửa được, mà tổng thì không bao giờ
      // đủ 100% nên cũng không trình duyệt được.
      const missingWeight = sel.filter(r => r.weight.trim() === '' || Number(r.weight) <= 0)
      if (missingWeight.length > 0) {
        setActiveId(item.id)
        toast.error(`${item.name}: ` + t('CascadeModal.enterWeightsFor') + missingWeight.map(r => r.name).join(', ')
          + t('CascadeModal.unitsCannotEditTheWeightOf'))
        return
      }
    }
    setSubmitting(true)
    let done = 0
    try {
      for (const item of picked) {
        await bscApi.cascade(scorecard.id, {
          scorecardPerspectiveId: item.id,
          linkType,
          targets: selectedOf(item.id).map(r => ({
            orgUnitId: r.orgUnitId,
            contributionValue: r.contribution.trim() === '' ? null : Number(r.contribution),
            weightPercentage: r.weight.trim() === '' ? null : Number(r.weight),
          })),
        })
        done++
      }
      toast.success(t('CascadeModal.cascadedItems', { count: done }))
      setRows({})
      onClose()
    } catch (e) {
      // Báo rõ đã giao được mấy chỉ tiêu trước khi lỗi, để người dùng biết phần nào cần làm lại.
      toast.error(`${getApiErrorMessage(e, t('CascadeModal.cascadeFailed'))}${done > 0 ? ` ${t('CascadeModal.cascadedBeforeError', { count: done })}` : ''}`)
    } finally {
      setSubmitting(false)
      invalidate()
    }
  }

  const pending = submitting || cascadeWhole.isPending

  /** Tổng thẻ con lệch 100% sau khi giao ⇒ đơn vị phải chia lại trước khi trình; báo ngay cho người giao. */
  const submitWhole = (data: Parameters<typeof cascadeWhole.mutate>[0]['data']) =>
    cascadeWhole.mutate({ scorecardId: scorecard.id, data }, {
      onSuccess: res => {
        const off = (res?.recipients ?? []).filter(r => Math.abs((r.scorecardTotalWeight ?? 0) - 100) > 0.01)
        if (off.length > 0) {
          toast.warning(t('CascadeModal.childTotalsOff', {
            units: off.map(r => `${r.orgUnitName ?? r.scorecardName} (${Math.round((r.scorecardTotalWeight ?? 0) * 10) / 10}%)`).join(', '),
          }))
        }
        onClose()
      },
    })

  const modeSwitch = (
    <div className="grid grid-cols-2 gap-2">
      {([
        { value: 'item' as const, label: t('CascadeModal.modeItem') },
        { value: 'whole' as const, label: t('CascadeModal.modeWhole') },
      ]).map(opt => (
        <ChoiceChip key={opt.value} selected={mode === opt.value} variant="solid" onClick={() => setMode(opt.value)}>
          {opt.label}
        </ChoiceChip>
      ))}
    </div>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!pending}
      title={t('CascadeModal.cascadeKpiToUnits')}
      description={<span className="block truncate" title={scorecard.name}>{scorecard.name}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={pending}>{t('CascadeModal.cancel')}</Button>}
          primary={mode === 'whole' ? (
            <Button type="submit" form={WHOLE_FORM_ID} disabled={pending}>
              {cascadeWhole.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('CascadeModal.saveWhole')}
            </Button>
          ) : (
            <Button onClick={submit} disabled={picked.length === 0 || pending}>
              {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {picked.length > 1
                ? t('CascadeModal.cascadeNItems', { count: picked.length })
                : <>{assigned.size > 0 ? t('CascadeModal.update') : t('CascadeModal.cascade')} {t('CascadeModal.forUnits', { count: selected.length })}</>}
            </Button>
          )}
        />
      }
    >
      {mode === 'whole' ? (
        <div className="space-y-4">
          {modeSwitch}
          <WholeCascadeBody scorecard={scorecard} units={targetUnits} ownUnitIds={ownUnitIds}
            formId={WHOLE_FORM_ID} onSubmit={submitWhole} />
        </div>
      ) : (
      <div className="space-y-4">
        {modeSwitch}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-label">{t('CascadeModal.kpiToAssign')}</label>
            {/* Chọn được nhiều chỉ tiêu cùng lúc; mỗi chỉ tiêu vẫn có bảng đơn vị riêng ở dưới. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-between font-normal" disabled={items.length === 0}>
                  <span className="truncate text-left">
                    {items.length === 0 ? t('CascadeModal.noKpisYet')
                      : picked.length === 1 ? picked[0]!.name
                        : t('CascadeModal.nItemsPicked', { count: picked.length })}
                  </span>
                  <ChevronDown aria-hidden="true" className="opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-2 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                <div className="space-y-1">
                  {items.map(i => {
                    const on = picked.some(p => p.id === i.id)
                    return (
                      <div key={i.id} onClick={() => togglePick(i.id)}
                        className={cn('flex items-center gap-3 px-3 py-2 rounded-card cursor-pointer transition-colors',
                          on ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]' : 'hover:bg-[var(--color-muted)]')}>
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                          on ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'border-[var(--color-border)]')}>
                          {on && <Check size={10} strokeWidth={4} />}
                        </div>
                        <span className="text-xs font-medium truncate">
                          {i.name}{i.targetValue != null ? ` · ${i.targetValue}${i.unit ? ` ${i.unit}` : ''}` : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <label className="text-label">{t('CascadeModal.linkType')}</label>
            <Select value={linkType} onValueChange={v => setLinkType(v as BscLinkType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[1100]">
                {Object.entries(LINK_LABELS()).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption ml-1">{LINK_LABELS()[linkType].hint}</p>
          </div>
        </div>

        {/* Nhiều chỉ tiêu ⇒ mỗi chỉ tiêu một thẻ; bấm thẻ để mở bảng đơn vị của chỉ tiêu đó. */}
        {picked.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map(i => {
              const n = selectedOf(i.id).length
              return (
                <ChoiceChip key={i.id} selected={i.id === selectedItem?.id} variant="solid" onClick={() => setActiveId(i.id)}>
                  {i.name}{n > 0 ? ` · ${n}` : ''}
                </ChoiceChip>
              )
            })}
          </div>
        )}

        {showCoverage && (
          <div className={cn('rounded-card px-4 py-3 text-xs font-medium flex items-center gap-2',
            gap != null && Math.abs(gap) <= Math.max(0.01, Math.abs(parentTarget!) * 0.01)
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]'
              : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]')}>
            {gap != null && Math.abs(gap) <= Math.max(0.01, Math.abs(parentTarget!) * 0.01)
              ? <Check size={14} /> : <AlertTriangle size={14} />}
            {t('CascadeModal.allocated')} {totalContribution.toLocaleString(intlLocale())} / {parentTarget!.toLocaleString(intlLocale())}
            {selectedItem?.unit ? ` ${selectedItem.unit}` : ''}
            {gap != null && Math.abs(gap) > 0.009 && (
              <span>· {gap > 0 ? t('CascadeModal.short', { value: gap.toLocaleString(intlLocale()) }) : t('CascadeModal.over', { value: Math.abs(gap).toLocaleString(intlLocale()) })}</span>
            )}
          </div>
        )}

        <div className="rounded-card border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-[40vh] overflow-y-auto custom-scrollbar">
          {/* Tiêu đề cột: hai ô nhập bên phải trước đây chỉ có placeholder làm nhãn, mà placeholder
              thì biến mất ngay khi người dùng gõ chữ đầu tiên — lúc đó không còn gì nói ô nào là gì. */}
          <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-muted)] sticky top-0 z-10">
            <span className="w-4 shrink-0" />
            <span className="text-eyebrow flex-1">{t('CascadeModal.unit2')}</span>
            <span className="text-eyebrow w-24 text-right">
              {t('CascadeModal.contribution')}{selectedItem?.unit ? ` (${selectedItem.unit})` : ''}
            </span>
            <span className="text-eyebrow w-20 text-right">{t('CascadeModal.weight')}</span>
          </div>
          {targetUnits.length === 0 && (
            <div className="px-4 py-6 text-center text-caption">
              {t('CascadeModal.thisUnitHasNoLowerUnits')}
            </div>
          )}
          {targetUnits.map(u => {
            const r = rowOf(u)
            const isOwn = ownUnitIds.has(u.id)
            return (
              <div key={u.id} className={cn('flex items-center gap-3 px-4 py-2', isOwn && 'opacity-40')}>
                <ChoiceChip selected={r.selected} variant="solid" className="shrink-0" disabled={isOwn} onClick={() => patch(u, { selected: !r.selected })}>
                  {r.selected && <span className="text-xs font-semibold">✓</span>}
                </ChoiceChip>
                <span className="flex-1 text-sm font-medium text-[var(--color-foreground)] truncate"
                  style={{ paddingLeft: u.level * 12 }}>
                  {u.name}
                  {isOwn && <span className="ml-1.5 text-caption">{t('CascadeModal.thisScorecardsUnit')}</span>}
                </span>
                {r.selected && (
                  <>
                    <LocaleNumberInput type="number" step="any" value={r.contribution}
                      onChange={e => patch(u, { contribution: e.target.value })}
                      placeholder="0"
                      className="w-24 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent" />
                    <LocaleNumberInput type="number" step="0.1" value={r.weight}
                      onChange={e => patch(u, { weight: e.target.value })}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent" />
                  </>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-caption">
          {t('CascadeModal.unitsReceiveTheKpiAs')} <b>{t('CascadeModal.locked')}</b>{t('CascadeModal.theUnitHeadCannotEditThe')} <b>{t('CascadeModal.theWeightMustBeEnteredHere')}</b> {t('CascadeModal.ifLeftEmptyTheKpiStays')}
        </p>
      </div>
      )}
    </Dialog>
  )
}
