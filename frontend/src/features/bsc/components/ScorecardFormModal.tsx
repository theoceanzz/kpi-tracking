import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Layers, Loader2, Scale, ChevronDown, Check, PlusCircle, Edit2, Trash2, Target, Lock, ShieldAlert } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useBscMutations, useBscPerspectives, useFixedPerspectives, useScorecardMutations } from '../hooks/useBsc'
import PerspectiveFormModal from './PerspectiveFormModal'
import { scorecardSchema, type ScorecardFormData, type WeightRow } from '../schemas/scorecardSchema'
import { toastFirstError } from '@/lib/formErrors'
import FixedPerspectiveFormModal from './FixedPerspectiveFormModal'
import {
  ScorecardResponse, ScorecardRequest, BscScorecardStatus, BscScoringMode, BscEmptyPerspectivePolicy,
  BscFixedPerspective, PerspectiveResponse, FixedPerspectiveResponse, BscScorecardApplyScope,
  ScorecardPerspectiveResponse, BscItemOrigin, BscGateEffect, BscGateScope, BscMeasurementSource,
} from '../types'

interface ScorecardFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  scorecard?: ScorecardResponse
  /** Mở sẵn form tạo hạng mục cho lĩnh vực này (nút "Thêm hạng mục" ngoài danh sách). */
  autoCreateFixed?: BscFixedPerspective
}

/**
 * Dựng một dòng của bảng trọng số.
 *
 * Mục tiêu lấy theo DÒNG của bộ tiêu chí đang sửa (`row`) chứ không phải mặc định của hạng mục:
 * cùng một hạng mục "Doanh thu" nhưng công ty đặt 100 tỷ còn phòng KD đặt 60 tỷ. Chỉ khi bộ tiêu
 * chí chưa đặt riêng (dòng mới, hoặc thẻ chưa từng lưu mục tiêu) mới rơi về con số của hạng mục.
 */
/**
 * Danh sách xổ ra của các select NHỎ trong khay cấu hình.
 *
 * SelectItem của shadcn mặc định `text-sm`, rộng hơn trigger đã thu nhỏ nên nhãn dài
 * ("Không được mức cao nhất") bị xuống dòng. Đè cỡ chữ bằng arbitrary variant thay vì gắn
 * class lên từng item — selector con có độ ưu tiên cao hơn nên thắng được `text-sm` gốc.
 */
const COMPACT_MENU = 'z-[1100] min-w-0 [&_[role=option]]:text-xs [&_[role=option]]:py-1.5 '
  + '[&_[role=option]]:pr-3 [&_[role=option]]:whitespace-nowrap'

const toRow = (
  p: PerspectiveResponse,
  weight: number,
  enabled: boolean,
  row?: Partial<Pick<ScorecardPerspectiveResponse,
    'targetValue' | 'minimumValue' | 'unit' | 'origin' | 'locked' | 'parentItemName'
    | 'parentScorecardName' | 'measurementSource' | 'isGate' | 'gateMinPercent'
    | 'gateEffect' | 'gateCapRating' | 'gateAppliesTo'>>,
): WeightRow => ({
  perspectiveId: p.id,
  code: p.code,
  name: p.name,
  color: p.color,
  fixedPerspective: p.fixedPerspective,
  displayOrder: p.displayOrder,
  targetValue: row ? row.targetValue ?? null : p.targetValue,
  minimumValue: row ? row.minimumValue ?? null : p.minimumValue,
  unit: row ? row.unit ?? null : p.unit,
  origin: row?.origin ?? BscItemOrigin.SELF,
  locked: row?.locked ?? false,
  parentItemName: row?.parentItemName ?? null,
  parentScorecardName: row?.parentScorecardName ?? null,
  measurementSource: row?.measurementSource ?? BscMeasurementSource.ROLLUP,
  isGate: row?.isGate ?? false,
  gateMinPercent: row?.gateMinPercent ?? null,
  gateEffect: row?.gateEffect ?? null,
  gateCapRating: row?.gateCapRating ?? null,
  gateAppliesTo: row?.gateAppliesTo ?? BscGateScope.BOTH,
  weight,
  enabled,
})

