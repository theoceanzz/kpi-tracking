import { useMemo, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { kpiDelegationSchema, type KpiFormData } from '../schemas/kpiSchema'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { Loader2, Check, Target, Info } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
    resolver: zodResolver(kpiDelegationSchema),
    defaultValues: {
      kpiType: kpi.kpiType ?? 'QUANTITATIVE',
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
    // BE nhận orgUnitIds (List) — xem chú thích ở OrgUnitSubmissionsPage.
    orgUnitIds: kpi.orgUnitId ? [kpi.orgUnitId] : undefined,
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
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Giao việc thất bại'))
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
    return objectives.filter((obj: any) => obj.orgUnitIds?.includes(kpi.orgUnitId))
  }, [objectives, kpi.orgUnitId])

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      dismissible={!updateMutation.isPending}
      title="Giao việc & Ủy quyền"
      description="Phân bổ chỉ tiêu cho nhân sự cấp dưới"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Đóng</Button>}
          primary={!isAlreadyDelegated && (
            <Button type="submit" form="kpi-delegation-form" disabled={updateMutation.isPending || selectedAssignees.length === 0}>
              {updateMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
              Xác nhận Giao việc
            </Button>
          )}
        />
      }
    >
      <form id="kpi-delegation-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* 1. Assignees Section */}
        <div className="bg-[var(--color-primary-soft)] p-6 rounded-widget border border-[var(--color-border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-label">Người thực hiện</label>
            <span className="text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-3 py-1 rounded-full border border-[var(--color-border)] shadow-sm">
              {kpi.hasChildren && kpi.delegatedToNames && kpi.delegatedToNames.length > 0 
                ? `Đã giao cho: ${kpi.delegatedToNames.join(', ')}`
                : delegatedStaffCount > 0 
                  ? `Đã chọn ${delegatedStaffCount} nhân sự`
                  : 'Chưa giao cho ai'}
            </span>
          </div>
          
          {isAlreadyDelegated && (
            <div className="mb-2 px-3 py-2 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-card flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning-solid)]"/>
              <p className="text-xs font-medium text-[var(--color-warning)] tracking-tight">Chỉ tiêu đã được giao việc. Danh sách người thực hiện đã được khóa.</p>
            </div>
          )}

          <div className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="p-3 bg-[var(--color-muted)] border-b border-[var(--color-border)]">
              <input 
                type="text" 
                placeholder="Tìm theo tên hoặc email..." 
                value={userSearch} 
                onChange={e => setUserSearch(e.target.value)}
                className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-[var(--color-subtle-foreground)]"
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-2 space-y-1">
              {isLoadingUsers ? (
                <div className="py-8 text-center"><Loader2 className="animate-spin mx-auto text-[var(--color-primary)]" size={20} /></div>
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
                      "w-full px-4 py-4 flex items-center justify-between rounded-card transition-all",
                      isSelected ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
                      isDisabled && isSelected ? "opacity-90" : isDisabled ? "opacity-50 grayscale cursor-not-allowed" : ""
                    )}
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-medium tracking-tight">{u.fullName}</span>
                      <span className={cn("text-xs", isSelected ? "text-[var(--color-primary-foreground)]" : "text-[var(--color-subtle-foreground)]")}>{u.email}</span>
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
          <div className="bg-[var(--color-primary-soft)] p-5 rounded-widget border border-[var(--color-border)] space-y-3">
             <div className="flex items-center gap-2 text-[var(--color-primary)]">
               <Target size={18} />
               <span className="text-sm font-medium">OKR Chiến lược</span>
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
                     "w-full rounded-card border-[var(--color-border)] bg-[var(--color-card)] focus:ring-[var(--color-ring)] transition-all h-10",
                     (!!kpi.keyResultId || isAlreadyDelegated) && "bg-[var(--color-muted)] cursor-not-allowed opacity-70"
                   )}>
                     <SelectValue placeholder="-- Không liên kết --" />
                   </SelectTrigger>
                   <SelectContent className="rounded-card border-[var(--color-border)] max-h-[300px]">
                     <SelectItem value="NONE" className="font-medium">-- Không liên kết --</SelectItem>
                     {filteredObjectives.map(obj => (
                       <SelectGroup key={obj.id}>
                         <SelectLabel className="text-eyebrow px-2 py-1.5 text-[var(--color-primary)] bg-[var(--color-primary-soft)] rounded-control my-1">
                           {obj.name}
                         </SelectLabel>
                         {obj.keyResults.map((kr: any) => (
                           <SelectItem key={kr.id} value={kr.id} className="rounded-control">
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
          className="group/info bg-[var(--color-muted)] p-6 rounded-widget border border-[var(--color-border)] space-y-4 cursor-pointer hover:bg-[var(--color-card)] hover:border-[var(--color-border)] transition-all duration-300"
        >
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Info size={16} className="text-[var(--color-subtle-foreground)] group-hover/info:text-[var(--color-primary)] transition-colors" />
                 <span className="text-eyebrow group-hover/info:text-[var(--color-primary)] transition-colors">Thông tin chỉ tiêu gốc</span>
              </div>
              <div className="text-eyebrow text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2 py-0.5 rounded-full opacity-0 group-hover/info:opacity-100 transition-all transform translate-x-2 group-hover/info:translate-x-0">
                 Xem chi tiết
              </div>
           </div>
           <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                 <p className="text-eyebrow">Tên chỉ tiêu</p>
                 <p className="text-sm font-medium text-[var(--color-foreground)] group-hover/info:text-[var(--color-primary)] dark:group-hover/info:text-[var(--color-primary)] transition-colors">{kpi.name}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                 <div className="space-y-1">
                    <p className="text-eyebrow">Mục tiêu</p>
                    <p className="text-sm font-semibold text-[var(--color-primary)]">{kpi.targetValue} {kpi.unit}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-eyebrow">Trọng số</p>
                    <p className="text-sm font-semibold text-[var(--color-primary)]">{kpi.weight}%</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-eyebrow">Kỳ đánh giá</p>
                    <p className="text-sm font-medium text-[var(--color-muted-foreground)]">{periodsData?.content.find(p => p.id === kpi.kpiPeriodId)?.name || '...'}</p>
                 </div>
              </div>
           </div>
        </div>

      </form>
    </Dialog>

      {/* Existing KPI Detail Modal */}
      <KpiDetailModal 
        open={showDetail} 
        onClose={() => setShowDetail(false)} 
        kpi={kpi} 
      />
    </>
  )
}
