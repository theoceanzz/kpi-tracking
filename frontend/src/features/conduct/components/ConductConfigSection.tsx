import { useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, Save, RotateCcw, Star, ChevronRight, ChevronDown,
  Search, X, CalendarRange, Loader2, Copy, HelpCircle, Scale, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useConductConfig, useConductSets } from '../hooks/useConduct'
import type { ConductSet } from '../api/conductApi'
import type { OrganizationResponse } from '@/features/orgunits/api/organizationApi'

/**
 * Các BỘ tiêu chí hạnh kiểm của tổ chức — cùng khuôn với hồ sơ luật của "xếp loại đơn vị":
 * nhiều bộ, mỗi bộ gán cho một số KỲ, kỳ không được gán thì dùng bộ MẶC ĐỊNH.
 *
 * Mỗi bộ giữ riêng thang điểm và danh sách tiêu chí kèm trọng số; ràng buộc duy nhất là
 * TỔNG trọng số = 100% — vì điểm tổng là Σ(điểm × trọng số), lệch 100% thì điểm không bao
 * giờ chạm được thang tối đa.
 *
 * Bố cục: thẻ đóng là MỘT dòng tóm tắt đủ để so sánh các bộ với nhau; mở ra mới thấy phần
 * soạn thảo. Tên bộ nằm ngay trên dòng tiêu đề chứ không lặp lại thành một ô riêng bên
 * trong, và phần "biểu hiện cụ thể" của mỗi tiêu chí gập lại — bốn ô văn bản dài mở sẵn
 * đẩy nút Lưu xuống dưới màn hình, đúng thứ người dùng cần bấm nhất.
 *
 * Khác "xếp loại đơn vị" ở một chỗ: bên đó cả cấu hình là một chuỗi JSON nên lưu một lần
 * là xong, còn ở đây mỗi bộ là một tài nguyên riêng trên server, nên nút Lưu nằm trong
 * từng thẻ — sửa bộ của kỳ này không được đụng bộ mà kỳ khác đang chấm dở.
 */

interface DraftCriteria {
  name: string
  description: string
  weight: string
}

interface DraftSet {
  id: string
  name: string
  isDefault: boolean
  maxScore: string
  kpiCycleIds: string[]
  criteria: DraftCriteria[]
}

const toDraft = (s: ConductSet): DraftSet => ({
  id: s.id,
  name: s.name,
  isDefault: s.isDefault,
  maxScore: String(s.maxScore ?? 4),
  kpiCycleIds: [...(s.kpiCycleIds ?? [])],
  criteria: (s.criteria ?? []).map(c => ({
    name: c.name,
    description: c.description ?? '',
    weight: String(c.weight),
  })),
})

const round2 = (n: number) => Math.round(n * 100) / 100
const totalWeight = (rows: DraftCriteria[]) => round2(rows.reduce((s, c) => s + (Number(c.weight) || 0), 0))

/** Nút biểu tượng dùng lại ở nhiều chỗ — luôn có tên đọc được cho trình đọc màn hình. */
function IconButton({
  label, onClick, danger, children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'w-8 h-8 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer',
        danger
          ? 'text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200',
      )}
    >
      {children}
    </button>
  )
}

