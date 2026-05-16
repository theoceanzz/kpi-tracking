import { useMemo, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Loader2, X, Check, Target, Info } from 'lucide-react'
import type { KpiCriteria } from '@/types/kpi'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import KpiDetailModal from './KpiDetailModal'

interface KpiDelegationModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria
}

export default function KpiDelegationModal({ open, onClose, kpi }: KpiDelegationModalProps) {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: periodsData } = useKpiPeriods({ organizationId })
  
  const enableOkr = org?.enableOkr
  const { data: objectives } = useObjectives(enableOkr ? organizationId : undefined)

  const { handleSubmit, reset, watch, setValue, control } = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema),
    defaultValues: { 
      name: kpi.name, 
      assignedToIds: kpi.assigneeIds ?? [], 
      kpiPeriodId: kpi.kpiPeriodId, 
      keyResultId: kpi.keyResultId, 
      parentId: kpi.parentId 
    },
  })

  const [userSearch, setUserSearch] = useState('')
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    if (open) {
      reset({
        name: kpi.name,
        description: kpi.description ?? '',
        weight: kpi.weight ?? undefined,
        targetValue: kpi.targetValue ?? undefined,
        unit: kpi.unit ?? '',
        frequency: kpi.frequency,
        orgUnitId: kpi.orgUnitId ?? undefined,
        assignedToIds: kpi.assigneeIds ?? [],
        minimumValue: kpi.minimumValue ?? undefined,
        kpiPeriodId: kpi.kpiPeriodId ?? '',
        keyResultId: kpi.keyResultId ?? null,
        parentId: kpi.parentId ?? null,
      })
    }
  }, [open, kpi, reset])

  const selectedAssignees = watch('assignedToIds') || []
  const delegatedStaffCount = useMemo(() => {
    if (kpi.hasChildren && kpi.delegatedToNames) {
      return kpi.delegatedToNames.length
    }
    return selectedAssignees.filter(id => id !== user?.id).length
  }, [selectedAssignees, user?.id, kpi.hasChildren, kpi.delegatedToNames])

  const isAlreadyDelegated = !!kpi.hasChildren

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({ 
    page: 0, 
    size: 200, 
    orgUnitId: kpi.orgUnitId ?? undefined
  })

  const displayUsers = useMemo(() => {
    if (!usersData?.content) return []
    // Filter out the current user (the one delegating)
    const filtered = usersData.content.filter(u => u.id !== user?.id)

    if (!userSearch.trim()) return filtered
    const search = userSearch.toLowerCase()
    return filtered.filter(u => 
      u.fullName.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search)
    )
  }, [usersData, userSearch, user?.id])

  const updateMutation = useMutation({
    mutationFn: (data: KpiFormData) => kpiApi.update(kpi.id, data),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Giao việc thành công')
      onClose() 
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Giao việc thất bại')
    },
  })

  const onSubmit = (data: KpiFormData) => {
    const payload = {
      ...kpi,
      ...data,
      name: kpi.name,
      description: kpi.description,
      targetValue: kpi.targetValue,
      unit: kpi.unit,
      weight: kpi.weight,
      minimumValue: kpi.minimumValue,
      kpiPeriodId: kpi.kpiPeriodId,
      frequency: kpi.frequency,
      orgUnitId: kpi.orgUnitId ?? undefined,
    }
    updateMutation.mutate(payload as any)
  }


  const filteredObjectives = useMemo(() => {
    if (!objectives) return []
    return objectives.filter((obj: any) => obj.orgUnitId === kpi.orgUnitId)
  }, [objectives, kpi.orgUnitId])

  if (!open) return null


  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-950 rounded-3xl shadow-2xl p-8 max-w-xl w-full mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[92vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Giao việc & Ủy quyền</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phân bổ chỉ tiêu cho nhân sự cấp dưới</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-900">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 1. Assignees Section */}
          <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-800/50 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">Người thực hiện</label>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
                {kpi.hasChildren && kpi.delegatedToNames && kpi.delegatedToNames.length > 0 
                  ? `Đã giao cho: ${kpi.delegatedToNames.join(', ')}`
                  : delegatedStaffCount > 0 
                    ? `Đã chọn ${delegatedStaffCount} nhân sự`
                    : 'Chưa giao cho ai'}
              </span>
            </div>
            
            {isAlreadyDelegated && (
              <div className="mb-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">Chỉ tiêu đã được giao việc. Danh sách người thực hiện đã được khóa.</p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-inner">
              <div className="p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <input 
                  type="text" 
                  placeholder="Tìm theo tên hoặc email..." 
                  value={userSearch} 
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="max-h-52 overflow-y-auto p-2 space-y-1">
                {isLoadingUsers ? (
                  <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={20} /></div>
                ) : displayUsers.map((u) => {
                  const isSelected = selectedAssignees.includes(u.id) || kpi.delegatedToIds?.includes(u.id)
                  const isDisabled = isAlreadyDelegated
                  
                  return (
                    <button
                      key={u.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return
                        const current = [...selectedAssignees]
                        if (isSelected) {
                          setValue('assignedToIds', current.filter(id => id !== u.id))
                        } else {
                          setValue('assignedToIds', [...current, u.id])
                        }
                      }}
                      className={cn(
                        "w-full px-4 py-4 flex items-center justify-between rounded-xl transition-all",
                        isSelected ? "bg-indigo-600 text-white shadow-lg" : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400",
                        isDisabled && isSelected ? "opacity-90" : isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""
                      )}
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold tracking-tight">{u.fullName}</span>
                        <span className={cn("text-[10px]", isSelected ? "text-indigo-100" : "text-slate-400")}>{u.email}</span>
                      </div>
                      {isSelected && <Check size={18} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 2. Strategy Section */}
          {enableOkr && (
            <div className="bg-violet-50/50 dark:bg-violet-900/10 p-5 rounded-3xl border border-violet-100 dark:border-violet-800/50 space-y-3">
               <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                 <Target size={18} />
                 <span className="text-xs font-black uppercase tracking-widest">OKR Chiến lược</span>
               </div>
               <Controller
                 name="keyResultId"
                 control={control}
                 render={({ field }) => (
                   <Select 
                     onValueChange={field.onChange} 
                     value={field.value || "NONE"}
                     disabled={!!kpi.keyResultId || isAlreadyDelegated}
                   >
                     <SelectTrigger className={cn(
                       "w-full rounded-xl border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-900 focus:ring-violet-500/20 transition-all h-10",
                       (!!kpi.keyResultId || isAlreadyDelegated) && "bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                     )}>
                       <SelectValue placeholder="-- Không liên kết --" />
                     </SelectTrigger>
                     <SelectContent className="rounded-xl border-violet-100 dark:border-violet-800 shadow-xl max-h-[300px]">
                       <SelectItem value="NONE" className="font-medium">-- Không liên kết --</SelectItem>
                       {filteredObjectives.map(obj => (
                         <SelectGroup key={obj.id}>
                           <SelectLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/20 rounded-md my-1">
                             {obj.name}
                           </SelectLabel>
                           {obj.keyResults.map((kr: any) => (
                             <SelectItem key={kr.id} value={kr.id} className="rounded-lg">
                               {kr.name}
                             </SelectItem>
                           ))}
                         </SelectGroup>
                       ))}
                     </SelectContent>
                   </Select>
                 )}
               />
            </div>
          )}

          {/* 3. Core Info Summary (Clickable for Detail) */}
          <div 
            onClick={() => setShowDetail(true)}
            className="group/info bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50 space-y-4 cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300"
          >
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Info size={16} className="text-slate-400 group-hover/info:text-indigo-500 transition-colors" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/info:text-indigo-400 transition-colors">Thông tin chỉ tiêu gốc</span>
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full opacity-0 group-hover/info:opacity-100 transition-all transform translate-x-2 group-hover/info:translate-x-0">
                   Xem chi tiết
                </div>
             </div>
             <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Tên chỉ tiêu</p>
                   <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/info:text-indigo-600 dark:group-hover/info:text-indigo-400 transition-colors">{kpi.name}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Mục tiêu</p>
                      <p className="text-sm font-black text-indigo-600">{kpi.targetValue} {kpi.unit}</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Trọng số</p>
                      <p className="text-sm font-black text-indigo-600">{kpi.weight}%</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Kỳ đánh giá</p>
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{periodsData?.content.find(p => p.id === kpi.kpiPeriodId)?.name || '...'}</p>
                   </div>
                </div>
             </div>
          </div>

          {!isAlreadyDelegated && (
            <div className="flex gap-4 pt-4">
              <button type="button" onClick={onClose} className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Đóng</button>
              <button 
                type="submit" 
                disabled={updateMutation.isPending || selectedAssignees.length === 0} 
                className="flex-2 py-4 px-8 rounded-2xl text-sm font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-3"
              >
                {updateMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                Xác nhận Giao việc
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Existing KPI Detail Modal */}
      <KpiDetailModal 
        open={showDetail} 
        onClose={() => setShowDetail(false)} 
        kpi={kpi} 
      />
    </div>
  )
}
