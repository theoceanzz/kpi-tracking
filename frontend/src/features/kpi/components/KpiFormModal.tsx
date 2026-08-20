import { useMemo, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useFormAssistStore } from '@/store/formAssistStore'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { FREQUENCY_MAP, cn, formatDateTime } from '@/lib/utils'
import { Loader2, X, Check, Sparkles, Target, Users, LayoutGrid, SlidersHorizontal, BarChart3 } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'
import { useState } from 'react'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useBscPerspectives, useScorecards, useFixedPerspectives } from '@/features/bsc/hooks/useBsc'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DateTimePicker } from '@/components/common/DateTimePicker'

interface KpiFormModalProps {
  open: boolean
  onClose: () => void
  editKpi?: KpiCriteria | null
  parentKpi?: KpiCriteria | null
  parentRelationType?: 'DELEGATION' | 'DECOMPOSITION'
}

const frequencyOptions = (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'] as const).map(value => ({
  value,
  label: FREQUENCY_MAP[value]
}))

// Empty numeric inputs must become `undefined`, not NaN — otherwise hidden fields
// (e.g. target/minimum on the qualitative tab) keep a NaN value and fail zod validation.
const numOrUndef = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v)

function toDatetimeLocal(value?: string | null): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  if (isNaN(d.getTime())) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}