export default function ConductConfigSection({ org }: { org: OrganizationResponse }) {
  const orgId = org?.id
  const { data: config, isLoading } = useConductConfig(orgId)
  const {
    createSet, isCreating, updateSet, isUpdating,
    deleteSet, markDefaultSet, resetSet,
  } = useConductSets(orgId)

  const { data: cyclesData } = useKpiCycles({
    organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc',
  })
  const cycles = useMemo(
    () => (cyclesData?.content ?? []).map(c => ({ id: c.id as string, name: c.name as string })),
    [cyclesData],
  )
  const cycleNameById = useMemo(() => {
    const m: Record<string, string> = {}
    cycles.forEach(c => { m[c.id] = c.name })
    return m
  }, [cycles])

  // Server là nguồn sự thật: mọi mutation trả về nguyên cấu hình nên nạp lại bản nháp theo
  // nó, khỏi phải tự đồng bộ từng thẻ sau mỗi lần lưu/xoá/đổi mặc định.
  const [drafts, setDrafts] = useState<DraftSet[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const sets = useMemo(() => config?.sets ?? [], [config])
  // Nạp lại bản nháp NGAY TRONG RENDER khi server trả về cấu hình khác, không qua effect:
  // effect chạy sau khi đã vẽ nên người dùng thấy một nhịp số cũ rồi mới nhảy sang số mới.
  const syncedSets = useRef<typeof sets | null>(null)
  if (syncedSets.current !== sets) {
    syncedSets.current = sets
    setDrafts(sets.map(toDraft))
    // Chỉ dọn id đã biến mất và mở sẵn thẻ đầu khi chưa có thẻ nào mở. KHÔNG tự mở thẻ
    // "mới thấy": mỗi lần cấu hình được tải lại, mọi thẻ đang thu sẽ bung ra hết.
    setExpanded(prev => {
      const live = new Set(sets.map(s => s.id))
      const next = new Set([...prev].filter(id => live.has(id)))
      if (next.size === 0 && sets[0]) next.add(sets[0].id)
      return next
    })
  }

  const toggleExpanded = (id: string) =>
    setExpanded(e => {
      const s = new Set(e)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })

  const patch = (id: string, p: Partial<DraftSet>) =>
    setDrafts(ds => ds.map(d => (d.id === id ? { ...d, ...p } : d)))

  // Kỳ đang bị bộ KHÁC giữ — hiện ngay trong ô chọn thay vì để người dùng gán rồi mới thấy
  // kỳ lặng lẽ biến mất khỏi bộ cũ.
  const cycleOwner = (selfId: string): Record<string, string> => {
    const m: Record<string, string> = {}
    drafts.forEach(d => {
      if (d.id === selfId) return
      d.kpiCycleIds.forEach(cid => { m[cid] = d.name })
    })
    return m
  }

  /** Tạo bộ mới rồi mở sẵn thẻ của nó — bước tiếp theo luôn là gán kỳ cho bộ vừa tạo. */
  const addSet = (name: string, copyFromSetId: string | null) => {
    const before = new Set(drafts.map(d => d.id))
    createSet({ name, copyFromSetId }, {
      onSuccess: cfg => {
        const created = (cfg?.sets ?? []).find(s => !before.has(s.id))
        if (created) setExpanded(e => new Set([...e, created.id]))
      },
    })
  }

  const handleAdd = () => {
    const base = drafts.find(d => d.isDefault) ?? drafts[0]
    addSet(`Bộ tiêu chí ${drafts.length + 1}`, base?.id ?? null)
  }

  const handleSave = (draft: DraftSet) => {
    if (!draft.name.trim()) { toast.error('Tên bộ tiêu chí không được để trống'); return }
    if (!draft.criteria.length) { toast.error(`Bộ "${draft.name}" cần ít nhất 1 tiêu chí`); return }
    if (draft.criteria.some(c => !c.name.trim())) { toast.error('Tên tiêu chí không được để trống'); return }
    if (draft.criteria.some(c => !(Number(c.weight) > 0))) {
      toast.error('Trọng số của mỗi tiêu chí phải lớn hơn 0'); return
    }
    const total = totalWeight(draft.criteria)
    if (Math.abs(total - 100) > 0.01) {
      toast.error(`Tổng trọng số phải bằng 100% (hiện tại ${total}%)`); return
    }
    const max = Number(draft.maxScore)
    if (!(max > 0)) { toast.error('Thang điểm phải lớn hơn 0'); return }

    setSavingId(draft.id)
    updateSet({
      setId: draft.id,
      data: {
        name: draft.name.trim(),
        maxScore: max,
        // Bộ mặc định áp cho mọi kỳ chưa gán nên không mang danh sách kỳ nào.
        kpiCycleIds: draft.isDefault ? [] : draft.kpiCycleIds,
        criteria: draft.criteria.map(c => ({
          name: c.name.trim(),
          description: c.description.trim() || null,
          weight: Number(c.weight),
        })),
      },
    }, { onSettled: () => setSavingId(null) })
  }

  if (isLoading) return <LoadingSkeleton rows={6} />

  const unassignedCount = cycles.filter(c => !drafts.some(d => d.kpiCycleIds.includes(c.id))).length
  const hasDefault = drafts.some(d => d.isDefault)

  return (
    // Đầu mục PHẢI là `WorkspaceHeader`: đó cũng là nơi vẽ hàng tab Định lượng/Định tính/
    // Hạnh kiểm của mục Thang điểm. Tự dựng một đầu card khác ở đây là hàng tab biến mất.
    <div className="space-y-4">
      <WorkspaceHeader
        description={`${drafts.length} bộ tiêu chí — gán theo kỳ, kỳ chưa gán dùng bộ mặc định.`}
        actions={
          <>
            <HelpPopover />
            <button
              type="button"
              onClick={() => resetSet(undefined)}
              className="inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-sm font-bold bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] border border-[var(--color-border)] transition-all cursor-pointer"
              title="Đặt bộ mặc định về 4 tiêu chí × 25%"
            >
              <RotateCcw size={16} aria-hidden="true" /> Đặt lại bộ mặc định
            </button>
          </>
        }
      />

      {!hasDefault && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-[11px] font-bold text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
          Chưa có bộ mặc định — các kỳ không được gán sẽ không mở được phiếu chấm.
        </p>
      )}

      {/* Không bọc thêm một card ngoài: mỗi bộ đã là một card có viền, lồng card trong
          card chỉ thêm một tầng khung mà không nhóm thêm được thông tin gì. */}
      <div className="space-y-2.5">
        {drafts.map(d => (
          <SetCard
            key={d.id}
            draft={d}
            cycles={cycles}
            cycleNameById={cycleNameById}
            cycleOwner={cycleOwner(d.id)}
            unassignedCount={unassignedCount}
            canDelete={drafts.length > 1 && !d.isDefault}
            isOpen={expanded.has(d.id)}
            isSaving={savingId === d.id && isUpdating}
            onToggle={() => toggleExpanded(d.id)}
            onPatch={p => patch(d.id, p)}
            onSave={() => handleSave(d)}
            onSetDefault={() => markDefaultSet(d.id)}
            onDuplicate={() => addSet(`${d.name} (bản sao)`, d.id)}
            onReset={() => resetSet(d.id)}
            onRemove={() => deleteSet(d.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        disabled={isCreating}
        className="w-full h-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-500 hover:border-teal-400 hover:text-teal-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
      >
        {isCreating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
        Thêm bộ tiêu chí
      </button>
    </div>
  )
}

/** Phần giải thích dài — để sau nút "?" thay vì bày sẵn hai dòng chữ trên danh sách. */
function HelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Bộ tiêu chí hạnh kiểm hoạt động thế nào"
          className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] border border-[var(--color-border)] transition-all cursor-pointer"
        >
          <HelpCircle size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] text-xs leading-relaxed text-slate-600 dark:text-slate-300 space-y-2">
        <p>Mỗi <b>bộ</b> là một cách chấm hạnh kiểm. Gán bộ cho <b>kỳ</b> nào thì mọi đợt trong kỳ đó chấm theo bộ ấy.</p>
        <p>Kỳ không được gán dùng bộ <b>mặc định</b>. Một kỳ chỉ thuộc một bộ — gán sang bộ khác thì bộ cũ tự mất kỳ đó.</p>
        <p>Điểm tổng = Σ(điểm × trọng số), nên <b>tổng trọng số phải bằng 100%</b>.</p>
      </PopoverContent>
    </Popover>
  )
}

// ── Thẻ 1 bộ (accordion) ────────────────────────────────────────────────────
function SetCard({
  draft: d, cycles, cycleNameById, cycleOwner, unassignedCount,
  canDelete, isOpen, isSaving,
  onToggle, onPatch, onSave, onSetDefault, onDuplicate, onReset, onRemove,
}: {
  draft: DraftSet
  cycles: { id: string; name: string }[]
  cycleNameById: Record<string, string>
  cycleOwner: Record<string, string>
  /** Bao nhiêu kỳ đang rơi về bộ mặc định — chỉ hiện trên chính thẻ mặc định. */
  unassignedCount: number
  canDelete: boolean
  isOpen: boolean
  isSaving: boolean
  onToggle: () => void
  onPatch: (patch: Partial<DraftSet>) => void
  onSave: () => void
  onSetDefault: () => void
  onDuplicate: () => void
  onReset: () => void
  onRemove: () => void
}) {
  // Ô "biểu hiện cụ thể" gập theo từng tiêu chí: mở sẵn cả bốn thì thẻ dài gấp bốn lần và
  // nút Lưu bị đẩy khỏi màn hình.
  const [openDesc, setOpenDesc] = useState<Set<number>>(new Set())
  const toggleDesc = (i: number) =>
    setOpenDesc(s => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const total = totalWeight(d.criteria)
  const totalOff = Math.abs(total - 100) > 0.01

  const setCriteria = (idx: number, p: Partial<DraftCriteria>) =>
    onPatch({ criteria: d.criteria.map((c, i) => (i === idx ? { ...c, ...p } : c)) })

  /** Chia đều 100% cho các tiêu chí — cách thoát nhanh nhất khi tổng bị lệch. */
  const splitEvenly = () => {
    const n = d.criteria.length
    if (!n) return
    const each = Math.floor((100 / n) * 100) / 100
    // Dồn phần lẻ vào tiêu chí cuối để tổng chạm đúng 100, không phải 99.99.
    const rest = round2(100 - each * (n - 1))
    onPatch({ criteria: d.criteria.map((c, i) => ({ ...c, weight: String(i === n - 1 ? rest : each) })) })
  }

  const fieldCls = 'h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-bold border border-transparent outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20'

  return (
    <div className={cn(
      'rounded-2xl border transition-colors',
      isOpen ? 'border-slate-300 dark:border-slate-700' : 'border-slate-200 dark:border-slate-800',
      d.isDefault && 'border-teal-300 dark:border-teal-800',
    )}>
      {/* ── Dòng tiêu đề: đóng thì là bản tóm tắt, mở thì là thanh công cụ của bộ ── */}
      <div className="flex items-center gap-2 p-2.5 max-sm:flex-wrap">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? `Thu gọn bộ ${d.name}` : `Mở bộ ${d.name}`}
          className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>

        {d.isDefault && (
          <Badge className="gap-1 shrink-0 whitespace-nowrap"><Star size={11} className="fill-white" aria-hidden="true" /> Mặc định</Badge>
        )}

        {isOpen ? (
          // Tên bộ sửa ngay tại đây, không lặp lại thành một ô riêng bên dưới. Rộng vừa
          // phải: ô kéo hết bề ngang cho một cái tên tám chữ trông như lỗi bố cục.
          <input
            value={d.name}
            onChange={e => onPatch({ name: e.target.value })}
            placeholder="Tên bộ tiêu chí"
            aria-label="Tên bộ tiêu chí"
            className={cn(fieldCls, 'flex-1 min-w-[140px] max-w-xs font-black')}
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
          >
            <span className="font-black text-sm truncate">{d.name || 'Bộ tiêu chí'}</span>
            <span className="ml-auto flex items-center gap-2 shrink-0 text-[11px] font-bold text-slate-400 max-sm:hidden">
              <span>{d.criteria.length} tiêu chí</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>thang {d.maxScore}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className={totalOff ? 'text-rose-500' : 'text-emerald-500'}>{total}%</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <CycleSummary draft={d} cycleNameById={cycleNameById} />
            </span>
          </button>
        )}

        {isOpen && (
          <div className="flex items-center gap-0.5 shrink-0 max-sm:w-full max-sm:justify-end">
            {!d.isDefault && (
              <IconButton label="Đặt làm bộ mặc định" onClick={onSetDefault}><Star size={15} /></IconButton>
            )}
            <IconButton label="Nhân bản bộ này" onClick={onDuplicate}><Copy size={15} /></IconButton>
            <IconButton label="Đặt bộ này về 4 tiêu chí mặc định" onClick={onReset}><RotateCcw size={15} /></IconButton>
            {canDelete && <IconButton label="Xoá bộ này" onClick={onRemove} danger><Trash2 size={15} /></IconButton>}
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="ml-1.5 inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />} Lưu
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {/* ── Một hàng thuộc tính: kỳ áp dụng + thang điểm + tổng trọng số ──
              Trước đây là ba khối xếp dọc, mỗi khối có nền và chú thích riêng — cao gần
              200px cho ba con số. */}
          <div className="px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                <CalendarRange size={12} aria-hidden="true" /> Kỳ áp dụng
              </span>
              {d.isDefault ? (
                <span
                  className="text-[11px] font-bold text-slate-500 dark:text-slate-400"
                  title="Bộ mặc định luôn áp cho mọi kỳ chưa gán — giới hạn nó theo kỳ sẽ làm các kỳ còn lại không chấm được"
                >
                  Mọi kỳ chưa gán bộ riêng
                  {unassignedCount > 0 && (
                    <span className="text-slate-400"> ({unassignedCount} kỳ)</span>
                  )}
                </span>
              ) : (
                <>
                  {d.kpiCycleIds.map(id => (
                    <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-[180px]">
                      <span className="truncate">{cycleNameById[id] ?? 'Kỳ'}</span>
                      <button
                        type="button"
                        onClick={() => onPatch({ kpiCycleIds: d.kpiCycleIds.filter(x => x !== id) })}
                        className="shrink-0 hover:text-red-500 cursor-pointer"
                        aria-label={`Bỏ gán kỳ ${cycleNameById[id] ?? ''}`}
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </Badge>
                  ))}
                  <CyclePickerPopover
                    cycles={cycles}
                    selected={d.kpiCycleIds}
                    ownedBy={cycleOwner}
                    onToggle={id => onPatch({
                      kpiCycleIds: d.kpiCycleIds.includes(id) ? d.kpiCycleIds.filter(x => x !== id) : [...d.kpiCycleIds, id],
                    })}
                  />
                  {d.kpiCycleIds.length === 0 && (
                    <span className="text-[11px] font-bold text-amber-500">chưa gán kỳ nào</span>
                  )}
                </>
              )}
            </div>

            <label className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <Scale size={12} aria-hidden="true" /> Thang điểm
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={d.maxScore}
                onChange={e => onPatch({ maxScore: e.target.value })}
                onWheel={e => e.currentTarget.blur()}
                className={cn(fieldCls, 'w-16 text-center')}
              />
            </label>

            <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng trọng số</span>
              <span className={cn('text-base font-black tabular-nums', totalOff ? 'text-rose-500' : 'text-emerald-500')}>
                {total}%
              </span>
              {totalOff && (
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="px-2 h-7 rounded-lg text-[11px] font-black bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 cursor-pointer"
                  title="Chia đều 100% cho các tiêu chí"
                >
                  Chia đều
                </button>
              )}
            </div>
          </div>

          {/* ── Danh sách tiêu chí ── */}
          <div className="p-3 space-y-1.5">
            {d.criteria.map((row, idx) => {
              const lines = row.description.split('\n').map(l => l.trim()).filter(Boolean)
              const descOpen = openDesc.has(idx)
              return (
                <div key={idx} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  <div className="flex items-center gap-2 p-2 max-sm:flex-wrap">
                    <span className="w-6 h-6 shrink-0 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 tabular-nums">
                      {idx + 1}
                    </span>
                    <input
                      value={row.name}
                      onChange={e => setCriteria(idx, { name: e.target.value })}
                      placeholder="Tên tiêu chí"
                      aria-label={`Tên tiêu chí ${idx + 1}`}
                      className={cn(fieldCls, 'flex-1 min-w-[120px] bg-white dark:bg-slate-900')}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row.weight}
                        onChange={e => setCriteria(idx, { weight: e.target.value })}
                        onWheel={e => e.currentTarget.blur()}
                        aria-label={`Trọng số tiêu chí ${idx + 1} (%)`}
                        className={cn(fieldCls, 'w-16 text-center bg-white dark:bg-slate-900 tabular-nums')}
                      />
                      <span className="text-xs font-black text-slate-400">%</span>
                    </div>
                    {/* Gập "biểu hiện" nhưng vẫn nói rõ đang có bao nhiêu dòng, để không ai
                        tưởng tiêu chí này chưa được mô tả. */}
                    <button
                      type="button"
                      onClick={() => toggleDesc(idx)}
                      aria-expanded={descOpen}
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1 px-2 h-9 rounded-lg text-[11px] font-bold cursor-pointer transition-colors',
                        lines.length
                          ? 'bg-white dark:bg-slate-900 text-slate-500 hover:text-teal-600 border border-slate-200 dark:border-slate-700'
                          : 'text-slate-400 hover:text-teal-600',
                      )}
                    >
                      {descOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                      {lines.length ? `${lines.length} biểu hiện` : 'Thêm biểu hiện'}
                    </button>
                    <IconButton
                      label={`Xoá tiêu chí ${row.name || idx + 1}`}
                      onClick={() => onPatch({ criteria: d.criteria.filter((_, i) => i !== idx) })}
                      danger
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>

                  {descOpen && (
                    <div className="px-2 pb-2 pl-10 max-sm:pl-2">
                      <textarea
                        value={row.description}
                        onChange={e => setCriteria(idx, { description: e.target.value })}
                        placeholder="Các biểu hiện cụ thể — mỗi dòng một ý"
                        aria-label={`Biểu hiện cụ thể của tiêu chí ${idx + 1}`}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium leading-relaxed outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-y"
                      />
                    </div>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={() => onPatch({ criteria: [...d.criteria, { name: '', description: '', weight: '0' }] })}
              className="w-full h-9 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-400 hover:text-teal-600 hover:border-teal-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} aria-hidden="true" /> Thêm tiêu chí
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Tóm tắt kỳ trên thẻ đã thu — giữ nhãn nguyên vẹn, phần dư gộp thành "+n". */
function CycleSummary({
  draft: d, cycleNameById,
}: {
  draft: DraftSet
  cycleNameById: Record<string, string>
}) {
  if (d.isDefault) return <span>mọi kỳ chưa gán</span>
  if (d.kpiCycleIds.length === 0) return <span className="text-amber-500">chưa gán kỳ</span>
  const names = d.kpiCycleIds.map(id => cycleNameById[id] ?? 'Kỳ')
  return (
    <span className="max-w-[220px] truncate" title={names.join(', ')}>
      {names[0]}{names.length > 1 ? ` +${names.length - 1}` : ''}
    </span>
  )
}

// ── Popover chọn KỲ: danh sách phẳng có ô tìm ───────────────────────────────
function CyclePickerPopover({
  cycles, selected, ownedBy, onToggle,
}: {
  cycles: { id: string; name: string }[]
  selected: string[]
  /** cycleId → tên bộ khác đang giữ kỳ đó. */
  ownedBy: Record<string, string>
  onToggle: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? cycles.filter(c => c.name.toLowerCase().includes(q)) : cycles
  }, [cycles, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-bold border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-teal-400 hover:text-teal-600 cursor-pointer"
        >
          <Plus size={13} aria-hidden="true" /> Chọn kỳ
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <div className="p-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm kỳ…"
              aria-label="Tìm kỳ đánh giá"
              className="w-full h-8 pl-8 pr-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs border-none outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto p-1.5">
          {shown.length ? shown.map(c => (
            <label key={c.id} className="flex items-center gap-2 py-1.5 px-1.5 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => onToggle(c.id)} />
              <span className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{c.name}</span>
              {ownedBy[c.id] && !selected.includes(c.id) && (
                <span className="ml-auto shrink-0 text-[10px] font-bold text-amber-500 truncate max-w-[90px]" title={`Đang thuộc bộ "${ownedBy[c.id]}"`}>
                  {ownedBy[c.id]}
                </span>
              )}
            </label>
          )) : <p className="text-[11px] italic text-slate-400 p-2">Không tìm thấy kỳ.</p>}
        </div>
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
          Một kỳ chỉ thuộc một bộ — chọn ở đây sẽ gỡ kỳ khỏi bộ đang giữ.
        </div>
      </PopoverContent>
    </Popover>
  )
}
