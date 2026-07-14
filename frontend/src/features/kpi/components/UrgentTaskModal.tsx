import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { toast } from 'sonner'
import { Loader2, X, AlertTriangle, ArrowLeftRight, SlidersHorizontal, Check, ShieldAlert, Target, Users, BarChart3 } from 'lucide-react'
import { FREQUENCY_MAP, cn, formatNumber, formatDateTime } from '@/lib/utils'
import type { KpiCriteria, KpiFrequency, KpiType } from '@/types/kpi'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useBscPerspectives } from '@/features/bsc/hooks/useBsc'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutGrid } from 'lucide-react'
import { DateTimePicker } from '@/components/common/DateTimePicker'


const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"
const labelCls = "block text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest mb-1.5"

const frequencyOptions = (['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'UNLIMITED'] as const)

interface UrgentTaskModalProps {
  open: boolean
  onClose: () => void
  kpiPeriodId: string
  orgUnitId: string
}

// ─── Shared Assignee Selector ────────────────────────────────────────────────

interface AssigneeSelectorProps {
  orgUnitId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  hint?: string
  isStaff?: boolean
  currentUser?: { id: string; fullName: string; email?: string | null }
}

function AssigneeSelector({ orgUnitId, selectedIds, onChange, hint, isStaff, currentUser }: AssigneeSelectorProps) {
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (isStaff && currentUser && (selectedIds.length === 0 || !selectedIds.includes(currentUser.id))) {
      onChange([currentUser.id])
    }
  }, [isStaff, currentUser?.id])

  const { data: usersData, isLoading } = useUsers(isStaff ? {} : {
    orgUnitIds: [orgUnitId],
    role: selectedRole === 'ALL' ? undefined : selectedRole,
    size: 500,
  })

  const allUsers = usersData?.content ?? []

  const availableRoles = useMemo(() => {
    const rolesMap = new Map<string, string>()
    allUsers.forEach(u => {
      const m = u.memberships?.[0]
      if (m?.roleName && m?.roleDisplayName) rolesMap.set(m.roleName, m.roleDisplayName)
    })
    return Array.from(rolesMap.entries()).map(([name, label]) => ({ name, label }))
  }, [allUsers])

  const displayUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers
    const s = userSearch.toLowerCase()
    return allUsers.filter(u =>
      u.fullName.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)
    )
  }, [allUsers, userSearch])

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  if (isStaff && currentUser) {
    return (
      <div className="bg-[var(--color-primary)]/5 rounded-2xl p-4 border border-[var(--color-primary)]/10">
        <label className="text-sm font-bold flex items-center gap-2 mb-3">
          <Users size={15} className="text-[var(--color-primary)]" />
          Giao thực hiện
        </label>
        <div className="bg-[var(--color-background)] border border-[var(--color-primary)]/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-lg shrink-0">
              {currentUser.fullName?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{currentUser.fullName} <span className="text-[var(--color-primary)]">(Bản thân)</span></div>
              <div className="text-[10px] text-[var(--color-muted-foreground)] font-medium truncate">{currentUser.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[9px] font-black uppercase">Đang chọn</span>
              <div className="bg-[var(--color-primary)] text-white rounded-full p-1">
                <Check size={12} strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-primary)]/5 rounded-2xl p-4 space-y-3 border border-[var(--color-primary)]/10">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold flex items-center gap-2">
          <Users size={15} className="text-[var(--color-primary)]" />
          Giao thực hiện
          {hint && <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">({hint})</span>}
        </label>
        <div className="px-2.5 py-1 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-black uppercase tracking-wider">
          {usersData?.totalElements ?? 0} nhân sự khả dụng
        </div>
      </div>

      {/* Role filter chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-black text-[var(--color-muted-foreground)] uppercase shrink-0">Role:</span>
        {[{ name: 'ALL', label: 'Tất cả' }, ...availableRoles].map(r => (
          <button key={r.name} type="button" onClick={() => setSelectedRole(r.name)}
            className={cn('px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-tight transition-all shrink-0',
              selectedRole === r.name
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                : 'bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-muted-foreground)]'
            )}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Search + list */}
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-background)] shadow-inner">
        <div className="p-2 border-b border-[var(--color-border)] bg-[var(--color-accent)]/5">
          <input type="text" placeholder="Họ tên hoặc Email..."
            value={userSearch} onChange={e => setUserSearch(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm" />
        </div>
        <div className="max-h-48 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-xs text-[var(--color-muted-foreground)] font-bold">
              <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
              <span className="uppercase tracking-widest opacity-50">Đang đồng bộ...</span>
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--color-muted-foreground)] font-medium italic">
              Không tìm thấy nhân sự phù hợp
            </div>
          ) : displayUsers.map(u => (
            <div key={u.id} onClick={() => toggle(u.id)}
              className={cn('flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                selectedIds.includes(u.id)
                  ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20 scale-[1.01] font-bold'
                  : 'hover:bg-[var(--color-accent)]'
              )}>
              <div className="flex flex-col">
                <span className="text-sm">{u.fullName}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-[9px] font-medium opacity-70',
                    selectedIds.includes(u.id) ? 'text-white' : 'text-[var(--color-muted-foreground)]'
                  )}>{u.email}</span>
                  {u.memberships?.[0]?.roleDisplayName && (
                    <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter',
                      selectedIds.includes(u.id)
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    )}>
                      {u.memberships[0].roleDisplayName}
                    </span>
                  )}
                </div>
              </div>
              {selectedIds.includes(u.id) && (
                <div className="bg-white rounded-full p-0.5 animate-in zoom-in">
                  <Check size={12} className="text-[var(--color-primary)]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Shared quantitative/qualitative switcher ────────────────────────────────

function KpiTypeTabs({ value, onChange }: { value: KpiType; onChange: (t: KpiType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--color-accent)]/30 border border-[var(--color-border)]/40">
      <button type="button" onClick={() => onChange('QUANTITATIVE')}
        className={cn('flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all',
          value !== 'QUALITATIVE' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]')}>
        <BarChart3 size={13} /> Định lượng
      </button>
      <button type="button" onClick={() => onChange('QUALITATIVE')}
        className={cn('flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all',
          value === 'QUALITATIVE' ? 'bg-emerald-600 text-white shadow-md' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]')}>
        <SlidersHorizontal size={13} /> Định tính
      </button>
    </div>
  )
}

// ─── Tab 1: Replace KPI ──────────────────────────────────────────────────────

interface ReplaceFormData {
  replacedKpiId: string
  replacementReason: string
  kpiType: KpiType
  name: string
  description: string
  frequency: KpiFrequency
  targetValue: string
  minimumValue: string
  unit: string
  isReverseKpi: boolean
  isBonusKpi: boolean
  deadline: string
  keyResultId: string
  perspectiveId: string
  assignedToIds: string[]
}

interface TabSharedProps {
  period?: { id: string; name: string; startDate: string | null; endDate: string | null }
  enableOkr: boolean
  enableQualitative: boolean
  enableBsc: boolean
  objectives: any[]
  perspectives: any[]
}

// ─── Shared BSC perspective selector ─────────────────────────────────────────

function PerspectiveSelect({ control, name, perspectives }: { control: any; name: string; perspectives: any[] }) {
  return (
    <div className="bg-violet-50/50 dark:bg-violet-900/5 p-4 rounded-2xl border border-violet-100 dark:border-violet-900/50 space-y-3">
      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
        <LayoutGrid size={16} />
        <span className="text-[11px] font-black uppercase tracking-widest">Viễn cảnh BSC</span>
      </div>
      <Controller name={name} control={control}
        render={({ field }: any) => (
          <Select onValueChange={field.onChange} value={field.value || 'NONE'}>
            <SelectTrigger className="w-full rounded-xl border-violet-100 dark:border-violet-900 bg-white dark:bg-slate-900 h-11 shadow-sm overflow-hidden">
              <SelectValue placeholder="-- Chưa gán viễn cảnh --" />
            </SelectTrigger>
            <SelectContent className="z-[300] rounded-2xl max-h-[300px]">
              <SelectItem value="NONE" className="font-bold py-3">-- Chưa gán viễn cảnh --</SelectItem>
              {perspectives?.map((p: any) => (
                <SelectItem key={p.id} value={p.id} className="rounded-xl py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#94a3b8' }} />
                    <span className="font-semibold text-xs">{p.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  )
}

function ReplaceTab({ kpiList, orgUnitId, period, enableOkr, enableQualitative, enableBsc, objectives, perspectives, onSuccess }: { kpiList: KpiCriteria[]; orgUnitId: string; onSuccess: () => void } & TabSharedProps) {
  const qc = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const isStaff = currentUser?.memberships?.[0]?.roleRank === 2

  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = useForm<ReplaceFormData>({
    defaultValues: { replacedKpiId: '', replacementReason: '', kpiType: 'QUANTITATIVE', name: '', description: '', frequency: 'MONTHLY', targetValue: '', minimumValue: '', unit: '', isReverseKpi: false, isBonusKpi: false, deadline: '', keyResultId: 'NONE', perspectiveId: 'NONE', assignedToIds: [] }
  })

  const replacedKpiId = watch('replacedKpiId')
  const selectedKpi = kpiList.find(k => k.id === replacedKpiId)
  const selectedAssignees = watch('assignedToIds')
  const kpiType = watch('kpiType')
  const isQual = kpiType === 'QUALITATIVE'

  useEffect(() => {
    if (selectedKpi) {
      setValue('frequency', selectedKpi.frequency)
      setValue('unit', selectedKpi.unit ?? '')
      setValue('targetValue', selectedKpi.targetValue?.toString() ?? '')
      setValue('minimumValue', selectedKpi.minimumValue?.toString() ?? '')
      setValue('assignedToIds', selectedKpi.assigneeIds ?? [])
    }
  }, [replacedKpiId, selectedKpi, setValue])

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ReplaceFormData) => kpiApi.replace(data.replacedKpiId, {
      replacementReason: data.replacementReason || undefined,
      kpiType: data.kpiType,
      name: data.name,
      description: data.description || undefined,
      frequency: data.frequency,
      targetValue: data.kpiType === 'QUALITATIVE' ? undefined : (data.targetValue ? parseFloat(data.targetValue) : undefined),
      minimumValue: data.kpiType === 'QUALITATIVE' ? undefined : (data.minimumValue ? parseFloat(data.minimumValue) : undefined),
      unit: data.kpiType === 'QUALITATIVE' ? undefined : (data.unit || undefined),
      isReverseKpi: data.kpiType === 'QUALITATIVE' ? false : data.isReverseKpi,
      isBonusKpi: data.isBonusKpi,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      keyResultId: (data.keyResultId && data.keyResultId !== 'NONE') ? data.keyResultId : null,
      perspectiveId: (data.perspectiveId && data.perspectiveId !== 'NONE') ? data.perspectiveId : null,
      assignedToIds: data.assignedToIds.length > 0 ? data.assignedToIds : undefined,
    }),
    onSuccess: () => {
      toast.success('KPI đã được thay thế thành công')
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      reset()
      onSuccess()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Thay thế KPI thất bại')
  })

  const activeKpis = kpiList.filter(k => k.status !== 'REPLACED' && k.status !== 'INACTIVE')

  return (
    <form onSubmit={handleSubmit(d => mutate(d))} className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/50 p-3 flex gap-2.5">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
          KPI được chọn sẽ bị đánh dấu <strong>Đã thay thế</strong> và không tính vào điểm. KPI mới sẽ kế thừa trọng số.
        </p>
      </div>

      <div>
        <label className={labelCls}>KPI cần thay thế <span className="text-red-500">*</span></label>
        <Controller name="replacedKpiId" control={control} rules={{ required: true }}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className={cn(inputCls, 'h-auto truncate', errors.replacedKpiId && 'ring-2 ring-red-500')}>
                <SelectValue placeholder="— Chọn KPI cần thay thế —" />
              </SelectTrigger>
              <SelectContent className="z-[300]">
                {activeKpis.map(k => (
                  <SelectItem key={k.id} value={k.id}>
                    <span className="font-semibold">{k.name}</span>
                    <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">({k.weight ?? 0}%)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {selectedKpi && (
          <p className="mt-1.5 text-[10px] font-bold text-[var(--color-muted-foreground)]">
            Trọng số kế thừa: <span className="text-[var(--color-primary)]">{selectedKpi.weight ?? 0}%</span>
            {' · '}Tần suất: {FREQUENCY_MAP[selectedKpi.frequency]}
            {selectedKpi.assigneeNames?.length > 0 && <> · Giao cho: {selectedKpi.assigneeNames.join(', ')}</>}
          </p>
        )}
      </div>

      <div>
        <label className={labelCls}>Lý do thay thế</label>
        <textarea {...register('replacementReason')} rows={2}
          placeholder="VD: Phát sinh công việc khẩn cấp từ khách hàng..."
          className={inputCls + ' resize-none'} />
      </div>

      <div className="space-y-4">
        <p className="text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest">Thông tin KPI thay thế</p>

        {enableQualitative && (
          <Controller name="kpiType" control={control}
            render={({ field }) => <KpiTypeTabs value={field.value} onChange={field.onChange} />} />
        )}

        <div>
          <label className={labelCls}>Tên KPI mới <span className="text-red-500">*</span></label>
          <input {...register('name', { required: true })} placeholder="VD: Xử lý yêu cầu khẩn khách hàng Q3"
            className={cn(inputCls, errors.name && 'ring-2 ring-red-500')} />
        </div>

        <div>
          <label className={labelCls}>Mô tả chi tiết</label>
          <textarea {...register('description')} rows={2}
            placeholder="Cung cấp ngữ cảnh và cách tính toán..."
            className={inputCls + ' resize-none'} />
        </div>

        <div className="bg-[var(--color-accent)]/10 rounded-2xl p-4 border border-[var(--color-border)]/30 space-y-3">
          {!isQual && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mục tiêu đạt được</label>
              <input type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()}
                {...register('targetValue')} placeholder="1000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mục tiêu tối thiểu</label>
              <input type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()}
                {...register('minimumValue')} placeholder="800" className={inputCls} />
            </div>
          </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tần suất <span className="text-red-500">*</span></label>
              <Controller name="frequency" control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={cn(inputCls, 'h-auto')}><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[300]">
                      {frequencyOptions.map(f => <SelectItem key={f} value={f}>{FREQUENCY_MAP[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {!isQual && (
            <div>
              <label className={labelCls}>Đơn vị tính</label>
              <input {...register('unit')} placeholder="VNĐ, %, KPI..." className={inputCls} />
            </div>
            )}
          </div>

          {!isQual && (
          <Controller name="isReverseKpi" control={control}
            render={({ field }) => (
              <button type="button" onClick={() => field.onChange(!field.value)}
                className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                  field.value ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50'
                )}>
                <div>
                  <span className={cn('text-sm font-bold', field.value ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--color-foreground)]')}>KPI Ngược</span>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">Giá trị mục tiêu càng thấp càng tốt (VD: tỉ lệ lỗi, chi phí)</p>
                </div>
                <div className={cn('w-10 h-6 rounded-full transition-all relative flex-shrink-0', field.value ? 'bg-orange-500' : 'bg-[var(--color-muted-foreground)]/30')}>
                  <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', field.value ? 'left-5' : 'left-1')} />
                </div>
              </button>
            )}
          />
          )}

          <Controller name="isBonusKpi" control={control}
            render={({ field }) => (
              <button type="button" onClick={() => field.onChange(!field.value)}
                className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                  field.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50'
                )}>
                <div>
                  <span className={cn('text-sm font-bold', field.value ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-foreground)]')}>KPI Thưởng</span>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">Không bắt buộc, không tính vào 100% trọng số, hoàn thành thì được cộng điểm thêm</p>
                </div>
                <div className={cn('w-10 h-6 rounded-full transition-all relative flex-shrink-0', field.value ? 'bg-emerald-500' : 'bg-[var(--color-muted-foreground)]/30')}>
                  <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', field.value ? 'left-5' : 'left-1')} />
                </div>
              </button>
            )}
          />
        </div>
      </div>

      <AssigneeSelector orgUnitId={orgUnitId} selectedIds={selectedAssignees}
        onChange={ids => setValue('assignedToIds', ids)}
        isStaff={isStaff} currentUser={currentUser ?? undefined} />

      {/* Deadline */}
      <div>
        <label className="block text-sm font-bold mb-1.5">Hạn chốt</label>
        <Controller name="deadline" control={control}
          render={({ field }) => (
            <DateTimePicker
              value={field.value || ''}
              onChange={field.onChange}
              placeholder="Chưa chọn (mặc định theo đợt)"
              className={cn(!period && 'opacity-50 pointer-events-none')}
            />
          )}
        />
        {period && (
          <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1">
            Để trống = mặc định theo ngày kết thúc đợt ({formatDateTime(period.endDate)})
          </p>
        )}
      </div>

      {/* OKR Key Result */}
      {enableOkr && (
        <div className="bg-indigo-50/50 dark:bg-indigo-900/5 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Target size={16} />
            <span className="text-[11px] font-black uppercase tracking-widest">Đẩy tiến độ OKR Chiến lược</span>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight">Gắn kết Kết quả then chốt (KR)</label>
            <Controller name="keyResultId" control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || 'NONE'}>
                  <SelectTrigger className="w-full rounded-xl border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 h-11 shadow-sm overflow-hidden">
                    <SelectValue placeholder="-- Không liên kết --" />
                  </SelectTrigger>
                  <SelectContent className="z-[300] rounded-2xl max-h-[300px]">
                    <SelectItem value="NONE" className="font-bold py-3">-- Không liên kết mục tiêu --</SelectItem>
                    {objectives.map((obj: any) => (
                      <SelectGroup key={obj.id} className="p-1">
                        <SelectLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl my-1.5 flex items-start justify-between gap-2">
                          <span>OBJ: {obj.name}</span>
                          <span className="text-[8px] border border-indigo-200 rounded px-1 py-0.5 shrink-0 font-black">OKR</span>
                        </SelectLabel>
                        {obj.keyResults?.map((kr: any) => (
                          <SelectItem key={kr.id} value={kr.id} className="rounded-xl py-2.5 pl-8">
                            <span className="font-semibold text-xs">{kr.name}</span>
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

      {/* BSC perspective */}
      {enableBsc && <PerspectiveSelect control={control} name="perspectiveId" perspectives={perspectives} />}

      <div className="flex gap-4 pt-2 border-t border-[var(--color-border)]/50">
        <button type="button" onClick={onSuccess}
          className="flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[var(--color-accent)] transition-all">
          Hủy
        </button>
        <button type="submit" disabled={isPending || !replacedKpiId}
          className="flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {isPending && <Loader2 size={16} className="animate-spin" />}
          Thay thế KPI
        </button>
      </div>
    </form>
  )
}

// ─── Tab 2: Reduce weights + Add new KPI ────────────────────────────────────

interface AdjustFormData {
  weights: { kpiId: string; name: string; currentWeight: number; newWeight: number }[]
  newKpiType: KpiType
  newName: string
  newWeight: number | string
  newFrequency: KpiFrequency
  newTargetValue: string
  newMinimumValue: string
  newUnit: string
  newIsReverseKpi: boolean
  newIsBonusKpi: boolean
  newDeadline: string
  newKeyResultId: string
  newPerspectiveId: string
  newAssignedToIds: string[]
  newDescription: string
}

function AdjustTab({ kpiList, kpiPeriodId, orgUnitId, period, enableOkr, enableQualitative, enableBsc, objectives, perspectives, onSuccess }: { kpiList: KpiCriteria[]; kpiPeriodId: string; orgUnitId: string; onSuccess: () => void } & TabSharedProps) {
  const qc = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const isStaff = currentUser?.memberships?.[0]?.roleRank === 2

  const adjustableKpis = kpiList.filter(k => k.status !== 'REPLACED' && k.status !== 'INACTIVE')

  const { register, handleSubmit, watch, control, formState: { errors } } = useForm<AdjustFormData>({
    defaultValues: {
      weights: adjustableKpis.map(k => ({ kpiId: k.id, name: k.name, currentWeight: k.weight ?? 0, newWeight: k.weight ?? 0 })),
      newKpiType: 'QUANTITATIVE', newName: '', newWeight: '', newFrequency: 'MONTHLY', newTargetValue: '', newMinimumValue: '', newUnit: '', newIsReverseKpi: false, newIsBonusKpi: false, newDeadline: '', newKeyResultId: 'NONE', newPerspectiveId: 'NONE', newAssignedToIds: [], newDescription: ''
    }
  })

  const newKpiType = watch('newKpiType')
  const isQual = newKpiType === 'QUALITATIVE'

  const { fields } = useFieldArray({ control, name: 'weights' })
  const watchedWeights = watch('weights')
  const watchedNewWeight = watch('newWeight')

  const totalExisting = watchedWeights.reduce((sum, w) => sum + (parseFloat(String(w.newWeight)) || 0), 0)
  const totalAll = totalExisting + (parseFloat(String(watchedNewWeight)) || 0)
  const remaining = 100 - totalAll
  const isValid = Math.abs(totalAll - 100) <= 0.01

  const batchMutation = useMutation({
    mutationFn: (data: AdjustFormData) => kpiApi.batchUpdateWeights({
      updates: data.weights.map(w => ({ kpiId: w.kpiId, weight: parseFloat(String(w.newWeight)) || 0 }))
    }),
    onError: (err: any) => { throw err }
  })

  const createMutation = useMutation({
    mutationFn: (data: AdjustFormData) => kpiApi.create({
      kpiType: data.newKpiType,
      name: data.newName,
      description: data.newDescription || undefined,
      weight: parseFloat(String(data.newWeight)) || 0,
      frequency: data.newFrequency,
      targetValue: data.newKpiType === 'QUALITATIVE' ? undefined : (data.newTargetValue ? parseFloat(data.newTargetValue) : undefined),
      minimumValue: data.newKpiType === 'QUALITATIVE' ? undefined : (data.newMinimumValue ? parseFloat(data.newMinimumValue) : undefined),
      unit: data.newKpiType === 'QUALITATIVE' ? undefined : (data.newUnit || undefined),
      isReverseKpi: data.newKpiType === 'QUALITATIVE' ? false : data.newIsReverseKpi,
      isBonusKpi: data.newIsBonusKpi,
      deadline: data.newDeadline ? new Date(data.newDeadline).toISOString() : null,
      keyResultId: (data.newKeyResultId && data.newKeyResultId !== 'NONE') ? data.newKeyResultId : null,
      perspectiveId: (data.newPerspectiveId && data.newPerspectiveId !== 'NONE') ? data.newPerspectiveId : null,
      assignedToIds: data.newAssignedToIds.length > 0 ? data.newAssignedToIds : undefined,
      kpiPeriodId,
      orgUnitId,
    }),
    onError: (err: any) => { throw err }
  })

  const isPending = batchMutation.isPending || createMutation.isPending

  const onSubmit = async (data: AdjustFormData) => {
    if (!isValid) { toast.error(`Tổng trọng số phải đúng 100% (hiện tại: ${formatNumber(totalAll)}%)`); return }
    if (!data.newName.trim()) { toast.error('Vui lòng nhập tên KPI mới'); return }
    try {
      if (adjustableKpis.length > 0) await batchMutation.mutateAsync(data)
      await createMutation.mutateAsync(data)
      toast.success('Đã điều chỉnh trọng số và thêm KPI mới')
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Có lỗi xảy ra')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {adjustableKpis.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest">Điều chỉnh trọng số KPI hiện có</p>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-background)] shadow-sm">
            <div className="grid grid-cols-[1fr_88px_52px_76px] text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)] bg-[var(--color-accent)]/30 px-3 py-2 border-b border-[var(--color-border)]">
              <span>Tên KPI</span>
              <span className="text-center whitespace-nowrap">Trạng thái</span>
              <span className="text-center whitespace-nowrap">Cũ (%)</span>
              <span className="text-center whitespace-nowrap">Mới (%)</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {fields.map((field, idx) => {
                const kpi = adjustableKpis[idx]
                return (
                  <div key={field.id} className="grid grid-cols-[1fr_88px_52px_76px] items-center px-3 py-2.5 gap-2">
                    <span className="text-sm font-medium text-[var(--color-foreground)] truncate">{kpi?.name}</span>
                    <span className={`text-center text-[9px] font-black uppercase whitespace-nowrap ${kpi?.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {kpi?.status === 'APPROVED' ? 'Đã duyệt' : kpi?.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Nháp'}
                    </span>
                    <span className="text-center text-sm text-[var(--color-muted-foreground)]">{formatNumber(kpi?.weight ?? 0)}</span>
                    <input type="number" step="0.1" min="0" max="100"
                      {...register(`weights.${idx}.newWeight`, { valueAsNumber: true })}
                      className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 shadow-sm" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-[11px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest">KPI khẩn cấp mới</p>

        {enableQualitative && (
          <Controller name="newKpiType" control={control}
            render={({ field }) => <KpiTypeTabs value={field.value} onChange={field.onChange} />} />
        )}

        <div>
          <label className={labelCls}>Tên KPI mới <span className="text-red-500">*</span></label>
          <input {...register('newName')} placeholder="VD: Xử lý yêu cầu khẩn cấp tháng 7"
            className={cn(inputCls, errors.newName && 'ring-2 ring-red-500')} />
        </div>

        <div>
          <label className={labelCls}>Mô tả chi tiết</label>
          <textarea {...register('newDescription')} rows={2}
            placeholder="Cung cấp ngữ cảnh và cách tính toán..."
            className={inputCls + ' resize-none'} />
        </div>

        <div className="bg-[var(--color-accent)]/10 rounded-2xl p-4 border border-[var(--color-border)]/30 space-y-3">
          {!isQual && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mục tiêu đạt được</label>
              <input type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()}
                {...register('newTargetValue')} placeholder="1000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mục tiêu tối thiểu</label>
              <input type="number" step="any" onWheel={e => (e.target as HTMLInputElement).blur()}
                {...register('newMinimumValue')} placeholder="800" className={inputCls} />
            </div>
          </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Trọng số (%) <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" min="0" max="100"
                onWheel={e => (e.target as HTMLInputElement).blur()}
                {...register('newWeight')} placeholder="20" className={inputCls} />
            </div>
            {!isQual && (
            <div>
              <label className={labelCls}>Đơn vị tính</label>
              <input {...register('newUnit')} placeholder="VNĐ, %, KPI..." className={inputCls} />
            </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Tần suất <span className="text-red-500">*</span></label>
            <Controller name="newFrequency" control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={cn(inputCls, 'h-auto')}><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[300]">
                    {frequencyOptions.map(f => <SelectItem key={f} value={f}>{FREQUENCY_MAP[f]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {!isQual && (
          <Controller name="newIsReverseKpi" control={control}
            render={({ field }) => (
              <button type="button" onClick={() => field.onChange(!field.value)}
                className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                  field.value ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10' : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50'
                )}>
                <div>
                  <span className={cn('text-sm font-bold', field.value ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--color-foreground)]')}>KPI Ngược</span>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">Giá trị mục tiêu càng thấp càng tốt (VD: tỉ lệ lỗi, chi phí)</p>
                </div>
                <div className={cn('w-10 h-6 rounded-full transition-all relative flex-shrink-0', field.value ? 'bg-orange-500' : 'bg-[var(--color-muted-foreground)]/30')}>
                  <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', field.value ? 'left-5' : 'left-1')} />
                </div>
              </button>
            )}
          />
          )}

          <Controller name="newIsBonusKpi" control={control}
            render={({ field }) => (
              <button type="button" onClick={() => field.onChange(!field.value)}
                className={cn('w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left',
                  field.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/50'
                )}>
                <div>
                  <span className={cn('text-sm font-bold', field.value ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-foreground)]')}>KPI Thưởng</span>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">Không bắt buộc, không tính vào 100% trọng số, hoàn thành thì được cộng điểm thêm</p>
                </div>
                <div className={cn('w-10 h-6 rounded-full transition-all relative flex-shrink-0', field.value ? 'bg-emerald-500' : 'bg-[var(--color-muted-foreground)]/30')}>
                  <div className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all', field.value ? 'left-5' : 'left-1')} />
                </div>
              </button>
            )}
          />
        </div>
      </div>

      <Controller name="newAssignedToIds" control={control}
        render={({ field }) => (
          <AssigneeSelector orgUnitId={orgUnitId} selectedIds={field.value} onChange={field.onChange}
            isStaff={isStaff} currentUser={currentUser ?? undefined} />
        )}
      />

      {/* Deadline */}
      <div>
        <label className="block text-sm font-bold mb-1.5">Hạn chốt</label>
        <Controller name="newDeadline" control={control}
          render={({ field }) => (
            <DateTimePicker
              value={field.value || ''}
              onChange={field.onChange}
              placeholder="Chưa chọn (mặc định theo đợt)"
              className={cn(!period && 'opacity-50 pointer-events-none')}
            />
          )}
        />
        {period && (
          <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1">
            Để trống = mặc định theo ngày kết thúc đợt ({formatDateTime(period.endDate)})
          </p>
        )}
      </div>

      {/* OKR Key Result */}
      {enableOkr && (
        <div className="bg-indigo-50/50 dark:bg-indigo-900/5 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Target size={16} />
            <span className="text-[11px] font-black uppercase tracking-widest">Đẩy tiến độ OKR Chiến lược</span>
          </div>
          <div className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight">Gắn kết Kết quả then chốt (KR)</label>
            <Controller name="newKeyResultId" control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || 'NONE'}>
                  <SelectTrigger className="w-full rounded-xl border-indigo-100 dark:border-indigo-900 bg-white dark:bg-slate-900 h-11 shadow-sm overflow-hidden">
                    <SelectValue placeholder="-- Không liên kết --" />
                  </SelectTrigger>
                  <SelectContent className="z-[300] rounded-2xl max-h-[300px]">
                    <SelectItem value="NONE" className="font-bold py-3">-- Không liên kết mục tiêu --</SelectItem>
                    {objectives.map((obj: any) => (
                      <SelectGroup key={obj.id} className="p-1">
                        <SelectLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl my-1.5 flex items-start justify-between gap-2">
                          <span>OBJ: {obj.name}</span>
                          <span className="text-[8px] border border-indigo-200 rounded px-1 py-0.5 shrink-0 font-black">OKR</span>
                        </SelectLabel>
                        {obj.keyResults?.map((kr: any) => (
                          <SelectItem key={kr.id} value={kr.id} className="rounded-xl py-2.5 pl-8">
                            <span className="font-semibold text-xs">{kr.name}</span>
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

      {/* BSC perspective */}
      {enableBsc && <PerspectiveSelect control={control} name="newPerspectiveId" perspectives={perspectives} />}

      <div className={cn('rounded-xl px-4 py-3 flex items-center justify-between border',
        isValid
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300'
      )}>
        <span className="text-sm font-bold">Tổng trọng số sau khi lưu</span>
        <div className="text-right">
          <span className="text-lg font-black">{formatNumber(totalAll)}%</span>
          {!isValid && <p className="text-[10px] font-bold mt-0.5">
            {remaining > 0 ? `Còn thiếu ${formatNumber(remaining)}%` : `Đang thừa ${formatNumber(Math.abs(remaining))}%`}
          </p>}
        </div>
      </div>

      <div className="flex gap-4 pt-2 border-t border-[var(--color-border)]/50">
        <button type="button" onClick={onSuccess}
          className="flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[var(--color-accent)] transition-all">
          Hủy
        </button>
        <button type="submit" disabled={isPending}
          className="flex-1 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {isPending && <Loader2 size={16} className="animate-spin" />}
          Lưu & Thêm KPI
        </button>
      </div>
    </form>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export default function UrgentTaskModal({ open, onClose, kpiPeriodId: initPeriodId, orgUnitId: initOrgUnitId }: UrgentTaskModalProps) {
  const [tab, setTab] = useState<'replace' | 'adjust'>('replace')
  const [selectedPeriodId, setSelectedPeriodId] = useState(initPeriodId)
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState(initOrgUnitId)

  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const isStaff = user?.memberships?.[0]?.roleRank === 2
  const staffOrgUnitId = user?.memberships?.[0]?.orgUnitId

  // Sync with props when modal opens
  useEffect(() => {
    if (open) {
      setSelectedPeriodId(initPeriodId)
      setSelectedOrgUnitId(isStaff && staffOrgUnitId ? staffOrgUnitId : initOrgUnitId)
    }
  }, [open, initPeriodId, initOrgUnitId])

  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: org } = useOrganization(organizationId)
  const enableOkr = org?.enableOkr ?? false
  const enableQualitative = org?.enableQualitative ?? false
  const enableBsc = org?.enableBsc ?? false
  const { data: objectives } = useObjectives(enableOkr ? organizationId : undefined)
  const { data: perspectives } = useBscPerspectives(enableBsc ? organizationId : undefined)
  const { data: orgUnitTreeData } = useOrgUnitTree()

  const flatOrgUnits = useMemo(() => {
    if (!orgUnitTreeData) return []
    const flatten = (nodes: any[], level = 0): any[] => {
      let result: any[] = []
      nodes.forEach(n => {
        result.push({ ...n, level, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + n.name })
        if (n.children?.length) result = result.concat(flatten(n.children, level + 1))
      })
      return result
    }
    return flatten(orgUnitTreeData)
  }, [orgUnitTreeData])

  // Fetch KPIs for selected period + org unit
  const ready = !!selectedPeriodId && !!selectedOrgUnitId

  const { data: kpiData, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['kpi-criteria', 'urgent-list', selectedPeriodId, selectedOrgUnitId],
    queryFn: () => kpiApi.getAll({ kpiPeriodId: selectedPeriodId, orgUnitId: selectedOrgUnitId, size: 200 }),
    enabled: open && ready,
  })

  // Fetch total weight to validate 100%
  const { data: totalWeight, isLoading: isLoadingWeight } = useKpiTotalWeight(
    ready ? selectedOrgUnitId : undefined,
    ready ? selectedPeriodId : undefined
  )

  const weightIs100 = totalWeight != null && Math.abs(totalWeight - 100) <= 0.001
  const kpiList = (kpiData?.content ?? []).filter(k => k.orgUnitId === selectedOrgUnitId)
  const selectedPeriod = periodsData?.content.find(p => p.id === selectedPeriodId)
  const filteredObjectives = useMemo(() => {
    if (!objectives || !selectedOrgUnitId) return []
    return objectives.filter((obj: any) => obj.orgUnitIds?.includes(selectedOrgUnitId))
  }, [objectives, selectedOrgUnitId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[92vh] flex flex-col border border-[var(--color-border)]/50 animate-in zoom-in-95">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]/50">
          <div className="space-y-0.5">
            <h3 className="text-lg font-extrabold tracking-tight text-[var(--color-foreground)]">Thêm task khẩn cấp</h3>
            <p className="text-xs text-[var(--color-muted-foreground)] font-medium">Thay thế KPI hoặc điều chỉnh trọng số để bổ sung công việc mới</p>
          </div>
          <button onClick={onClose}
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-all p-1.5 hover:bg-[var(--color-accent)] rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Period + Org Unit filter */}
        <div className="px-6 py-4 border-b border-[var(--color-border)]/50 space-y-3 bg-[var(--color-accent)]/5">
          <p className="text-[10px] font-black text-[var(--color-muted-foreground)] uppercase tracking-widest">Chọn phạm vi áp dụng</p>
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-black text-[var(--color-muted-foreground)] uppercase mb-1.5 truncate">Kỳ đánh giá <span className="text-red-500">*</span></label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className={cn(inputCls, 'h-auto truncate')}>
                  <SelectValue placeholder="— Chọn đợt —" />
                </SelectTrigger>
                <SelectContent className="z-[300]">
                  {periodsData?.content.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isStaff && (
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-black text-[var(--color-muted-foreground)] uppercase mb-1.5 truncate">Đơn vị <span className="text-red-500">*</span></label>
                <Select value={selectedOrgUnitId} onValueChange={setSelectedOrgUnitId}>
                  <SelectTrigger className={cn(inputCls, 'h-auto truncate')}>
                    <SelectValue placeholder="— Chọn đơn vị —" />
                  </SelectTrigger>
                  <SelectContent className="z-[300]">
                    {flatOrgUnits.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.levelLabel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Weight status */}
          {ready && (
            <div className={cn('rounded-xl px-3 py-2 flex items-center justify-between text-xs font-bold border',
              isLoadingWeight
                ? 'bg-[var(--color-accent)] border-[var(--color-border)] text-[var(--color-muted-foreground)]'
                : weightIs100
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300'
            )}>
              <span className="flex items-center gap-1.5">
                {isLoadingWeight
                  ? <Loader2 size={12} className="animate-spin" />
                  : weightIs100
                    ? <Check size={12} />
                    : <ShieldAlert size={12} />
                }
                {isLoadingWeight
                  ? 'Đang kiểm tra trọng số...'
                  : weightIs100
                    ? 'Tổng trọng số đạt 100% — sẵn sàng thao tác'
                    : (
                      <span>
                        Chức năng này chỉ dùng được khi tổng trọng số đã đạt <strong>100%</strong>.{' '}
                        Vui lòng vào <strong>Tạo mới KPI/ Import KPI</strong> để bổ sung cho đủ trọng số trước.
                      </span>
                    )
                }
              </span>
              {!isLoadingWeight && (
                <span className="text-sm font-black ml-2 shrink-0">{formatNumber(totalWeight ?? 0)}%</span>
              )}
            </div>
          )}
        </div>

        {/* Tabs — chỉ hiển thị khi đủ điều kiện */}
        {ready && !isLoadingWeight && weightIs100 && (
          <div className="flex border-b border-[var(--color-border)]/50 px-6">
            <button onClick={() => setTab('replace')}
              className={cn('flex items-center gap-2 py-3 pr-6 text-xs font-black uppercase tracking-wider border-b-2 -mb-px transition-colors',
                tab === 'replace' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
              )}>
              <ArrowLeftRight size={14} /> Thay thế KPI
            </button>
            <button onClick={() => setTab('adjust')}
              className={cn('flex items-center gap-2 py-3 pr-6 text-xs font-black uppercase tracking-wider border-b-2 -mb-px transition-colors',
                tab === 'adjust' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
              )}>
              <SlidersHorizontal size={14} /> Điều chỉnh trọng số
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 custom-scrollbar">
          {!ready ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <ShieldAlert size={36} className="text-[var(--color-muted-foreground)] opacity-30" />
              <p className="text-sm font-bold text-[var(--color-muted-foreground)]">Chọn kỳ đánh giá và đơn vị để tiếp tục</p>
            </div>
          ) : isLoadingWeight || isLoadingKpis ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-muted-foreground)] opacity-50">Đang tải...</span>
            </div>
          ) : !weightIs100 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                <ShieldAlert size={32} className="text-red-500 dark:text-red-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-[var(--color-foreground)]">Chưa thể thực hiện thao tác này</p>
                <p className="text-xs text-[var(--color-muted-foreground)] max-w-xs leading-relaxed">
                  Tổng trọng số KPI của đơn vị đang là <strong className="text-red-500">{formatNumber(totalWeight ?? 0)}%</strong>, chưa đạt mức 100% bắt buộc.
                  Hãy vào <strong>Tạo mới KPI</strong> để bổ sung KPI cho đủ 100% trọng số trước khi thêm task khẩn cấp.
                </p>
              </div>
              <button onClick={onClose}
                className="mt-2 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                Đóng & Tạo mới KPI
              </button>
            </div>
          ) : kpiList.length === 0 ? (
            <p className="text-center text-sm font-medium text-[var(--color-muted-foreground)] py-16 italic">Chưa có KPI nào trong kỳ này</p>
          ) : tab === 'replace' ? (
            <ReplaceTab kpiList={kpiList} orgUnitId={selectedOrgUnitId} period={selectedPeriod} enableOkr={enableOkr} enableQualitative={enableQualitative} enableBsc={enableBsc} objectives={filteredObjectives} perspectives={perspectives ?? []} onSuccess={onClose} />
          ) : (
            <AdjustTab kpiList={kpiList} kpiPeriodId={selectedPeriodId} orgUnitId={selectedOrgUnitId} period={selectedPeriod} enableOkr={enableOkr} enableQualitative={enableQualitative} enableBsc={enableBsc} objectives={filteredObjectives} perspectives={perspectives ?? []} onSuccess={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}