export default function KpiFormModal({ open, onClose, editKpi, parentKpi, parentRelationType }: KpiFormModalProps) {
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

  // Flatten tree for dropdown
  const flattenTree = (nodes: any[], level = 0): any[] => {
    let result: any[] = []
    nodes.forEach(node => {
      result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children, level + 1))
      }
    })
    return result
  }

  const flatOrgUnits = useMemo(() => {
    if (!orgUnitTreeData) return []
    const all = flattenTree(orgUnitTreeData)
    // Filter out root nodes (nodes without parentId are usually the organization root)
    return all.filter(u => u.parentId !== null)
  }, [orgUnitTreeData])

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, control, getValues } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: {
      kpiType: 'QUANTITATIVE',
      name: '',
      description: '',
      weight: undefined,
      targetValue: undefined,
      minimumValue: undefined,
      isReverseKpi: false,
      isBonusKpi: false,
      deadline: undefined,
      unit: '',
      frequency: 'MONTHLY',
      assignedToIds: [],
      kpiPeriodId: '',
      keyResultId: null,
      parentId: null,
      parentRelationType: null,
      perspectiveId: null,
      orgUnitIds: [],
      orgUnitId: '',
    },
  })

  const formKpiPeriodId = watch('kpiPeriodId')
  const periodHasScorecard = !!formKpiPeriodId && (bscScorecards || []).some(sc => sc.kpiPeriodId === formKpiPeriodId)
  const formOrgUnitIds = watch('orgUnitIds') || []
  const [selectedRole, setSelectedRole] = useState<string>('ALL')

  // Giới thiệu form này với trợ lý AI trong lúc nó đang mở, để người dùng nhờ điền hộ được.
  // Truyền HÀM đọc/ghi chứ không truyền dữ liệu: giá trị chỉ cần đúng tại thời điểm gửi câu hỏi,
  // đẩy vào store theo từng ký tự sẽ làm mọi thành phần nghe store vẽ lại liên tục.
  useEffect(() => {
    if (!open) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'kpi_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      setValue: (field, value) =>
        setValue(field as keyof KpiFormData, value as never, { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('kpi_form')
  }, [open, getValues, setValue])

  const kpiType = watch('kpiType')
  const isQualitative = kpiType === 'QUALITATIVE'
  const enableQualitative = org?.enableQualitative
  // Show the type switcher only for standalone new KPIs when the org enabled qualitative.
  // Child KPIs (parentKpi) and edits keep their fixed type.
  const showTypeTabs = enableQualitative && !parentKpi && !isEdit

  // Synchronize form values only when modal opens
  useEffect(() => {
    if (!open) {
      setUserSearch('')
      setSelectedRole('ALL')
      setAiSuggestions([])
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
    } else {
      const defaultOrgUnitId = user?.memberships?.[0]?.orgUnitId || ''
      const effectiveRelationType = parentKpi ? (parentRelationType ?? 'DECOMPOSITION') : null
      const isDecomposition = effectiveRelationType === 'DECOMPOSITION'
      const remainingWeight = parentKpi ? Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0)) : undefined
      reset({
        // Child KPIs inherit the parent's type; standalone new KPIs default to quantitative.
        kpiType: parentKpi?.kpiType ?? 'QUANTITATIVE',
        name: parentKpi ? `[${parentKpi.name}] ` : '',
        description: '',
        weight: isDecomposition ? remainingWeight : undefined,
        targetValue: undefined,
        minimumValue: undefined,
        isReverseKpi: false,
        isBonusKpi: false,
        deadline: undefined,
        unit: parentKpi?.unit ?? '',
        frequency: 'MONTHLY',
        kpiPeriodId: parentKpi?.kpiPeriodId ?? '',
        keyResultId: null,
        parentId: parentKpi?.id ?? null,
        parentRelationType: effectiveRelationType,
        perspectiveId: parentKpi?.perspectiveId ?? null,
        orgUnitIds: canAssignRoles ? [] : (defaultOrgUnitId ? [defaultOrgUnitId] : []),
        orgUnitId: parentKpi?.orgUnitId ?? defaultOrgUnitId,
        assignedToIds: isDecomposition ? (parentKpi?.assigneeIds ?? []) : (isStaff ? ([user?.id].filter(Boolean) as string[]) : [])
      })
    }
  }, [open, reset, editKpi, flatOrgUnits, canManageOrg, parentKpi, parentRelationType, isStaff, user])

  const selectedAssignees = watch('assignedToIds') || []

  // Combine roles from selected org units
  const availableRolesForFilter = useMemo(() => {
    const rolesMap = new Map<string, { id: string; name: string }>()
    formOrgUnitIds.forEach(id => {
      const unit = flatOrgUnits.find(u => u.id === id)
      unit?.assignedRoles?.forEach((role: any) => {
        rolesMap.set(role.name, role) // Use name as key to deduplicate standard roles like "Nhân viên"
      })
    })
    return Array.from(rolesMap.values())
  }, [formOrgUnitIds, flatOrgUnits])

  // Member count sum
  const totalMemberCount = useMemo(() => {
    return formOrgUnitIds.reduce((sum, id) => {
      const unit = flatOrgUnits.find(u => u.id === id)
      return sum + (unit?.memberCount || 0)
    }, 0)
  }, [formOrgUnitIds, flatOrgUnits])

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ 
    page: 0, 
    size: 500, 
    orgUnitIds: formOrgUnitIds.length > 0 ? formOrgUnitIds : (isEdit ? [] : ['00000000-0000-0000-0000-000000000000']), 
    role: selectedRole === 'ALL' ? undefined : selectedRole
  })

  const availableUsers = useMemo(() => {
    return usersData?.content || []
  }, [usersData])


  const createMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.create(data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Tạo chỉ tiêu thành công')
      reset()
      setAiSuggestions([])
      onClose() 
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Tạo chỉ tiêu thất bại'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.update(editKpi!.id, data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Cập nhật thành công')
      onClose() 
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Cập nhật thất bại'
      toast.error(msg)
    },
  })

  const formFrequency = watch('frequency')
  const formDeadline = watch('deadline')

  const selectedPeriod = useMemo(() => {
    return periodsData?.content?.find((p: any) => p.id === formKpiPeriodId)
  }, [periodsData, formKpiPeriodId])

  const filteredFrequencyOptions = useMemo(() => {
    if (!selectedPeriod) return frequencyOptions
    
    const TYPE_LEVEL: Record<string, number> = {
      'UNLIMITED': 0, // không giới hạn = nhỏ nhất, luôn hợp lệ với mọi loại đợt
      'DAILY': 1,
      'WEEKLY': 2,
      'MONTHLY': 3,
      'QUARTERLY': 4,
      'SEMI_ANNUALLY': 5,
      'YEARLY': 6
    }
    const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
    return frequencyOptions.filter(opt => (TYPE_LEVEL[opt.value as any] || 0) <= periodLevel)
  }, [selectedPeriod])

  useEffect(() => {
    if (selectedPeriod) {
      const TYPE_LEVEL: Record<string, number> = {
        'UNLIMITED': 0, // không giới hạn = nhỏ nhất, luôn hợp lệ với mọi loại đợt
        'DAILY': 1,
        'WEEKLY': 2,
        'MONTHLY': 3,
        'QUARTERLY': 4,
        'SEMI_ANNUALLY': 5,
        'YEARLY': 6
      }
      const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
      if ((TYPE_LEVEL[formFrequency] || 0) > periodLevel) {
        setValue('frequency', selectedPeriod.periodType as any)
      }
    }
  }, [selectedPeriod, formFrequency, setValue])

  // Clear the custom deadline if the period is unselected, or if it falls outside the newly selected period's range
  useEffect(() => {
    if (!formDeadline) return

    if (!formKpiPeriodId) {
      setValue('deadline', undefined)
      toast.error('Đã xoá hạn chót riêng vì chưa chọn đợt KPI')
      return
    }

    if (selectedPeriod) {
      const t = new Date(formDeadline).getTime()
      const s = selectedPeriod.startDate ? new Date(selectedPeriod.startDate).getTime() : null
      const e = selectedPeriod.endDate ? new Date(selectedPeriod.endDate).getTime() : null
      if ((s && t < s) || (e && t > e)) {
        setValue('deadline', undefined)
        toast.error('Đã xoá hạn chót riêng vì không còn nằm trong đợt KPI mới chọn')
      }
    }
  }, [formKpiPeriodId, selectedPeriod, formDeadline, setValue])
  
  const filteredObjectives = useMemo(() => {
    if (!objectives) return []
    if (formOrgUnitIds.length === 0) return []
    return objectives.filter((obj: any) => obj.orgUnitIds?.some((id: string) => formOrgUnitIds.includes(id)))
  }, [objectives, formOrgUnitIds])

  const watchedKeyResultId = watch('keyResultId')
  const watchedPerspectiveId = watch('perspectiveId')
  const inheritedPerspective = useMemo(() => {
    if (!watchedKeyResultId || watchedKeyResultId === 'NONE') return null
    const obj = (objectives || []).find((o: any) => o.keyResults?.some((kr: any) => kr.id === watchedKeyResultId))
    if (obj?.perspectiveId) return { name: obj.perspectiveName as string, color: (obj.perspectiveColor as string) || '#8b5cf6' }
    return null
  }, [watchedKeyResultId, objectives])

  // Bản đồ đơn vị → cha (để resolve thẻ điểm áp dụng: đơn vị → cha → mặc định).
  const unitParent = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    return map
  }, [orgUnitTreeData])

  // Thẻ điểm HIỆU LỰC cho KPI theo đơn vị đầu tiên được gán (đơn vị → cha → mặc định).
  const effectiveScorecard = useMemo(() => {
    if (!formKpiPeriodId) return null
    const periodScs = (bscScorecards || []).filter(sc => sc.kpiPeriodId === formKpiPeriodId)
    if (periodScs.length === 0) return null
    const realUnits = formOrgUnitIds.filter(id => id && id !== '00000000-0000-0000-0000-000000000000')
    if (realUnits.length === 0) return null // chưa chọn đơn vị ⇒ chưa biết thẻ điểm nào
    let cur: string | null = realUnits[0]!, guard = 0
    while (cur && guard++ < 100) {
      const found = periodScs.find(s => (s.orgUnits || []).some(u => u.id === cur))
      if (found) return found
      cur = unitParent.get(cur) ?? null
    }
    return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
  }, [bscScorecards, formKpiPeriodId, formOrgUnitIds, unitParent])

  // Trọng số THẬT (chỉ hiển thị) = trọng số form × %hạng_mục (lấy từ thẻ điểm hiệu lực của đơn vị KPI).
  // Form% chỉ để đủ 100%/hạng mục; trọng số thật mới là phần đóng góp vào 100% của đơn vị.
  const watchedWeight = watch('weight')
  const effectivePerspId = useMemo(() => {
    if (watchedPerspectiveId && watchedPerspectiveId !== 'NONE') return watchedPerspectiveId
    if (watchedKeyResultId && watchedKeyResultId !== 'NONE') {
      const obj = (objectives || []).find((o: any) => o.keyResults?.some((kr: any) => kr.id === watchedKeyResultId))
      return obj?.perspectiveId || null
    }
    return null
  }, [watchedPerspectiveId, watchedKeyResultId, objectives])
  const categoryWeightPct = useMemo(() => {
    if (!effectiveScorecard || !effectivePerspId) return null
    const sp = effectiveScorecard.perspectives.find(p => p.perspectiveId === effectivePerspId)
    return sp && sp.weightPercentage != null ? sp.weightPercentage : null
  }, [effectiveScorecard, effectivePerspId])
  const realWeight = (watchedWeight != null && !Number.isNaN(Number(watchedWeight)) && categoryWeightPct != null)
    ? (Number(watchedWeight) * categoryWeightPct / 100) : null

  // Lọc hạng mục theo THẺ ĐIỂM của đơn vị KPI được gán: chỉ hiện hạng mục CÓ trong thẻ điểm
  // áp dụng cho đơn vị đó (union nếu gán nhiều đơn vị). Thiếu ⇒ nhắc thêm vào thẻ điểm.
  const availablePerspectiveIds = useMemo<Set<string> | null>(() => {
    if (!enableBsc) return null // không bật BSC ⇒ không liên quan (mục hạng mục cũng ẩn)
    const ids = new Set<string>()
    if (!formKpiPeriodId) return ids // chưa chọn kỳ ⇒ rỗng
    const periodScs = (bscScorecards || []).filter(sc => sc.kpiPeriodId === formKpiPeriodId)
    if (periodScs.length === 0) return ids // kỳ chưa có thẻ điểm ⇒ rỗng
    const realUnits = formOrgUnitIds.filter(id => id && id !== '00000000-0000-0000-0000-000000000000')
    if (realUnits.length === 0) return ids // chưa chọn đơn vị ⇒ rỗng
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

  const hasRealUnit = formOrgUnitIds.some(id => id && id !== '00000000-0000-0000-0000-000000000000')

  const filteredGroupedPerspectives = useMemo(() => {
    if (!availablePerspectiveIds) return groupedPerspectives
    return groupedPerspectives
      .map(g => ({ ...g, items: g.items.filter(p => availablePerspectiveIds.has(p.id)) }))
      .filter(g => g.items.length > 0)
  }, [groupedPerspectives, availablePerspectiveIds])

  // Hạng mục đang gán nhưng KHÔNG có trong thẻ điểm của đơn vị ⇒ cảnh báo (sẽ không tính điểm BSC).
  // Chỉ cảnh báo khi ĐÃ chọn đơn vị (chưa chọn thì đã có nhắc "chọn đơn vị trước").
  const selectedPerspMissing = !!availablePerspectiveIds && hasRealUnit && !!effectivePerspId && !availablePerspectiveIds.has(effectivePerspId)

  // Clear Key Result if OrgUnit changes to a different one
  useEffect(() => {
    if (formOrgUnitIds.length > 0 && watch('keyResultId')) {
      const currentKrId = watch('keyResultId')
      const isStillValid = filteredObjectives.some(obj => 
        obj.keyResults.some((kr: any) => kr.id === currentKrId)
      )
      if (!isStillValid) {
        setValue('keyResultId', null)
      }
    }
  }, [formOrgUnitIds, filteredObjectives, setValue, watch])

  // AI Suggestion Logic
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const displayUsers = useMemo(() => {
    let filtered = availableUsers

    if (!userSearch.trim()) return filtered
    const search = userSearch.toLowerCase()
    return filtered.filter(u => 
      u.fullName.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    )
  }, [availableUsers, userSearch])

  const handleAiSuggest = async () => {
    const orgUnitId = formOrgUnitIds[0] || user?.memberships?.[0]?.orgUnitId
    if (!orgUnitId) {
      toast.error('Vui lòng chọn hoặc đảm bảo bạn thuộc một phòng ban để nhận gợi ý chính xác')
      return
    }

    setIsSuggesting(true)
    try {
      const suggestions = await kpiApi.getAiSuggestions(orgUnitId)
      setAiSuggestions(suggestions)
      if (suggestions.length === 0) {
        toast.info('AI không tìm thấy gợi ý phù hợp lúc này')
      }
    } catch (err) {
      toast.error('Lỗi khi lấy gợi ý từ AI')
    } finally {
      setIsSuggesting(false)
    }
  }

  const applySuggestion = (sug: any) => {
    reset({
      ...watch(),
      name: sug.name,
      description: sug.description,
      unit: sug.unit,
      targetValue: sug.targetValue,
      weight: sug.weight,
      frequency: sug.frequency,
    })
    setAiSuggestions([])
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isPendingApproval = isEdit && editKpi?.status === 'PENDING_APPROVAL'

  const onSubmit = (data: KpiFormData) => {
    const payload = { ...data }

    // Qualitative KPIs have no numeric measurement fields.
    if (payload.kpiType === 'QUALITATIVE') {
      delete payload.targetValue
      delete payload.minimumValue
      delete payload.unit
      payload.isReverseKpi = false
    }

    if (!payload.orgUnitIds || payload.orgUnitIds.length === 0) {
        delete payload.orgUnitIds
    }

    if (payload.keyResultId === '' || payload.keyResultId === 'NONE') payload.keyResultId = null
    if (payload.parentId === '') payload.parentId = null
    if (payload.perspectiveId === '' || payload.perspectiveId === 'NONE') payload.perspectiveId = null

    if (payload.deadline && selectedPeriod) {
      const t = new Date(payload.deadline).getTime()
      const s = selectedPeriod.startDate ? new Date(selectedPeriod.startDate).getTime() : null
      const e = selectedPeriod.endDate ? new Date(selectedPeriod.endDate).getTime() : null
      if ((s && t < s) || (e && t > e)) {
        toast.error('Hạn chót phải nằm trong khoảng thời gian của đợt KPI')
        return
      }
      payload.deadline = new Date(payload.deadline).toISOString()
    } else {
      delete payload.deadline
    }

    if (isEdit) {
      updateMutation.mutate(payload as any)
    } else {
      createMutation.mutate(payload as any)
    }
  }

  const toggleAssignee = (userId: string) => {
    const current = [...selectedAssignees]
    const index = current.indexOf(userId)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(userId)
    }
    setValue('assignedToIds', current)
  }

  const toggleOrgUnit = (orgId: string) => {
    let current = [...formOrgUnitIds]
    const index = current.indexOf(orgId)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      if (enableOkr) {
        current = [orgId]
      } else {
        current.push(orgId)
      }
    }
    setValue('orgUnitIds', current)
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 animate-in zoom-in-95 max-h-[96vh] overflow-y-auto custom-scrollbar border border-[var(--color-border)]/50">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold tracking-tight text-[var(--color-foreground)]">{isEdit ? 'Chỉnh sửa chỉ tiêu' : 'Tạo mới KPI'}</h3>
            <p className="text-xs text-[var(--color-muted-foreground)] font-medium">Phát triển mục tiêu kinh doanh & vận hành</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-all p-1.5 hover:bg-[var(--color-accent)] rounded-full">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit, (err) => console.error('KPI Form Errors:', err))}
          className="space-y-5"
        >
          {showTypeTabs && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--color-accent)]/30 border border-[var(--color-border)]/40">
              <button
                type="button"
                onClick={() => setValue('kpiType', 'QUANTITATIVE')}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  !isQualitative ? "bg-indigo-600 text-white shadow-md" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                )}
              >
                <BarChart3 size={14} /> Định lượng
              </button>
              <button
                type="button"
                onClick={() => setValue('kpiType', 'QUALITATIVE')}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  isQualitative ? "bg-emerald-600 text-white shadow-md" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
                )}
              >
                <SlidersHorizontal size={14} /> Định tính
              </button>
            </div>
          )}

          {isEdit && isQualitative && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
              <SlidersHorizontal size={14} /> KPI Định tính — chấm điểm theo thang định tính khi duyệt
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-bold text-[var(--color-foreground)]">Tên chỉ tiêu <span className="text-red-500">*</span></label>
                {(canManageOrg || canReview) && !isEdit && (
                  <button 
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={isSuggesting}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-[10px] font-black text-white hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50"
                  >
                    {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    GỢI Ý AI
                  </button>
                )}
              </div>
              <input 
                {...register('name')} 
                className={inputCls} 
                placeholder="VD: Doanh thu tháng 10" 
              />
              {errors.name && <p className="text-red-500 text-xs mt-1 font-medium">{errors.name.message}</p>}
            </div>

            {aiSuggestions.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 uppercase tracking-wider">
                    <Sparkles size={12} /> Chiến lược gợi ý:
                    </span>
                    <button type="button" onClick={() => setAiSuggestions([])} className="text-[10px] font-bold text-blue-500 hover:underline hover:opacity-80">Đóng</button>
                </div>
                <div className="space-y-1.5">
                    {aiSuggestions.map((s, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="w-full text-left p-2.5 rounded-xl bg-[var(--color-background)] border border-blue-100 dark:border-blue-900 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group"
                    >
                        <div className="font-bold text-xs group-hover:text-blue-600 transition-colors">{s.name}</div>
                        <div className="text-[10px] text-[var(--color-muted-foreground)] line-clamp-1 mt-0.5">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">{s.targetValue} {s.unit}</span> • {s.description}
                        </div>
                    </button>
                    ))}
                </div>
                </div>
            )}

            <div>
              <label className="block text-sm font-bold mb-1.5">Mô tả chi tiết</label>
              <textarea 
                {...register('description')} 
                rows={2} 
                className={inputCls + ' resize-none'} 
                placeholder="Cung cấp ngữ cảnh và cách tính toán..." 
              />
            </div>
          </div>

          <div className="bg-[var(--color-accent)]/10 rounded-2xl p-4 border border-[var(--color-border)]/30 space-y-4">
              {!isQualitative && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Mục tiêu đạt được <span className="text-red-500">*</span></label>
                  <input
                    {...register('targetValue', { setValueAs: numOrUndef })}
                    type="number"
                    step="any"
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className={inputCls}
                    placeholder="1000"
                  />
                  {errors.targetValue && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.targetValue.message}</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Mục tiêu tối thiểu <span className="text-red-500">*</span></label>
                  <input
                    {...register('minimumValue', { setValueAs: numOrUndef })}
                    type="number"
                    step="any"
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className={inputCls}
                    placeholder="800"
                  />
                  {errors.minimumValue && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.minimumValue.message}</p>}
                </div>
              </div>
              )}

              {isQualitative && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  KPI định tính không có mục tiêu số. Khi duyệt bài nộp, quản lý chọn một mức trong thang điểm định tính (KÉM/YẾU/…/TỐT) để chấm điểm.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Trọng số (%) <span className="text-red-500">*</span></label>
                  <input
                    {...register('weight', { setValueAs: numOrUndef })}
                    type="number"
                    step="any"
                    min={0}
                    max={100}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className={inputCls}
                    placeholder="25"
                  />
                  {errors.weight && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.weight.message}</p>}
                  {parentKpi && watch('parentRelationType') === 'DECOMPOSITION' && (
                    <p className="text-[10px] mt-1 font-bold text-cyan-600">
                      Trọng số còn lại của KPI cha "{parentKpi.name}": {Math.max(0, (parentKpi.weight ?? 0) - (parentKpi.childrenWeightTotal ?? 0))}%
                    </p>
                  )}
                  {realWeight != null && (
                    <p className="text-[10px] mt-1 font-bold text-violet-600 dark:text-violet-400">
                      Trọng số thật ≈ {realWeight.toFixed(1)}%
                      <span className="font-medium text-slate-400"> (= {Number(watchedWeight)}% × {categoryWeightPct}% hạng mục — phần đóng góp vào 100% của đơn vị)</span>
                    </p>
                  )}
                </div>
                {!isQualitative && (
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Đơn vị tính <span className="text-red-500">*</span></label>
                  <input
                    {...register('unit')}
                    className={inputCls}
                    placeholder="VNĐ, %, KPI..."
                  />
                  {errors.unit && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.unit.message}</p>}
                </div>
                )}
              </div>

              {!isQualitative && (
              <Controller
                name="isReverseKpi"
                control={control}
                render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left",
                      field.value
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                        : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-sm font-bold", field.value ? "text-orange-600 dark:text-orange-400" : "text-[var(--color-foreground)]")}>
                          KPI Ngược
                        </span>
                        <div className="relative group/tooltip">
                          <div className="w-4 h-4 rounded-full bg-[var(--color-muted-foreground)]/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 flex items-center justify-center cursor-help transition-colors">
                            <span className="text-[9px] font-black text-[var(--color-muted-foreground)] group-hover/tooltip:text-orange-500 leading-none transition-colors">?</span>
                          </div>
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-[11px] leading-relaxed shadow-2xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 z-50 scale-95 group-hover/tooltip:scale-100">
                            <p className="font-black text-orange-300 mb-1.5">KPI Ngược là gì?</p>
                            <p className="font-medium opacity-90">Loại KPI mà giá trị thực tế <span className="text-orange-300 font-bold">càng thấp càng tốt</span>.</p>
                            <p className="font-medium opacity-80 mt-1.5">Ví dụ: tỉ lệ lỗi, chi phí vận hành, thời gian xử lý, tỉ lệ nghỉ việc...</p>
                            <p className="font-medium opacity-80 mt-1.5">Công thức điểm: <span className="text-green-300 font-bold">2 − (thực tế ÷ mục tiêu)</span>, thay vì chia thẳng như KPI thường.</p>
                            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-slate-700" />
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                        Giá trị mục tiêu càng thấp càng tốt (VD: tỉ lệ lỗi, chi phí)
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-6 rounded-full transition-all relative flex-shrink-0",
                      field.value ? "bg-orange-500" : "bg-[var(--color-muted-foreground)]/30"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all",
                        field.value ? "left-5" : "left-1"
                      )} />
                    </div>
                  </button>
                )}
              />
              )}

              {!parentKpi && (
                <Controller
                  name="isBonusKpi"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left",
                        field.value
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10"
                          : "border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-sm font-bold", field.value ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--color-foreground)]")}>
                            KPI Thưởng
                          </span>
                          <div className="relative group/tooltip">
                            <div className="w-4 h-4 rounded-full bg-[var(--color-muted-foreground)]/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 flex items-center justify-center cursor-help transition-colors">
                              <span className="text-[9px] font-black text-[var(--color-muted-foreground)] group-hover/tooltip:text-emerald-500 leading-none transition-colors">?</span>
                            </div>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-[11px] leading-relaxed shadow-2xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all duration-200 z-50 scale-95 group-hover/tooltip:scale-100">
                              <p className="font-black text-emerald-300 mb-1.5">KPI Thưởng là gì?</p>
                              <p className="font-medium opacity-90">KPI <span className="text-emerald-300 font-bold">tùy chọn</span>, không tính vào tổng 100% trọng số của đơn vị.</p>
                              <p className="font-medium opacity-80 mt-1.5">Không làm cũng không sao. Nếu hoàn thành, điểm sẽ được <span className="text-emerald-300 font-bold">cộng thêm</span> vào tổng điểm đánh giá.</p>
                              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-slate-700" />
                            </div>
                          </div>
                        </div>
                        <div className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                          Không bắt buộc, không tính vào 100% trọng số, hoàn thành thì được cộng điểm thêm
                        </div>
                      </div>
                      <div className={cn(
                        "w-10 h-6 rounded-full transition-all relative flex-shrink-0",
                        field.value ? "bg-emerald-500" : "bg-[var(--color-muted-foreground)]/30"
                      )}>
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all",
                          field.value ? "left-5" : "left-1"
                        )} />
                      </div>
                    </button>
                  )}
                />
              )}
          </div>

          {!isPendingApproval && flatOrgUnits.length > 0  && (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="block text-sm font-bold flex items-center gap-2">
                          <LayoutGrid size={16} className="text-indigo-500" />
                          Đơn vị thực hiện
                      </label>
                      {enableOkr && (
                        <p className="text-[10px] text-indigo-600 font-bold animate-pulse italic">
                          * Chế độ OKR đang bật: Chỉ chọn được 1 đơn vị
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-2 py-0.5 rounded-full uppercase">
                        {formOrgUnitIds.length} đã chọn
                    </span>
                </div>
                <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-background)] shadow-inner">
                    <div className="max-h-36 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {flatOrgUnits.map(unit => (
                            <div 
                                key={unit.id} 
                                onClick={() => toggleOrgUnit(unit.id)}
                                className={cn(
                                    "flex items-center justify-between px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-all",
                                    formOrgUnitIds.includes(unit.id) 
                                        ? "bg-indigo-600 text-white shadow-md font-bold" 
                                        : "hover:bg-[var(--color-accent)]"
                                )}
                            >
                                <span className="truncate">{unit.levelLabel}</span>
                                {formOrgUnitIds.includes(unit.id) && <Check size={14} />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

          {!isPendingApproval && (<div className="bg-[var(--color-primary)]/5 rounded-2xl p-4 space-y-4 border border-[var(--color-primary)]/10 shadow-sm transition-all overflow-hidden">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-bold flex items-center gap-2">
                    <Users size={16} className="text-[var(--color-primary)]" />
                    Giao thực hiện
                </label>
                {!isStaff && (
                    <div className="px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-wider">
                        {totalMemberCount} nhân sự khả dụng
                    </div>
                )}
            </div>

            {isStaff ? (
                <div className="bg-white dark:bg-white/5 border border-[var(--color-primary)]/20 rounded-xl p-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-lg">
                            {user?.fullName?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold">{user?.fullName} <span className="text-[var(--color-primary)]">(Bản thân)</span></div>
                            <div className="text-[10px] text-[var(--color-muted-foreground)] font-medium">{user?.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-none font-black text-[9px] uppercase">
                                Đang chọn
                            </Badge>
                            <div className="bg-[var(--color-primary)] text-white rounded-full p-1">
                                <Check size={12} strokeWidth={3} />
                            </div>
                        </div>
                    </div>
                </div>
            ) : formOrgUnitIds.length > 0 ? (
                <>
                <div className="flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-1">
                    <span className="text-[10px] font-black text-[var(--color-muted-foreground)] uppercase shrink-0">Role:</span>
                    <button
                        type="button"
                        onClick={() => setSelectedRole('ALL')}
                        className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-tight transition-all shrink-0",
                            selectedRole === 'ALL' 
                                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm" 
                                : "bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-muted-foreground)]"
                        )}
                    >
                        Tất cả
                    </button>
                    {availableRolesForFilter.map(role => (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => setSelectedRole(role.name)}
                            className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-tight transition-all shrink-0",
                                selectedRole === role.name 
                                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm" 
                                    : "bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-muted-foreground)]"
                            )}
                        >
                            {role.name}
                        </button>
                    ))}
                </div>
                
                <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-background)] shadow-inner animate-in fade-in slide-in-from-top-2">
                <div className="p-2 border-b border-[var(--color-border)] bg-[var(--color-accent)]/5">
                    <input 
                    type="text"
                    placeholder="Họ tên hoặc Email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"
                    />
                </div>
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {isLoadingUsers ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-xs text-[var(--color-muted-foreground)] font-bold">
                        <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                        <span className="uppercase tracking-widest opacity-50">Đang đồng bộ...</span>
                    </div>
                    ) : displayUsers.length === 0 ? (
                        <div className="p-12 text-center text-xs text-[var(--color-muted-foreground)] font-medium italic">
                            Không tìm thấy nhân sự phù hợp theo tiêu chí lọc
                        </div>
                    ) : (
                    displayUsers.map((u) => (
                        <div 
                        key={u.id}
                        onClick={() => toggleAssignee(u.id)}
                        className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all",
                            selectedAssignees.includes(u.id) 
                                ? "bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 scale-[1.01] font-bold" 
                                : "hover:bg-[var(--color-accent)] group"
                        )}
                        >
                        <div className="flex flex-col">
                            <span className="text-sm">{u.fullName}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn("text-[9px] font-medium opacity-70", selectedAssignees.includes(u.id) ? "text-white" : "text-[var(--color-muted-foreground)]")}>{u.email}</span>
                                {u.memberships?.[0] && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                                        selectedAssignees.includes(u.id) ? "bg-white/20 text-white" : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                                    )}>
                                        {u.memberships[0].roleDisplayName}
                                    </span>
                                )}
                            </div>
                        </div>
                        {selectedAssignees.includes(u.id) && (
                            <div className="bg-white rounded-full p-0.5 animate-in zoom-in">
                                <Check size={12} className="text-[var(--color-primary)]" />
                            </div>
                        )}
                        </div>
                    ))
                    )}
                </div>
                </div>
                </>
            ) : (
                <div className="p-10 text-center text-[10px] text-[var(--color-muted-foreground)] font-bold uppercase tracking-widest italic bg-[var(--color-background)]/50 rounded-xl border border-dashed border-[var(--color-border)] animate-pulse">
                     Vui lòng chọn đơn vị thực hiện để hiển thị danh sách nhân sự
                </div>
            )}
          </div>)}

          {!isPendingApproval && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">Đợt đánh giá <span className="text-red-500">*</span></label>
              <Controller name="kpiPeriodId" control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger className={cn(inputCls, 'h-auto', errors.kpiPeriodId && 'ring-2 ring-red-500')}>
                      <SelectValue placeholder="Chọn đợt..." />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.kpiPeriodId && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.kpiPeriodId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Tần suất chốt <span className="text-red-500">*</span></label>
              <Controller name="frequency" control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger className={cn(inputCls, 'h-auto')}>
                      <SelectValue placeholder="Chọn tần suất..." />
                    </SelectTrigger>
                    <SelectContent className="z-[300]">
                      {filteredFrequencyOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold mb-1.5">Hạn chót</label>
              <Controller name="deadline" control={control}
                render={({ field }) => (
                  <DateTimePicker
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Chưa chọn (mặc định theo đợt)"
                    className={cn(!selectedPeriod && 'opacity-50 pointer-events-none')}
                  />
                )}
              />
              {selectedPeriod && (
                <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1">
                  Để trống = mặc định theo ngày kết thúc đợt ({formatDateTime(selectedPeriod.endDate)})
                </p>
              )}
            </div>
          </div>
          )}

          {!isPendingApproval && enableOkr && (
            <div className="bg-indigo-50/50 dark:bg-indigo-900/5 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Target size={16} />
                <span className="text-[11px] font-black uppercase tracking-widest">Đẩy tiến độ OKR Chiến lược</span>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight">Gắn kết Kết quả then chốt (KR)</label>
                <Controller
                  name="keyResultId"
                  control={control}
                  render={({ field }) => (
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || "NONE"}
                      disabled={isEdit && !!editKpi?.keyResultId}
                    >
                      <SelectTrigger className={cn(
                        "w-full rounded-xl border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 focus:ring-indigo-500/30 transition-all h-11 shadow-sm overflow-hidden",
                        isEdit && !!editKpi?.keyResultId && "bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                      )}>
                        <SelectValue placeholder="-- Không liên kết --" className="truncate flex-1 min-w-0 text-left" />
                      </SelectTrigger>
                      <SelectContent className="z-[300] rounded-2xl border-indigo-50 dark:border-indigo-900 shadow-2xl max-h-[350px] overflow-auto">
                        <SelectItem value="NONE" className="font-bold py-3">-- Không liên kết mục tiêu --</SelectItem>
                        {filteredObjectives.map(obj => (
                          <SelectGroup key={obj.id} className="p-1">
                            <SelectLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl my-1.5 flex items-start justify-between gap-2">
                              <span>OBJ: {obj.name}</span>
                              <Badge variant="outline" className="text-[8px] border-indigo-200 shrink-0">OKR</Badge>
                            </SelectLabel>
                            {obj.keyResults.map((kr: any) => (
                              <SelectItem
                                key={kr.id}
                                value={kr.id}
                                className="rounded-xl py-2.5 pl-8 pr-3 focus:bg-indigo-50 focus:text-indigo-700 transition-colors"
                                              >
                                <span className="font-semibold text-xs truncate block" title={kr.name}>{kr.name}</span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}

          {!isPendingApproval && enableBsc && (
            <div className="bg-violet-50/50 dark:bg-violet-900/5 p-4 rounded-2xl border border-violet-100 dark:border-violet-900/50 space-y-3">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <LayoutGrid size={16} />
                <span className="text-[11px] font-black uppercase tracking-widest">Hạng mục BSC</span>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight">Gắn chỉ tiêu vào hạng mục (theo viễn cảnh)</label>
                <Controller
                  name="perspectiveId"
                  control={control}
                  render={({ field }) => (
                    // key ép remount khi value được nạp (reset async) hoặc danh sách hạng mục
                    // load xong → hiện đúng ngay lần mở đầu, không phải mở lần 2.
                    <Select key={`${field.value ?? 'NONE'}-${(perspectives || []).length}`} onValueChange={field.onChange} value={field.value || 'NONE'}>
                      <SelectTrigger className="w-full rounded-xl border-violet-100 dark:border-violet-900 bg-white dark:bg-slate-900 focus:ring-violet-500/30 transition-all h-11 shadow-sm overflow-hidden">
                        <SelectValue placeholder="-- Chưa gán hạng mục --" className="truncate flex-1 min-w-0 text-left" />
                      </SelectTrigger>
                      <SelectContent className="z-[300] rounded-2xl border-violet-50 dark:border-violet-900 shadow-2xl max-h-[350px] overflow-auto">
                        <SelectItem value="NONE" className="font-bold py-3">-- Chưa gán hạng mục --</SelectItem>
                        {filteredGroupedPerspectives.map(group => (
                          <div key={group.code}>
                            <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{group.name}</div>
                            {group.items.map(p => (
                              <SelectItem key={p.id} value={p.id} className="rounded-xl py-2.5 pl-3 pr-3 focus:bg-violet-50 focus:text-violet-700 transition-colors">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#94a3b8' }} />
                                  <span className="font-semibold text-xs truncate">{p.name}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {(!watchedPerspectiveId || watchedPerspectiveId === 'NONE') && inheritedPerspective && (
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-start gap-1.5 mt-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: inheritedPerspective.color }} />
                    <span>
                      Đang kế thừa hạng mục <b className="text-slate-700 dark:text-slate-200">"{inheritedPerspective.name}"</b> từ mục tiêu cha. Chọn ở đây để gán đè trực tiếp.
                    </span>
                  </p>
                )}
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1.5">
                  Lưu ý: tổng trọng số các chỉ tiêu trong cùng 1 hạng mục phải bằng <b>100%</b>. Hệ thống sẽ <b>chặn phê duyệt</b> nếu chưa đủ 100%.
                </p>
                {selectedPerspMissing && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Hạng mục đang gán <b>chưa có trong thẻ điểm</b> của đơn vị bạn chọn ⇒ KPI sẽ <b>không tính vào điểm BSC</b>. Hãy thêm hạng mục này vào thẻ điểm cho phòng ban đó.
                  </p>
                )}
                {availablePerspectiveIds && !formKpiPeriodId && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Hãy <b>chọn Đợt đánh giá trước</b> — hạng mục hiện theo thẻ điểm của đợt + đơn vị.
                  </p>
                )}
                {availablePerspectiveIds && formKpiPeriodId && !periodHasScorecard && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Đợt này <b>chưa có thẻ điểm BSC</b> — hãy tạo thẻ điểm cho đợt (gồm các hạng mục) thì mới chọn được hạng mục.
                  </p>
                )}
                {availablePerspectiveIds && formKpiPeriodId && periodHasScorecard && !hasRealUnit && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Hãy <b>chọn Đơn vị thực hiện trước</b> — hạng mục hiện theo thẻ điểm của đơn vị đó.
                  </p>
                )}
                {availablePerspectiveIds && periodHasScorecard && hasRealUnit && filteredGroupedPerspectives.length === 0 && (
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-start gap-1.5 mt-1.5">
                    <span className="shrink-0">⚠</span>
                    Thẻ điểm của phòng ban bạn chọn <b>chưa có hạng mục nào</b> — hãy thêm hạng mục vào thẻ điểm cho phòng ban đó trước.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 pt-6 border-t border-[var(--color-border)]/50">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[var(--color-accent)] transition-all">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Xác nhận' : 'Khởi tạo ngay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
