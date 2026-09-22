import { useMemo, useEffect, useRef, useState } from 'react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi, type AiKpiSuggestion } from '../api/kpiApi'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useFormAssistStore } from '@/store/formAssistStore'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { FREQUENCY_MAP, cn, formatDateTime, formatNumber } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import {
  Loader2, Check, Sparkles, Target, Users, LayoutGrid, SlidersHorizontal, BarChart3, RotateCcw, RefreshCw,
  CalendarRange, AlertTriangle, Link2, Unlink, SplitSquareHorizontal,
} from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useBscPerspectives, useScorecards, useFixedPerspectives, useBscKpiPlan } from '@/features/bsc/hooks/useBsc'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'
import { perspectiveHint } from '@/features/bsc/utils/perspectiveHint'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Section } from '@/components/common/ScoreForm'
import { Field, Hint, SourceCard, Stat, ToggleCard } from './KpiFormParts'
import type { BscKpiPlanResponse } from '@/features/bsc/types'

interface KpiFormModalProps {
  open: boolean
  onClose: () => void
  editKpi?: KpiCriteria | null
  parentKpi?: KpiCriteria | null
  parentRelationType?: 'DELEGATION' | 'DECOMPOSITION'
  /**
   * `modal` (mặc định) giữ nguyên lớp phủ + tiêu đề + nút Hủy như hai trang đang dùng.
   * `inline` bỏ khung đó để nhúng thẳng vào một bước của trình thiết lập, nơi khung wizard đã lo
   * phần tiêu đề và điều hướng.
   */
  variant?: 'modal' | 'inline'
  /** Gọi kèm chỉ tiêu vừa tạo. */
  onCreated?: (kpi: KpiCriteria) => void
  /** Tạo xong thì dọn form và Ở LẠI để thêm cái tiếp theo, thay vì đóng. */
  keepOpenAfterCreate?: boolean
  /** Nhãn nút xác nhận. Trong wizard là "Thêm chỉ tiêu". */
  submitLabel?: string
  /** Báo ra ngoài đợt và đơn vị đang chọn, ngay khi người dùng vừa chọn. */
  onContextChange?: (ctx: { kpiPeriodId?: string; orgUnitIds: string[] }) => void
  /** Khoá đợt: form dùng luôn giá trị này và hiện một thẻ chỉ-đọc thay cho ô chọn. */
  lockedPeriodId?: string
  /** Đơn vị tích sẵn khi mở form — thường là đơn vị người dùng đang trực thuộc. */
  defaultOrgUnitIds?: string[]
  /** Thu ô chọn đơn vị thành một dòng gọn, bung ra khi bấm "Đổi". */
  compactOrgUnits?: boolean
  /** Bấm một đơn vị là THAY lựa chọn cũ, không cộng dồn — hành vi nút radio. */
  singleOrgUnit?: boolean
}

const frequencyOptions = (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'] as const).map(value => ({
  value,
  label: FREQUENCY_MAP[value]
}))

const TYPE_LEVEL: Record<string, number> = {
  UNLIMITED: 0, DAILY: 1, WEEKLY: 2, MONTHLY: 3, QUARTERLY: 4, SEMI_ANNUALLY: 5, YEARLY: 6,
}

const NONE = '00000000-0000-0000-0000-000000000000'

// Empty numeric inputs must become `undefined`, not NaN — otherwise hidden fields
// (e.g. target/minimum on the qualitative tab) keep a NaN value and fail zod validation.
const numOrUndef = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v)

const round2 = (v: number) => Math.round(v * 100) / 100

function toDatetimeLocal(value?: string | null): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  if (isNaN(d.getTime())) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Nguồn của chỉ tiêu: tự do, một hạng mục BSC, hay một kết quả then chốt của OKR. */
type Source = 'FREE' | 'BSC' | 'OKR'

/** Một dòng khi chia hạng mục BSC ra từng đợt của kỳ. */
interface SplitRow {
  kpiPeriodId: string
  periodName: string
  selected: boolean
  name: string
  targetValue?: number
  minimumValue?: number
  weight?: number
  /** Trọng số hạng mục đã có KPI khác chiếm trong đợt này. */
  allocatedWeight: number
  kpiCount: number
}

/**
 * Form tạo / sửa chỉ tiêu, xếp theo CHIỀU PHỤ THUỘC của dữ liệu:
 *
 *   ① Bối cảnh  — đợt, đơn vị, người nhận: quyết định bộ tiêu chí BSC / OKR nào áp dụng.
 *   ② Nguồn     — tự do / hạng mục BSC / KR: chọn xong thì ĐIỀN SẴN mục tiêu, đơn vị tính,
 *                 trọng số còn trống của hạng mục, tên gợi ý. Hạng mục trải nhiều đợt thì chia
 *                 luôn tại đây (gộp từ BscKpiSplitModal cũ).
 *   ③ Nội dung  — tên, mô tả, con số: sửa vượt số nguồn thì CẢNH BÁO, không chặn.
 *
 * Bản cũ để tên và con số ở trên cùng, hạng mục BSC / KR ở dưới cùng: gõ 100 triệu xong mới
 * thấy hạng mục chỉ có 80, lại kéo lên sửa.
 */
