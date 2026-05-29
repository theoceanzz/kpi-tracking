import { useMemo, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { FREQUENCY_MAP, cn } from '@/lib/utils'
import { Loader2, X, Check, Sparkles, Target, Users, LayoutGrid } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'
import { useState } from 'react'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

interface KpiFormModalProps {
  open: boolean
  onClose: () => void
  editKpi?: KpiCriteria | null
  parentKpi?: KpiCriteria | null
}

const frequencyOptions = (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'] as const).map(value => ({
  value,
  label: FREQUENCY_MAP[value]
}))


export default function KpiFormModal({ open, onClose, editKpi, parentKpi }: KpiFormModalProps) {
  const isEdit = !!editKpi
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ORG:VIEW')
  const canReview = hasPermission('SUBMISSION:REVIEW')
  const canAssignRoles = hasPermission('ROLE:ASSIGN')

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: periodsData } = useKpiPeriods({ organizationId })
  
  const enableOkr = org?.enableOkr
  const { data: objectives } = useObjectives(enableOkr ? organizationId : undefined)

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

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, control } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: { 
      name: '', 
      frequency: 'MONTHLY', 
      assignedToIds: [], 
      kpiPeriodId: '', 
      keyResultId: null, 
      parentId: null,
      orgUnitIds: [] 
    },
  })

  const formKpiPeriodId = watch('kpiPeriodId')
  const formOrgUnitIds = watch('orgUnitIds') || []
  const [selectedRole, setSelectedRole] = useState<string>('ALL')

  // Synchronize form values only when modal opens
  useEffect(() => {
    if (!open) {
      setUserSearch('')
      setSelectedRole('ALL')
      return
    }

    if (editKpi) {
      reset({
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
        kpiPeriodId: editKpi.kpiPeriodId ?? '',
        keyResultId: editKpi.keyResultId ?? null,
        parentId: editKpi.parentId ?? null,
      })
    } else {
      const defaultOrgUnitId = user?.memberships?.[0]?.orgUnitId || ''
      reset({ 
        name: parentKpi ? `[${parentKpi.name}] ` : '', 
        frequency: 'MONTHLY', 
        assignedToIds: [], 
        kpiPeriodId: parentKpi?.kpiPeriodId ?? '',
        keyResultId: null,
        parentId: parentKpi?.id ?? null,
        unit: parentKpi?.unit ?? '',
        orgUnitIds: canAssignRoles ? [] : (defaultOrgUnitId ? [defaultOrgUnitId] : []),
        orgUnitId: defaultOrgUnitId
      })
    }
  }, [open, reset, flatOrgUnits, canManageOrg, parentKpi]) 

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
    if (!usersData?.content) return []
    
    return usersData.content.filter(u => {
      if (hasPermission('USER:VIEW') || canAssignRoles) return true
      
      const targetIsManager = u.permissions?.includes('SUBMISSION:REVIEW') || 
                               u.memberships?.some(m => m.roleRank === 0)
      if (targetIsManager && !canAssignRoles) return false

      return true
    })
  }, [usersData, hasPermission, canAssignRoles])


  const createMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.create(data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Tạo chỉ tiêu thành công')
      reset()
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

  const selectedPeriod = useMemo(() => {
    return periodsData?.content?.find((p: any) => p.id === formKpiPeriodId)
  }, [periodsData, formKpiPeriodId])

  const filteredFrequencyOptions = useMemo(() => {
    if (!selectedPeriod) return frequencyOptions
    
    const TYPE_LEVEL: Record<string, number> = {
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
  
  const filteredObjectives = useMemo(() => {
    if (!objectives) return []
    if (formOrgUnitIds.length === 0) return []
    return objectives.filter((obj: any) => formOrgUnitIds.includes(obj.orgUnitId))
  }, [objectives, formOrgUnitIds])

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

  const onSubmit = (data: KpiFormData) => {
    const payload = { 
      ...data,
      name: isEdit ? editKpi?.name : data.name,
      description: isEdit ? editKpi?.description : data.description,
      targetValue: isEdit ? editKpi?.targetValue : data.targetValue,
      unit: isEdit ? editKpi?.unit : data.unit,
      weight: isEdit ? editKpi?.weight : data.weight,
      minimumValue: isEdit ? editKpi?.minimumValue : data.minimumValue,
      kpiPeriodId: isEdit ? editKpi?.kpiPeriodId : data.kpiPeriodId,
      frequency: isEdit ? editKpi?.frequency : data.frequency,
      orgUnitIds: isEdit ? editKpi?.orgUnitIds : data.orgUnitIds,
      keyResultId: isEdit ? editKpi?.keyResultId : data.keyResultId,
      parentId: isEdit ? editKpi?.parentId : data.parentId,
    }
    
    if (!payload.orgUnitIds || payload.orgUnitIds.length === 0) {
        delete payload.orgUnitIds
    }

    if (payload.keyResultId === '') payload.keyResultId = null
    if (payload.parentId === '') payload.parentId = null
    delete payload.assignedToId
    
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
    const current = [...formOrgUnitIds]
    const index = current.indexOf(orgId)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(orgId)
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Mục tiêu số</label>
                  <input 
                    {...register('targetValue', { valueAsNumber: true })} 
                    type="number" 
                    step="any" 
                    onWheel={(e) => (e.target as HTMLInputElement).blur()} 
                    className={inputCls} 
                    placeholder="1000" 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Đơn vị tính</label>
                  <input 
                    {...register('unit')} 
                    className={inputCls} 
                    placeholder="VNĐ, %, KPI..." 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Trọng số (%)</label>
                  <input 
                    {...register('weight', { valueAsNumber: true })} 
                    type="number" 
                    step="any" 
                    min={0} 
                    max={100} 
                    onWheel={(e) => (e.target as HTMLInputElement).blur()} 
                    className={inputCls} 
                    placeholder="25" 
                  />
                  {errors.weight && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.weight.message}</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5">Giá trị chặn dưới</label>
                  <input 
                    {...register('minimumValue', { valueAsNumber: true })} 
                    type="number" 
                    step="any" 
                    onWheel={(e) => (e.target as HTMLInputElement).blur()} 
                    className={inputCls} 
                    placeholder="800" 
                  />
                </div>
              </div>
          </div>

          {canAssignRoles && (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold flex items-center gap-2">
                        <LayoutGrid size={16} className="text-indigo-500" />
                        Đơn vị thực hiện
                    </label>
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

          <div className="bg-[var(--color-primary)]/5 rounded-2xl p-4 space-y-4 border border-[var(--color-primary)]/10 shadow-sm transition-all overflow-hidden">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-bold flex items-center gap-2">
                    <Users size={16} className="text-[var(--color-primary)]" />
                    Giao thực hiện
                </label>
                <div className="px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-wider">
                    {totalMemberCount} nhân sự khả dụng
                </div>
            </div>

            {formOrgUnitIds.length > 0 ? (
                <>
                <div className="flex gap-2 items-center overflow-x-auto pb-1 no-scrollbar animate-in fade-in slide-in-from-top-1">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1.5">Kỳ đánh giá <span className="text-red-500">*</span></label>
              <select {...register('kpiPeriodId')} className={inputCls}>
                <option value="">Chọn đợt...</option>
                {periodsData?.content.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {errors.kpiPeriodId && <p className="text-red-500 text-[10px] mt-1 font-bold">{errors.kpiPeriodId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold mb-1.5">Tần suất chốt</label>
              <select {...register('frequency')} className={inputCls}>
                {filteredFrequencyOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>

          {enableOkr && (
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
                        "w-full rounded-xl border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 focus:ring-indigo-500/30 transition-all h-11 shadow-sm",
                        isEdit && !!editKpi?.keyResultId && "bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                      )}>
                        <SelectValue placeholder="-- Không liên kết --" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-indigo-50 dark:border-indigo-900 shadow-2xl max-h-[350px] overflow-hidden">
                        <SelectItem value="NONE" className="font-bold py-3">-- Không liên kết mục tiêu --</SelectItem>
                        {filteredObjectives.map(obj => (
                          <SelectGroup key={obj.id} className="p-1">
                            <SelectLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl my-1.5 flex items-center justify-between">
                              <span>OBJ: {obj.name}</span>
                              <Badge variant="outline" className="text-[8px] border-indigo-200">OKR</Badge>
                            </SelectLabel>
                            {obj.keyResults.map((kr: any) => (
                              <SelectItem key={kr.id} value={kr.id} className="rounded-xl py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 transition-colors">
                                <span className="font-semibold text-xs">{kr.name}</span>
                                <div className="text-[9px] opacity-70">Hiện tại: {kr.progress}% hoàn thành</div>
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
