import { useState, useEffect, useMemo } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2, AlertTriangle, ArrowLeftRight, SlidersHorizontal, Check, ShieldAlert, Users, Building2, CalendarRange,
} from 'lucide-react'
import { adjustKpiSchema, replaceKpiSchema, NEW_KPI_DEFAULTS, type AdjustFormData, type ReplaceFormData } from '../schemas/urgentTaskSchema'
import { kpiApi } from '../api/kpiApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { FREQUENCY_MAP, cn, formatNumber } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import type { KpiCriteria } from '@/types/kpi'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useBscPerspectives, useScorecards } from '@/features/bsc/hooks/useBsc'
import { useKpiTotalWeight } from '../hooks/useKpiTotalWeight'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'
import { perspectiveHint } from '@/features/bsc/utils/perspectiveHint'
import type { ScorecardPerspectiveResponse } from '@/features/bsc/types'
import { toastFirstError } from '@/lib/formErrors'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { SegmentedControl } from '@/components/common/FilterBar'
import { Field, Hint } from './KpiFormParts'
import { UrgentKpiFields, type UrgentKpiContext } from './UrgentKpiFields'

interface UrgentTaskModalProps {
  open: boolean
  onClose: () => void
  kpiPeriodId: string
  orgUnitId: string
}

type Tab = 'replace' | 'adjust'

// ─── Giao thực hiện ──────────────────────────────────────────────────────────