export default function KpiFormModal({
  open, onClose, editKpi, parentKpi, parentRelationType,
  variant = 'modal', onCreated, keepOpenAfterCreate = false, submitLabel, onContextChange,
  lockedPeriodId, defaultOrgUnitIds, compactOrgUnits = false, singleOrgUnit = false,
}: KpiFormModalProps) {
  const isInline = variant === 'inline'
  const isEdit = !!editKpi
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ORG:VIEW')
  const canReview = hasPermission('SUBMISSION:REVIEW')
  const canAssignRoles = hasPermission('ROLE:ASSIGN')

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const isStaff = user?.memberships?.[0]?.roleRank === 2
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const enableOkr = org?.enableOkr
  const { data: objectives } = useObjectives(enableOkr ? organizationId : undefined)

  const enableBsc = org?.enableBsc
  const { data: perspectives } = useBscPerspectives(enableBsc ? organizationId : undefined)
  const { data: fixedPerspectives } = useFixedPerspectives()
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)

  const groupedPerspectives = useMemo(() => {
    const order = (fixedPerspectives || []).map(fp => fp.code)
    const nameByCode = new Map((fixedPerspectives || []).map(fp => [fp.code, fp.name]))
    const groups = (perspectives || []).reduce((acc, p) => {
      const key = p.fixedPerspective || 'INTERNAL_PROCESS'
      if (!acc[key]) acc[key] = []
      acc[key].push(p)
      return acc
    }, {} as Record<string, typeof perspectives>)
    const keys = order.length ? order.filter(k => groups[k]) : Object.keys(groups)
    return keys.map(k => ({ code: k, name: nameByCode.get(k as any) || k, items: groups[k]! }))
  }, [perspectives, fixedPerspectives])

  const flattenTree = (nodes: any[], level = 0): any[] => {
    let result: any[] = []
    nodes.forEach(node => {
      result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
      if (node.children?.length) result = result.concat(flattenTree(node.children, level + 1))
    })
    return result
  }

  // Giữ CẢ nút gốc: backend cắt cây theo quyền, ai chỉ có ORG:VIEW_TREE thì nhận đơn vị của
  // chính họ làm gốc — lọc gốc đi là trưởng đơn vị không giao được KPI cho đơn vị mình.
  const flatOrgUnits = useMemo(() => (orgUnitTreeData ? flattenTree(orgUnitTreeData) : []), [orgUnitTreeData])

  /** Phần `defaultOrgUnitIds` thật sự chọn được. */
  const selectableDefaultUnitIds = useMemo(
    () => (defaultOrgUnitIds ?? []).filter(id => flatOrgUnits.some(u => u.id === id)),
    [defaultOrgUnitIds, flatOrgUnits],
  )

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, control, getValues } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: {
      kpiType: 'QUANTITATIVE', name: '', description: '',
      weight: undefined, targetValue: undefined, minimumValue: undefined,
      isReverseKpi: false, isBonusKpi: false, deadline: undefined, unit: '',
      frequency: 'MONTHLY', assignedToIds: [], kpiPeriodId: lockedPeriodId ?? '',
      keyResultId: null, parentId: null, parentRelationType: null, perspectiveId: null,
      orgUnitIds: selectableDefaultUnitIds, orgUnitId: '',
    },
  })

  const formKpiPeriodId = watch('kpiPeriodId')
  const periodHasScorecard = scorecardsForPeriod(bscScorecards, formKpiPeriodId).length > 0
  const formOrgUnitIds = watch('orgUnitIds') || []
  const [selectedRole, setSelectedRole] = useState<string>('ALL')
  const [orgUnitsExpanded, setOrgUnitsExpanded] = useState(false)

  // Nguồn chỉ tiêu và chế độ chia theo đợt — trạng thái giao diện, không nằm trong payload.
  const [source, setSource] = useState<Source>('FREE')
  const [splitMode, setSplitMode] = useState(false)
  const [splitRows, setSplitRows] = useState<SplitRow[]>([])
  /** Giá trị các ô đã ĐIỀN SẴN từ nguồn — chỉ ghi đè lại những ô người dùng chưa sửa tay. */
  const prefilledRef = useRef<Partial<Record<'name' | 'unit' | 'targetValue' | 'minimumValue' | 'weight', unknown>>>({})

  // Đẩy bối cảnh ra ngoài. Nối chuỗi id để so sánh: `watch('orgUnitIds')` trả về mảng mới mỗi render.
  const contextKey = `${formKpiPeriodId ?? ''}|${formOrgUnitIds.join(',')}`
  useEffect(() => {
    const [periodPart, unitsPart] = contextKey.split('|')
    onContextChange?.({ kpiPeriodId: periodPart || undefined, orgUnitIds: unitsPart ? unitsPart.split(',') : [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])

  const fillableRef = useRef<string[]>([])
  useEffect(() => {
    if (!open) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'kpi_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      fillableFields: () => fillableRef.current,
      setValue: (field, value) =>
        setValue(field as keyof KpiFormData, value as never, { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('kpi_form')
  }, [open, getValues, setValue])

  const kpiType = watch('kpiType')
  const isQualitative = kpiType === 'QUALITATIVE'
  const enableQualitative = org?.enableQualitative
  const showTypeTabs = enableQualitative && !parentKpi && !isEdit

  // Khởi tạo form mỗi lần mở.
  useEffect(() => {
    if (!open) {
      setUserSearch(''); setSelectedRole('ALL'); setAiSuggestions([]); setAppliedIdx(null); setBeforeApply(null)
      setSplitMode(false); setSplitRows([]); prefilledRef.current = {}
      return
    }

    if (editKpi) {
      reset({
        kpiType: editKpi.kpiType ?? 'QUANTITATIVE',
        name: editKpi.name,
        description: editKpi.description ?? '',
        weight: editKpi.weight ?? undefined,
        targetValue: editKpi.targetValue ?? undefined,
        unit: editKpi.unit ?? '',
        frequency: editKpi.frequency,
        orgUnitId: editKpi.orgUnitId ?? '',
        orgUnitIds: editKpi.orgUnitIds ?? (editKpi.orgUnitId ? [editKpi.orgUnitId] : []),
        assignedToIds: editKpi.assigneeIds ?? [],
        minimumValue: editKpi.minimumValue ?? undefined,
        isReverseKpi: editKpi.isReverseKpi ?? false,
        isBonusKpi: editKpi.isBonusKpi ?? false,
        deadline: toDatetimeLocal(editKpi.deadline) ?? undefined,
        kpiPeriodId: editKpi.kpiPeriodId ?? '',
        keyResultId: editKpi.keyResultId ?? null,
        parentId: editKpi.parentId ?? null,
        perspectiveId: editKpi.perspectiveId ?? null,
      })
      setSource(editKpi.keyResultId ? 'OKR' : editKpi.perspectiveId ? 'BSC' : 'FREE')
    } else {
      const defaultOrgUnitId = user?.memberships?.[0]?.orgUnitId || ''
      const effectiveRelationType = parentKpi ? (parentRelationType ?? 'DECOMPOSITION') : null
      const isDecomposition = effectiveRelationType === 'DECOMPOSITION'
      const remainingWeight = parentKpi ? Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0)) : undefined
      reset({
        kpiType: parentKpi?.kpiType ?? 'QUANTITATIVE',
        name: parentKpi ? `[${parentKpi.name}] ` : '',
        description: '',
        weight: isDecomposition ? remainingWeight : undefined,
        targetValue: undefined, minimumValue: undefined,
        isReverseKpi: false, isBonusKpi: false, deadline: undefined,
        unit: parentKpi?.unit ?? '',
        frequency: 'MONTHLY',
        kpiPeriodId: lockedPeriodId ?? parentKpi?.kpiPeriodId ?? '',
        keyResultId: null,
        parentId: parentKpi?.id ?? null,
        parentRelationType: effectiveRelationType,
        perspectiveId: parentKpi?.perspectiveId ?? null,
        orgUnitIds: selectableDefaultUnitIds.length > 0
          ? selectableDefaultUnitIds
          : (canAssignRoles ? [] : (defaultOrgUnitId ? [defaultOrgUnitId] : [])),
        orgUnitId: parentKpi?.orgUnitId ?? defaultOrgUnitId,
        assignedToIds: isDecomposition ? (parentKpi?.assigneeIds ?? []) : (isStaff ? ([user?.id].filter(Boolean) as string[]) : [])
      })
      setSource(parentKpi?.perspectiveId ? 'BSC' : 'FREE')
    }
  }, [open, reset, editKpi, flatOrgUnits, canManageOrg, parentKpi, parentRelationType, isStaff, user, lockedPeriodId, selectableDefaultUnitIds, canAssignRoles])

  const selectedAssignees = watch('assignedToIds') || []

  const availableRolesForFilter = useMemo(() => {
    const rolesMap = new Map<string, { id: string; name: string }>()
    formOrgUnitIds.forEach(id => {
      const unit = flatOrgUnits.find(u => u.id === id)
      unit?.assignedRoles?.forEach((role: any) => { rolesMap.set(role.name, role) })
    })
    return Array.from(rolesMap.values())
  }, [formOrgUnitIds, flatOrgUnits])

  const totalMemberCount = useMemo(() => formOrgUnitIds.reduce((sum, id) => {
    const unit = flatOrgUnits.find(u => u.id === id)
    return sum + (unit?.memberCount || 0)
  }, 0), [formOrgUnitIds, flatOrgUnits])

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({
    page: 0, size: 500,
    orgUnitIds: formOrgUnitIds.length > 0 ? formOrgUnitIds : (isEdit ? [] : [NONE]),
    role: selectedRole === 'ALL' ? undefined : selectedRole
  })
  const availableUsers = useMemo(() => usersData?.content || [], [usersData])

  const afterCreate = (created: KpiCriteria | KpiCriteria[]) => {
    qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
    qc.invalidateQueries({ queryKey: ['bsc-kpi-plan'] })
    qc.invalidateQueries({ queryKey: ['bsc-unit-result'] })
    // Giữ lại BỐI CẢNH (đợt, đơn vị, tần suất), dọn nội dung — chế độ thêm liên tục không bắt
    // chọn lại đợt/đơn vị cho từng chỉ tiêu. Không giữ người thực hiện: trường đổi nhiều nhất.
    reset({
      ...getValues(),
      name: '', description: '', weight: undefined, targetValue: undefined, minimumValue: undefined,
      unit: '', deadline: undefined, isReverseKpi: false, isBonusKpi: false, assignedToIds: [],
      keyResultId: null, perspectiveId: null,
    })
    setSource('FREE'); setSplitMode(false); setSplitRows([]); prefilledRef.current = {}
    setAiSuggestions([]); setAppliedIdx(null); setBeforeApply(null)
    const first = Array.isArray(created) ? created[0] : created
    if (first) onCreated?.(first)
    if (!keepOpenAfterCreate) onClose()
  }

  const createMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.create(data),
    onSuccess: (created) => { toast.success('Tạo chỉ tiêu thành công'); afterCreate(created) },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Tạo chỉ tiêu thất bại')),
  })

  const splitMutation = useMutation({
    mutationFn: (data: Parameters<typeof kpiApi.createFromBsc>[0]) => kpiApi.createFromBsc(data),
    onSuccess: (created) => {
      toast.success(`Đã tạo ${created?.length ?? 0} chỉ tiêu theo đợt từ hạng mục BSC`)
      afterCreate(created)
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Tạo chỉ tiêu từ hạng mục BSC thất bại')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.update(editKpi!.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kpi-criteria'] }); toast.success('Cập nhật thành công'); onClose() },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Cập nhật chỉ tiêu thất bại')),
  })

  const formFrequency = watch('frequency')
  const formDeadline = watch('deadline')
  const selectedPeriod = useMemo(
    () => periodsData?.content?.find((p: any) => p.id === formKpiPeriodId),
    [periodsData, formKpiPeriodId],
  )

  const filteredFrequencyOptions = useMemo(() => {
    if (!selectedPeriod) return frequencyOptions
    const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
    return frequencyOptions.filter(opt => (TYPE_LEVEL[opt.value as any] || 0) <= periodLevel)
  }, [selectedPeriod])

  useEffect(() => {
    if (!selectedPeriod) return
    const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
    if ((TYPE_LEVEL[formFrequency] || 0) > periodLevel) setValue('frequency', selectedPeriod.periodType as any)
  }, [selectedPeriod, formFrequency, setValue])

  // Hạn chót riêng phải nằm trong đợt; đổi đợt mà lệch ra ngoài thì xoá và báo.
  useEffect(() => {
    if (!formDeadline) return
    if (!formKpiPeriodId) { setValue('deadline', undefined); toast.error('Đã xoá hạn chót riêng vì chưa chọn đợt KPI'); return }
    if (selectedPeriod) {
      const t = new Date(formDeadline).getTime()
      const s = selectedPeriod.startDate ? new Date(selectedPeriod.startDate).getTime() : null
      const e = selectedPeriod.endDate ? new Date(selectedPeriod.endDate).getTime() : null
      if ((s && t < s) || (e && t > e)) { setValue('deadline', undefined); toast.error('Đã xoá hạn chót riêng vì không còn nằm trong đợt KPI mới chọn') }
    }
  }, [formKpiPeriodId, selectedPeriod, formDeadline, setValue])

  const filteredObjectives = useMemo(() => {
    if (!objectives || formOrgUnitIds.length === 0) return []
    return objectives.filter((obj: any) => obj.orgUnitIds?.some((id: string) => formOrgUnitIds.includes(id)))
  }, [objectives, formOrgUnitIds])

  const watchedKeyResultId = watch('keyResultId')
  const watchedPerspectiveId = watch('perspectiveId')
  const selectedKr = useMemo(() => {
    if (!watchedKeyResultId || watchedKeyResultId === 'NONE') return null
    for (const obj of (objectives || []) as any[]) {
      const kr = obj.keyResults?.find((k: any) => k.id === watchedKeyResultId)
      if (kr) return { kr, obj }
    }
    return null
  }, [watchedKeyResultId, objectives])
  const inheritedPerspective = useMemo(() => {
    const obj = selectedKr?.obj
    if (obj?.perspectiveId) return { name: obj.perspectiveName as string, color: (obj.perspectiveColor as string) || '#8b5cf6' }
    return null
  }, [selectedKr])

  const unitParent = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    return map
  }, [orgUnitTreeData])

  // Bộ tiêu chí HIỆU LỰC theo đơn vị đầu tiên được gán (đơn vị → cha → mặc định).
  const effectiveScorecard = useMemo(() => {
    if (!formKpiPeriodId) return null
    const periodScs = scorecardsForPeriod(bscScorecards, formKpiPeriodId)
    if (periodScs.length === 0) return null
    const realUnits = formOrgUnitIds.filter(id => id && id !== NONE)
    if (realUnits.length === 0) return null
    let cur: string | null = realUnits[0]!, guard = 0
    while (cur && guard++ < 100) {
      const found = periodScs.find(s => (s.orgUnits || []).some(u => u.id === cur))
      if (found) return found
      cur = unitParent.get(cur) ?? null
    }
    return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
  }, [bscScorecards, formKpiPeriodId, formOrgUnitIds, unitParent])

  /** Dòng hạng mục đang chọn trong bộ tiêu chí hiệu lực — nguồn số để điền sẵn. */
  const selectedPerspRow = useMemo(() => {
    if (!watchedPerspectiveId || watchedPerspectiveId === 'NONE') return null
    return effectiveScorecard?.perspectives.find(sp => sp.perspectiveId === watchedPerspectiveId) ?? null
  }, [effectiveScorecard, watchedPerspectiveId])
  const selectedPerspective = useMemo(
    () => (perspectives || []).find(p => p.id === watchedPerspectiveId) ?? null,
    [perspectives, watchedPerspectiveId],
  )
  // Kế hoạch chia của hạng mục (đã có KPI nào chiếm bao nhiêu ở từng đợt).
  const { data: plan } = useBscKpiPlan(source === 'BSC' && selectedPerspRow?.id ? selectedPerspRow.id : undefined)

  const perspectiveNumbers = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const p of perspectives || []) {
      const row = effectiveScorecard?.perspectives.find(sp => sp.perspectiveId === p.id)
      map.set(p.id, perspectiveHint({
        targetValue: row?.targetValue ?? p.targetValue,
        minimumValue: row?.minimumValue ?? p.minimumValue,
        unit: row?.unit ?? p.unit,
        weightPercentage: row?.weightPercentage ?? null,
      }))
    }
    return map
  }, [perspectives, effectiveScorecard])

  const watchedWeight = watch('weight')
  const effectivePerspId = useMemo(() => {
    if (watchedPerspectiveId && watchedPerspectiveId !== 'NONE') return watchedPerspectiveId
    return selectedKr?.obj?.perspectiveId || null
  }, [watchedPerspectiveId, selectedKr])
  const categoryWeightPct = useMemo(() => {
    if (!effectiveScorecard || !effectivePerspId) return null
    const sp = effectiveScorecard.perspectives.find(p => p.perspectiveId === effectivePerspId)
    return sp && sp.weightPercentage != null ? sp.weightPercentage : null
  }, [effectiveScorecard, effectivePerspId])
  const realWeight = (watchedWeight != null && !Number.isNaN(Number(watchedWeight)) && categoryWeightPct != null)
    ? (Number(watchedWeight) * categoryWeightPct / 100) : null

  const availablePerspectiveIds = useMemo<Set<string> | null>(() => {
    if (!enableBsc) return null
    const ids = new Set<string>()
    if (!formKpiPeriodId) return ids
    const periodScs = scorecardsForPeriod(bscScorecards, formKpiPeriodId)
    if (periodScs.length === 0) return ids
    const realUnits = formOrgUnitIds.filter(id => id && id !== NONE)
    if (realUnits.length === 0) return ids
    const resolveForUnit = (unitId: string) => {
      let cur: string | null = unitId, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some(u => u.id === cur))
        if (found) return found
        cur = unitParent.get(cur) ?? null
      }
      return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    }
    realUnits.forEach(uid => (resolveForUnit(uid)?.perspectives || []).forEach(p => ids.add(p.perspectiveId)))
    return ids
  }, [enableBsc, bscScorecards, formKpiPeriodId, formOrgUnitIds, unitParent])

  const hasRealUnit = formOrgUnitIds.some(id => id && id !== NONE)
  const filteredGroupedPerspectives = useMemo(() => {
    if (!availablePerspectiveIds) return groupedPerspectives
    return groupedPerspectives
      .map(g => ({ ...g, items: g.items.filter(p => availablePerspectiveIds.has(p.id)) }))
      .filter(g => g.items.length > 0)
  }, [groupedPerspectives, availablePerspectiveIds])
  const selectedPerspMissing = !!availablePerspectiveIds && hasRealUnit && !!effectivePerspId && !availablePerspectiveIds.has(effectivePerspId)

  // Đổi đơn vị ⇒ KR không còn thuộc đơn vị thì bỏ.
  useEffect(() => {
    if (formOrgUnitIds.length > 0 && watch('keyResultId')) {
      const currentKrId = watch('keyResultId')
      const stillValid = filteredObjectives.some(obj => obj.keyResults.some((kr: any) => kr.id === currentKrId))
      if (!stillValid) setValue('keyResultId', null)
    }
  }, [formOrgUnitIds, filteredObjectives, setValue, watch])

  // ── Điền sẵn từ nguồn ─────────────────────────────────────────────────────
  // Chỉ ghi đè ô còn trống hoặc ô vẫn đang giữ đúng giá trị lần điền sẵn trước — người dùng đã
  // sửa tay thì không đụng vào (họ đã đọc số nguồn và quyết định khác).
  const prefill = (field: keyof typeof prefilledRef.current, value: unknown) => {
    const current = getValues(field as keyof KpiFormData)
    const untouched = current === undefined || current === '' || current === null || current === prefilledRef.current[field]
    if (!untouched) return
    setValue(field as keyof KpiFormData, value as never, { shouldValidate: true, shouldDirty: true })
    prefilledRef.current[field] = value
  }

  const periodRowOfPlan = useMemo(
    () => plan?.periods.find(p => p.kpiPeriodId === formKpiPeriodId) ?? null,
    [plan, formKpiPeriodId],
  )

  useEffect(() => {
    if (isEdit || source !== 'BSC' || !selectedPerspRow || isQualitative) return
    const row = selectedPerspRow
    if (row.unit) prefill('unit', row.unit)
    // Mục tiêu: phần CÒN LẠI của hạng mục, chia cho số đợt còn trống nếu kỳ có nhiều đợt.
    const remaining = plan?.remainingValue ?? row.targetValue ?? null
    const openPeriods = plan ? plan.periods.filter(p => (p.allocatedWeight || 0) < 99.99).length : 1
    if (remaining != null && remaining > 0) {
      const target = round2(remaining / Math.max(openPeriods, 1))
      prefill('targetValue', target)
      if (row.minimumValue != null && row.targetValue) prefill('minimumValue', round2(target * (row.minimumValue / row.targetValue)))
    } else if (row.targetValue != null) {
      prefill('targetValue', row.targetValue)
      if (row.minimumValue != null) prefill('minimumValue', row.minimumValue)
    }
    // Trọng số = phần còn trống của hạng mục trong đợt này (100% của hạng mục = đủ).
    const usedWeight = periodRowOfPlan?.allocatedWeight ?? 0
    prefill('weight', Math.max(0, round2(100 - usedWeight)) || 100)
    if (selectedPerspective?.name) prefill('name', selectedPeriod ? `${selectedPerspective.name} — ${selectedPeriod.name}` : selectedPerspective.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, source, selectedPerspRow?.id, plan?.scorecardPerspectiveId, periodRowOfPlan?.kpiPeriodId, isQualitative])

  useEffect(() => {
    if (isEdit || source !== 'OKR' || !selectedKr || isQualitative) return
    const { kr } = selectedKr
    if (kr.unit) prefill('unit', kr.unit)
    if (kr.targetValue != null) {
      const remaining = kr.targetValue - (kr.currentValue ?? 0)
      prefill('targetValue', remaining > 0 ? round2(remaining) : kr.targetValue)
    }
    if (kr.name) prefill('name', kr.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, source, selectedKr?.kr?.id, isQualitative])

  // Dựng bảng chia theo đợt khi bật chế độ chia (phần còn lại chia đều cho các đợt còn trống).
  useEffect(() => {
    if (!splitMode || !plan) return
    const openPeriods = plan.periods.filter(p => (p.allocatedWeight || 0) < 99.99)
    const remaining = plan.remainingValue
    const each = remaining != null && openPeriods.length > 0 ? round2(remaining / openPeriods.length) : undefined
    const ratio = plan.minimumValue != null && plan.targetValue ? plan.minimumValue / plan.targetValue : null
    setSplitRows(plan.periods.map(p => {
      const open = (p.allocatedWeight || 0) < 99.99
      return {
        kpiPeriodId: p.kpiPeriodId, periodName: p.name, selected: open,
        name: `${plan.name} — ${p.name}`,
        targetValue: open ? each : undefined,
        minimumValue: open && each != null && ratio != null ? round2(each * ratio) : undefined,
        weight: open ? round2(100 - (p.allocatedWeight || 0)) : undefined,
        allocatedWeight: p.allocatedWeight || 0, kpiCount: p.kpiCount,
      }
    }))
  }, [splitMode, plan])

  const changeSource = (next: Source) => {
    setSource(next)
    setSplitMode(false)
    if (next !== 'BSC') setValue('perspectiveId', null)
    if (next !== 'OKR') setValue('keyResultId', null)
    if (next === 'FREE') prefilledRef.current = {}
  }

  // ── Cảnh báo lệch số nguồn (không chặn) ──────────────────────────────────
  const watchedTarget = watch('targetValue')
  const watchedUnit = watch('unit')
  const sourceWarnings = useMemo(() => {
    const out: string[] = []
    if (isQualitative) return out
    const t = watchedTarget != null && !Number.isNaN(Number(watchedTarget)) ? Number(watchedTarget) : null
    if (source === 'BSC' && selectedPerspRow) {
      const cap = plan?.remainingValue ?? selectedPerspRow.targetValue ?? null
      if (t != null && cap != null && t > cap + 0.001) {
        out.push(`Mục tiêu ${formatNumber(t)} vượt phần còn lại của hạng mục "${selectedPerspective?.name}" (${formatNumber(cap)}${selectedPerspRow.unit ? ` ${selectedPerspRow.unit}` : ''}). Điểm BSC chỉ tính tới mức của hạng mục.`)
      }
      if (selectedPerspRow.unit && watchedUnit && watchedUnit.trim().toLowerCase() !== selectedPerspRow.unit.trim().toLowerCase()) {
        out.push(`Đơn vị tính "${watchedUnit}" khác hạng mục ("${selectedPerspRow.unit}") — số sẽ không cộng dồn được vào hạng mục.`)
      }
    }
    if (source === 'OKR' && selectedKr) {
      const { kr } = selectedKr
      if (t != null && kr.targetValue != null && t > kr.targetValue + 0.001) {
        out.push(`Mục tiêu ${formatNumber(t)} vượt mục tiêu của KR "${kr.name}" (${formatNumber(kr.targetValue)}${kr.unit ? ` ${kr.unit}` : ''}).`)
      }
      if (kr.unit && watchedUnit && watchedUnit.trim().toLowerCase() !== kr.unit.trim().toLowerCase()) {
        out.push(`Đơn vị tính "${watchedUnit}" khác KR ("${kr.unit}") — tiến độ KR sẽ không cộng đúng.`)
      }
    }
    return out
  }, [isQualitative, watchedTarget, watchedUnit, source, selectedPerspRow, selectedPerspective, plan, selectedKr])

  // ── Gợi ý AI ──────────────────────────────────────────────────────────────
  const [aiSuggestions, setAiSuggestions] = useState<AiKpiSuggestion[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null)
  const [beforeApply, setBeforeApply] = useState<Partial<KpiFormData> | null>(null)
  const [userSearch, setUserSearch] = useState('')

  const displayUsers = useMemo(() => {
    if (!userSearch.trim()) return availableUsers
    const q = userSearch.toLowerCase()
    return availableUsers.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [availableUsers, userSearch])

  const buildAiContext = () => {
    const parts: string[] = []
    const typedName = (watch('name') || '').trim()
    if (typedName) parts.push(`Tên chỉ tiêu đang gõ: "${typedName}"`)
    parts.push(isQualitative ? 'Loại KPI: định tính' : 'Loại KPI: định lượng')
    if (selectedPeriod?.name) parts.push(`Đợt: ${selectedPeriod.name}`)
    if (selectedKr?.obj?.name) parts.push(`Mục tiêu liên quan: ${selectedKr.obj.name}`)
    if (source === 'BSC' && selectedPerspective?.name) parts.push(`Hạng mục BSC: ${selectedPerspective.name}`)
    return parts.join('. ')
  }

  const handleAiSuggest = async () => {
    const orgUnitId = formOrgUnitIds[0] || user?.memberships?.[0]?.orgUnitId
    if (!orgUnitId) { toast.error('Vui lòng chọn hoặc đảm bảo bạn thuộc một phòng ban để nhận gợi ý chính xác'); return }
    setIsSuggesting(true); setAppliedIdx(null)
    try {
      const suggestions = await kpiApi.getAiSuggestions(orgUnitId, buildAiContext())
      setAiSuggestions(suggestions)
      if (suggestions.length === 0) toast.info('AI không tìm thấy gợi ý phù hợp lúc này')
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Lỗi khi lấy gợi ý từ AI'))
    } finally { setIsSuggesting(false) }
  }

  const applySuggestion = (sug: AiKpiSuggestion, idx: number) => {
    if (!beforeApply) {
      setBeforeApply({ name: watch('name'), description: watch('description'), unit: watch('unit'), targetValue: watch('targetValue'), weight: watch('weight'), frequency: watch('frequency') })
    }
    const opts = { shouldDirty: true, shouldValidate: true } as const
    setValue('name', sug.name ?? '', opts)
    if (sug.description != null) setValue('description', sug.description, opts)
    if (!isQualitative) {
      if (sug.unit != null) setValue('unit', sug.unit, opts)
      if (sug.targetValue != null) setValue('targetValue', sug.targetValue, opts)
    }
    if (sug.weight != null) setValue('weight', sug.weight, opts)
    if (sug.frequency != null) setValue('frequency', sug.frequency, opts)
    setAppliedIdx(idx)
  }
  const undoSuggestion = () => {
    if (!beforeApply) return
    const opts = { shouldDirty: true, shouldValidate: true } as const
    Object.entries(beforeApply).forEach(([field, value]) => setValue(field as keyof KpiFormData, value as never, opts))
    setBeforeApply(null); setAppliedIdx(null)
  }
  const closeSuggestions = () => { setAiSuggestions([]); setAppliedIdx(null); setBeforeApply(null) }

  const isPending = createMutation.isPending || updateMutation.isPending || splitMutation.isPending
  const isPendingApproval = isEdit && editKpi?.status === 'PENDING_APPROVAL'

  useEffect(() => {
    fillableRef.current = [
      'name', 'description', 'weight',
      ...(showTypeTabs ? ['kpiType'] : []),
      ...(isQualitative ? [] : ['targetValue', 'minimumValue', 'unit', 'isReverseKpi']),
      ...(parentKpi ? [] : ['isBonusKpi']),
      ...(isPendingApproval ? [] : [...(lockedPeriodId ? [] : ['kpiPeriodId']), 'frequency', 'deadline', 'assignedToIds']),
      ...(!isPendingApproval && flatOrgUnits.length > 0 ? ['orgUnitIds'] : []),
    ]
  }, [showTypeTabs, isQualitative, parentKpi, isPendingApproval, flatOrgUnits.length, lockedPeriodId])

  // ── Gửi ───────────────────────────────────────────────────────────────────
  const isReverse = !!watch('isReverseKpi')
  const isBonus = !!watch('isBonusKpi')

  const submitSplit = () => {
    if (!selectedPerspRow) return
    const chosen = splitRows.filter(r => r.selected)
    if (chosen.length === 0) { toast.error('Chọn ít nhất một đợt để chia'); return }
    for (const r of chosen) {
      if (r.targetValue == null || Number.isNaN(r.targetValue) || r.targetValue < 0) { toast.error(`Đợt "${r.periodName}": nhập mục tiêu`); return }
      if (r.weight == null || Number.isNaN(r.weight) || r.weight <= 0 || r.weight > 100) { toast.error(`Đợt "${r.periodName}": trọng số phải trong 1–100`); return }
      if (r.minimumValue != null && !Number.isNaN(r.minimumValue)) {
        if (isReverse && r.minimumValue <= r.targetValue) { toast.error(`Đợt "${r.periodName}": KPI ngược thì ngưỡng tối đa phải lớn hơn mục tiêu`); return }
        if (!isReverse && r.minimumValue > r.targetValue) { toast.error(`Đợt "${r.periodName}": tối thiểu không được lớn hơn mục tiêu`); return }
      }
    }
    if (formOrgUnitIds.length === 0) { toast.error('Chọn đơn vị thực hiện'); return }
    if (selectedAssignees.length > 0 && formOrgUnitIds.length > 1) { toast.error('Giao đích danh thì mỗi lần chỉ chia cho một đơn vị'); return }
    splitMutation.mutate({
      scorecardPerspectiveId: selectedPerspRow.id,
      orgUnitIds: formOrgUnitIds,
      assignedToIds: selectedAssignees.length ? selectedAssignees : undefined,
      assignToAllUnitMembers: false,
      description: getValues('description') || undefined,
      unit: getValues('unit') || undefined,
      isReverseKpi: isReverse,
      allocations: chosen.map(r => ({
        kpiPeriodId: r.kpiPeriodId, name: r.name.trim() || undefined,
        targetValue: r.targetValue as number, minimumValue: r.minimumValue ?? null, weight: r.weight as number,
      })),
    })
  }

  const onSubmit = (data: KpiFormData) => {
    const payload = { ...data }
    if (payload.kpiType === 'QUALITATIVE') {
      delete payload.targetValue; delete payload.minimumValue; delete payload.unit
      payload.isReverseKpi = false
    }
    if (!payload.orgUnitIds || payload.orgUnitIds.length === 0) delete payload.orgUnitIds
    if (payload.keyResultId === '' || payload.keyResultId === 'NONE') payload.keyResultId = null
    if (payload.parentId === '') payload.parentId = null
    if (payload.perspectiveId === '' || payload.perspectiveId === 'NONE') payload.perspectiveId = null
    if (payload.deadline && selectedPeriod) {
      const t = new Date(payload.deadline).getTime()
      const s = selectedPeriod.startDate ? new Date(selectedPeriod.startDate).getTime() : null
      const e = selectedPeriod.endDate ? new Date(selectedPeriod.endDate).getTime() : null
      if ((s && t < s) || (e && t > e)) { toast.error('Hạn chót phải nằm trong khoảng thời gian của đợt KPI'); return }
      payload.deadline = new Date(payload.deadline).toISOString()
    } else {
      delete payload.deadline
    }
    if (isEdit) updateMutation.mutate(payload as any)
    else createMutation.mutate(payload as any)
  }

  const toggleAssignee = (userId: string) => {
    const current = [...selectedAssignees]
    const index = current.indexOf(userId)
    if (index > -1) current.splice(index, 1); else current.push(userId)
    setValue('assignedToIds', current)
  }

  const toggleOrgUnit = (orgId: string) => {
    if (singleOrgUnit) { setValue('orgUnitIds', [orgId]); return }
    let current = [...formOrgUnitIds]
    const index = current.indexOf(orgId)
    if (index > -1) current.splice(index, 1)
    else if (enableOkr) current = [orgId]
    else current.push(orgId)
    setValue('orgUnitIds', current)
  }

  if (!open) return null

  const canPickSource = !isPendingApproval && (enableBsc || enableOkr)
  const krLocked = isEdit && !!editKpi?.keyResultId
  const showSplit = source === 'BSC' && !isEdit && !parentKpi && !!plan && plan.periods.length > 1 && !isQualitative
  const targetLabel = isReverse ? 'Ngưỡng mục tiêu (càng thấp càng tốt)' : 'Mục tiêu mong muốn'
  const minLabel = isReverse ? 'Ngưỡng tối đa chấp nhận' : 'Mục tiêu tối thiểu'
  const submitting = isPending
  const sourceUnitLabel = source === 'BSC' ? selectedPerspRow?.unit : source === 'OKR' ? selectedKr?.kr?.unit : null

  const formBody = (
    <form
      id="kpi-form"
      noValidate
      onSubmit={splitMode ? (e => { e.preventDefault(); submitSplit() }) : handleSubmit(onSubmit, (err) => console.error('KPI Form Errors:', err))}
      className="flex flex-col gap-6"
    >
      {showTypeTabs && (
        <div className="grid grid-cols-2 gap-1 rounded-control bg-[var(--color-muted)] p-1">
          <ChoiceChip selected={!isQualitative} variant="segment" className="h-9" onClick={() => setValue('kpiType', 'QUANTITATIVE')}>
            <BarChart3 /> Định lượng
          </ChoiceChip>
          <ChoiceChip selected={isQualitative} variant="segment" className="h-9" onClick={() => setValue('kpiType', 'QUALITATIVE')}>
            <SlidersHorizontal /> Định tính
          </ChoiceChip>
        </div>
      )}
      {isEdit && isQualitative && (
        <div className="flex items-center gap-2 rounded-card border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-3 py-2 text-xs font-medium text-[var(--color-success)]">
          <SlidersHorizontal size={14} /> KPI Định tính — chấm điểm theo thang định tính khi duyệt
        </div>
      )}

      {/* ══ ① Bối cảnh ══════════════════════════════════════════════════════ */}
      {!isPendingApproval && (
        <Section title="① Bối cảnh" hint={parentKpi ? 'KPI con nằm trong đợt và đơn vị của KPI cha' : 'Đợt và đơn vị quyết định bộ tiêu chí BSC / OKR áp dụng'}>
          {/* Tách từ KPI cha: con số của cha là "nguồn" của KPI con — hiện ngay đầu để chia cho đúng. */}
          {parentKpi && (
            <SourceCard color="#6366f1" title={`${parentRelationType === 'DELEGATION' ? 'Phân rã từ' : 'KPI con của'} "${parentKpi.name}"`} subtitle={parentKpi.assigneeNames?.length ? `Giao cho ${parentKpi.assigneeNames.join(', ')}` : null}>
              <Stat label="Mục tiêu KPI cha" value={parentKpi.targetValue != null ? `${formatNumber(parentKpi.targetValue)}${parentKpi.unit ? ` ${parentKpi.unit}` : ''}` : '—'} />
              <Stat label="Trọng số cha" value={`${parentKpi.weight ?? 0}%`} />
              <Stat label="Đã chia cho KPI con" value={`${parentKpi.childrenWeightTotal ?? 0}%`} />
              <Stat label="Còn lại" value={`${Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0))}%`} hint={parentRelationType === 'DECOMPOSITION' ? 'Điền sẵn vào trọng số' : undefined} />
            </SourceCard>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {lockedPeriodId ? (
              <Field label="Đợt đánh giá">
                <div className="flex h-9 items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 text-sm">
                  <CalendarRange size={14} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />
                  <span className="truncate">{selectedPeriod?.name ?? 'Đợt đã chọn'}</span>
                </div>
              </Field>
            ) : (
              <Field label="Đợt đánh giá" required error={errors.kpiPeriodId?.message}>
                <Controller name="kpiPeriodId" control={control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.kpiPeriodId}><SelectValue placeholder="Chọn đợt..." /></SelectTrigger>
                      <SelectContent>
                        {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
            <Field label="Tần suất chốt" required>
              <Controller name="frequency" control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Chọn tần suất..." /></SelectTrigger>
                    <SelectContent>
                      {filteredFrequencyOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Hạn chót" hint={selectedPeriod ? `Trống = cuối đợt (${formatDateTime(selectedPeriod.endDate)})` : 'Chọn đợt trước'}>
              <Controller name="deadline" control={control}
                render={({ field }) => (
                  <DateTimePicker value={field.value || ''} onChange={field.onChange} placeholder="Mặc định theo đợt"
                    className={cn(!selectedPeriod && 'pointer-events-none opacity-50')} />
                )}
              />
            </Field>
          </div>

          {/* Đơn vị thực hiện */}
          {flatOrgUnits.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-label flex items-center gap-2">
                  <LayoutGrid size={15} className="text-[var(--color-primary)]" aria-hidden="true" /> Đơn vị thực hiện
                  {enableOkr && <span className="text-caption">· chế độ OKR: một đơn vị</span>}
                </label>
                {compactOrgUnits ? (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setOrgUnitsExpanded(v => !v)}>
                    {orgUnitsExpanded ? 'Xong' : 'Đổi'}
                  </Button>
                ) : (
                  <span className="text-caption">{formOrgUnitIds.length} đã chọn</span>
                )}
              </div>
              {compactOrgUnits && !orgUnitsExpanded && (
                <div className="flex h-9 items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 text-sm">
                  <LayoutGrid size={13} className="shrink-0 text-[var(--color-muted-foreground)]" />
                  <span className="truncate">
                    {formOrgUnitIds.length === 0 ? 'Chưa chọn đơn vị'
                      : formOrgUnitIds.length === 1 ? (flatOrgUnits.find(u => u.id === formOrgUnitIds[0])?.name ?? '1 đơn vị')
                      : `${formOrgUnitIds.length} đơn vị`}
                  </span>
                </div>
              )}
              <div className={cn('rounded-card border border-[var(--color-border)] bg-[var(--color-card)]', compactOrgUnits && !orgUnitsExpanded && 'hidden')}>
                <div className="custom-scrollbar max-h-36 space-y-0.5 overflow-y-auto p-1.5">
                  {flatOrgUnits.map(unit => {
                    const on = formOrgUnitIds.includes(unit.id)
                    return (
                      <button key={unit.id} type="button" onClick={() => toggleOrgUnit(unit.id)}
                        className={cn('flex w-full items-center justify-between rounded-control px-3 py-1.5 text-left text-xs transition-colors',
                          on ? 'bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]' : 'hover:bg-[var(--color-muted)]')}>
                        <span className="truncate">{unit.levelLabel}</span>
                        {on && <Check size={14} aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Giao thực hiện */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-label flex items-center gap-2">
                <Users size={15} className="text-[var(--color-primary)]" aria-hidden="true" /> Giao thực hiện
              </label>
              {!isStaff && <span className="text-caption">{selectedAssignees.length} người · {totalMemberCount} khả dụng</span>}
            </div>
            {isStaff ? (
              <div className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2.5">
                <UserAvatar fullName={user?.fullName} avatarUrl={user?.avatarUrl} className="h-8 w-8 rounded-full" fallbackClassName="bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-sm font-semibold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.fullName} <span className="text-[var(--color-primary)]">(bản thân)</span></p>
                  <p className="truncate text-caption">{user?.email}</p>
                </div>
                <Check size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
              </div>
            ) : formOrgUnitIds.length > 0 ? (
              <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] p-2">
                  <Input size="sm" placeholder="Tìm theo tên hoặc email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-56" />
                  <ChoiceChip selected={selectedRole === 'ALL'} size="sm" onClick={() => setSelectedRole('ALL')}>Tất cả</ChoiceChip>
                  {availableRolesForFilter.map(role => (
                    <ChoiceChip key={role.id} selected={selectedRole === role.name} size="sm" onClick={() => setSelectedRole(role.name)}>{role.name}</ChoiceChip>
                  ))}
                </div>
                <div className="custom-scrollbar max-h-44 space-y-0.5 overflow-y-auto p-1.5">
                  {isLoadingUsers ? (
                    <p className="flex items-center justify-center gap-2 py-8 text-caption"><Loader2 size={16} className="animate-spin" /> Đang tải nhân sự…</p>
                  ) : displayUsers.length === 0 ? (
                    <p className="py-8 text-center text-caption">Không có nhân sự phù hợp</p>
                  ) : displayUsers.map(u => {
                    const on = selectedAssignees.includes(u.id)
                    return (
                      <button key={u.id} type="button" onClick={() => toggleAssignee(u.id)}
                        className={cn('flex w-full items-center justify-between rounded-control px-3 py-2 text-left transition-colors',
                          on ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'hover:bg-[var(--color-muted)]')}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{u.fullName}</span>
                          <span className={cn('block truncate text-xs', on ? 'text-white/80' : 'text-[var(--color-muted-foreground)]')}>
                            {u.email}{u.memberships?.[0] && ` · ${u.memberships[0].roleDisplayName}`}
                          </span>
                        </span>
                        {on && <Check size={14} aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="rounded-card border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-caption">
                Chọn đơn vị thực hiện để hiện danh sách nhân sự
              </p>
            )}
          </div>
        </Section>
      )}

      {/* ══ ② Nguồn chỉ tiêu ═══════════════════════════════════════════════ */}
      {canPickSource && (
        <Section title="② Nguồn chỉ tiêu" hint="Chọn nguồn trước — mục tiêu, đơn vị tính, trọng số sẽ điền sẵn ở bước ③">
          {/* KR đã gắn thì không gỡ được khi sửa (luật cũ của ô KR) — khoá luôn việc đổi nguồn. */}
          <div className="flex flex-wrap gap-2" title={krLocked ? 'Chỉ tiêu đã gắn KR — không đổi nguồn khi sửa' : undefined}>
            <ChoiceChip selected={source === 'FREE'} onClick={() => changeSource('FREE')} disabled={krLocked}><Unlink /> Tự do</ChoiceChip>
            {enableBsc && <ChoiceChip selected={source === 'BSC'} onClick={() => changeSource('BSC')} disabled={krLocked}><LayoutGrid /> Hạng mục BSC</ChoiceChip>}
            {enableOkr && (
              <ChoiceChip selected={source === 'OKR'} onClick={() => changeSource('OKR')}>
                <Target /> Kết quả then chốt (OKR)
              </ChoiceChip>
            )}
          </div>

          {source === 'BSC' && (
            <div className="space-y-3">
              <Controller name="perspectiveId" control={control}
                render={({ field }) => (
                  <Select key={`${field.value ?? 'NONE'}-${(perspectives || []).length}`} onValueChange={field.onChange} value={field.value || 'NONE'}>
                    <SelectTrigger><SelectValue placeholder="Chọn hạng mục…" /></SelectTrigger>
                    <SelectContent className="max-h-[350px]">
                      <SelectItem value="NONE">— Chưa chọn hạng mục —</SelectItem>
                      {filteredGroupedPerspectives.map(group => (
                        <SelectGroup key={group.code}>
                          <SelectLabel>{group.name}</SelectLabel>
                          {group.items.map(p => (
                            <SelectItem key={p.id} value={p.id}
                              extra={perspectiveNumbers.get(p.id) && <span className="ml-auto pl-3 text-caption whitespace-nowrap">{perspectiveNumbers.get(p.id)}</span>}>
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
                )}
              />
              {/* Vì sao danh sách trống — nói thẳng thiếu gì. */}
              {availablePerspectiveIds && !formKpiPeriodId && <Hint tone="warning">Chọn <b>Đợt đánh giá</b> ở bước ① — hạng mục hiện theo bộ tiêu chí của đợt.</Hint>}
              {availablePerspectiveIds && formKpiPeriodId && !periodHasScorecard && <Hint tone="warning">Đợt này <b>chưa có bộ tiêu chí BSC</b> — lập bộ tiêu chí cho đợt rồi mới chọn được hạng mục.</Hint>}
              {availablePerspectiveIds && formKpiPeriodId && periodHasScorecard && !hasRealUnit && <Hint tone="warning">Chọn <b>Đơn vị thực hiện</b> ở bước ① — hạng mục hiện theo bộ tiêu chí của đơn vị.</Hint>}
              {availablePerspectiveIds && periodHasScorecard && hasRealUnit && filteredGroupedPerspectives.length === 0 && <Hint tone="warning">Bộ tiêu chí của đơn vị này <b>chưa có hạng mục nào</b>.</Hint>}
              {selectedPerspMissing && <Hint tone="warning">Hạng mục này <b>không có trong bộ tiêu chí</b> của đơn vị đã chọn ⇒ KPI sẽ không tính vào điểm BSC.</Hint>}

              {selectedPerspRow && selectedPerspective && (
                <SourceCard color={selectedPerspective.color || '#94a3b8'} title={selectedPerspective.name} subtitle={effectiveScorecard?.name}>
                  <Stat label="Mục tiêu hạng mục" value={selectedPerspRow.targetValue != null ? `${formatNumber(selectedPerspRow.targetValue)}${selectedPerspRow.unit ? ` ${selectedPerspRow.unit}` : ''}` : '—'} />
                  <Stat label="Tối thiểu" value={selectedPerspRow.minimumValue != null ? formatNumber(selectedPerspRow.minimumValue) : '—'} />
                  <Stat label="Trọng số hạng mục" value={`${selectedPerspRow.weightPercentage}%`} hint="100% chỉ tiêu = đủ hạng mục" />
                  {plan && (
                    <Stat label="Còn chưa chia" value={plan.remainingValue != null ? formatNumber(plan.remainingValue) : '—'}
                      hint={`${plan.periods.length} đợt · ${plan.periods.reduce((s, p) => s + p.kpiCount, 0)} KPI đã gắn`} />
                  )}
                  {periodRowOfPlan && (
                    <Stat label={`Trọng số còn trống · ${periodRowOfPlan.name}`} value={`${round2(100 - periodRowOfPlan.allocatedWeight)}%`} hint={`${periodRowOfPlan.kpiCount} KPI đã chiếm ${periodRowOfPlan.allocatedWeight}%`} />
                  )}
                </SourceCard>
              )}

              {showSplit && (
                <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
                  <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium"><SplitSquareHorizontal size={15} aria-hidden="true" /> Chia theo từng đợt trong kỳ</span>
                      <span className="text-caption block">Hạng mục trải {plan!.periods.length} đợt — tạo một KPI cho mỗi đợt, phần còn lại chia đều. Tắt = chỉ tạo KPI cho đợt đã chọn ở bước ①.</span>
                    </span>
                    <Switch checked={splitMode} onCheckedChange={setSplitMode} />
                  </label>
                  {splitMode && (
                    <div className="border-t border-[var(--color-border)] p-3">
                      <SplitTable rows={splitRows} onChange={setSplitRows} unit={watchedUnit || selectedPerspRow?.unit || ''} isReverse={isReverse} plan={plan!} unitCount={Math.max(formOrgUnitIds.length, 1)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {source === 'OKR' && (
            <div className="space-y-3">
              <Controller name="keyResultId" control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || 'NONE'} disabled={isEdit && !!editKpi?.keyResultId}>
                    <SelectTrigger><SelectValue placeholder="Chọn kết quả then chốt…" /></SelectTrigger>
                    <SelectContent className="max-h-[350px]">
                      <SelectItem value="NONE">— Chưa chọn KR —</SelectItem>
                      {filteredObjectives.map(obj => (
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
                )}
              />
              {formOrgUnitIds.length === 0 && <Hint tone="warning">Chọn <b>Đơn vị thực hiện</b> ở bước ① — KR hiện theo mục tiêu của đơn vị.</Hint>}
              {formOrgUnitIds.length > 0 && filteredObjectives.length === 0 && <Hint tone="warning">Đơn vị này chưa có mục tiêu OKR nào.</Hint>}
              {selectedKr && (
                <SourceCard color={inheritedPerspective?.color || '#8b5cf6'} title={selectedKr.kr.name} subtitle={`OBJ: ${selectedKr.obj.name}`}>
                  <Stat label="Mục tiêu KR" value={selectedKr.kr.targetValue != null ? `${formatNumber(selectedKr.kr.targetValue)}${selectedKr.kr.unit ? ` ${selectedKr.kr.unit}` : ''}` : '—'} />
                  <Stat label="Đã đạt" value={selectedKr.kr.currentValue != null ? `${formatNumber(selectedKr.kr.currentValue)} (${Math.round(selectedKr.kr.progress ?? 0)}%)` : '—'} />
                  {inheritedPerspective && <Stat label="Hạng mục BSC kế thừa" value={inheritedPerspective.name} />}
                </SourceCard>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ══ ③ Nội dung chỉ tiêu ═════════════════════════════════════════════ */}
      <Section title={canPickSource || !isPendingApproval ? '③ Nội dung chỉ tiêu' : 'Nội dung chỉ tiêu'}
        hint={source !== 'FREE' && !isEdit ? 'Đã điền sẵn từ nguồn — sửa chỗ nào thấy khác' : undefined}>

        {/* Hai công tắc đứng TRƯỚC các ô số: chúng đổi nhãn và ý nghĩa của những ô đó. */}
        {(!isQualitative || !parentKpi) && (
          <div className="flex flex-wrap gap-2">
            {!isQualitative && (
              <Controller name="isReverseKpi" control={control} render={({ field }) => (
                <ToggleCard on={!!field.value} onToggle={() => field.onChange(!field.value)} tone="warning"
                  title="KPI ngược" desc="Giá trị càng thấp càng tốt — tỉ lệ lỗi, chi phí, thời gian xử lý" />
              )} />
            )}
            {!parentKpi && (
              <Controller name="isBonusKpi" control={control} render={({ field }) => (
                <ToggleCard on={!!field.value} onToggle={() => field.onChange(!field.value)} tone="success"
                  title="KPI thưởng" desc="Không bắt buộc, không nằm trong 100% trọng số; làm được thì cộng thêm điểm" />
              )} />
            )}
          </div>
        )}

        <Field label="Tên chỉ tiêu" required error={errors.name?.message}
          trailing={(canManageOrg || canReview) && !isEdit && (
            <Button size="sm" variant="outline" type="button" onClick={handleAiSuggest} disabled={isSuggesting} title="AI đọc số liệu của đơn vị và bối cảnh bạn đang nhập để đề xuất chỉ tiêu">
              {isSuggesting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Sparkles aria-hidden="true" />} Gợi ý AI
            </Button>
          )}>
          <Input {...register('name')} invalid={!!errors.name} placeholder="VD: Doanh thu tháng 10" />
        </Field>

        {isSuggesting && aiSuggestions.length === 0 && (
          <div className="space-y-2 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3">
            <span className="text-eyebrow flex items-center gap-1.5 text-[var(--color-info)]"><Loader2 size={12} className="animate-spin" /> AI đang đọc số liệu đơn vị…</span>
            {[0, 1, 2].map(i => <div key={i} className="h-12 animate-pulse rounded-card bg-[var(--color-card)]" />)}
          </div>
        )}
        {aiSuggestions.length > 0 && (
          <div className="space-y-2 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-eyebrow flex items-center gap-1 text-[var(--color-info)]"><Sparkles size={12} /> AI đề xuất {aiSuggestions.length} chỉ tiêu</span>
              <span className="ml-auto flex items-center gap-1">
                {beforeApply && <Button variant="ghost" size="sm" type="button" onClick={undoSuggestion}><RotateCcw aria-hidden="true" /> Hoàn tác</Button>}
                <Button variant="ghost" size="sm" type="button" onClick={handleAiSuggest} disabled={isSuggesting}>
                  {isSuggesting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />} Gợi ý khác
                </Button>
                <Button variant="ghost" size="sm" type="button" onClick={closeSuggestions}>Đóng</Button>
              </span>
            </div>
            <div className="space-y-1.5">
              {aiSuggestions.map((s, idx) => {
                const applied = appliedIdx === idx
                return (
                  <button key={idx} type="button" onClick={() => applySuggestion(s, idx)}
                    className={cn('w-full rounded-card border p-3 text-left transition-colors',
                      applied ? 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] ring-2 ring-[var(--color-info-solid)]' : 'border-[var(--color-info-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]')}>
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 text-sm">{s.name}</span>
                      {applied && <span className="text-eyebrow flex shrink-0 items-center gap-1 text-[var(--color-info)]"><Check size={11} /> Đã điền</span>}
                    </div>
                    {s.description && <p className="text-caption mt-1 line-clamp-2">{s.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!isQualitative && s.targetValue != null && <SuggestionChip label="Mục tiêu" value={`${s.targetValue}${s.unit ? ` ${s.unit}` : ''}`} />}
                      {s.weight != null && <SuggestionChip label="Trọng số" value={`${s.weight}%`} />}
                      {s.frequency && <SuggestionChip label="Tần suất" value={FREQUENCY_MAP[s.frequency] ?? s.frequency} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <Field label="Mô tả chi tiết">
          <Textarea {...register('description')} rows={2} placeholder="Cung cấp ngữ cảnh và cách tính toán…" />
        </Field>

        {isQualitative ? (
          <Hint tone="success">KPI định tính không có mục tiêu số. Khi duyệt bài nộp, quản lý chọn một mức trong thang định tính (Kém … Tốt) để chấm.</Hint>
        ) : !splitMode && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={targetLabel} required error={errors.targetValue?.message} prefilled={prefilledRef.current.targetValue !== undefined && watchedTarget === prefilledRef.current.targetValue}>
              <Input {...register('targetValue', { setValueAs: numOrUndef })} type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()} invalid={!!errors.targetValue} placeholder="1000"
                suffix={watchedUnit ? <span className="text-xs">{watchedUnit}</span> : undefined} />
            </Field>
            <Field label={minLabel} required error={errors.minimumValue?.message}>
              <Input {...register('minimumValue', { setValueAs: numOrUndef })} type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()} invalid={!!errors.minimumValue} placeholder="800"
                suffix={watchedUnit ? <span className="text-xs">{watchedUnit}</span> : undefined} />
            </Field>
            <Field label="Đơn vị tính" required error={errors.unit?.message} prefilled={!!sourceUnitLabel && watchedUnit === sourceUnitLabel}>
              <Input {...register('unit')} invalid={!!errors.unit} placeholder="VNĐ, %, KPI…" />
            </Field>
          </div>
        )}

        {!splitMode && (
          <Field
            label={isBonus ? 'Điểm cộng thêm (%)' : 'Trọng số (%)'} required error={errors.weight?.message}
            hint={isBonus ? 'KPI thưởng: con số này là phần cộng thêm, không nằm trong 100% của đơn vị'
              : source === 'BSC' && selectedPerspRow ? `Trọng số trong hạng mục "${selectedPerspective?.name}" — tổng các KPI của hạng mục phải đủ 100%`
              : parentKpi && watch('parentRelationType') === 'DECOMPOSITION' ? `Còn lại của KPI cha "${parentKpi.name}": ${Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0))}%`
              : undefined}
            prefilled={prefilledRef.current.weight !== undefined && watchedWeight === prefilledRef.current.weight}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Input {...register('weight', { setValueAs: numOrUndef })} type="number" step="any" min={0} max={100} onWheel={e => (e.target as HTMLInputElement).blur()} invalid={!!errors.weight} placeholder="25" suffix={<span className="text-xs">%</span>} className="w-36" />
              {realWeight != null && (
                <span className="text-caption">≈ <b className="text-[var(--color-primary)]">{realWeight.toFixed(1)}%</b> của đơn vị ({Number(watchedWeight)}% × {categoryWeightPct}% hạng mục)</span>
              )}
            </div>
          </Field>
        )}

        {sourceWarnings.map((w, i) => (
          <Hint key={i} tone="warning" icon={<AlertTriangle size={14} aria-hidden="true" />}>{w}</Hint>
        ))}
      </Section>

      {isInline && (
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submitLabel ?? (isEdit ? 'Lưu thay đổi' : splitMode ? `Tạo ${splitRows.filter(r => r.selected).length} chỉ tiêu theo đợt` : 'Tạo chỉ tiêu')}
          </Button>
        </div>
      )}
    </form>
  )

  if (isInline) return formBody

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      dismissible={!isPending}
      title={isEdit ? 'Sửa chỉ tiêu' : parentKpi ? (parentRelationType === 'DECOMPOSITION' ? 'Thêm KPI con' : 'Phân rã chỉ tiêu') : 'Tạo chỉ tiêu'}
      description={isEdit ? 'Thay đổi có hiệu lực sau khi lưu; chỉ tiêu đã duyệt cần gửi duyệt lại.' : 'Chọn bối cảnh và nguồn trước, con số sẽ điền sẵn; sửa rồi gửi duyệt sau.'}
      headerExtra={source !== 'FREE' && (
        <Badge variant="info"><Link2 size={11} aria-hidden="true" /> {source === 'BSC' ? 'Theo hạng mục BSC' : 'Theo KR'}</Badge>
      )}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="kpi-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {submitLabel ?? (isEdit ? 'Lưu thay đổi' : splitMode ? `Tạo ${splitRows.filter(r => r.selected).length} chỉ tiêu theo đợt` : 'Tạo chỉ tiêu')}
            </Button>
          }
        />
      }
    >
      {formBody}
    </Dialog>
  )
}

/** Bảng chia hạng mục BSC ra từng đợt — gộp từ BscKpiSplitModal. */
function SplitTable({ rows, onChange, unit, isReverse, plan, unitCount }: {
  rows: SplitRow[]; onChange: (rows: SplitRow[]) => void; unit: string; isReverse: boolean; plan: BscKpiPlanResponse; unitCount: number
}) {
  const patch = (i: number, p: Partial<SplitRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  const chosen = rows.filter(r => r.selected)
  const planned = chosen.reduce((s, r) => s + (Number(r.targetValue) || 0), 0)
  const remaining = plan.remainingValue ?? null
  const over = remaining != null && !isReverse && planned * unitCount > remaining + 0.001

  const splitEvenly = () => {
    if (remaining == null) { toast.info('Hạng mục chưa đặt mục tiêu nên không chia tự động được'); return }
    const idxs = rows.map((r, i) => (r.selected ? i : -1)).filter(i => i >= 0)
    if (!idxs.length) return
    const each = round2(remaining / unitCount / idxs.length)
    const ratio = plan.minimumValue != null && plan.targetValue ? plan.minimumValue / plan.targetValue : null
    onChange(rows.map((r, i) => {
      const k = idxs.indexOf(i)
      if (k < 0) return r
      const value = k === idxs.length - 1 ? round2(remaining / unitCount - each * (idxs.length - 1)) : each
      return { ...r, targetValue: value, minimumValue: ratio != null ? round2(value * ratio) : r.minimumValue }
    }))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption">
          Tổng đã chia <b className={cn('tabular-nums', over ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]')}>{formatNumber(planned)}</b>
          {remaining != null && <> / còn {formatNumber(remaining)}{unit ? ` ${unit}` : ''}</>}
          {unitCount > 1 && ` · × ${unitCount} đơn vị`}
        </span>
        <Button variant="outline" size="sm" type="button" onClick={splitEvenly}>Chia đều</Button>
      </div>
      <div className="overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-eyebrow">
              <th className="w-8 px-2 py-2" />
              <th className="px-2 py-2 text-left">Đợt</th>
              <th className="px-2 py-2 text-left">Tên KPI</th>
              <th className="px-2 py-2 text-right">{isReverse ? 'Ngưỡng' : 'Mục tiêu'}</th>
              <th className="px-2 py-2 text-right">{isReverse ? 'Tối đa' : 'Tối thiểu'}</th>
              <th className="px-2 py-2 text-right">Trọng số</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((r, i) => (
              <tr key={r.kpiPeriodId} className={cn(!r.selected && 'opacity-50')}>
                <td className="px-2 py-1.5"><Checkbox checked={r.selected} onCheckedChange={v => patch(i, { selected: !!v })} aria-label={`Chia cho ${r.periodName}`} /></td>
                <td className="px-2 py-1.5">
                  <span className="block font-medium">{r.periodName}</span>
                  {r.kpiCount > 0 && <span className="text-caption block">{r.kpiCount} KPI · đã chiếm {r.allocatedWeight}%</span>}
                </td>
                <td className="px-2 py-1.5"><Input size="sm" value={r.name} onChange={e => patch(i, { name: e.target.value })} disabled={!r.selected} className="min-w-[180px]" /></td>
                <td className="px-2 py-1.5"><Input size="sm" type="number" step="any" value={r.targetValue ?? ''} onChange={e => patch(i, { targetValue: numOrUndef(e.target.value) })} disabled={!r.selected} className="w-28" inputClassName="text-right tabular-nums" /></td>
                <td className="px-2 py-1.5"><Input size="sm" type="number" step="any" value={r.minimumValue ?? ''} onChange={e => patch(i, { minimumValue: numOrUndef(e.target.value) })} disabled={!r.selected} className="w-28" inputClassName="text-right tabular-nums" /></td>
                <td className="px-2 py-1.5"><Input size="sm" type="number" step="any" min={0} max={100} value={r.weight ?? ''} onChange={e => patch(i, { weight: numOrUndef(e.target.value) })} disabled={!r.selected} suffix={<span className="text-xs">%</span>} className="w-24" inputClassName="text-right tabular-nums" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {over && <Hint tone="warning" icon={<AlertTriangle size={14} aria-hidden="true" />}>Tổng đã chia vượt phần còn lại của hạng mục — server sẽ từ chối khi tạo.</Hint>}
    </div>
  )
}

/** Thẻ nhỏ hiện một thông số của gợi ý AI (mục tiêu, trọng số, tần suất). */
function SuggestionChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-control border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-info)]">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      {value}
    </span>
  )
}
