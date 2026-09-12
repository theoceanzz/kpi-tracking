import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, X, LayoutGrid, Check, SplitSquareHorizontal, Users, Building2 } from 'lucide-react'

import { bscKpiSplitSchema, type BscKpiSplitFormData } from '../schemas/bscKpiSplitSchema'
import { kpiApi } from '../api/kpiApi'
import { useScorecards, useBscKpiPlan } from '@/features/bsc/hooks/useBsc'
import { perspectiveHint } from '@/features/bsc/utils/perspectiveHint'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn, formatNumber } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BscKpiPlanResponse } from '@/features/bsc/types'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

interface BscKpiSplitModalProps {
  open: boolean
  onClose: () => void
}

/** Làm tròn 2 chữ số — tiền/tỉ lệ chia ra thường lẻ, để nguyên thì ô nhập đầy số vô nghĩa. */
const round2 = (v: number) => Math.round(v * 100) / 100

const numOrUndef = (v: unknown) =>
  v === '' || v === null || v === undefined ? undefined : Number(v)

/**
 * Chia MỘT hạng mục của bộ tiêu chí BSC thành KPI theo từng đợt của kỳ.
 *
 * <p>Đây là đường đi ngược lại với cách làm cũ: thay vì tạo KPI rồi mới nhớ gán hạng mục (và
 * thường quên, khiến điểm BSC của đơn vị rỗng), trưởng đơn vị bắt đầu TỪ con số của hạng mục —
 * VD "Doanh thu 100 triệu" của một kỳ 2 đợt — rồi chia ra đợt 1 bao nhiêu tiền / bao nhiêu trọng
 * số, đợt 2 bao nhiêu. KPI sinh ra đã gắn sẵn đúng dòng chỉ tiêu nên tự cộng vào kết quả BSC.
 */
