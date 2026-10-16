import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useMemo, useState } from 'react'
import { Loader2, AlertTriangle, ArrowRight, Check, ChevronDown, Info, Lock, Undo2 } from 'lucide-react'
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
import { BscLinkType, type CascadeTargetRequest, type ScorecardResponse, type ScorecardPerspectiveResponse } from '../types'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import WholeCascadeBody, { type WholeCascadeSummary } from './WholeCascadeBody'
import ConfirmDialog from '@/components/common/ConfirmDialog'

/** Giao từng chỉ tiêu (có đóng góp) hay giao CẢ BỘ thành một dòng "Kết quả cấp trên" chỉ có trọng số. */
type CascadeMode = 'item' | 'whole'
const WHOLE_FORM_ID = 'whole-cascade-form'

interface CascadeModalProps {
  open: boolean
  onClose: () => void
  scorecard: ScorecardResponse | null
}

/**
 * Cách chỉ tiêu cha ra kết quả từ cấp dưới — chọn MỘT cho cả chỉ tiêu (backend chặn trộn hai loại).
 * Đơn vị nào chỉ hỗ trợ thì đặt vai trò riêng của dòng đó (SUPPORT), không chọn ở đây.
 */
type ItemMethod = BscLinkType.SUM | BscLinkType.SHARED
const METHODS: ItemMethod[] = [BscLinkType.SUM, BscLinkType.SHARED]
const ROLE_MAIN = 'main'
const ROLE_SUPPORT = 'support'

interface TargetRow {
  orgUnitId: string
  name: string
  level: number
  selected: boolean
  /** Đã nhận chỉ tiêu này từ trước — chưa có API thu hồi lẻ nên không cho bỏ tick (bỏ tick cũng chẳng xoá gì). */
  assigned: boolean
  /** Vai trò hỗ trợ (SUPPORT): theo dõi chỉ tiêu nhưng kết quả không tính lên chỉ tiêu cha. */
  support: boolean
  /** Đơn vị nhận chỉ tiêu này qua "giao cả bộ" (X% cả bộ) — chỉ xem ở đây, sửa / thu hồi ở tab Giao cả bộ. */
  whole?: number | null
  /** SUM: phần được giao (đóng góp); SHARED / hỗ trợ: mục tiêu riêng của đơn vị. */
  value: string
  weight: string
}

type AssignedUnit = { value: string; weight: string; support: boolean; whole: number | null }
interface AssignedItem {
  method: ItemMethod
  units: Map<string, AssignedUnit>
}
type Unit = { id: string; name: string; level: number }

/** CUSTOM là loại cũ, chưa từng có công thức nào — phép gộp xử lý y hệt SUPPORT. */
const isSupportLink = (l?: BscLinkType | null) => l === BscLinkType.SUPPORT || l === BscLinkType.CUSTOM
const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

/**
 * Phân rã chỉ tiêu của bộ tiêu chí cha xuống nhiều đơn vị — chọn được nhiều chỉ tiêu một lần.
 *
 * <p>"Loại liên kết" tách thành hai câu hỏi dễ trả lời thay vì một danh sách 4 loại khó phân biệt:
 * <ul>
 *   <li>CHỈ TIÊU ra kết quả thế nào: chia mục tiêu rồi cộng dồn (SUM) hay mọi đơn vị cùng chịu trọn
 *       (SHARED) — mỗi chỉ tiêu chọn riêng.</li>
 *   <li>ĐƠN VỊ đóng vai gì: chính (tính vào cha) hay hỗ trợ (SUPPORT, không tính) — mỗi dòng chọn riêng.</li>
 * </ul>
 * "Công thức riêng" (CUSTOM) đã bỏ khỏi giao diện; dòng cũ mang CUSTOM hiện thành "Hỗ trợ".
 *
 * <p>Đơn vị nhận được một dòng KHOÁ: trưởng đơn vị không sửa mục tiêu/trọng số của dòng đó, chỉ gắn
 * KPI con và cập nhật kết quả. Thanh tổng đóng góp so với mục tiêu cha cập nhật ngay khi gõ, vì đó
 * là thứ người giao việc cần biết trước khi bấm lưu — thiếu hay vượt đều là quyết định có chủ ý.
 */
