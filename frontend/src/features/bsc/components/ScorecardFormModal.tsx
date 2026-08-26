import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Layers, Loader2, Scale, ChevronDown, Check, PlusCircle, Edit2, Trash2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usePermission } from '@/hooks/usePermission'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useBscMutations, useBscPerspectives, useFixedPerspectives, useScorecardMutations } from '../hooks/useBsc'
import PerspectiveFormModal from './PerspectiveFormModal'
import FixedPerspectiveFormModal from './FixedPerspectiveFormModal'
import {
  ScorecardResponse, ScorecardRequest, BscScorecardStatus, BscScoringMode, BscEmptyPerspectivePolicy,
  BscFixedPerspective, PerspectiveResponse, FixedPerspectiveResponse,
} from '../types'

interface ScorecardFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  scorecard?: ScorecardResponse
  /** Mở sẵn form tạo hạng mục cho lĩnh vực này (nút "Thêm hạng mục" ngoài danh sách). */
  autoCreateFixed?: BscFixedPerspective
}

interface WeightRow {
  perspectiveId: string
  code: string
  name: string
  color?: string
  fixedPerspective?: BscFixedPerspective
  displayOrder: number
  weight: number
  enabled: boolean
}

const toRow = (p: PerspectiveResponse, weight: number, enabled: boolean): WeightRow => ({
  perspectiveId: p.id,
  code: p.code,
  name: p.name,
  color: p.color,
  fixedPerspective: p.fixedPerspective,
  displayOrder: p.displayOrder,
  weight,
  enabled,
})