export default function ScorecardFormModal({ isOpen, onClose, organizationId, scorecard, autoCreateFixed }: ScorecardFormModalProps) {
  const { data: periodsData } = useKpiPeriods({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { data: cyclesData } = useKpiCycles({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const { data: perspectives } = useBscPerspectives(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives(organizationId)
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { createScorecard, updateScorecard } = useScorecardMutations()
  const { deletePerspective } = useBscMutations()
  const { hasPermission } = usePermission()
  const { user } = useAuthStore()
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

  const { register, handleSubmit: rhfHandleSubmit, reset, watch, setValue, getValues } = useForm<ScorecardFormData>({
    resolver: zodResolver(scorecardSchema),
    defaultValues: {
      name: '', vision: '',
      applyScope: BscScorecardApplyScope.PERIOD,
      periodIds: [], cycleId: '', scopes: [],
      status: BscScorecardStatus.DRAFT,
      emptyPolicy: BscEmptyPerspectivePolicy.RENORMALIZE,
      rows: [],
    },
  })

  // Bảng trọng số và các ô tick đợt/đơn vị đều là điều khiển tự vẽ, còn tổng trọng số
  // phải cập nhật theo từng lần gõ, nên đọc qua watch thay vì đăng ký từng ô.
  const applyScope = watch('applyScope')
  const periodIds = watch('periodIds')
  const cycleId = watch('cycleId')
  const scopes = watch('scopes')
  const status = watch('status')
  const emptyPolicy = watch('emptyPolicy')
  const rows = watch('rows')

  /** Thay danh sách dòng dựa trên danh sách hiện tại — thay cho `setRows(prev => …)`. */
  const updateRows = (fn: (prev: WeightRow[]) => WeightRow[]) =>
    setValue('rows', fn(getValues('rows')), { shouldValidate: true })

  const allPeriods = useMemo(() => periodsData?.content || [], [periodsData])
  const allCycles = useMemo(() => cyclesData?.content || [], [cyclesData])
  // Đợt xếp theo kỳ để tick nhanh cả cụm; đợt không thuộc kỳ nào dồn xuống cuối.
  const periodGroups = useMemo(() => {
    const groups = new Map<string, { label: string; items: typeof allPeriods }>()
    for (const p of allPeriods) {
      const key = p.cycleId || '__none__'
      if (!groups.has(key)) groups.set(key, { label: p.cycleName || 'Không thuộc kỳ nào', items: [] })
      groups.get(key)!.items.push(p)
    }
    return [...groups.entries()].sort((a, b) => (a[0] === '__none__' ? 1 : b[0] === '__none__' ? -1 : 0)).map(([, g]) => g)
  }, [allPeriods])
  const cyclePeriods = useMemo(() => allPeriods.filter(p => p.cycleId === cycleId), [allPeriods, cycleId])


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
  // Dòng nào đang mở ô nhập mục tiêu riêng. Mặc định đóng để bảng trọng số vẫn gọn —
  // phần lớn hạng mục dùng luôn mục tiêu mặc định của danh mục.
  const [openTargetRows, setOpenTargetRows] = useState<string[]>([])

  /**
   * Phạm vi mặc định theo quyền: quản trị BSC toàn tổ chức mở form là đứng sẵn ở ĐƠN VỊ GỐC
   * (tức lập BSC công ty); trưởng đơn vị đứng sẵn ở đơn vị của chính họ. Cả hai đều là việc họ
   * làm nhiều nhất, và chọn sai phạm vi thì backend chặn nên đoán đúng ngay từ đầu đỡ một vòng lỗi.
   */
  const ownUnitId = user?.memberships?.[0]?.orgUnitId
  const rootUnitId = flatOrgUnits[0]?.id
  const defaultScopeIds = useMemo(() => {
    if (canManage) return rootUnitId ? [rootUnitId] : []
    return ownUnitId ? [ownUnitId] : []
  }, [canManage, rootUnitId, ownUnitId])

  /** Người dùng đã tự đụng vào phạm vi chưa — chạm rồi thì không điền mặc định đè lên nữa. */
  const scopeTouched = useRef(false)

  useEffect(() => {
    if (!isOpen) { initializedFor.current = null; return }
    if (!perspectives) return
    const key = scorecard?.id ?? 'new'

    if (initializedFor.current !== key) {
      initializedFor.current = key
      if (scorecard) {
        reset({
          name: scorecard.name,
          vision: scorecard.vision || '',
          applyScope: scorecard.applyScope || BscScorecardApplyScope.PERIOD,
          periodIds: scorecard.applyScope === BscScorecardApplyScope.CYCLE ? [] : (scorecard.periods || []).map(p => p.id),
          cycleId: scorecard.kpiCycleId || '',
          scopes: (scorecard.orgUnits || []).map(u => u.id),
          status: scorecard.status,
          emptyPolicy: scorecard.emptyPerspectivePolicy,
          rows: perspectives.map(p => {
            const existing = scorecard.perspectives.find(sp => sp.perspectiveId === p.id)
            return toRow(p, existing?.weightPercentage ?? 0, !!existing, existing)
          }),
        })
      } else {
        scopeTouched.current = false
        reset({
          name: '', vision: '',
          applyScope: BscScorecardApplyScope.PERIOD,
          periodIds: [], cycleId: '', scopes: defaultScopeIds,
          status: BscScorecardStatus.DRAFT,
          emptyPolicy: BscEmptyPerspectivePolicy.RENORMALIZE,
          rows: perspectives.map(p => toRow(p, 0, true)),
        })
      }
      return
    }

    // Hạng mục vừa tạo thêm ⇒ vào bộ tiêu chí ngay (đang bật, 0%) để người dùng chỉ còn
    // việc chia trọng số; hạng mục vừa xoá thì rời khỏi danh sách.
    updateRows(prev => {
      const byId = new Map(prev.map(r => [r.perspectiveId, r]))
      return perspectives.map(p => {
        const old = byId.get(p.id)
        const pending = pendingWeights.current[p.id]
        if (pending !== undefined) delete pendingWeights.current[p.id]
        return toRow(p, pending ?? old?.weight ?? 0, old?.enabled ?? true, old)
      })
    })
  }, [isOpen, scorecard, perspectives])

  // Cây đơn vị nạp bất đồng bộ nên thường tới SAU lần reset đầu tiên, lúc đó mặc định còn rỗng.
  // Điền bù ở đây, và chỉ khi người dùng chưa tự chọn gì để không thổi bay lựa chọn của họ.
  useEffect(() => {
    if (!isOpen || scorecard || scopeTouched.current) return
    if (defaultScopeIds.length === 0 || getValues('scopes').length > 0) return
    setValue('scopes', defaultScopeIds)
  }, [isOpen, scorecard, defaultScopeIds, getValues, setValue])

  const enabledRows = rows.filter(r => r.enabled)
  const total = useMemo(() => enabledRows.reduce((s, r) => s + (Number(r.weight) || 0), 0), [enabledRows])
  const isValid = Math.abs(total - 100) <= 0.01 && enabledRows.length > 0

  const setWeight = (id: string, w: number) => updateRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, weight: w } : r))

  // Trọng số vừa nhập trong modal hạng mục (tạo mới hoặc sửa) → áp thẳng vào dòng tương ứng.
  const applyPerspectiveWeight = (perspectiveId: string, weight: number) => {
    pendingWeights.current[perspectiveId] = weight
    updateRows(prev => prev.map(r => r.perspectiveId === perspectiveId ? { ...r, weight, enabled: true } : r))
  }
  const toggle = (id: string) => updateRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, enabled: !r.enabled } : r))

  /**
   * Sửa cấu hình riêng của một dòng: mục tiêu, nguồn số liệu, hạng mục chặn.
   * `null` ở mục tiêu = xoá con số riêng, quay về mặc định của hạng mục.
   */
  const setRowTarget = (id: string, patch: Partial<Pick<WeightRow,
    'targetValue' | 'minimumValue' | 'unit' | 'measurementSource'
    | 'isGate' | 'gateMinPercent' | 'gateEffect' | 'gateCapRating' | 'gateAppliesTo'>>) =>
    updateRows(prev => prev.map(r => r.perspectiveId === id ? { ...r, ...patch } : r))

  const toggleTargetRow = (id: string) =>
    setOpenTargetRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // Tick node gốc ⇒ chọn/bỏ toàn bộ; tick hết các đơn vị con khác ⇒ tự tick luôn gốc (giống OKR).
  /**
   * Tick thẳng đúng đơn vị được chọn, KHÔNG lan xuống cây nữa.
   *
   * Trước đây tick node gốc là chọn hết mọi đơn vị. Với mô hình phân cấp thì đó là bẫy: thẻ phủ
   * toàn bộ đơn vị sẽ đụng phạm vi với mọi BSC phòng ban tạo sau, làm kẹt luôn việc phân rã.
   * Nhân viên vẫn được phủ vì lúc chấm điểm hệ thống đi ngược lên cây tìm thẻ gần nhất — gắn ở
   * gốc là đủ, không cần liệt kê từng đơn vị con.
   */
  const toggleScope = (unitId: string) => {
    scopeTouched.current = true
    const nextIds = scopes.includes(unitId)
      ? scopes.filter(id => id !== unitId)
      : [...scopes, unitId]
    setValue('scopes', nextIds, { shouldValidate: true })
  }
  const scopeLabel = (id: string) => flatOrgUnits.find(u => u.id === id)?.name || 'Đơn vị'

  const isCycleMode = applyScope === BscScorecardApplyScope.CYCLE

  const setPeriodIds = (next: string[]) => setValue('periodIds', next, { shouldValidate: true })
  const togglePeriod = (id: string) =>
    setPeriodIds(periodIds.includes(id) ? periodIds.filter(x => x !== id) : [...periodIds, id])
  const togglePeriodGroup = (ids: string[]) => {
    const allOn = ids.every(id => periodIds.includes(id))
    setPeriodIds(allOn ? periodIds.filter(id => !ids.includes(id)) : [...new Set([...periodIds, ...ids])])
  }
  const periodTriggerLabel = periodIds.length === 0
    ? 'Chọn đợt áp dụng'
    : periodIds.length === 1
      ? (allPeriods.find(p => p.id === periodIds[0])?.name || '1 đợt')
      : `Đã chọn ${periodIds.length} đợt`

  /**
   * Chia đều phần trọng số CÒN LẠI cho các dòng đơn vị tự quản.
   *
   * Dòng cấp trên giao có trọng số do cấp trên đặt và bị khoá — chia vào đó là chia hụt: giao diện
   * hiện đủ 100% nhưng lúc lưu backend bỏ qua trọng số của dòng khoá, tải lại là thiếu đúng bằng
   * phần đã chia nhầm. Nên giữ nguyên dòng khoá và chỉ chia 100 trừ đi phần chúng đang chiếm.
   */
  const distributeEvenly = () => {
    const editable = rows.filter(r => r.enabled && !r.locked)
    if (editable.length === 0) return
    const lockedTotal = rows
      .filter(r => r.enabled && r.locked)
      .reduce((sum, r) => sum + (Number(r.weight) || 0), 0)
    const pool = Math.max(0, Math.round((100 - lockedTotal) * 10) / 10)

    const base = Math.floor((pool / editable.length) * 10) / 10
    let remainder = Math.round((pool - base * editable.length) * 10) / 10
    updateRows(prev => prev.map(r => {
      if (!r.enabled || r.locked) return r
      let w = base
      if (remainder > 0) { w = Math.round((base + 0.1) * 10) / 10; remainder = Math.round((remainder - 0.1) * 10) / 10 }
      return { ...r, weight: w }
    }))
  }

  const isPending = createScorecard.isPending || updateScorecard.isPending

  const onSubmit = (data: ScorecardFormData) => {
    const cycleMode = data.applyScope === BscScorecardApplyScope.CYCLE
    const payload: ScorecardRequest = {
      name: data.name.trim(),
      vision: data.vision.trim() || undefined,
      applyScope: data.applyScope,
      kpiPeriodIds: cycleMode ? undefined : data.periodIds,
      kpiCycleId: cycleMode ? data.cycleId : undefined,
      orgUnitIds: data.scopes,
      status: data.status,
      scoringMode: scorecard?.scoringMode || BscScoringMode.SHADOW,
      emptyPerspectivePolicy: data.emptyPolicy,
      // Mục tiêu gửi kèm từng dòng: backend coi danh sách này là authoritative nên null ở đây
      // đúng nghĩa "hạng mục này không đặt mục tiêu riêng trong bộ tiêu chí".
      perspectives: data.rows.filter(r => r.enabled)
        .map((r, idx) => ({
          perspectiveId: r.perspectiveId,
          weightPercentage: Number(r.weight) || 0,
          displayOrder: idx,
          targetValue: r.targetValue ?? null,
          minimumValue: r.minimumValue ?? null,
          unit: r.unit ?? null,
          measurementSource: r.measurementSource ?? null,
          isGate: r.isGate ?? false,
          gateMinPercent: r.gateMinPercent ?? null,
          gateEffect: r.gateEffect ?? null,
          gateCapRating: r.gateCapRating ?? null,
          gateAppliesTo: r.gateAppliesTo ?? null,
        })),
    }
    if (scorecard) {
      // Sửa: phạm vi phòng ban khoá (backend bỏ qua orgUnits), nhưng đợt/kỳ áp dụng thì đổi được.
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

  const renderRow = (r: WeightRow) => {
    const catalog = perspectives?.find(p => p.id === r.perspectiveId)
    // "Riêng" = con số của bộ tiêu chí này khác mặc định của hạng mục. Hiện nhãn để người
    // dùng biết vì sao cùng một hạng mục lại hiển thị mục tiêu khác nhau ở hai bộ tiêu chí.
    const isOwnTarget = !!catalog && (
      (r.targetValue ?? null) !== (catalog.targetValue ?? null)
      || (r.minimumValue ?? null) !== (catalog.minimumValue ?? null)
      || (r.unit ?? null) !== (catalog.unit ?? null)
    )
    const targetOpen = openTargetRows.includes(r.perspectiveId)
    return (
    <div key={r.perspectiveId} className={cn('group', !r.enabled && 'opacity-50')}>
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button type="button" onClick={() => { if (!r.locked) toggle(r.perspectiveId) }} disabled={!!r.locked}
        title={r.locked
          ? 'Chỉ tiêu cấp trên giao — bỏ khỏi bộ tiêu chí phải đi qua cấp trên'
          : r.enabled ? 'Bỏ hạng mục khỏi bộ tiêu chí này' : 'Đưa hạng mục vào bộ tiêu chí này'}
        className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', r.enabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600')}>
        {r.enabled && <span className="text-[9px] font-black">✓</span>}
      </button>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color || '#8b5cf6' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
          {r.name}
          {r.origin === BscItemOrigin.ASSIGNED && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              title={`Chỉ tiêu cấp trên giao xuống${r.parentScorecardName ? ` từ "${r.parentScorecardName}"` : ''} — không sửa được mục tiêu và trọng số ở đây`}>
              <Lock size={9} /> cấp trên giao
            </span>
          )}
        </p>
        {(r.targetValue != null || r.minimumValue != null) && (
          <p className="text-[10px] font-bold text-slate-400 truncate">
            {r.targetValue != null && <>Mục tiêu {r.targetValue}{r.unit ? ` ${r.unit}` : ''}</>}
            {r.targetValue != null && r.minimumValue != null && ' · '}
            {r.minimumValue != null && <>Tối thiểu {r.minimumValue}{r.unit ? ` ${r.unit}` : ''}</>}
            {r.targetValue != null && r.targetValue > 0 && (
              <span className="ml-1.5 text-indigo-500" title="Hạng mục tự chấm theo mục tiêu của chính nó (kiểu OKR)">· tự chấm</span>
            )}
            {isOwnTarget && (
              <span className="ml-1.5 text-amber-500" title="Mục tiêu đặt riêng cho bộ tiêu chí này, khác mặc định của hạng mục">· riêng</span>
            )}
            {r.isGate && (
              <span className="ml-1.5 text-red-500" title="Hạng mục chặn: không đạt thì bị áp trần xếp loại (điểm không bị trừ)">· chặn</span>
            )}
          </p>
        )}
      </div>
      {/* Cả ba nút hiện thường trực. Giấu sau hover thì người dùng không biết là có —
          riêng nút cấu hình là thao tác chính của luồng phân rã nên càng không được giấu.
          Xoá vẫn an toàn vì phải qua hộp xác nhận nói rõ là xoá khỏi TOÀN tổ chức. */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button type="button" onClick={() => toggleTargetRow(r.perspectiveId)} disabled={!r.enabled}
          title="Mục tiêu riêng, hạng mục chặn và nguồn số liệu cho bộ tiêu chí này"
          className={cn('p-1.5 rounded-lg transition-all disabled:opacity-40',
            targetOpen || isOwnTarget || r.isGate
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/20'
              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30')}>
          <Target size={14} />
        </button>
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
        <input type="number" min={0} max={100} step={0.1} value={r.weight} disabled={!r.enabled || !!r.locked}
          title={r.locked ? 'Trọng số do cấp trên đặt — liên hệ cấp trên nếu cần đổi' : undefined}
          onChange={e => setWeight(r.perspectiveId, Number(e.target.value))}
          className="w-20 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20" />
        <span className="text-xs font-black text-slate-400">%</span>
      </div>
    </div>

    {targetOpen && (
      <div className="px-4 pb-3 -mt-0.5 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Mục tiêu</label>
          <input type="number" step="any" value={r.targetValue ?? ''} disabled={!r.enabled || !!r.locked}
            onChange={e => setRowTarget(r.perspectiveId, { targetValue: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder={catalog?.targetValue != null ? String(catalog.targetValue) : '—'}
            className="w-28 px-2 py-1.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:placeholder:text-transparent" />
        </div>
        <div className="space-y-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Tối thiểu</label>
          <input type="number" step="any" value={r.minimumValue ?? ''} disabled={!r.enabled || !!r.locked}
            onChange={e => setRowTarget(r.perspectiveId, { minimumValue: e.target.value === '' ? null : Number(e.target.value) })}
            placeholder={catalog?.minimumValue != null ? String(catalog.minimumValue) : '—'}
            className="w-28 px-2 py-1.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:placeholder:text-transparent" />
        </div>
        <div className="space-y-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Đơn vị</label>
          <input type="text" value={r.unit ?? ''} disabled={!r.enabled || !!r.locked}
            onChange={e => setRowTarget(r.perspectiveId, { unit: e.target.value.trim() === '' ? null : e.target.value })}
            placeholder={catalog?.unit || 'VNĐ, %, buổi...'}
            className="w-28 px-2 py-1.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20 focus:placeholder:text-transparent" />
        </div>
        {isOwnTarget && !r.locked && (
          <button type="button"
            onClick={() => setRowTarget(r.perspectiveId, {
              targetValue: catalog?.targetValue ?? null,
              minimumValue: catalog?.minimumValue ?? null,
              unit: catalog?.unit ?? null,
            })}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all">
            Về mặc định
          </button>
        )}
        <p className="w-full text-[10px] font-bold text-slate-400 mt-0.5">
          {r.locked
            ? 'Chỉ tiêu cấp trên giao: mục tiêu và trọng số do cấp trên đặt. Đơn vị chỉ gắn KPI con và cập nhật kết quả.'
            : 'Con số riêng của bộ tiêu chí này. Bỏ trống = dùng mục tiêu mặc định của hạng mục.'}
        </p>

        {/* Hạng mục chặn — "câu chặn 10": không đạt thì bị áp TRẦN XẾP LOẠI, điểm giữ nguyên. */}
        <div className="w-full pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!r.isGate} disabled={!r.enabled || !!r.locked}
              onChange={e => setRowTarget(r.perspectiveId, {
                isGate: e.target.checked,
                // Bật chặn mà bỏ trống ngưỡng thì dòng đó im lặng không có tác dụng gì.
                gateMinPercent: e.target.checked ? (r.gateMinPercent ?? 100) : null,
                gateEffect: e.target.checked ? (r.gateEffect ?? BscGateEffect.BLOCK_EXCELLENT) : null,
              })}
              className="w-3.5 h-3.5 rounded accent-red-500" />
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-600 dark:text-slate-300">
              <ShieldAlert size={12} className={r.isGate ? 'text-red-500' : 'text-slate-400'} />
              Hạng mục chặn
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Không đạt ngưỡng thì bị hạ trần xếp loại — điểm số KHÔNG bị trừ
            </span>
          </label>

          {r.isGate && (
            <div className="flex flex-wrap items-end gap-2 pl-5">
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Ngưỡng %</label>
                <input type="number" step="any" value={r.gateMinPercent ?? ''} disabled={!!r.locked}
                  onChange={e => setRowTarget(r.perspectiveId, {
                    gateMinPercent: e.target.value === '' ? null : Number(e.target.value),
                  })}
                  className="w-20 h-9 px-3 rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-sm font-bold outline-none disabled:opacity-50" />
              </div>
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Hệ quả</label>
                <Select value={r.gateEffect ?? BscGateEffect.BLOCK_EXCELLENT} disabled={!!r.locked}
                  onValueChange={v => setRowTarget(r.perspectiveId, { gateEffect: v as BscGateEffect })}>
                  <SelectTrigger className="h-9 w-auto min-w-[12rem] gap-2 px-3 py-0 rounded-lg text-xs font-bold bg-red-50/60 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 focus:ring-1 focus:ring-red-400 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                  <SelectContent className={COMPACT_MENU}>
                    <SelectItem value={BscGateEffect.BLOCK_EXCELLENT}>Không được mức cao nhất</SelectItem>
                    <SelectItem value={BscGateEffect.CAP_AT_RATING}>Trần đúng mức...</SelectItem>
                    <SelectItem value={BscGateEffect.WARN_ONLY}>Chỉ cảnh báo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {r.gateEffect === BscGateEffect.CAP_AT_RATING && (
                <div className="space-y-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Mức trần</label>
                  <input type="number" min={1} max={5} value={r.gateCapRating ?? ''} disabled={!!r.locked}
                    onChange={e => setRowTarget(r.perspectiveId, {
                      gateCapRating: e.target.value === '' ? null : Number(e.target.value),
                    })}
                    className="w-16 h-9 px-3 rounded-lg bg-red-50/60 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-sm font-bold outline-none disabled:opacity-50" />
                </div>
              )}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Áp cho</label>
                <Select value={r.gateAppliesTo ?? BscGateScope.BOTH} disabled={!!r.locked}
                  onValueChange={v => setRowTarget(r.perspectiveId, { gateAppliesTo: v as BscGateScope })}>
                  <SelectTrigger className="h-9 w-auto min-w-[12rem] gap-2 px-3 py-0 rounded-lg text-xs font-bold bg-red-50/60 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 focus:ring-1 focus:ring-red-400 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                  <SelectContent className={COMPACT_MENU}>
                    <SelectItem value={BscGateScope.BOTH}>Cá nhân và đơn vị</SelectItem>
                    <SelectItem value={BscGateScope.INDIVIDUAL}>Chỉ cá nhân</SelectItem>
                    <SelectItem value={BscGateScope.UNIT}>Chỉ đơn vị</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Nguồn kết quả đơn vị</label>
              <Select value={r.measurementSource ?? BscMeasurementSource.ROLLUP} disabled={!r.enabled}
                onValueChange={v => setRowTarget(r.perspectiveId, { measurementSource: v as BscMeasurementSource })}>
                <SelectTrigger className="h-9 w-auto min-w-[10.5rem] gap-2 px-3 py-0 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 focus:ring-1 focus:ring-indigo-400 focus:ring-offset-0"><SelectValue /></SelectTrigger>
                <SelectContent className={COMPACT_MENU}>
                  <SelectItem value={BscMeasurementSource.ROLLUP}>Tự cộng từ KPI</SelectItem>
                  <SelectItem value={BscMeasurementSource.MANUAL}>Nhập tay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Giải thích đổi theo lựa chọn: hai nguồn này khác nhau ở CHỖ LẤY SỐ, mà nhìn tên
                thì không thấy được — nói mơ hồ thì người dùng chọn bừa rồi kết quả đơn vị ra rỗng. */}
            <p className="flex-1 text-[10px] font-medium text-slate-400 pb-1.5 leading-relaxed">
              {(r.measurementSource ?? BscMeasurementSource.ROLLUP) === BscMeasurementSource.ROLLUP
                ? 'Hệ thống tự cộng kết quả của các KPI cá nhân đang gắn vào chỉ tiêu này rồi so với mục tiêu. Không KPI nào gắn vào thì chỉ tiêu không có số.'
                : 'Người phụ trách tự gõ con số thực đạt của cả đơn vị ở tab Cây phân rã → Kết quả BSC. Dùng cho chỉ tiêu không phân rã hết xuống cá nhân (VD doanh thu phòng lấy từ báo cáo tài chính).'}
            </p>
          </div>
        </div>
      </div>
    )}
    </div>
    )
  }

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
                <input {...register('name')} placeholder="VD: Chiến lược Quý 3/2026"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Áp dụng theo <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: BscScorecardApplyScope.PERIOD, label: 'Đợt' },
                    { value: BscScorecardApplyScope.CYCLE, label: 'Kỳ' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setValue('applyScope', opt.value, { shouldValidate: true })}
                      className={cn('h-10 rounded-xl border text-xs font-black uppercase tracking-wider transition-all',
                        applyScope === opt.value
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-indigo-300')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Theo KỲ: chọn đúng 1 kỳ, mọi đợt trong kỳ tự áp dụng. Theo ĐỢT: tick nhiều đợt. */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {isCycleMode ? 'Kỳ áp dụng' : 'Đợt áp dụng (chọn nhiều)'} <span className="text-red-500">*</span>
              </label>

              {isCycleMode ? (
                <Select value={cycleId} onValueChange={v => setValue('cycleId', v, { shouldValidate: true })}>
                  <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none">
                    <SelectValue placeholder="Chọn kỳ đánh giá" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 max-h-[280px]">
                    {allCycles.map(c => <SelectItem key={c.id} value={c.id} className="text-sm font-bold">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button"
                      className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold flex items-center justify-between focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all">
                      <span className={cn('truncate text-left', periodIds.length === 0 && 'text-slate-400')}>{periodTriggerLabel}</span>
                      <ChevronDown size={14} className="opacity-50 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                    {allPeriods.length === 0 && (
                      <p className="px-3 py-2 text-xs font-bold text-slate-400">Chưa có đợt KPI nào</p>
                    )}
                    {periodGroups.map(g => {
                      const ids = g.items.map(p => p.id)
                      const allOn = ids.every(id => periodIds.includes(id))
                      return (
                        <div key={g.label} className="mb-1 last:mb-0">
                          <div className="flex items-center justify-between px-3 py-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{g.label}</span>
                            <button type="button" onClick={() => togglePeriodGroup(ids)}
                              className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider shrink-0">
                              {allOn ? 'Bỏ chọn' : 'Chọn hết'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {g.items.map(p => {
                              const isSelected = periodIds.includes(p.id)
                              return (
                                <div key={p.id} onClick={() => togglePeriod(p.id)}
                                  className={cn('flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors group',
                                    isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800')}>
                                  <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                                    isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 dark:border-slate-700 group-hover:border-indigo-400')}>
                                    {isSelected && <Check size={10} strokeWidth={4} />}
                                  </div>
                                  <span className="text-xs font-bold truncate">{p.name}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </PopoverContent>
                </Popover>
              )}

              <p className="text-[10px] font-medium text-slate-400 ml-1">
                {isCycleMode
                  ? cycleId
                    ? `Áp dụng cho ${cyclePeriods.length} đợt thuộc kỳ này${cyclePeriods.length > 0 ? ': ' + cyclePeriods.map(p => p.name).join(', ') : ''}. Đợt thêm vào kỳ sau này cũng tự áp dụng.`
                    : 'Chọn 1 kỳ — mọi đợt thuộc kỳ (kể cả đợt thêm sau) đều dùng bộ tiêu chí này.'
                  : 'Tick nhiều đợt để dùng chung một bộ tiêu chí. Cần áp dụng cho cả kỳ thì chuyển sang "Kỳ".'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phạm vi áp dụng (phòng ban)</label>
              <Popover>
                <PopoverTrigger asChild disabled={!!scorecard}>
                  <button type="button" disabled={!!scorecard}
                    className="w-full h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold flex items-center justify-between focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                    <span className="truncate text-left">
                      {scopes.length === 0 ? 'Chưa chọn đơn vị'
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
                  : 'Chọn ĐƠN VỊ GỐC nếu đây là BSC của cả công ty — không cần tick thêm đơn vị con, nhân viên nào không có BSC riêng sẽ tự kế thừa lên trên. Một bộ tiêu chí cũng có thể áp cho nhiều đơn vị ngang hàng (giống OKR).'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tuyên bố chiến lược (Vision)</label>
              <textarea {...register('vision')} rows={2} placeholder="Câu tuyên bố chiến lược trung tâm..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái</label>
                <Select value={status} onValueChange={v => setValue('status', v as BscScorecardStatus)}>
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
                <Select value={emptyPolicy} onValueChange={v => setValue('emptyPolicy', v as BscEmptyPerspectivePolicy)}>
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
            <button type="button" onClick={rhfHandleSubmit(onSubmit, toastFirstError)} disabled={isPending}
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
