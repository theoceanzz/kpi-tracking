import { useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { toast } from 'sonner'
import { Loader2, X, Check, Sparkles } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'
import { useState } from 'react'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
import { Gauge } from 'lucide-react'

interface KpiFormModalProps {
  open: boolean
  onClose: () => void
  editKpi?: KpiCriteria | null
}

const frequencyOptions = [
  { value: 'DAILY', label: 'Hàng ngày' },
  { value: 'WEEKLY', label: 'Hàng tuần' },
  { value: 'MONTHLY', label: 'Hàng tháng' },
  { value: 'QUARTERLY', label: 'Hàng quý' },
  { value: 'YEARLY', label: 'Hàng năm' },
] as const

const ROLE_PRIORITY: Record<string, number> = {
  'DIRECTOR': 4,
  'HEAD': 3,
  'DEPUTY': 2,
  'STAFF': 1,
}

export default function KpiFormModal({ open, onClose, editKpi }: KpiFormModalProps) {
  const isEdit = !!editKpi
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ORG:VIEW')
  const canReview = hasPermission('SUBMISSION:REVIEW')
  const canAssignRoles = hasPermission('ROLE:ASSIGN')

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  
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
  const flatOrgUnits = useMemo(() => orgUnitTreeData ? flattenTree(orgUnitTreeData) : [], [orgUnitTreeData])

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: { name: '', frequency: 'MONTHLY', assignedToIds: [], kpiPeriodId: '' },
  })

  // Synchronize form values only when modal opens
  useEffect(() => {
    if (!open) return

    if (editKpi) {
      reset({
        name: editKpi.name,
        description: editKpi.description ?? '',
        weight: editKpi.weight ?? undefined,
        targetValue: editKpi.targetValue ?? undefined,
        unit: editKpi.unit ?? '',
        frequency: editKpi.frequency,
        orgUnitId: editKpi.orgUnitId ?? '',
        assignedToIds: editKpi.assigneeIds ?? [],
        minimumValue: editKpi.minimumValue ?? undefined,
        kpiPeriodId: editKpi.kpiPeriodId ?? '',
      })
    } else {
      reset({ 
        name: '', 
        frequency: 'MONTHLY', 
        assignedToIds: [], 
        kpiPeriodId: '',
        orgUnitId: canManageOrg ? (flatOrgUnits?.[0]?.id || '') : (user?.memberships?.[0]?.orgUnitId || '')
      })
    }
  }, [open, reset, flatOrgUnits, canManageOrg]) 

  const formOrgUnitId = watch('orgUnitId')
  const selectedAssignees = watch('assignedToIds') || []

  // For HEAD/DEPUTY, automatically use their orgUnit if not chosen
  const fetchOrgUnitId = useMemo(() => {
    if (canManageOrg) return formOrgUnitId || undefined
    return formOrgUnitId || user?.memberships?.[0]?.orgUnitId
  }, [canManageOrg, user, formOrgUnitId])

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ 
    page: 0, 
    size: 200, 
    orgUnitId: fetchOrgUnitId 
  })

  const availableUsers = useMemo(() => {
    if (!usersData?.content) return []
    
    return usersData.content.filter(u => {
      // If user has USER:VIEW or ROLE:ASSIGN, they can see everyone in the list
      if (hasPermission('USER:VIEW') || canAssignRoles) return true
      
      // Otherwise, only allow assigning to people who don't have management/review permissions 
      // if the current user themselves is just a lower-level manager
      const targetIsManager = u.permissions?.includes('SUBMISSION:REVIEW')
      if (targetIsManager && !canAssignRoles) return false

      return true
    })
  }, [usersData, hasPermission, canAssignRoles])

  const { data: totalWeightData } = useKpiTotalWeight(
    fetchOrgUnitId,
    watch('kpiPeriodId')
  )

  const currentWeight = watch('weight') || 0
  const oldWeight = editKpi?.weight || 0
  const projectedWeight = useMemo(() => {
    const existing = totalWeightData || 0
    return existing - oldWeight + Number(currentWeight)
  }, [totalWeightData, oldWeight, currentWeight])

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

  const formKpiPeriodId = watch('kpiPeriodId')
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
      'YEARLY': 5
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
        'YEARLY': 5
      }
      const periodLevel = TYPE_LEVEL[selectedPeriod.periodType] || 0
      if ((TYPE_LEVEL[formFrequency] || 0) > periodLevel) {
        setValue('frequency', selectedPeriod.periodType as any)
      }
    }
  }, [selectedPeriod, formFrequency, setValue])

  // AI Suggestion Logic
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)

  const handleAiSuggest = async () => {
    const orgUnitId = watch('orgUnitId') || user?.memberships?.[0]?.orgUnitId
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
    const payload = { ...data }
    
    // Clean up empty strings and unselected values
    if (!payload.orgUnitId) delete payload.orgUnitId
    
    // Ensure assignedToIds is an array and remove legacy assignedToId
    delete payload.assignedToId
    
    if (isEdit) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
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

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">{isEdit ? 'Chỉnh sửa chỉ tiêu' : 'Tạo chỉ tiêu mới'}</h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">Thiết lập mục tiêu và phân bổ người thực hiện</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors p-1 hover:bg-[var(--color-accent)] rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium">Tên chỉ tiêu <span className="text-red-500">*</span></label>
              {(canManageOrg || canReview) && !isEdit && (
                <button 
                  type="button"
                  onClick={handleAiSuggest}
                  disabled={isSuggesting}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-primary)] hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Gợi ý bằng AI
                </button>
              )}
            </div>
            <input {...register('name')} className={inputCls} placeholder="VD: Doanh thu tháng" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          {aiSuggestions.length > 0 && (
            <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-3 space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--color-primary)] flex items-center gap-1">
                  <Sparkles size={12} /> Gợi ý dành cho bạn:
                </span>
                <button type="button" onClick={() => setAiSuggestions([])} className="text-[10px] hover:underline">Đóng</button>
              </div>
              <div className="space-y-1.5">
                {aiSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="w-full text-left p-2 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-all group"
                  >
                    <div className="font-semibold text-xs group-hover:text-[var(--color-primary)]">{s.name}</div>
                    <div className="text-[10px] text-[var(--color-muted-foreground)] line-clamp-1">{s.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Mô tả</label>
            <textarea {...register('description')} rows={2} className={inputCls + ' resize-none'} placeholder="Chi tiết chỉ tiêu..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Mục tiêu</label>
              <input {...register('targetValue', { valueAsNumber: true })} type="number" step="any" className={inputCls} placeholder="100" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Đơn vị</label>
              <input {...register('unit')} className={inputCls} placeholder="VD: triệu, %, cái" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Trọng số (%)</label>
              <input {...register('weight', { valueAsNumber: true })} type="number" step="any" min={0} max={100} className={inputCls} placeholder="30" />
              {errors.weight && <p className="text-red-500 text-xs mt-1">{errors.weight.message}</p>}
              
              {watch('kpiPeriodId') && (
                <div className={`mt-2 p-2 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 ${
                  projectedWeight === 100 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                  projectedWeight > 100 ? 'bg-rose-50 border-rose-100 text-rose-700' : 
                  'bg-amber-50 border-amber-100 text-amber-700'
                }`}>
                  <Gauge size={12} />
                  Dự kiến tổng trọng số: {projectedWeight}% 
                  {projectedWeight === 100 ? ' (Đạt chuẩn)' : projectedWeight > 100 ? ' (Vượt mức!)' : ' (Chưa đủ)'}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Tần suất <span className="text-red-500">*</span></label>
              <select {...register('frequency')} className={inputCls}>
                {filteredFrequencyOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              {errors.frequency && <p className="text-red-500 text-xs mt-1">{errors.frequency.message}</p>}
            </div>
          </div>

          {hasPermission('ORG:VIEW') && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Phòng ban / Đơn vị</label>
              <select {...register('orgUnitId')} className={inputCls}>
                {flatOrgUnits.map((d: any) => <option key={d.id} value={d.id}>{d.levelLabel}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              Giao cho 
              <span className="text-[10px] text-[var(--color-muted-foreground)] ml-2 pulse">(Có thể chọn nhiều)</span>
            </label>
            
            <div className="border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-background)]">
              <div className="max-h-40 overflow-y-auto p-1.5 space-y-1">
                {isLoadingUsers ? (
                  <div className="p-3 text-center text-xs text-[var(--color-muted-foreground)]">Đang tải danh sách...</div>
                ) : availableUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[var(--color-muted-foreground)]">Không có nhân viên phù hợp</div>
                ) : (
                  availableUsers.map((u) => {
                    const isSelected = selectedAssignees.includes(u.id)
                    return (
                      <div 
                        key={u.id}
                        onClick={() => toggleAssignee(u.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          isSelected ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-accent)]'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{u.fullName}</span>
                          <span className="text-[10px] opacity-70">{u.email} • {u.roles?.join(', ')}</span>
                        </div>
                        {isSelected && <Check size={16} />}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            {selectedAssignees.length > 0 && (
              <p className="text-[10px] font-medium text-[var(--color-primary)] mt-1.5">
                Đã chọn {selectedAssignees.length} nhân viên
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Kỳ (Đợt) KPI <span className="text-red-500">*</span></label>
              <select {...register('kpiPeriodId')} className={inputCls}>
                <option value="">Chọn đợt...</option>
                {periodsData?.content.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.periodType})</option>
                ))}
              </select>
              {errors.kpiPeriodId && <p className="text-red-500 text-xs mt-1">{errors.kpiPeriodId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Giá trị tối thiểu</label>
              <input {...register('minimumValue', { valueAsNumber: true })} type="number" step="any" className={inputCls} placeholder="VD: 50" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--color-accent)] transition-all">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20">
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
