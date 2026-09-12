import { useMemo, useState } from 'react'
import { Loader2, AlertTriangle, Check } from 'lucide-react'
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

interface CascadeModalProps {
  open: boolean
  onClose: () => void
  scorecard: ScorecardResponse | null
}

const LINK_LABELS: Record<BscLinkType, { label: string; hint: string }> = {
  [BscLinkType.SUM]: { label: 'Cộng dồn', hint: 'Đóng góp của các đơn vị cộng lại thành kết quả của chỉ tiêu cha' },
  [BscLinkType.SHARED]: { label: 'Dùng chung', hint: 'Nhiều đơn vị cùng chịu trách nhiệm một chỉ tiêu — không cộng dồn' },
  [BscLinkType.SUPPORT]: { label: 'Hỗ trợ', hint: 'Đơn vị hỗ trợ, không mang con số đóng góp nào' },
  [BscLinkType.CUSTOM]: { label: 'Công thức riêng', hint: 'Hệ thống không tự suy diễn — người cấu hình tự chịu trách nhiệm' },
}

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
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { cascade } = useCascadeMutations()

  const [itemId, setItemId] = useState<string>('')
  const [linkType, setLinkType] = useState<BscLinkType>(BscLinkType.SUM)
  /** CHỈ chứa thay đổi người dùng vừa gõ. Phần đã giao trước đó đọc thẳng từ độ phủ (xem rowOf). */
  const [rows, setRows] = useState<Record<string, TargetRow>>({})

  const { data: coverage } = useScorecardCoverage(open ? scorecard?.id : undefined)

  const items: ScorecardPerspectiveResponse[] = useMemo(
    () => (scorecard?.perspectives || []).slice().sort((a, b) => a.displayOrder - b.displayOrder),
    [scorecard],
  )
  // Mặc định chọn chỉ tiêu đầu tiên thay vì để trống: modal này chỉ có một việc để làm, bắt người
  // dùng mở dropdown chọn thêm một bước là thừa. Suy ra ở đây chứ không setState trong effect —
  // và cũng nhờ vậy id trỏ tới chỉ tiêu đã bị xoá thì tự rơi về chỉ tiêu đầu thay vì kẹt ô trống.
  const selectedItem = items.find(i => i.id === itemId) ?? items[0]

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
  const assigned = useMemo(() => {
    const map = new Map<string, { contribution: string; weight: string }>()
    const item = coverage?.items.find(i => i.scorecardPerspectiveId === selectedItem?.id)
    for (const child of item?.children ?? []) {
      if (!child.orgUnitId) continue
      map.set(child.orgUnitId, {
        contribution: child.contributionValue != null ? String(child.contributionValue) : '',
        weight: child.weightPercentage != null ? String(child.weightPercentage) : '',
      })
    }
    return map
  }, [coverage, selectedItem])

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

  const rowOf = (u: { id: string; name: string; level: number }): TargetRow => {
    const draft = rows[u.id]
    if (draft) return draft
    const prev = assigned.get(u.id)
    return prev
      ? { orgUnitId: u.id, name: u.name, level: u.level, selected: true, ...prev }
      : { orgUnitId: u.id, name: u.name, level: u.level, selected: false, contribution: '', weight: '' }
  }

  const patch = (u: { id: string; name: string; level: number }, next: Partial<TargetRow>) => {
    const base = rowOf(u)
    setRows(prev => ({ ...prev, [u.id]: { ...base, ...next } }))
  }

  // Duyệt TOÀN BỘ đơn vị chứ không chỉ các dòng đang có bản nháp — dòng đã giao từ trước
  // cũng phải được tính vào tổng, nếu không thanh độ phủ trong modal lại nói sai.
  const selected = flatUnits.map(rowOf).filter(r => r.selected)
  const totalContribution = selected.reduce((s, r) => s + (Number(r.contribution) || 0), 0)
  const parentTarget = selectedItem?.targetValue ?? null
  // Chỉ SUM mới cộng dồn — với SHARED/SUPPORT thì so tổng với mục tiêu cha là vô nghĩa.
  const showCoverage = linkType === BscLinkType.SUM && parentTarget != null && parentTarget > 0
  const gap = showCoverage ? parentTarget - totalContribution : null

  const submit = () => {
    if (!selectedItem || selected.length === 0) return
    // Trọng số của dòng được giao là do CẤP TRÊN đặt và bị khoá ở phía đơn vị. Bỏ trống ở đây là
    // dồn đơn vị vào ngõ cụt: dòng đó nằm im ở 0%, họ không sửa được, mà tổng thì không bao giờ
    // đủ 100% nên cũng không trình duyệt được.
    const missingWeight = selected.filter(r => r.weight.trim() === '' || Number(r.weight) <= 0)
    if (missingWeight.length > 0) {
      toast.error('Nhập trọng số cho: ' + missingWeight.map(r => r.name).join(', ')
        + '. Đơn vị không tự sửa được trọng số của chỉ tiêu cấp trên giao.')
      return
    }
    cascade.mutate({
      scorecardId: scorecard.id,
      data: {
        scorecardPerspectiveId: selectedItem.id,
        linkType,
        targets: selected.map(r => ({
          orgUnitId: r.orgUnitId,
          contributionValue: r.contribution.trim() === '' ? null : Number(r.contribution),
          weightPercentage: r.weight.trim() === '' ? null : Number(r.weight),
        })),
      },
    }, { onSuccess: () => { setRows({}); onClose() } })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!cascade.isPending}
      title="Phân rã chỉ tiêu xuống đơn vị"
      description={<span className="block truncate" title={scorecard.name}>{scorecard.name}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={cascade.isPending}>Huỷ</Button>}
          primary={
            <Button onClick={submit} disabled={!selectedItem || selected.length === 0 || cascade.isPending}>
              {cascade.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {assigned.size > 0 ? 'Cập nhật' : 'Phân rã'} cho {selected.length} đơn vị
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-label">Chỉ tiêu cần giao</label>
            {/* value rỗng bị Radix hiểu là "đã chọn giá trị rỗng" nên nó nuốt luôn placeholder —
                truyền undefined mới ra được ô có chữ gợi ý khi bộ tiêu chí chưa có chỉ tiêu nào. */}
            <Select value={selectedItem?.id ?? undefined}
              onValueChange={v => { setItemId(v); setRows({}) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chưa có chỉ tiêu nào" /></SelectTrigger>
              <SelectContent className="z-[1100]">
                {items.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}{i.targetValue != null ? ` · ${i.targetValue}${i.unit ? ` ${i.unit}` : ''}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-label">Loại liên kết</label>
            <Select value={linkType} onValueChange={v => setLinkType(v as BscLinkType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[1100]">
                {Object.entries(LINK_LABELS).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-caption ml-1">{LINK_LABELS[linkType].hint}</p>
          </div>
        </div>

        {showCoverage && (
          <div className={cn('rounded-card px-4 py-3 text-xs font-medium flex items-center gap-2',
            gap != null && Math.abs(gap) <= Math.max(0.01, Math.abs(parentTarget!) * 0.01)
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]'
              : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]')}>
            {gap != null && Math.abs(gap) <= Math.max(0.01, Math.abs(parentTarget!) * 0.01)
              ? <Check size={14} /> : <AlertTriangle size={14} />}
            Đã phân bổ {totalContribution.toLocaleString('vi-VN')} / {parentTarget!.toLocaleString('vi-VN')}
            {selectedItem?.unit ? ` ${selectedItem.unit}` : ''}
            {gap != null && Math.abs(gap) > 0.009 && (
              <span>· {gap > 0 ? `còn thiếu ${gap.toLocaleString('vi-VN')}` : `vượt ${Math.abs(gap).toLocaleString('vi-VN')}`}</span>
            )}
          </div>
        )}

        <div className="rounded-card border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-[40vh] overflow-y-auto custom-scrollbar">
          {/* Tiêu đề cột: hai ô nhập bên phải trước đây chỉ có placeholder làm nhãn, mà placeholder
              thì biến mất ngay khi người dùng gõ chữ đầu tiên — lúc đó không còn gì nói ô nào là gì. */}
          <div className="flex items-center gap-3 px-4 py-2 bg-[var(--color-muted)] sticky top-0 z-10">
            <span className="w-4 shrink-0" />
            <span className="text-eyebrow flex-1">Đơn vị</span>
            <span className="text-eyebrow w-24 text-right">
              Đóng góp{selectedItem?.unit ? ` (${selectedItem.unit})` : ''}
            </span>
            <span className="text-eyebrow w-20 text-right">Trọng số %</span>
          </div>
          {targetUnits.length === 0 && (
            <div className="px-4 py-6 text-center text-caption">
              Đơn vị này không có đơn vị cấp dưới nào để giao chỉ tiêu.
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
                  {isOwn && <span className="ml-1.5 text-caption">· đơn vị của thẻ này</span>}
                </span>
                {r.selected && (
                  <>
                    <input type="number" step="any" value={r.contribution}
                      onChange={e => patch(u, { contribution: e.target.value })}
                      placeholder="0"
                      className="w-24 px-2 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-xs font-medium text-right outline-none focus:placeholder:text-transparent" />
                    <input type="number" step="0.1" value={r.weight}
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
          Đơn vị nhận chỉ tiêu ở dạng <b>khoá</b>: trưởng đơn vị không sửa được mục tiêu và trọng số,
          chỉ gắn KPI con vào. Vì vậy <b>trọng số phải nhập ngay ở đây</b> — để trống thì chỉ tiêu nằm im ở 0%
          và đơn vị không bao giờ gom đủ 100% để trình duyệt.
        </p>
      </div>
    </Dialog>
  )
}