function AssigneeSelector({ orgUnitId, selectedIds, onChange, hint, isStaff, currentUser }: {
  orgUnitId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  hint?: string
  isStaff?: boolean
  currentUser?: { id: string; fullName: string; email?: string | null; avatarUrl?: string | null }
}) {
  const [selectedRole, setSelectedRole] = useState('ALL')
  const [userSearch, setUserSearch] = useState('')

  useEffect(() => {
    if (isStaff && currentUser && (selectedIds.length === 0 || !selectedIds.includes(currentUser.id))) {
      onChange([currentUser.id])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return allUsers.filter(u => u.fullName.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s))
  }, [allUsers, userSearch])

  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-label flex items-center gap-2"><Users size={15} className="text-[var(--color-primary)]" aria-hidden="true" /> Giao thực hiện</label>
        {!isStaff && <span className="text-caption">{selectedIds.length} người</span>}
      </div>
      {hint && <p className="text-caption">{hint}</p>}
      {isStaff && currentUser ? (
        <div className="flex items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2.5">
          <UserAvatar fullName={currentUser.fullName} avatarUrl={currentUser.avatarUrl} className="h-8 w-8 rounded-full" fallbackClassName="bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-sm font-semibold" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentUser.fullName} <span className="text-[var(--color-primary)]">(bản thân)</span></p>
            <p className="truncate text-caption">{currentUser.email}</p>
          </div>
          <Check size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] p-2">
            <Input size="sm" placeholder="Tìm theo tên hoặc email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-56" />
            <ChoiceChip selected={selectedRole === 'ALL'} size="sm" onClick={() => setSelectedRole('ALL')}>Tất cả</ChoiceChip>
            {availableRoles.map(r => (
              <ChoiceChip key={r.name} selected={selectedRole === r.name} size="sm" onClick={() => setSelectedRole(r.name)}>{r.label}</ChoiceChip>
            ))}
          </div>
          <div className="custom-scrollbar max-h-44 space-y-0.5 overflow-y-auto p-1.5">
            {isLoading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-caption"><Loader2 size={16} className="animate-spin" /> Đang tải nhân sự…</p>
            ) : displayUsers.length === 0 ? (
              <p className="py-8 text-center text-caption">Không có nhân sự phù hợp</p>
            ) : displayUsers.map(u => {
              const on = selectedIds.includes(u.id)
              return (
                <button key={u.id} type="button" onClick={() => toggle(u.id)}
                  className={cn('flex w-full items-center justify-between rounded-control px-3 py-2 text-left transition-colors',
                    on ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'hover:bg-[var(--color-muted)]')}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.fullName}</span>
                    <span className={cn('block truncate text-xs', on ? 'text-white/80' : 'text-[var(--color-muted-foreground)]')}>
                      {u.email}{u.memberships?.[0]?.roleDisplayName && ` · ${u.memberships[0].roleDisplayName}`}
                    </span>
                  </span>
                  {on && <Check size={14} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Thay thế ────────────────────────────────────────────────────────────

function ReplaceTab({ kpiList, orgUnitId, ctx, onSuccess }: { kpiList: KpiCriteria[]; orgUnitId: string; ctx: UrgentKpiContext; onSuccess: () => void }) {
  const qc = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const isStaff = currentUser?.memberships?.[0]?.roleRank === 2

  const form = useForm<ReplaceFormData>({
    resolver: zodResolver(replaceKpiSchema),
    defaultValues: { replacedKpiId: '', replacementReason: '', ...NEW_KPI_DEFAULTS },
  })
  const { register, handleSubmit, watch, setValue, control, reset, formState: { errors } } = form

  const replacedKpiId = watch('replacedKpiId')
  const selectedKpi = kpiList.find(k => k.id === replacedKpiId)
  const selectedAssignees = watch('assignedToIds')

  // KPI bị thay thế cho sẵn tần suất, đơn vị tính, mục tiêu, người nhận — KPI mới thường là
  // "cùng việc đó nhưng con số khác", điền lại từ đầu là bắt gõ lại thứ đã có.
  useEffect(() => {
    if (!selectedKpi) return
    setValue('frequency', selectedKpi.frequency)
    setValue('unit', selectedKpi.unit ?? '')
    setValue('targetValue', selectedKpi.targetValue?.toString() ?? '')
    setValue('minimumValue', selectedKpi.minimumValue?.toString() ?? '')
    setValue('assignedToIds', selectedKpi.assigneeIds ?? [])
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
    onError: (err) => toast.error(getApiErrorMessage(err, 'Thay thế KPI thất bại')),
  })

  const activeKpis = kpiList.filter(k => k.status !== 'REPLACED' && k.status !== 'INACTIVE')

  return (
    <form id="urgent-form" onSubmit={handleSubmit(d => mutate(d), toastFirstError)} className="flex flex-col gap-6">
      <UrgentKpiFields
        form={form}
        ctx={ctx}
        contextSlot={
          <>
            <Field label="KPI cần thay thế" required error={errors.replacedKpiId?.message}
              hint={selectedKpi ? `Kế thừa trọng số ${selectedKpi.weight ?? 0}% · ${FREQUENCY_MAP[selectedKpi.frequency]}${selectedKpi.assigneeNames?.length ? ` · ${selectedKpi.assigneeNames.join(', ')}` : ''}` : 'KPI được chọn sẽ đánh dấu "Đã thay thế", không tính điểm; KPI mới kế thừa trọng số.'}>
              <Controller name="replacedKpiId" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={!!errors.replacedKpiId}><SelectValue placeholder="— Chọn KPI cần thay thế —" /></SelectTrigger>
                  <SelectContent>
                    {activeKpis.map(k => (
                      <SelectItem key={k.id} value={k.id} extra={<span className="ml-auto pl-3 text-caption">{k.weight ?? 0}%</span>}>
                        <span className="truncate">{k.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Lý do thay thế">
              <Textarea {...register('replacementReason')} rows={2} placeholder="VD: Phát sinh công việc khẩn cấp từ khách hàng…" />
            </Field>
            <AssigneeSelector orgUnitId={orgUnitId} selectedIds={selectedAssignees} onChange={ids => setValue('assignedToIds', ids)}
              isStaff={isStaff} currentUser={currentUser ?? undefined}
              hint={selectedKpi ? 'Đã chép người nhận từ KPI bị thay thế — sửa nếu cần.' : undefined} />
          </>
        }
      />
      <UrgentFooter isPending={isPending} label="Thay thế KPI" onCancel={onSuccess} />
    </form>
  )
}

// ─── Tab Điều chỉnh ──────────────────────────────────────────────────────────

function AdjustTab({ kpiList, kpiPeriodId, orgUnitId, ctx, perspectiveWeightPct, onSuccess }: {
  kpiList: KpiCriteria[]; kpiPeriodId: string; orgUnitId: string; ctx: UrgentKpiContext
  perspectiveWeightPct?: Map<string, number>; onSuccess: () => void
}) {
  const qc = useQueryClient()
  const { user: currentUser } = useAuthStore()
  const isStaff = currentUser?.memberships?.[0]?.roleRank === 2
  const adjustableKpis = kpiList.filter(k => k.status !== 'REPLACED' && k.status !== 'INACTIVE')

  const form = useForm<AdjustFormData>({
    resolver: zodResolver(adjustKpiSchema),
    defaultValues: {
      weights: adjustableKpis.map(k => ({ kpiId: k.id, name: k.name, currentWeight: k.weight ?? 0, newWeight: k.weight ?? 0 })),
      weight: '', ...NEW_KPI_DEFAULTS,
    },
  })
  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = form
  const { fields } = useFieldArray({ control, name: 'weights' })
  const watchedWeights = watch('weights')
  const watchedNewWeight = watch('weight')
  const watchedNewPerspId = watch('perspectiveId')
  const selectedAssignees = watch('assignedToIds')

  // Trọng số THẬT = form × %hạng_mục (bộ tiêu chí của đơn vị). Không BSC ⇒ giữ form; hạng mục
  // không có trong bộ tiêu chí ⇒ 0 (không tính). Nhờ vậy tổng ≈ 100% thay vì cộng dồn form.
  const usePct = ctx.enableBsc && !!perspectiveWeightPct && perspectiveWeightPct.size > 0
  const realOf = (effPerspId: string | null | undefined, formWeight: number) => {
    if (!usePct || !effPerspId) return formWeight
    const pct = perspectiveWeightPct!.get(effPerspId)
    return pct == null ? 0 : formWeight * pct / 100
  }
  const totalExisting = watchedWeights.reduce((sum, w, i) => sum + realOf(adjustableKpis[i]?.effectivePerspectiveId, parseFloat(String(w.newWeight)) || 0), 0)
  const newPerspId = watchedNewPerspId && watchedNewPerspId !== 'NONE' ? watchedNewPerspId : null
  const newReal = realOf(newPerspId, parseFloat(String(watchedNewWeight)) || 0)
  const totalAll = totalExisting + newReal
  const isValid = Math.abs(totalAll - 100) <= 0.01

  const batchMutation = useMutation({
    mutationFn: (data: AdjustFormData) => kpiApi.batchUpdateWeights({
      updates: data.weights.map(w => ({ kpiId: w.kpiId, weight: parseFloat(String(w.newWeight)) || 0 })),
    }),
  })
  const createMutation = useMutation({
    mutationFn: (data: AdjustFormData) => kpiApi.create({
      kpiType: data.kpiType, name: data.name, description: data.description || undefined,
      weight: parseFloat(String(data.weight)) || 0, frequency: data.frequency,
      targetValue: data.kpiType === 'QUALITATIVE' ? undefined : (data.targetValue ? parseFloat(data.targetValue) : undefined),
      minimumValue: data.kpiType === 'QUALITATIVE' ? undefined : (data.minimumValue ? parseFloat(data.minimumValue) : undefined),
      unit: data.kpiType === 'QUALITATIVE' ? undefined : (data.unit || undefined),
      isReverseKpi: data.kpiType === 'QUALITATIVE' ? false : data.isReverseKpi,
      isBonusKpi: data.isBonusKpi,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      keyResultId: (data.keyResultId && data.keyResultId !== 'NONE') ? data.keyResultId : null,
      perspectiveId: (data.perspectiveId && data.perspectiveId !== 'NONE') ? data.perspectiveId : null,
      assignedToIds: data.assignedToIds.length > 0 ? data.assignedToIds : undefined,
      kpiPeriodId, orgUnitId,
    }),
  })
  const isPending = batchMutation.isPending || createMutation.isPending

  const onSubmit = async (data: AdjustFormData) => {
    if (!isValid) { toast.error(`Tổng trọng số phải đúng 100% (hiện tại: ${formatNumber(totalAll)}%)`); return }
    try {
      if (adjustableKpis.length > 0) await batchMutation.mutateAsync(data)
      await createMutation.mutateAsync(data)
      toast.success('Đã điều chỉnh trọng số và thêm KPI mới')
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      onSuccess()
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, 'Cập nhật trọng số thất bại'))
    }
  }

  const remaining = Math.round((100 - totalExisting) * 100) / 100

  return (
    <form id="urgent-form" onSubmit={handleSubmit(onSubmit, toastFirstError)} className="flex flex-col gap-6">
      <UrgentKpiFields
        form={form}
        ctx={ctx}
        contextSlot={
          <>
            {adjustableKpis.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-label">Bớt trọng số KPI hiện có để chừa chỗ</label>
                  <span className={cn('text-xs font-semibold tabular-nums', isValid ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
                    Tổng {formatNumber(totalAll)}% / 100%
                  </span>
                </div>
                <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-eyebrow">
                        <th className="px-3 py-2 text-left">KPI</th>
                        <th className="px-2 py-2 text-center">Trạng thái</th>
                        <th className="px-2 py-2 text-right">Cũ</th>
                        <th className="px-2 py-2 text-right">Mới</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {fields.map((field, idx) => {
                        const kpi = adjustableKpis[idx]
                        const realOld = kpi?.weight != null ? realOf(kpi.effectivePerspectiveId, kpi.weight) : null
                        const newW = parseFloat(String(watchedWeights[idx]?.newWeight)) || 0
                        const realNew = usePct ? realOf(kpi?.effectivePerspectiveId, newW) : null
                        return (
                          <tr key={field.id}>
                            <td className="max-w-[220px] truncate px-3 py-1.5 font-medium" title={kpi?.name}>{kpi?.name}</td>
                            <td className={cn('px-2 py-1.5 text-center text-xs font-semibold', kpi?.status === 'APPROVED' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
                              {kpi?.status === 'APPROVED' ? 'Đã duyệt' : kpi?.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Nháp'}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-[var(--color-muted-foreground)]" title={usePct && realOld != null ? `Thật ${realOld.toFixed(1)}% (form ${formatNumber(kpi?.weight ?? 0)}% × %hạng mục)` : undefined}>
                              {usePct && realOld != null ? realOld.toFixed(1) : formatNumber(kpi?.weight ?? 0)}%
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex flex-col items-end">
                                <Input size="sm" type="number" step="0.1" min={0} max={100} {...register(`weights.${idx}.newWeight`, { valueAsNumber: true })} suffix={<span className="text-xs">%</span>} className="w-24" inputClassName="text-right tabular-nums" />
                                {realNew != null && <span className="text-caption tabular-nums">thật {realNew.toFixed(1)}%</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-caption">Còn trống cho KPI mới: <b className="tabular-nums text-[var(--color-foreground)]">{formatNumber(remaining)}%</b>{usePct ? ' (trọng số thật)' : ''}</p>
              </div>
            )}
            <AssigneeSelector orgUnitId={orgUnitId} selectedIds={selectedAssignees} onChange={ids => setValue('assignedToIds', ids)} isStaff={isStaff} currentUser={currentUser ?? undefined} />
          </>
        }
        weightSlot={
          <Field label="Trọng số KPI mới (%)" required error={errors.weight?.message}
            hint={usePct && newPerspId ? `Thật ≈ ${newReal.toFixed(1)}% của đơn vị (× %hạng mục)` : `Cần đúng bằng phần còn trống: ${formatNumber(remaining)}%`}>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="number" step="any" min={0} max={100} {...register('weight')} invalid={!!errors.weight} suffix={<span className="text-xs">%</span>} className="w-36" placeholder={String(remaining)} />
              {remaining > 0 && String(watchedNewWeight) !== String(remaining) && (
                <Button variant="ghost" size="sm" type="button" onClick={() => setValue('weight', remaining, { shouldValidate: true })}>Dùng {formatNumber(remaining)}%</Button>
              )}
            </div>
          </Field>
        }
      />
      {!isValid && (
        <Hint tone="warning" icon={<AlertTriangle size={14} aria-hidden="true" />}>
          Tổng trọng số sau điều chỉnh là {formatNumber(totalAll)}% — phải đúng 100% mới lưu được.
        </Hint>
      )}
      <UrgentFooter isPending={isPending} label="Lưu & thêm KPI" onCancel={onSuccess} />
    </form>
  )
}

function UrgentFooter({ isPending, label, onCancel }: { isPending: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
      <Button variant="outline" type="button" onClick={onCancel} disabled={isPending}>Hủy</Button>
      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 aria-hidden="true" className="animate-spin" />} {label}
      </Button>
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

/**
 * Việc khẩn: chèn một KPI mới vào đơn vị đã đủ 100% trọng số — bằng cách THAY một KPI (kế thừa
 * trọng số) hoặc BỚT trọng số các KPI hiện có. Phần "KPI mới" của cả hai tab dùng chung
 * `UrgentKpiFields`, cùng thứ tự bối cảnh → nguồn → nội dung với form tạo chỉ tiêu.
 */
export default function UrgentTaskModal({ open, onClose, kpiPeriodId: initPeriodId, orgUnitId: initOrgUnitId }: UrgentTaskModalProps) {
  const [tab, setTab] = useState<Tab>('replace')
  const [selectedPeriodId, setSelectedPeriodId] = useState(initPeriodId)
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState(initOrgUnitId)

  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const isStaff = user?.memberships?.[0]?.roleRank === 2
  const staffOrgUnitId = user?.memberships?.[0]?.orgUnitId

  useEffect(() => {
    if (open) {
      setSelectedPeriodId(initPeriodId)
      setSelectedOrgUnitId(isStaff && staffOrgUnitId ? staffOrgUnitId : initOrgUnitId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const ready = !!selectedPeriodId && !!selectedOrgUnitId
  const { data: kpiData, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['kpi-criteria', 'urgent-list', selectedPeriodId, selectedOrgUnitId],
    queryFn: () => kpiApi.getAll({ kpiPeriodId: selectedPeriodId, orgUnitId: selectedOrgUnitId, size: 200 }),
    enabled: open && ready,
  })
  const { data: totalWeight, isLoading: isLoadingWeight } = useKpiTotalWeight(
    ready ? selectedOrgUnitId : undefined, ready ? selectedPeriodId : undefined,
  )
  const weightIs100 = totalWeight != null && Math.abs(totalWeight - 100) <= 0.001
  const kpiList = (kpiData?.content ?? []).filter(k => k.orgUnitId === selectedOrgUnitId)
  const selectedPeriod = periodsData?.content.find(p => p.id === selectedPeriodId)
  const filteredObjectives = useMemo(() => {
    if (!objectives || !selectedOrgUnitId) return []
    return objectives.filter((obj: any) => obj.orgUnitIds?.includes(selectedOrgUnitId))
  }, [objectives, selectedOrgUnitId])

  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)
  const unitParentMap = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    return map
  }, [orgUnitTreeData])
  const effectiveScorecard = useMemo<any>(() => {
    if (!enableBsc || !selectedPeriodId || !selectedOrgUnitId) return null
    const periodScs = scorecardsForPeriod(bscScorecards, selectedPeriodId)
    if (periodScs.length === 0) return null
    let cur: string | null = selectedOrgUnitId, guard = 0, sc: any = null
    while (cur && guard++ < 100) {
      const found = periodScs.find(s => (s.orgUnits || []).some((u: any) => u.id === cur))
      if (found) { sc = found; break }
      cur = unitParentMap.get(cur) ?? null
    }
    if (!sc) sc = periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    return sc
  }, [enableBsc, bscScorecards, selectedPeriodId, selectedOrgUnitId, unitParentMap])

  const availablePerspectiveIds = useMemo<Set<string> | null>(() => {
    if (!enableBsc || !selectedPeriodId || !selectedOrgUnitId) return null
    const ids = new Set<string>()
    ;(effectiveScorecard?.perspectives || []).forEach((p: any) => ids.add(p.perspectiveId))
    return ids
  }, [enableBsc, selectedPeriodId, selectedOrgUnitId, effectiveScorecard])

  const perspectiveHints = useMemo(() => {
    const map = new Map<string, string | null>()
    const rows = new Map<string, ScorecardPerspectiveResponse>()
    for (const row of (effectiveScorecard?.perspectives || []) as ScorecardPerspectiveResponse[]) rows.set(row.perspectiveId, row)
    for (const p of perspectives || []) {
      const row = rows.get(p.id)
      map.set(p.id, perspectiveHint({
        targetValue: row?.targetValue ?? p.targetValue, minimumValue: row?.minimumValue ?? p.minimumValue,
        unit: row?.unit ?? p.unit, weightPercentage: row?.weightPercentage ?? null,
      }))
    }
    return map
  }, [perspectives, effectiveScorecard])

  const perspectiveWeightPct = useMemo(() => {
    const map = new Map<string, number>()
    ;(effectiveScorecard?.perspectives || []).forEach((p: any) => { if (p.weightPercentage != null) map.set(p.perspectiveId, p.weightPercentage) })
    return map
  }, [effectiveScorecard])

  const ctx: UrgentKpiContext = {
    period: selectedPeriod as UrgentKpiContext['period'],
    enableOkr, enableQualitative, enableBsc,
    objectives: filteredObjectives, perspectives: perspectives ?? [],
    availablePerspectiveIds, perspectiveHints,
    scorecardRows: effectiveScorecard?.perspectives ?? [], scorecardName: effectiveScorecard?.name ?? null,
  }

  const canWork = ready && !isLoadingWeight && !isLoadingKpis && weightIs100 && kpiList.length > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      title="Việc khẩn"
      description="Chèn một KPI mới vào đơn vị đã đủ 100% trọng số: thay một KPI, hoặc bớt trọng số các KPI hiện có."
    >
      <div className="flex flex-col gap-5">
        {/* Kỳ + đơn vị: bối cảnh chung cho cả hai tab, và điều kiện 100% phải kiểm ở đây. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kỳ đánh giá" required>
            <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
              <SelectTrigger><CalendarRange size={14} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" /><SelectValue placeholder="Chọn kỳ…" /></SelectTrigger>
              <SelectContent>{periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Đơn vị" required>
            {isStaff ? (
              <div className="flex h-9 items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 text-sm">
                <Building2 size={14} className="text-[var(--color-muted-foreground)]" aria-hidden="true" />
                <span className="truncate">{flatOrgUnits.find(u => u.id === selectedOrgUnitId)?.name ?? 'Đơn vị của bạn'}</span>
              </div>
            ) : (
              <Select value={selectedOrgUnitId} onValueChange={setSelectedOrgUnitId}>
                <SelectTrigger><Building2 size={14} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" /><SelectValue placeholder="Chọn đơn vị…" /></SelectTrigger>
                <SelectContent className="max-h-72">{flatOrgUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.levelLabel}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </Field>
        </div>

        {ready && (
          <div className={cn('flex items-center justify-between gap-3 rounded-card border px-3 py-2 text-xs font-medium',
            isLoadingWeight ? 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
              : weightIs100 ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
              : 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]')}>
            <span className="flex items-center gap-1.5">
              {isLoadingWeight ? <Loader2 size={12} className="animate-spin" /> : weightIs100 ? <Check size={12} /> : <ShieldAlert size={12} />}
              {isLoadingWeight ? 'Đang kiểm tra trọng số…'
                : weightIs100 ? 'Tổng trọng số đã đủ 100% — chèn KPI mới bằng một trong hai cách dưới'
                : <>Đơn vị chưa đủ <b>100%</b> trọng số — vào <b>Tạo chỉ tiêu</b> bổ sung cho đủ trước, việc khẩn chỉ dùng khi đã kín chỗ.</>}
            </span>
            {!isLoadingWeight && <span className="shrink-0 text-sm font-semibold tabular-nums">{formatNumber(totalWeight ?? 0)}%</span>}
          </div>
        )}

        {canWork && (
          <SegmentedControl<Tab>
            ariaLabel="Cách chèn KPI"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'replace', label: <span className="inline-flex items-center gap-1.5"><ArrowLeftRight size={14} /> Thay một KPI</span>, title: 'KPI cũ đánh dấu Đã thay thế, KPI mới kế thừa trọng số' },
              { value: 'adjust', label: <span className="inline-flex items-center gap-1.5"><SlidersHorizontal size={14} /> Bớt trọng số KPI hiện có</span>, title: 'Giảm trọng số vài KPI để chừa chỗ cho KPI mới' },
            ]}
          />
        )}

        {!ready ? (
          <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Chọn kỳ đánh giá và đơn vị để tiếp tục.</p>
        ) : isLoadingWeight || isLoadingKpis ? (
          <p className="flex items-center justify-center gap-2 py-10 text-caption"><Loader2 size={18} className="animate-spin text-[var(--color-primary)]" /> Đang tải…</p>
        ) : !weightIs100 ? null : kpiList.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">Chưa có KPI nào trong kỳ này.</p>
        ) : tab === 'replace' ? (
          <ReplaceTab key={`r-${selectedPeriodId}-${selectedOrgUnitId}`} kpiList={kpiList} orgUnitId={selectedOrgUnitId} ctx={ctx} onSuccess={onClose} />
        ) : (
          <AdjustTab key={`a-${selectedPeriodId}-${selectedOrgUnitId}`} kpiList={kpiList} kpiPeriodId={selectedPeriodId} orgUnitId={selectedOrgUnitId} ctx={ctx} perspectiveWeightPct={perspectiveWeightPct} onSuccess={onClose} />
        )}
      </div>
    </Dialog>
  )
}