export default function CascadeModal({ open, onClose, scorecard }: CascadeModalProps) {
  const { t } = useTranslation('bsc')
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { cascadeWhole, revokeCascade } = useCascadeMutations()
  // Đơn vị đang chờ xác nhận thu hồi chỉ tiêu đang chọn.
  const [revokeUnit, setRevokeUnit] = useState<{ id: string; name: string } | null>(null)

  const invalidate = useBscInvalidator()
  const [mode, setMode] = useState<CascadeMode>('item')
  /** Các chỉ tiêu đang giao (chọn được nhiều); null = chưa đụng tới ⇒ mặc định chỉ tiêu đầu tiên. */
  const [pickedIds, setPickedIds] = useState<string[] | null>(null)
  /** Chỉ tiêu đang mở bảng đơn vị — mỗi chỉ tiêu có cách tính, vai trò, mục tiêu, trọng số riêng. */
  const [activeId, setActiveId] = useState<string>('')
  /** Cách tính người dùng vừa đổi, theo từng chỉ tiêu. Chưa đổi thì suy từ phần đã giao (methodOf). */
  const [methods, setMethods] = useState<Record<string, ItemMethod>>({})
  /** CHỈ chứa thay đổi người dùng vừa gõ, theo từng chỉ tiêu. Phần đã giao đọc thẳng từ độ phủ (xem rowOfItem). */
  const [rows, setRows] = useState<Record<string, Record<string, TargetRow>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [wholeSummary, setWholeSummary] = useState<WholeCascadeSummary>({ selected: 0, hasAssigned: false })

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
    const flatten = (nodes: { id: string; name: string; children?: unknown[] }[], level = 0): Unit[] => {
      let out: Unit[] = []
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
   * Phần ĐÃ GIAO của từng chỉ tiêu, lấy từ báo cáo độ phủ — gồm cả cách tính và vai trò từng đơn vị.
   *
   * Thiếu cái này thì mở lại modal sau khi đã phân rã sẽ thấy trắng trơn và báo "còn thiếu 100"
   * trong khi bảng độ phủ ngay trên nói "đủ" — tệ hơn nữa, bấm lưu là ghi đè đóng góp về rỗng và
   * (bản cũ) kéo hết loại liên kết về "Cộng dồn".
   */
  const assignedByItem = useMemo(() => {
    const out = new Map<string, AssignedItem>()
    for (const item of coverage?.items ?? []) {
      const units = new Map<string, AssignedUnit>()
      for (const child of item.children ?? []) {
        if (!child.orgUnitId) continue
        const v = child.contributionValue ?? child.targetValue
        units.set(child.orgUnitId, {
          value: v != null ? String(v) : '',
          weight: child.weightPercentage != null ? String(child.weightPercentage) : '',
          support: isSupportLink(child.linkType),
          whole: child.wholeSharePercent ?? null,
        })
      }
      const shared = (item.children ?? []).some(c => c.linkType === BscLinkType.SHARED)
      out.set(item.scorecardPerspectiveId, { method: shared ? BscLinkType.SHARED : BscLinkType.SUM, units })
    }
    return out
  }, [coverage])

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

  const methodOf = (itemId?: string): ItemMethod =>
    (itemId && (methods[itemId] ?? assignedByItem.get(itemId)?.method)) || BscLinkType.SUM

  const rowOfItem = (itemId: string, u: Unit): TargetRow => {
    const draft = rows[itemId]?.[u.id]
    if (draft) return draft
    const prev = assignedByItem.get(itemId)?.units.get(u.id)
    return prev
      ? { orgUnitId: u.id, name: u.name, level: u.level, selected: true, assigned: true, ...prev }
      : { orgUnitId: u.id, name: u.name, level: u.level, selected: false, assigned: false, support: false, value: '', weight: '' }
  }

  const patch = (u: Unit, next: Partial<TargetRow>) => {
    if (!selectedItem) return
    const itemId = selectedItem.id
    const base = rowOfItem(itemId, u)
    setRows(prev => ({ ...prev, [itemId]: { ...(prev[itemId] ?? {}), [u.id]: { ...base, ...next } } }))
  }

  // Duyệt TOÀN BỘ đơn vị chứ không chỉ các dòng đang có bản nháp — dòng đã giao từ trước
  // cũng phải được tính vào tổng, nếu không thanh độ phủ trong modal lại nói sai.
  const selectedOf = (itemId: string) => flatUnits.map(u => rowOfItem(itemId, u)).filter(r => r.selected)

  const itemId = selectedItem?.id ?? ''
  const method = methodOf(itemId)
  const selected = selectedOf(itemId)
  const alreadyAssigned = selected.some(r => r.assigned)
  const mainRows = selected.filter(r => !r.support)
  const totalContribution = mainRows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  const parentTarget = selectedItem?.targetValue ?? null
  const unitSuffix = selectedItem?.unit ? ` ${selectedItem.unit}` : ''
  const fmt = (n: number) => n.toLocaleString(intlLocale())
  // Chỉ SUM mới cộng dồn — với SHARED thì so tổng với mục tiêu cha là vô nghĩa.
  const showCoverage = method === BscLinkType.SUM && parentTarget != null && parentTarget > 0
  const gap = showCoverage ? parentTarget - totalContribution : null
  const covered = gap != null && Math.abs(gap) <= Math.max(0.01, Math.abs(parentTarget!) * 0.01)

  /** Chia đều mục tiêu cha cho các đơn vị chính; phần lẻ dồn vào đơn vị cuối để tổng khớp đúng. */
  const splitEvenly = () => {
    if (!selectedItem || parentTarget == null || mainRows.length === 0) return
    const n = mainRows.length
    const each = Math.floor((parentTarget / n) * 100) / 100
    const last = Math.round((parentTarget - each * (n - 1)) * 100) / 100
    const share = new Map(mainRows.map((r, i) => [r.orgUnitId, i === n - 1 ? last : each]))
    setRows(prev => {
      const cur = { ...(prev[itemId] ?? {}) }
      for (const u of flatUnits) {
        const v = share.get(u.id)
        if (v != null) cur[u.id] = { ...rowOfItem(itemId, u), value: String(v) }
      }
      return { ...prev, [itemId]: cur }
    })
  }

  /** Lỗi chặn lưu của một chỉ tiêu (null = ổn) — dùng cho dấu cảnh báo trên thẻ chỉ tiêu lẫn lúc bấm lưu. */
  const problemOf = (item: ScorecardPerspectiveResponse): string | null => {
    const sel = selectedOf(item.id)
    if (sel.length === 0) return t('CascadeModal.chooseUnitsFor', { name: item.name })
    // Trọng số của dòng được giao là do CẤP TRÊN đặt và bị khoá ở phía đơn vị. Bỏ trống ở đây là
    // dồn đơn vị vào ngõ cụt: dòng đó nằm im ở 0%, họ không sửa được, mà tổng thì không bao giờ
    // đủ 100% nên cũng không trình duyệt được.
    const missingWeight = sel.filter(r => r.weight.trim() === '' || Number(r.weight) <= 0)
    if (missingWeight.length > 0) {
      return `${item.name}: ` + t('CascadeModal.enterWeightsFor') + missingWeight.map(r => r.name).join(', ')
        + t('CascadeModal.unitsCannotEditTheWeightOf')
    }
    return null
  }

  const toTarget = (item: ScorecardPerspectiveResponse, m: ItemMethod, r: TargetRow): CascadeTargetRequest => {
    const weightPercentage = numOrNull(r.weight)
    // Hỗ trợ: con số (nếu có) chỉ là mục tiêu riêng để đơn vị tự đo, không phải phần đóng góp.
    if (r.support) {
      return { orgUnitId: r.orgUnitId, linkType: BscLinkType.SUPPORT, contributionValue: null, targetValue: numOrNull(r.value), weightPercentage }
    }
    // Cùng chịu chung: mỗi đơn vị gánh trọn chỉ tiêu ⇒ để trống thì mục tiêu = mục tiêu cha.
    if (m === BscLinkType.SHARED) {
      return { orgUnitId: r.orgUnitId, linkType: m, contributionValue: null, targetValue: numOrNull(r.value) ?? item.targetValue ?? null, weightPercentage }
    }
    return { orgUnitId: r.orgUnitId, linkType: m, contributionValue: numOrNull(r.value), weightPercentage }
  }

  /**
   * Giao lần lượt từng chỉ tiêu đã chọn. Kiểm tra HẾT trước khi gửi cái nào — dừng giữa chừng vì
   * chỉ tiêu thứ ba thiếu trọng số là để hai chỉ tiêu đầu đã giao mà người dùng tưởng chưa có gì.
   */
  const submit = async () => {
    if (picked.length === 0) return
    for (const item of picked) {
      const problem = problemOf(item)
      if (problem) {
        setActiveId(item.id)
        toast.error(problem)
        return
      }
    }
    setSubmitting(true)
    let done = 0
    try {
      for (const item of picked) {
        const m = methodOf(item.id)
        // Đơn vị nhận qua "giao cả bộ" không gửi lại ở đây (backend chặn trộn hai cách giao).
        const targets = selectedOf(item.id).filter(r => r.whole == null).map(r => toTarget(item, m, r))
        if (targets.length === 0) continue
        await bscApi.cascade(scorecard.id, { scorecardPerspectiveId: item.id, linkType: m, targets })
        done++
      }
      toast.success(t('CascadeModal.cascadedItems', { count: done }))
      setRows({})
      setMethods({})
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

  const methodMeta: Record<ItemMethod, { label: string; short: string; hint: string }> = {
    [BscLinkType.SUM]: { label: t('CascadeModal.methodSum'), short: t('CascadeModal.methodSumShort'), hint: t('CascadeModal.methodSumHint') },
    [BscLinkType.SHARED]: { label: t('CascadeModal.methodShared'), short: t('CascadeModal.methodSharedShort'), hint: t('CascadeModal.methodSharedHint') },
  }
  // Luật "dòng khoá, trọng số phải đặt ngay ở đây" đúng cho CẢ HAI cách giao ⇒ một câu dùng chung.
  const lockedNote = (
    <p className="text-caption">
      {t('CascadeModal.unitsReceiveTheKpiAs')} <b>{t('CascadeModal.locked')}</b>{t('CascadeModal.theUnitHeadCannotEditThe')} <b>{t('CascadeModal.theWeightMustBeEnteredHere')}</b> {t('CascadeModal.ifLeftEmptyTheKpiStays')}
    </p>
  )
  const multi = picked.length > 1
  const readyCount = picked.filter(i => !problemOf(i)).length
  // "Tiếp" ưu tiên chỉ tiêu CHƯA xong kế sau cái đang mở; hết thì thôi không hiện nút.
  const activeIdx = picked.findIndex(i => i.id === selectedItem?.id)
  const nextItem = multi
    ? [...picked.slice(activeIdx + 1), ...picked.slice(0, activeIdx)].find(i => problemOf(i)) ?? null
    : null

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      dismissible={!pending}
      title={t('CascadeModal.cascadeKpiToUnits')}
      description={<span className="block truncate" title={scorecard.name}>{scorecard.name}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={pending}>{t('CascadeModal.cancel')}</Button>}
          primary={mode === 'whole' ? (
            <Button type="submit" form={WHOLE_FORM_ID} disabled={pending}>
              {cascadeWhole.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {/* Cùng cách ghi với bên giao từng chỉ tiêu. Bỏ tick hết để thu hồi thì không còn đơn vị
                  nào để "cho" ⇒ chỉ ghi "Cập nhật". */}
              {wholeSummary.hasAssigned ? t('CascadeModal.update') : t('CascadeModal.cascade')}
              {wholeSummary.selected > 0 && <> {t('CascadeModal.forUnits', { count: wholeSummary.selected })}</>}
            </Button>
          ) : (
            <Button onClick={submit} disabled={picked.length === 0 || pending}>
              {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {picked.length > 1
                ? t('CascadeModal.cascadeNItems', { count: picked.length })
                : <>{alreadyAssigned ? t('CascadeModal.update') : t('CascadeModal.cascade')} {t('CascadeModal.forUnits', { count: selected.length })}</>}
            </Button>
          )}
        />
      }
    >
      {mode === 'whole' ? (
        <div className="space-y-4">
          {modeSwitch}
          <WholeCascadeBody scorecard={scorecard} units={targetUnits} ownUnitIds={ownUnitIds}
            formId={WHOLE_FORM_ID} onSubmit={submitWhole} onSummary={setWholeSummary} />
          {lockedNote}
        </div>
      ) : (
      <div className="space-y-4">
        {modeSwitch}
        <div className="space-y-1.5">
          <label className="text-label">{t('CascadeModal.kpiToAssign')}</label>
          {/* Chọn được nhiều chỉ tiêu cùng lúc; mỗi chỉ tiêu vẫn có cách tính và bảng đơn vị riêng ở dưới. */}
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

        {/* Nhiều chỉ tiêu ⇒ bố cục danh sách – chi tiết: cột trái là các chỉ tiêu kèm trạng thái đủ/thiếu
            (người giao thấy ngay còn cái nào chưa xong), cột phải là phần thiết lập của chỉ tiêu đang mở.
            Một hàng chip trước đây vỡ dòng lộn xộn khi tên chỉ tiêu dài và không nói được cái nào đã xong. */}
        {selectedItem && (
          <div className={cn(multi && 'grid gap-3 sm:grid-cols-[15rem_minmax(0,1fr)] sm:items-start')}>
            {multi && (
              <nav aria-label={t('CascadeModal.itemsList')}
                className="flex flex-col overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] sm:sticky sm:top-0 sm:max-h-[60vh]">
                {/* Tiến độ: chữ + thanh, để người giao biết còn mấy chỉ tiêu phải làm trước khi bấm lưu. */}
                <div className="space-y-2 border-b border-[var(--color-border)] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-eyebrow">{t('CascadeModal.itemsList')}</span>
                    <span className={cn('text-xs font-semibold tabular-nums',
                      readyCount === picked.length ? 'text-[var(--color-success)]' : 'text-[var(--color-muted-foreground)]')}>
                      {readyCount}/{picked.length}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-[var(--color-muted)]" role="progressbar"
                    aria-valuemin={0} aria-valuemax={picked.length} aria-valuenow={readyCount}
                    aria-label={t('CascadeModal.itemsReady', { done: readyCount, total: picked.length })}>
                    <div className="h-full rounded-full bg-[var(--color-success-solid)] transition-[width] duration-300"
                      style={{ width: `${(readyCount / picked.length) * 100}%` }} />
                  </div>
                </div>
                <ol className="flex-1 space-y-1 overflow-y-auto p-1.5 custom-scrollbar">
                  {picked.map((i, idx) => {
                    const n = selectedOf(i.id).length
                    const problem = problemOf(i)
                    const active = i.id === selectedItem.id
                    return (
                      <li key={i.id}>
                        <button type="button" onClick={() => setActiveId(i.id)} title={problem ?? i.name}
                          aria-current={active ? 'step' : undefined}
                          className={cn('relative flex w-full items-start gap-2.5 rounded-control py-2 pl-3 pr-2 text-left transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                            active ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-muted)]')}>
                          {/* Vạch nhấn bên trái: nhìn lướt là biết đang sửa chỉ tiêu nào. */}
                          {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[var(--color-primary)]" />}
                          <span aria-hidden="true" className={cn(
                            'mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                            !problem ? 'bg-[var(--color-success-solid)] text-white'
                              : active ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                                : 'border border-[var(--color-border-strong)] text-[var(--color-muted-foreground)]')}>
                            {!problem ? <Check size={12} strokeWidth={3} /> : idx + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[13px] leading-snug line-clamp-2 text-[var(--color-foreground)]',
                              active ? 'font-semibold' : 'font-medium')}>
                              {i.name}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                              <span className="text-[var(--color-muted-foreground)]">{methodMeta[methodOf(i.id)].short}</span>
                              <span aria-hidden="true" className="text-[var(--color-border-strong)]">•</span>
                              <span className={problem ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]'}>
                                {n === 0 ? t('CascadeModal.noUnitsYet')
                                  : problem ? t('CascadeModal.missingWeight')
                                    : t('CascadeModal.nUnits', { count: n })}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </nav>
            )}

          <div className="min-w-0 space-y-3 rounded-card border border-[var(--color-border)] p-3">
            {multi && (
              <div className="flex items-end justify-between gap-3 border-b border-[var(--color-border)] pb-2.5">
                <div className="min-w-0">
                  <span className="text-eyebrow text-[var(--color-primary)]">
                    {t('CascadeModal.itemStep', { index: activeIdx + 1, total: picked.length })}
                  </span>
                  <h3 className="truncate text-sm font-semibold text-[var(--color-foreground)]" title={selectedItem.name}>
                    {selectedItem.name}
                  </h3>
                </div>
                {parentTarget != null && (
                  <span className="shrink-0 rounded-control bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
                    {t('CascadeModal.itemTarget', { value: `${fmt(parentTarget)}${unitSuffix}` })}
                  </span>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-label">{t('CascadeModal.method')}</label>
              <div className="grid grid-cols-2 gap-0.5 rounded-control bg-[var(--color-muted)] p-0.5">
                {METHODS.map(m => (
                  <ChoiceChip key={m} selected={method === m} variant="segment" className="h-auto min-h-8 whitespace-normal py-1.5"
                    onClick={() => setMethods(prev => ({ ...prev, [itemId]: m }))}>
                    {methodMeta[m].label}
                  </ChoiceChip>
                ))}
              </div>
              <p className="text-caption">{methodMeta[method].hint}</p>
            </div>

            {showCoverage && (
              <div className={cn('rounded-card px-4 py-3 text-xs font-medium flex flex-wrap items-center gap-2',
                covered
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]')}>
                {covered ? <Check size={14} /> : <AlertTriangle size={14} />}
                <span>
                  {t('CascadeModal.allocated')} {fmt(totalContribution)} / {fmt(parentTarget!)}{unitSuffix}
                  {gap != null && Math.abs(gap) > 0.009 && (
                    <> · {gap > 0 ? t('CascadeModal.short', { value: fmt(gap) }) : t('CascadeModal.over', { value: fmt(Math.abs(gap)) })}</>
                  )}
                </span>
                {mainRows.length > 0 && (
                  <Button type="button" variant="outline" size="sm" className="ml-auto h-7"
                    title={t('CascadeModal.splitEvenlyHint')} onClick={splitEvenly}>
                    {t('CascadeModal.splitEvenly')}
                  </Button>
                )}
              </div>
            )}
            {method === BscLinkType.SHARED && parentTarget != null && (
              <div className="rounded-card px-4 py-3 text-xs font-medium flex items-center gap-2 bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                <Info size={14} className="shrink-0" />
                {t('CascadeModal.sharedInfo', { value: `${fmt(parentTarget)}${unitSuffix}` })}
              </div>
            )}

            <div className="rounded-card border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-[40vh] overflow-y-auto custom-scrollbar">
              {/* Tiêu đề cột: ô nhập chỉ có placeholder làm nhãn thì gõ chữ đầu tiên là mất nhãn. */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-muted)] sticky top-0 z-10">
                <span className="w-8 shrink-0" />
                <span className="text-eyebrow flex-1">{t('CascadeModal.unit2')}</span>
                <span className="text-eyebrow w-24 hidden sm:block">{t('CascadeModal.role')}</span>
                <span className="text-eyebrow w-28 text-right whitespace-nowrap hidden sm:block">
                  {t('CascadeModal.unitTarget')}{selectedItem.unit ? ` (${selectedItem.unit})` : ''}
                </span>
                <span className="text-eyebrow w-20 text-right whitespace-nowrap hidden sm:block">{t('CascadeModal.weight')}</span>
              </div>
              {targetUnits.length === 0 && (
                <div className="px-4 py-6 text-center text-caption">
                  {t('CascadeModal.thisUnitHasNoLowerUnits')}
                </div>
              )}
              {targetUnits.map(u => {
                const r = rowOfItem(itemId, u)
                const isOwn = ownUnitIds.has(u.id)
                const placeholder = r.support ? '—'
                  : method === BscLinkType.SHARED && parentTarget != null ? fmt(parentTarget) : '0'
                return (
                  <div key={u.id} className={cn('flex flex-wrap sm:flex-nowrap items-center gap-2 px-3 py-2', isOwn && 'opacity-40')}>
                    {/* Dòng đã giao không bỏ tick được — gỡ đi bằng nút "Thu hồi" bên cạnh (có hỏi lại). Để
                        bấm được chỉ để tooltip còn hiện; nút disabled thì rê chuột không thấy lý do. */}
                    <ChoiceChip selected={r.selected} variant="check" className={cn(r.assigned && 'cursor-default')}
                      disabled={isOwn} title={r.assigned ? t('CascadeModal.alreadyAssigned') : undefined}
                      onClick={() => { if (!r.assigned) patch(u, { selected: !r.selected }) }}>
                      {r.assigned ? <Lock aria-hidden="true" /> : undefined}
                    </ChoiceChip>
                    <span className="flex-1 min-w-0 text-sm font-medium text-[var(--color-foreground)] truncate"
                      style={{ paddingLeft: u.level * 12 }}>
                      {u.name}
                      {isOwn && <span className="ml-1.5 text-caption">{t('CascadeModal.thisScorecardsUnit')}</span>}
                    </span>
                    {r.whole != null && (
                      <span className="shrink-0 rounded-control bg-[var(--color-primary-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]"
                        title={t('CascadeModal.viaWholeHint')}>
                        {t('CascadeModal.viaWhole', { value: Math.round(r.whole * 10) / 10 })}
                      </span>
                    )}
                    {r.assigned && r.whole == null && (
                      <Button variant="ghost" size="sm" className="shrink-0 text-[var(--color-error)] hover:text-[var(--color-error)]"
                        title={t('CascadeModal.revokeHint')}
                        disabled={revokeCascade.isPending}
                        onClick={() => setRevokeUnit({ id: u.id, name: u.name })}>
                        <Undo2 aria-hidden="true" /> {t('CascadeModal.revoke')}
                      </Button>
                    )}
                    {r.selected && r.whole == null && (
                      <div className="flex w-full sm:w-auto items-center justify-end gap-2">
                        <Select value={r.support ? ROLE_SUPPORT : ROLE_MAIN}
                          onValueChange={v => patch(u, { support: v === ROLE_SUPPORT })}>
                          <SelectTrigger className="h-8 w-24 px-2 text-xs" aria-label={t('CascadeModal.role')}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ROLE_MAIN}>{t('CascadeModal.roleMain')}</SelectItem>
                            <SelectItem value={ROLE_SUPPORT}>{t('CascadeModal.roleSupport')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <LocaleNumberInput type="number" step="any" value={r.value}
                          aria-label={t('CascadeModal.unitTarget')}
                          onChange={e => patch(u, { value: e.target.value })}
                          placeholder={placeholder}
                          className={cn('w-28 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent',
                            r.support && 'text-[var(--color-muted-foreground)]')} />
                        <LocaleNumberInput type="number" step="0.1" value={r.weight}
                          aria-label={t('CascadeModal.weight')}
                          onChange={e => patch(u, { weight: e.target.value })}
                          placeholder="0"
                          className="w-20 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-caption">
              <b>{t('CascadeModal.roleMain')}</b>: {t('CascadeModal.roleMainHint')}{' '}
              <b>{t('CascadeModal.roleSupport')}</b>: {t('CascadeModal.roleSupportHint')}
            </p>

            {nextItem && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" className="max-w-full" onClick={() => setActiveId(nextItem.id)}>
                  <span className="truncate">{t('CascadeModal.nextItem', { name: nextItem.name })}</span>
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
          </div>
        )}

        {lockedNote}
      </div>
      )}
      <ConfirmDialog
        open={!!revokeUnit}
        onClose={() => setRevokeUnit(null)}
        loading={revokeCascade.isPending}
        title={t('CascadeModal.revokeTitle')}
        description={t('CascadeModal.revokeDescription', { item: selectedItem?.name ?? '', unit: revokeUnit?.name ?? '' })}
        confirmLabel={t('CascadeModal.revoke')}
        onConfirm={() => {
          if (!revokeUnit || !selectedItem) return
          const itemId = selectedItem.id, unitId = revokeUnit.id
          revokeCascade.mutate({ scorecardId: scorecard.id, scorecardPerspectiveId: itemId, orgUnitId: unitId }, {
            onSuccess: () => {
              // Bỏ bản nháp của dòng vừa thu hồi để dòng hiện lại như đơn vị chưa được giao.
              setRows(prev => {
                const forItem = { ...(prev[itemId] ?? {}) }
                delete forItem[unitId]
                return { ...prev, [itemId]: forItem }
              })
              setRevokeUnit(null)
            },
          })
        }}
      />
    </Dialog>
  )
}