export default function ScorecardFormModal({ isOpen, onClose, organizationId, scorecard, autoCreateFixed }: ScorecardFormModalProps) {
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: perspectives } = useBscPerspectives(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives(organizationId)
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { createScorecard, updateScorecard } = useScorecardMutations()
  const { deletePerspective } = useBscMutations()
  const { hasPermission } = usePermission()
  const canManage = hasPermission('BSC:MANAGE')

  // Cây đơn vị phẳng GỒM cả node gốc (level 0) — mirror OKR để chọn nhiều & tick cha chọn hết con.
  const flatOrgUnits = useMemo(() => {
    const flatten = (nodes: any[], level = 0): { id: string; name: string; level: number }[] => {
      let result: { id: string; name: string; level: number }[] = []
      for (const node of nodes || []) {
        result.push({ id: node.id, name: node.name, level })
        if (node.children?.length) result = result.concat(flatten(node.children, level + 1))
      }
      return result
    }
    return flatten(orgUnitTreeData || [])
  }, [orgUnitTreeData])

  const [name, setName] = useState('')
  const [vision, setVision] = useState('')
  const [periodId, setPeriodId] = useState('')
  // Mỗi phần tử là 1 id đơn vị (gồm cả node gốc). Khi TẠO cho phép chọn nhiều → tạo nhiều bộ tiêu chí.
  const [scopes, setScopes] = useState<string[]>([])
  const [status, setStatus] = useState<BscScorecardStatus>(BscScorecardStatus.DRAFT)
  const [emptyPolicy, setEmptyPolicy] = useState<BscEmptyPerspectivePolicy>(BscEmptyPerspectivePolicy.RENORMALIZE)
  const [rows, setRows] = useState<WeightRow[]>([])

  // Hạng mục tạo/sửa/xoá ngay trong modal này, nên `perspectives` đổi giữa chừng là
  // chuyện thường. Chỉ nạp lại toàn bộ form đúng một lần cho mỗi bộ tiêu chí; những lần
  // sau chỉ hợp nhất danh sách để trọng số người dùng đang gõ dở không bị thổi bay.
  const initializedFor = useRef<string | null>(null)
  // Trọng số nhập ngay trong modal hạng mục: hạng mục vừa tạo chưa có dòng nào để gán,
  // nên giữ tạm ở đây rồi áp vào lúc danh sách hạng mục được nạp lại.
  const pendingWeights = useRef<Record<string, number>>({})
  const [perspectiveModal, setPerspectiveModal] = useState<
    { perspective?: PerspectiveResponse; fixed?: BscFixedPerspective } | null
  >(autoCreateFixed ? { fixed: autoCreateFixed } : null)
  const [editingFixed, setEditingFixed] = useState<FixedPerspectiveResponse | undefined>()
  const [deletePerspectiveTarget, setDeletePerspectiveTarget] = useState<WeightRow | null>(null)

  useEffect(() => {
    if (!isOpen) { initializedFor.current = null; return }
    if (!perspectives) return
    const key = scorecard?.id ?? 'new'

    if (initializedFor.current !== key) {
      initializedFor.current = key
      if (scorecard) {
        setName(scorecard.name)
        setVision(scorecard.vision || '')
        setPeriodId(scorecard.kpiPeriodId)
        setScopes((scorecard.orgUnits || []).map(u => u.id))
        setStatus(scorecard.status)
        setEmptyPolicy(scorecard.emptyPerspectivePolicy)
        setRows(perspectives.map(p => {
          const existing = scorecard.perspectives.find(sp => sp.perspectiveId === p.id)
          return toRow(p, existing?.weightPercentage ?? 0, !!existing)
        }))
      } else {
        setName('')
        setVision('')
        setPeriodId('')
        setScopes([])
        setStatus(BscScorecardStatus.DRAFT)
        setEmptyPolicy(BscEmptyPerspectivePolicy.RENORMALIZE)
        setRows(perspectives.map(p => toRow(p, 0, true)))
      }
      return
    }

    // Hạng mục vừa tạo thêm ⇒ vào bộ tiêu chí ngay (đang bật, 0%) để người dùng chỉ còn
    // việc chia trọng số; hạng mục vừa xoá thì rời khỏi danh sách.
    setRows(prev => {
      const byId = new Map(prev.map(r => [r.perspectiveId, r]))
      return perspectives.map(p => {
        const old = byId.get(p.id)
        const pending = pendingWeights.current[p.id]
        if (pending !== undefined) delete pendingWeights.current[p.id]
        return toRow(p, pending ?? old?.weight ?? 0, old?.enabled ?? true)
      })
    })
  }, [isOpen, scorecard, perspectives])

  const enabledRows = rows.filter(r => r.enabled)
  const total = useMemo(() => enabledRows.reduce((s, r) => s + (Number(r.weight) || 0), 0), [enabledRows])
  const isValid = Math.abs(total - 100) <= 0.01 && enabledRows.length > 0

  const setWeight = (id: string, w: number) => setRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, weight: w } : r))

  // Trọng số vừa nhập trong modal hạng mục (tạo mới hoặc sửa) → áp thẳng vào dòng tương ứng.
  const applyPerspectiveWeight = (perspectiveId: string, weight: number) => {
    pendingWeights.current[perspectiveId] = weight
    setRows(prev => prev.map(r => r.perspectiveId === perspectiveId ? { ...r, weight, enabled: true } : r))
  }
  const toggle = (id: string) => setRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, enabled: !r.enabled } : r))

  // Tick node gốc ⇒ chọn/bỏ toàn bộ; tick hết các đơn vị con khác ⇒ tự tick luôn gốc (giống OKR).
  const toggleScope = (unitId: string) => {
    const rootId = flatOrgUnits[0]?.id
    const isRoot = rootId === unitId
    let nextIds: string[]
    if (isRoot) {
      nextIds = scopes.includes(unitId) ? [] : flatOrgUnits.map(u => u.id)
    } else if (scopes.includes(unitId)) {
      nextIds = scopes.filter(id => id !== unitId && id !== rootId)
    } else {
      const tempIds = [...scopes, unitId]
      const allOthersSelected = flatOrgUnits.filter(u => u.id !== rootId).every(u => tempIds.includes(u.id))
      nextIds = allOthersSelected && rootId ? flatOrgUnits.map(u => u.id) : tempIds
    }
    setScopes(nextIds)
  }
  const scopeLabel = (id: string) => flatOrgUnits.find(u => u.id === id)?.name || 'Đơn vị'

  const distributeEvenly = () => {
    const en = rows.filter(r => r.enabled)
    if (en.length === 0) return
    const base = Math.floor((100 / en.length) * 10) / 10
    let remainder = Math.round((100 - base * en.length) * 10) / 10
    setRows(prev => prev.map(r => {
      if (!r.enabled) return r
      let w = base
      if (remainder > 0) { w = Math.round((base + 0.1) * 10) / 10; remainder = Math.round((remainder - 0.1) * 10) / 10 }
      return { ...r, weight: w }
    }))
  }

  const isPending = createScorecard.isPending || updateScorecard.isPending

  const handleSubmit = () => {
    if (!name.trim()) return
    if (!periodId) return
    const payload: ScorecardRequest = {
      name: name.trim(),
      vision: vision.trim() || undefined,
      kpiPeriodId: periodId,
      orgUnitIds: scopes,
      status,
      scoringMode: scorecard?.scoringMode || BscScoringMode.SHADOW,
      emptyPerspectivePolicy: emptyPolicy,
      perspectives: enabledRows.map((r, idx) => ({ perspectiveId: r.perspectiveId, weightPercentage: Number(r.weight) || 0, displayOrder: idx })),
    }
    if (scorecard) {
      // Sửa: phạm vi khoá, backend không đổi orgUnits nên chỉ gửi cấu hình.
      updateScorecard.mutate({ scorecardId: scorecard.id, data: payload }, { onSuccess: () => onClose() })
    } else {
      createScorecard.mutate({ organizationId, data: payload }, { onSuccess: () => onClose() })
    }
  }

  if (!isOpen) return null

  const groups = (fixedPerspectives || []).map(fp => ({
    fixed: fp,
    items: rows.filter(r => r.fixedPerspective === fp.code).sort((a, b) => a.displayOrder - b.displayOrder),
  }))
  // Hạng mục cũ chưa gán lĩnh vực nào thì vẫn phải thấy được, nếu không sẽ có trọng số
  // tính vào tổng mà không có dòng nào hiện ra để sửa.
  const ungrouped = rows.filter(r => !r.fixedPerspective)

  // Trọng số đưa sẵn vào modal hạng mục: dòng đang sửa (nếu có) và tổng của các dòng còn lại.
  const editingRow = rows.find(r => r.perspectiveId === perspectiveModal?.perspective?.id)
  const otherWeightTotal = enabledRows
    .filter(r => r.perspectiveId !== editingRow?.perspectiveId)
    .reduce((s, r) => s + (Number(r.weight) || 0), 0)

  const renderRow = (r: WeightRow) => (
    <div key={r.perspectiveId} className={cn('flex items-center gap-3 px-4 py-2.5 group', !r.enabled && 'opacity-50')}>
      <button type="button" onClick={() => toggle(r.perspectiveId)} title={r.enabled ? 'Bỏ hạng mục khỏi bộ tiêu chí này' : 'Đưa hạng mục vào bộ tiêu chí này'}
        className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', r.enabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600')}>
        {r.enabled && <span className="text-[9px] font-black">✓</span>}
      </button>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color || '#8b5cf6' }} />
      <span className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{r.name}</span>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button type="button" onClick={() => setPerspectiveModal({ perspective: perspectives?.find(p => p.id === r.perspectiveId) })}
          title="Sửa hạng mục" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
          <Edit2 size={14} />
        </button>
        <button type="button" onClick={() => setDeletePerspectiveTarget(r)}
          title="Xoá hạng mục khỏi tổ chức" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input type="number" min={0} max={100} step={0.1} value={r.weight} disabled={!r.enabled}
          onChange={e => setWeight(r.perspectiveId, Number(e.target.value))}
          className="w-20 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <span className="text-xs font-black text-slate-400">%</span>
      </div>
    </div>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[92vh]">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                <Layers size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{scorecard ? 'Chỉnh sửa bộ tiêu chí' : 'Tạo bộ tiêu chí mới'}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">BSC Scorecard</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X size={20} /></button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên bộ tiêu chí <span className="text-red-500">*</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Chiến lược Quý 3/2026"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đợt áp dụng <span className="text-red-500">*</span></label>
                <Select value={periodId} onValueChange={setPeriodId} disabled={!!scorecard}>
                  <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none">
                    <SelectValue placeholder="Chọn đợt" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 max-h-[280px]">
                    {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id} className="text-sm font-bold">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phạm vi áp dụng (phòng ban)</label>
              <Popover>
                <PopoverTrigger asChild disabled={!!scorecard}>
                  <button type="button" disabled={!!scorecard}
                    className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold flex items-center justify-between focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                    <span className="truncate text-left">
                      {scopes.length === 0 ? 'Toàn tổ chức (mặc định)'
                        : scopes.length === 1 ? scopeLabel(scopes[0]!)
                        : `Đã chọn ${scopes.length} đơn vị`}
                    </span>
                    <ChevronDown size={14} className="opacity-50 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-2 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                  <div className="space-y-1">
                    {flatOrgUnits.map(u => {
                      const isSelected = scopes.includes(u.id)
                      return (
                        <div key={u.id} onClick={() => toggleScope(u.id)}
                          className={cn('flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group',
                            isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800')}>
                          <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 group-hover:border-indigo-400')}>
                            {isSelected && <Check size={10} strokeWidth={4} />}
                          </div>
                          <span className="text-xs font-bold truncate" style={{ marginLeft: `${u.level * 12}px` }}>{u.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <p className="text-[10px] font-medium text-slate-400 ml-1">
                {scorecard
                  ? 'Không đổi được phạm vi của bộ tiêu chí đã tạo.'
                  : 'Một bộ tiêu chí có thể áp dụng cho NHIỀU đơn vị (giống OKR). Bỏ trống = áp dụng toàn tổ chức. Tick đơn vị gốc để chọn toàn bộ. Nhân viên dùng bộ tiêu chí chứa đơn vị của họ; nếu không có sẽ kế thừa đơn vị cha.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tuyên bố chiến lược (Vision)</label>
              <textarea value={vision} onChange={e => setVision(e.target.value)} rows={2} placeholder="Câu tuyên bố chiến lược trung tâm..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái</label>
                <Select value={status} onValueChange={v => setStatus(v as BscScorecardStatus)}>
                  <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                    <SelectItem value={BscScorecardStatus.DRAFT} className="text-sm font-bold text-slate-500">Nháp</SelectItem>
                    <SelectItem value={BscScorecardStatus.ACTIVE} className="text-sm font-bold text-emerald-600">Đang áp dụng</SelectItem>
                    <SelectItem value={BscScorecardStatus.ARCHIVED} className="text-sm font-bold text-amber-600">Lưu trữ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Chính sách hạng mục rỗng</label>
                <Select value={emptyPolicy} onValueChange={v => setEmptyPolicy(v as BscEmptyPerspectivePolicy)}>
                  <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                    <SelectItem value={BscEmptyPerspectivePolicy.RENORMALIZE} className="text-sm font-bold">Chuẩn hóa lại (khuyên dùng)</SelectItem>
                    <SelectItem value={BscEmptyPerspectivePolicy.ZERO_FILL} className="text-sm font-bold">Tính 0 điểm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hạng mục & trọng số — xếp theo 4 lĩnh vực, thêm/sửa/xoá ngay tại đây */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                  <Scale size={12} /> Hạng mục & trọng số
                </label>
                <button type="button" onClick={distributeEvenly} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider">Chia đều</button>
              </div>
              <p className="text-[10px] font-medium text-slate-400 ml-1">
                Tick để đưa hạng mục vào bộ tiêu chí này; tổng trọng số các hạng mục được tick phải bằng 100%.
              </p>

              <div className="space-y-3">
                {groups.map(g => (
                  <div key={g.fixed.code} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.fixed.color }} />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{g.fixed.name}</h4>
                      {canManage && (
                        <button type="button" onClick={() => setEditingFixed(g.fixed)} title="Đổi tên/màu lĩnh vực"
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all">
                          <Edit2 size={12} />
                        </button>
                      )}
                      <button type="button" onClick={() => setPerspectiveModal({ fixed: g.fixed.code })}
                        className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors shrink-0">
                        <PlusCircle size={13} /> Thêm hạng mục
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {g.items.map(renderRow)}
                      {g.items.length === 0 && (
                        <div className="px-4 py-4 text-center text-[11px] font-bold text-slate-400">
                          Chưa có hạng mục nào — bấm "Thêm hạng mục" (VD: Công tác giảng dạy, NCKH…)
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {ungrouped.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 dark:border-amber-800/50 overflow-hidden">
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/50">
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Chưa gán lĩnh vực</h4>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">{ungrouped.map(renderRow)}</div>
                  </div>
                )}
              </div>

              <div className={cn('flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-black border',
                isValid ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300')}>
                <span>Tổng trọng số</span>
                <span>{total.toFixed(1)}% {!isValid && `(cần đủ 100%)`}</span>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
            <button type="button" onClick={handleSubmit} disabled={isPending || !isValid || !name.trim() || !periodId}
              className="flex-[2] px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {isPending && <Loader2 className="animate-spin" size={18} />}
              {scorecard ? 'Lưu thay đổi' : 'Xác nhận tạo'}
            </button>
          </div>
        </div>
      </div>

      {/* Các lớp phủ con — z cao hơn để nằm trên modal bộ tiêu chí */}
      <PerspectiveFormModal
        isOpen={!!perspectiveModal}
        onClose={() => setPerspectiveModal(null)}
        organizationId={organizationId}
        perspective={perspectiveModal?.perspective}
        defaultFixedPerspective={perspectiveModal?.fixed}
        overlayClassName="z-[60]"
        showWeight
        defaultWeight={editingRow?.weight ?? 0}
        otherWeightTotal={otherWeightTotal}
        onWeightSubmit={applyPerspectiveWeight}
      />

      <FixedPerspectiveFormModal
        isOpen={!!editingFixed}
        onClose={() => setEditingFixed(undefined)}
        organizationId={organizationId}
        fixedPerspective={editingFixed}
        usedOrders={(fixedPerspectives || []).filter(fp => fp.code !== editingFixed?.code).map(fp => fp.displayOrder)}
        overlayClassName="z-[60]"
      />

      <ConfirmDialog
        open={!!deletePerspectiveTarget}
        onClose={() => setDeletePerspectiveTarget(null)}
        onConfirm={() => {
          if (deletePerspectiveTarget) deletePerspective.mutate(deletePerspectiveTarget.perspectiveId)
          setDeletePerspectiveTarget(null)
        }}
        title="Xóa hạng mục"
        description={`Xoá "${deletePerspectiveTarget?.name ?? ''}" khỏi toàn tổ chức, không chỉ bộ tiêu chí này. Các KPI đang gán vào hạng mục sẽ được gỡ liên kết. Nếu chỉ muốn bỏ khỏi bộ tiêu chí này thì bỏ tick ở ô vuông đầu dòng.`}
        confirmLabel="Xóa"
        loading={deletePerspective.isPending}
      />
    </>
  )
}