export default function BscKpiSplitModal({ open, onClose }: BscKpiSplitModalProps) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId

  const { data: scorecards, isLoading: loadingScorecards } = useScorecards(open ? organizationId : undefined)
  const { data: orgUnitTree } = useOrgUnitTree()

  const {
    register, handleSubmit, watch, setValue, getValues, control, reset, formState: { errors },
  } = useForm<BscKpiSplitFormData>({
    resolver: zodResolver(bscKpiSplitSchema),
    defaultValues: {
      scorecardId: '',
      scorecardPerspectiveId: '',
      unit: '',
      description: '',
      isReverseKpi: false,
      orgUnitIds: [],
      assignMode: 'UNIT',
      assignedToIds: [],
      rows: [],
    },
  })
  const { fields, replace } = useFieldArray({ control, name: 'rows' })

  const scorecardId = watch('scorecardId')
  const scorecardPerspectiveId = watch('scorecardPerspectiveId')
  const isReverseKpi = watch('isReverseKpi')
  const selectedUnitIds = watch('orgUnitIds') || []
  const assignMode = watch('assignMode')
  const selectedAssignees = watch('assignedToIds') || []
  const rows = watch('rows') || []

  const { data: plan, isLoading: loadingPlan } = useBscKpiPlan(
    open && scorecardPerspectiveId ? scorecardPerspectiveId : undefined
  )

  // Nhân sự của đơn vị đang chọn. Chỉ tải khi thật sự giao đích danh: modal luôn được mount nên
  // gọi vô điều kiện sẽ kéo danh sách nhân sự mỗi lần vào trang chỉ tiêu.
  const wantsPeople = open && assignMode === 'USERS' && selectedUnitIds.length > 0
  const { data: unitUsers, isLoading: loadingUsers } = useUsers(
    { orgUnitIds: selectedUnitIds, size: 500 },
    { enabled: wantsPeople },
  )
  const [peopleSearch, setPeopleSearch] = useState('')

  const candidates = useMemo(() => unitUsers?.content ?? [], [unitUsers])
  const shownCandidates = useMemo(() => {
    const q = peopleSearch.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(u =>
      u.fullName.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  }, [candidates, peopleSearch])

  // Bỏ tích người không còn thuộc đơn vị đang chọn — đổi đơn vị xong mà vẫn gửi id cũ thì backend
  // từ chối với lỗi khó hiểu ("người được giao không thuộc đơn vị").
  useEffect(() => {
    if (!wantsPeople || loadingUsers) return
    const allowed = new Set(candidates.map(u => u.id))
    const current = getValues('assignedToIds') || []
    const kept = current.filter(id => allowed.has(id))
    if (kept.length !== current.length) setValue('assignedToIds', kept, { shouldValidate: true })
  }, [wantsPeople, loadingUsers, candidates, getValues, setValue])

  // Đơn vị của người đang đăng nhập + toàn bộ nhánh con: bộ tiêu chí của đơn vị con vẫn là việc
  // của trưởng đơn vị cấp trên, lọc cứng theo đúng đơn vị mình sẽ giấu mất chúng.
  const myUnitIds = useMemo(() => {
    const mine = new Set((user?.memberships || []).map(m => m.orgUnitId).filter(Boolean) as string[])
    const out = new Set<string>(mine)
    type UnitNode = { id: string; children?: UnitNode[] }
    const walk = (nodes: UnitNode[], insideMine: boolean) => {
      nodes.forEach(n => {
        const inside = insideMine || mine.has(n.id)
        if (inside) out.add(n.id)
        if (n.children?.length) walk(n.children, inside)
      })
    }
    walk((orgUnitTree || []) as UnitNode[], false)
    return out
  }, [orgUnitTree, user])

  /** Bộ tiêu chí có gắn đơn vị thuộc phạm vi của người dùng — KPI chỉ cộng được vào những thẻ này. */
  const myScorecards = useMemo(
    () => (scorecards || []).filter(sc => (sc.orgUnits || []).some(u => myUnitIds.has(u.id))),
    [scorecards, myUnitIds]
  )

  const selectedScorecard = useMemo(
    () => myScorecards.find(sc => sc.id === scorecardId) || null,
    [myScorecards, scorecardId]
  )

  /** Hạng mục đã dựng sẵn bảng — tránh dựng lại (xoá sạch số người dùng vừa gõ) khi query refetch. */
  const builtForRef = useRef<string | null>(null)

  // Mở modal: dọn form, và chọn sẵn nếu người dùng chỉ phụ trách đúng một bộ tiêu chí.
  useEffect(() => {
    if (!open) return
    builtForRef.current = null
    reset({
      scorecardId: myScorecards.length === 1 ? myScorecards[0]!.id : '',
      scorecardPerspectiveId: '',
      unit: '',
      description: '',
      isReverseKpi: false,
      orgUnitIds: [],
      assignMode: 'UNIT',
      assignedToIds: [],
      rows: [],
    })
    // Chạy đúng một lần mỗi lần mở: thêm myScorecards vào deps sẽ xoá form ngay khi danh sách
    // bộ tiêu chí được tải lại nền.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Đổi bộ tiêu chí ⇒ hạng mục cũ không còn thuộc thẻ nào, phải chọn lại.
  useEffect(() => {
    if (!scorecardId) return
    const stillThere = (selectedScorecard?.perspectives || []).some(p => p.id === scorecardPerspectiveId)
    if (scorecardPerspectiveId && !stillThere) {
      setValue('scorecardPerspectiveId', '')
      replace([])
    }
  }, [scorecardId, selectedScorecard, scorecardPerspectiveId, setValue, replace])

  // Có kế hoạch chia ⇒ dựng sẵn bảng đợt với phần còn lại chia đều.
  useEffect(() => {
    if (!plan) return
    if (builtForRef.current === plan.scorecardPerspectiveId) return
    builtForRef.current = plan.scorecardPerspectiveId
    setValue('unit', plan.unit ?? '')
    setValue('orgUnitIds', (plan.orgUnits || []).map(u => u.id))
    setValue('assignedToIds', [])
    replace(buildRows(plan))
  }, [plan, setValue, replace])

  const createMutation = useMutation({
    mutationFn: (data: BscKpiSplitFormData) =>
      kpiApi.createFromBsc({
        scorecardPerspectiveId: data.scorecardPerspectiveId,
        orgUnitIds: data.orgUnitIds,
        assignedToIds: data.assignMode === 'USERS' ? data.assignedToIds : undefined,
        assignToAllUnitMembers: data.assignMode === 'UNIT',
        description: data.description || undefined,
        unit: data.unit || undefined,
        isReverseKpi: data.isReverseKpi,
        allocations: data.rows.filter(r => r.selected).map(r => ({
          kpiPeriodId: r.kpiPeriodId,
          name: r.name?.trim() || undefined,
          targetValue: r.targetValue as number,
          minimumValue: r.minimumValue ?? null,
          weight: r.weight as number,
        })),
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['bsc-kpi-plan'] })
      qc.invalidateQueries({ queryKey: ['bsc-unit-result'] })
      toast.success(`Đã tạo ${created?.length ?? 0} chỉ tiêu từ hạng mục "${plan?.name}"`)
      onClose()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Tạo chỉ tiêu từ hạng mục BSC thất bại')),
  })

  const selectedRows = rows.filter(r => r.selected)
  const plannedValue = selectedRows.reduce((sum, r) => sum + (Number(r.targetValue) || 0), 0)
  const unitCount = Math.max(selectedUnitIds.length, 1)
  const remaining = plan?.remainingValue ?? null
  // Mỗi đơn vị nhận một bản KPI nên phần chia bị nhân lên theo số đơn vị — cùng phép tính
  // backend dùng để chặn, hiện ở đây để người dùng thấy trước khi bấm.
  const overBudget = remaining != null && !isReverseKpi && plannedValue * unitCount > remaining + 0.001

  /** Chia đều phần CÒN LẠI cho các đợt đang tích, phần lẻ dồn vào đợt cuối để tổng khớp đúng. */
  const splitEvenly = () => {
    if (remaining == null) {
      toast.info('Hạng mục này chưa đặt mục tiêu nên không chia tự động được')
      return
    }
    const chosen = rows.map((r, i) => ({ ...r, i })).filter(r => r.selected)
    if (chosen.length === 0) return
    const each = round2(remaining / unitCount / chosen.length)
    chosen.forEach((row, idx) => {
      const isLast = idx === chosen.length - 1
      const value = isLast ? round2(remaining / unitCount - each * (chosen.length - 1)) : each
      setValue(`rows.${row.i}.targetValue`, value, { shouldValidate: true })
      if (plan?.minimumValue != null && plan?.targetValue) {
        setValue(`rows.${row.i}.minimumValue`, round2(value * (plan.minimumValue / plan.targetValue)))
      }
    })
  }

  if (!open) return null

  const inputCls = "w-full px-2.5 py-2 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] transition-all"

  return (
    <div className="fixed inset-x-0 top-0 h-screen z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-card p-6 max-w-3xl w-full mx-4 animate-in zoom-in-95 max-h-[96vh] overflow-y-auto custom-scrollbar border border-[var(--color-border)]/50">
        <div className="flex items-start justify-between mb-5">
          <div className="space-y-1">
            <h3 className="text-section-title tracking-tight flex items-center gap-2">
              <LayoutGrid size={18} className="text-[var(--color-primary)]" /> Tạo KPI từ hạng mục BSC
            </h3>
            <p className="text-xs text-[var(--color-muted-foreground)] font-medium">
              Chia mục tiêu của hạng mục ra từng đợt — KPI sinh ra tự tính vào điểm BSC của đơn vị
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-all p-1.5 hover:bg-[var(--color-accent)] rounded-full">
            <X size={20} />
          </button>
        </div>

        {myScorecards.length === 0 && !loadingScorecards ? (
          <div className="p-8 text-center text-caption bg-[var(--color-background)]/50 rounded-card border border-dashed border-[var(--color-border)]">
            Đơn vị bạn phụ trách chưa có bộ tiêu chí BSC nào. Hãy lập bộ tiêu chí cho đơn vị (kèm hạng mục và
            mục tiêu) rồi quay lại đây để chia thành KPI.
          </div>
        ) : (
        <form onSubmit={handleSubmit(data => createMutation.mutate(data))} className="space-y-5">
          <div className="bg-[var(--color-primary-soft)] p-4 rounded-card border border-[var(--color-border)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-label block text-[var(--color-muted-foreground)] tracking-tight mb-1.5">Bộ tiêu chí của đơn vị</label>
                <Select value={scorecardId || ''} onValueChange={v => setValue('scorecardId', v, { shouldValidate: true })}>
                  <SelectTrigger className={cn(inputCls, 'h-11', errors.scorecardId && 'ring-2 ring-[var(--color-error-solid)]')}>
                    <SelectValue placeholder="Chọn bộ tiêu chí..." />
                  </SelectTrigger>
                  <SelectContent className="z-[300] max-h-[320px]">
                    {myScorecards.map(sc => (
                      <SelectItem key={sc.id} value={sc.id}>
                        <span className="font-semibold text-xs">{sc.name}</span>
                        {sc.periodLabel && <span className="ml-2 text-caption">{sc.periodLabel}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.scorecardId && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.scorecardId.message}</p>}
              </div>

              <div>
                <label className="text-label block text-[var(--color-muted-foreground)] tracking-tight mb-1.5">Hạng mục cần chia</label>
                <Select
                  value={scorecardPerspectiveId || ''}
                  onValueChange={v => setValue('scorecardPerspectiveId', v, { shouldValidate: true })}
                  disabled={!selectedScorecard}
                >
                  <SelectTrigger className={cn(inputCls, 'h-11', errors.scorecardPerspectiveId && 'ring-2 ring-[var(--color-error-solid)]')}>
                    <SelectValue placeholder={selectedScorecard ? 'Chọn hạng mục...' : 'Chọn bộ tiêu chí trước'} />
                  </SelectTrigger>
                  <SelectContent className="z-[300] max-h-[320px]">
                    {(selectedScorecard?.perspectives || []).map(p => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        extra={perspectiveHint(p) && (
                          <span className="ml-auto pl-3 text-caption whitespace-nowrap">
                            {perspectiveHint(p)}
                          </span>
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#94a3b8' }} />
                          <span className="font-semibold text-xs truncate">{p.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.scorecardPerspectiveId && <p className="text-[var(--color-error)] text-xs mt-1 font-medium">{errors.scorecardPerspectiveId.message}</p>}
              </div>
            </div>

            {loadingPlan && (
              <div className="flex items-center gap-2 text-caption">
                <Loader2 size={14} className="animate-spin" /> Đang lấy mục tiêu và các đợt của hạng mục...
              </div>
            )}

            {plan && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <SummaryTile label="Mục tiêu hạng mục" value={plan.targetValue != null ? `${formatNumber(plan.targetValue)}${plan.unit ? ` ${plan.unit}` : ''}` : '—'} />
                <SummaryTile label="Đã chia thành KPI" value={`${formatNumber(plan.allocatedValue || 0)}${plan.unit ? ` ${plan.unit}` : ''}`} />
                <SummaryTile
                  label="Còn lại"
                  value={plan.remainingValue != null ? `${formatNumber(plan.remainingValue)}${plan.unit ? ` ${plan.unit}` : ''}` : '—'}
                  tone={plan.remainingValue != null && plan.remainingValue < 0 ? 'danger' : 'ok'}
                />
                <SummaryTile label="Trọng số hạng mục" value={plan.weightPercentage != null ? `${plan.weightPercentage}%` : '—'} />
              </div>
            )}
          </div>

          {plan && (
            <>
              {/* Giao cho — MỘT lựa chọn: hoặc để cả đơn vị, hoặc nêu đích danh người. Trước đây
                  màn này chỉ có ô chọn đơn vị, nên chia xong KPI luôn rơi vào nhóm "Chưa giao" mà
                  không chỗ nào nói ra điều đó. */}
              <div className="space-y-3">
                <label className="text-label block">Giao cho</label>

                <div className="grid grid-cols-2 gap-2">
                  {([
                    { mode: 'UNIT' as const, icon: <Building2 size={14} />, title: 'Cả đơn vị',
                      hint: 'Giao cho mọi nhân sự của đơn vị' },
                    { mode: 'USERS' as const, icon: <Users size={14} />, title: 'Người cụ thể',
                      hint: 'Chọn đích danh người thực hiện' },
                  ]).map(opt => (
                    <ChoiceChip selected={assignMode === opt.mode} className="text-left py-2.5" key={opt.mode} onClick={() => {
                        setValue('assignMode', opt.mode, { shouldValidate: true })
                        if (opt.mode === 'UNIT') {
                          setValue('assignedToIds', [], { shouldValidate: true })
                        } else if (selectedUnitIds.length > 1) {
                          // Giao đích danh thì mỗi lần chỉ một đơn vị: cùng danh sách người mà nhân
                          // ra nhiều đơn vị sẽ gán người của đơn vị này vào KPI của đơn vị kia.
                          setValue('orgUnitIds', selectedUnitIds.slice(0, 1), { shouldValidate: true })
                        }
                      }}>
                      <span className={cn('flex items-center gap-1.5 text-xs font-semibold',
                        assignMode === opt.mode ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]')}>
                        {opt.icon} {opt.title}
                      </span>
                      <span className="block text-caption mt-0.5">
                        {opt.hint}
                      </span>
                    </ChoiceChip>
                  ))}
                </div>

                {/* Một đơn vị thì không có gì để chọn — hiện thành dòng chữ thay vì một cái nút lúc
                    nào cũng bật, đỡ trông như còn thao tác chưa làm. */}
                {(plan.orgUnits || []).length <= 1 ? (
                  <p className="text-caption flex items-center gap-1.5">
                    <Building2 size={12} className="text-[var(--color-primary)]" />
                    Đơn vị nhận KPI: <span className="text-[var(--color-foreground)]">{plan.orgUnits?.[0]?.name || '—'}</span>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <span className="block text-eyebrow tracking-tight">
                      Đơn vị nhận KPI{assignMode === 'USERS' ? ' — chọn một' : ''}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(plan.orgUnits || []).map(u => {
                        const active = selectedUnitIds.includes(u.id)
                        return (
                          <ChoiceChip selected={active} variant="solid" size="sm" className="py-2" key={u.id} onClick={() => {
                              if (assignMode === 'USERS') {
                                setValue('orgUnitIds', [u.id], { shouldValidate: true })
                                return
                              }
                              setValue(
                                'orgUnitIds',
                                active ? selectedUnitIds.filter(id => id !== u.id) : [...selectedUnitIds, u.id],
                                { shouldValidate: true },
                              )
                            }}>
                            {active && <Check />} {u.name}
                          </ChoiceChip>
                        )
                      })}
                    </div>
                  </div>
                )}
                {errors.orgUnitIds && <p className="text-[var(--color-error)] text-xs font-medium">{errors.orgUnitIds.message}</p>}
                {assignMode === 'UNIT' && selectedUnitIds.length > 1 && (
                  <p className="text-caption">
                    Mỗi đơn vị nhận một bản KPI riêng ⇒ tổng mục tiêu chia ra được nhân {selectedUnitIds.length} lần.
                  </p>
                )}

                {assignMode === 'UNIT' ? (
                  <p className="text-caption">
                    KPI được giao cho <b>toàn bộ nhân sự đang hoạt động</b> của đơn vị. Muốn chỉ một vài
                    người thì chuyển sang <b>Người cụ thể</b>.
                  </p>
                ) : (
                  <div className="border border-[var(--color-border)] rounded-card overflow-hidden bg-[var(--color-background)]">
                    <div className="p-2 border-b border-[var(--color-border)] flex items-center gap-2">
                      <input
                        type="text"
                        value={peopleSearch}
                        onChange={e => setPeopleSearch(e.target.value)}
                        placeholder="Tìm theo họ tên hoặc email..."
                        className="flex-1 px-3 py-2 text-xs rounded-control border border-[var(--color-border)] bg-[var(--color-background)] outline-none focus:ring-2 focus:ring-[var(--color-ring)] transition-all"
                      />
                      <span className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold">
                        {selectedAssignees.length}/{candidates.length}
                      </span>
                    </div>
                    <div className="max-h-44 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                      {loadingUsers ? (
                        <div className="p-6 flex items-center justify-center gap-2 text-caption">
                          <Loader2 size={16} className="animate-spin" /> Đang tải nhân sự...
                        </div>
                      ) : shownCandidates.length === 0 ? (
                        <p className="p-6 text-center text-caption">
                          {candidates.length === 0
                            ? 'Đơn vị này chưa có nhân sự nào — chọn "Cả đơn vị" rồi giao sau.'
                            : 'Không tìm thấy nhân sự phù hợp'}
                        </p>
                      ) : shownCandidates.map(u => {
                        const active = selectedAssignees.includes(u.id)
                        return (
                          <ChoiceChip selected={active} variant="solid" className="w-full py-2 text-left" key={u.id} onClick={() => setValue(
                              'assignedToIds',
                              active ? selectedAssignees.filter(id => id !== u.id) : [...selectedAssignees, u.id],
                              { shouldValidate: true },
                            )}>
                            <span className="min-w-0">
                              <span className="block text-xs font-medium truncate">{u.fullName}</span>
                              <span className={cn('block text-xs font-medium truncate',
                                active ? 'text-white/70' : 'text-[var(--color-muted-foreground)]')}>
                                {u.email}
                                {u.memberships?.[0]?.roleDisplayName ? ` · ${u.memberships[0].roleDisplayName}` : ''}
                              </span>
                            </span>
                            {active && <Check className="shrink-0" />}
                          </ChoiceChip>
                        )
                      })}
                    </div>
                  </div>
                )}
                {errors.assignedToIds && <p className="text-[var(--color-error)] text-xs font-medium">{errors.assignedToIds.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-label block">Chia theo đợt</label>
                  <Button variant="outline" size="sm" type="button" onClick={splitEvenly}>
                    <SplitSquareHorizontal aria-hidden="true" /> Chia đều phần còn lại
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-xs font-medium text-[var(--color-warning)]">
                    Bộ tiêu chí này chưa gắn đợt nào — hãy gắn kỳ hoặc đợt cho bộ tiêu chí trước.
                  </p>
                )}

                <div className="space-y-2">
                  {fields.map((field, idx) => {
                    const period = plan.periods.find(p => p.kpiPeriodId === field.kpiPeriodId)
                    const selected = rows[idx]?.selected
                    const rowErrors = errors.rows?.[idx]
                    return (
                      <div
                        key={field.id}
                        className={cn(
                          'rounded-card border p-3 transition-all',
                          selected ? 'border-[var(--color-border)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] opacity-70'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4" {...register(`rows.${idx}.selected`)} />
                            <span className="text-xs font-semibold">{field.periodName}</span>
                          </label>
                          {period && period.kpiCount > 0 && (
                            <span className="text-caption">
                              đã có {period.kpiCount} KPI · {formatNumber(period.allocatedValue || 0)}{plan.unit ? ` ${plan.unit}` : ''} · {formatNumber(period.allocatedWeight || 0)}%
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="sm:col-span-4">
                            <input
                              {...register(`rows.${idx}.name`)}
                              disabled={!selected}
                              placeholder="Tên KPI"
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="text-label block text-[var(--color-muted-foreground)] mb-1">Mục tiêu</label>
                            <input
                              type="number" step="any" disabled={!selected}
                              {...register(`rows.${idx}.targetValue`, { setValueAs: numOrUndef })}
                              className={cn(inputCls, rowErrors?.targetValue && 'ring-2 ring-[var(--color-error-solid)]')}
                            />
                            {rowErrors?.targetValue && <p className="text-[var(--color-error)] text-xs mt-0.5 font-medium">{rowErrors.targetValue.message}</p>}
                          </div>
                          <div>
                            <label className="text-label block text-[var(--color-muted-foreground)] mb-1">Tối thiểu</label>
                            <input
                              type="number" step="any" disabled={!selected}
                              {...register(`rows.${idx}.minimumValue`, { setValueAs: numOrUndef })}
                              className={cn(inputCls, rowErrors?.minimumValue && 'ring-2 ring-[var(--color-error-solid)]')}
                            />
                            {rowErrors?.minimumValue && <p className="text-[var(--color-error)] text-xs mt-0.5 font-medium">{rowErrors.minimumValue.message}</p>}
                          </div>
                          <div>
                            <label className="text-label block text-[var(--color-muted-foreground)] mb-1">Trọng số (%)</label>
                            <input
                              type="number" step="any" disabled={!selected}
                              {...register(`rows.${idx}.weight`, { setValueAs: numOrUndef })}
                              className={cn(inputCls, rowErrors?.weight && 'ring-2 ring-[var(--color-error-solid)]')}
                            />
                            {rowErrors?.weight && <p className="text-[var(--color-error)] text-xs mt-0.5 font-medium">{rowErrors.weight.message}</p>}
                          </div>
                          <div>
                            <label className="text-label block text-[var(--color-muted-foreground)] mb-1">Đơn vị tính</label>
                            <input value={plan.unit || ''} disabled className={cn(inputCls, 'opacity-60')} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {errors.rows?.message && <p className="text-[var(--color-error)] text-xs font-medium">{errors.rows.message}</p>}

                <p className="text-caption">
                  Trọng số tính TRONG hạng mục: các KPI cùng hạng mục trong một đợt phải đủ <b>100%</b> thì mới duyệt được.
                </p>
                {overBudget && (
                  <p className="text-xs font-medium text-[var(--color-warning)]">
                    ⚠ Tổng chia ({formatNumber(plannedValue * unitCount)}{plan.unit ? ` ${plan.unit}` : ''}) vượt phần còn lại
                    của hạng mục ({formatNumber(remaining || 0)}{plan.unit ? ` ${plan.unit}` : ''}) — hệ thống sẽ từ chối.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-label block mb-1.5">Mô tả chung (tuỳ chọn)</label>
                  <input {...register('description')} placeholder="Cách đo, nguồn số liệu..." className={inputCls} />
                </div>
                <label className="flex items-end gap-2 pb-1 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mb-2.5" {...register('isReverseKpi')} />
                  <span className="text-xs font-medium mb-2">
                    KPI ngược <span className="font-medium text-[var(--color-muted-foreground)]">(càng thấp càng tốt: tỉ lệ lỗi, chi phí)</span>
                  </span>
                </label>
              </div>
            </>
          )}

          <div className="flex gap-4 pt-5 border-t border-[var(--color-border)]/50">
            <Button variant="ghost" className="flex-1" type="button" onClick={onClose}>Hủy</Button>
            <Button className="flex-1" type="submit" disabled={createMutation.isPending || !plan || selectedRows.length === 0}>
              {createMutation.isPending && <Loader2 aria-hidden="true" className="animate-spin" />}
              Tạo {selectedRows.length > 0 ? selectedRows.length : ''} chỉ tiêu
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

/**
 * Dựng sẵn các dòng đợt từ kế hoạch: đợt nào đã đủ 100% trọng số thì bỏ tích (chia thêm vào đó
 * chỉ làm tổng vượt 100 và chặn duyệt), phần mục tiêu còn lại chia đều cho các đợt còn lại.
 */
function buildRows(plan: BscKpiPlanResponse): BscKpiSplitFormData['rows'] {
  const openPeriods = plan.periods.filter(p => (p.allocatedWeight || 0) < 99.99)
  const remaining = plan.remainingValue
  const each = remaining != null && openPeriods.length > 0 ? round2(remaining / openPeriods.length) : undefined

  return plan.periods.map(p => {
    const selected = openPeriods.some(o => o.kpiPeriodId === p.kpiPeriodId)
    const target = selected ? each : undefined
    const minimum = target != null && plan.minimumValue != null && plan.targetValue
      ? round2(target * (plan.minimumValue / plan.targetValue))
      : undefined
    return {
      kpiPeriodId: p.kpiPeriodId,
      periodName: p.name,
      selected,
      name: `${plan.name} — ${p.name}`,
      targetValue: target,
      minimumValue: minimum,
      weight: selected ? round2(Math.max(0, 100 - (p.allocatedWeight || 0))) : undefined,
    }
  })
}

function SummaryTile({ label, value, tone = 'ok' }: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  return (
    <div className="rounded-card bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2">
      <div className="text-eyebrow">{label}</div>
      <div className={cn('text-sm font-semibold truncate', tone === 'danger' ? 'text-[var(--color-error)]' : 'text-[var(--color-foreground)]')} title={value}>
        {value}
      </div>
    </div>
  )
}
