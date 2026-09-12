import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { kpiApi } from '../api/kpiApi'
import { rejectKpiSchema, type RejectKpiFormData } from '../schemas/reviewSchema'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { Loader2, CheckCircle, XCircle, Pencil, Undo2, Layers, Target } from 'lucide-react'
import { formatNumber, formatDateTime, FREQUENCY_MAP } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useScorecards } from '@/features/bsc/hooks/useBsc'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { computeRealWeight } from '../utils/realWeight'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/common/StatusBadge'

interface KpiReviewModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
  onEdit?: (kpi: KpiCriteria) => void
  /** Mở thẳng ở chế độ nhập lý do trả lại (từ nút "Trả lại" trên hàng bảng). */
  initialMode?: 'view' | 'reject'
}

/**
 * Xem chi tiết một chỉ tiêu và duyệt / trả lại ngay trong hộp thoại (UX_PATTERNS.md P0 + P1).
 * Footer theo thứ tự cố định: [Trả lại — trái] … [Đóng] [Duyệt]. Trả lại bắt buộc lý do:
 * chuyển sang chế độ nhập lý do ngay trong thân hộp thoại, không mở hộp thoại thứ hai.
 */
export default function KpiReviewModal({ open, onClose, kpi, onEdit, initialMode = 'view' }: KpiReviewModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RejectKpiFormData>({
    resolver: zodResolver(rejectKpiSchema),
    defaultValues: { rejectReason: '' },
  })
  // Chế độ đang xem: người dùng bấm "Trả lại"/"Quay lại" thì ghi đè; đóng hộp thoại thì xoá ghi đè
  // để lần mở sau lại theo `initialMode` — không cần effect đồng bộ state.
  const [modeOverride, setModeOverride] = useState<'view' | 'reject' | null>(null)
  const mode = modeOverride ?? initialMode
  const setMode = (m: 'view' | 'reject') => setModeOverride(m)
  const close = () => { setModeOverride(null); reset({ rejectReason: '' }); onClose() }

  const qc = useQueryClient()
  const { canRevertApproval } = usePermission()

  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: bscScorecards } = useScorecards(org?.enableBsc ? organizationId : undefined)
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const realWeight = useMemo(
    () => computeRealWeight(kpi, bscScorecards, orgUnitTreeData, org?.enableBsc),
    [kpi, bscScorecards, orgUnitTreeData, org?.enableBsc]
  )

  const revertApprovalMutation = useMutation({
    mutationFn: () => kpiApi.revertApproval(kpi!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Đã hoàn duyệt, chỉ tiêu quay về trạng thái chờ duyệt')
      close()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Hoàn duyệt thất bại')),
  })

  const approveMutation = useMutation({
    mutationFn: () => kpiApi.approve(kpi!.id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Đã duyệt chỉ tiêu')
      close()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Duyệt chỉ tiêu thất bại')),
  })

  const rejectMutation = useMutation({
    mutationFn: (data: RejectKpiFormData) => kpiApi.reject(kpi!.id, { reason: data.rejectReason }),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      toast.success('Đã trả lại chỉ tiêu để chỉnh sửa')
      close()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Trả lại chỉ tiêu thất bại')),
  })

  if (!kpi) return null

  const isPending = approveMutation.isPending || rejectMutation.isPending || revertApprovalMutation.isPending
  const isReviewable = kpi.status === 'PENDING_APPROVAL'
  const perspectiveColor = kpi.effectivePerspectiveColor || undefined

  const footer = isReviewable
    ? mode === 'reject'
      ? (
        <DialogFooter
          note="Người tạo sẽ nhận thông báo kèm lý do."
          secondary={<Button variant="outline" onClick={() => setMode('view')} disabled={isPending}>Quay lại</Button>}
          primary={
            <Button variant="destructive" onClick={handleSubmit(d => rejectMutation.mutate(d))} disabled={isPending}>
              {rejectMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              Trả lại
            </Button>
          }
        />
      ) : (
        <DialogFooter
          destructive={
            <Button variant="outline" onClick={() => setMode('reject')} disabled={isPending} className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]">
              <XCircle aria-hidden="true" /> Trả lại
            </Button>
          }
          secondary={<Button variant="outline" onClick={close} disabled={isPending}>Đóng</Button>}
          primary={
            <Button onClick={() => approveMutation.mutate()} disabled={isPending}>
              {approveMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              Duyệt
            </Button>
          }
        />
      )
    : (
      <DialogFooter
        destructive={
          kpi.status === 'APPROVED' && canRevertApproval ? (
            <Button variant="outline" onClick={() => revertApprovalMutation.mutate()} disabled={isPending}>
              {revertApprovalMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
              Hoàn duyệt
            </Button>
          ) : undefined
        }
        primary={<Button variant="outline" onClick={close}>Đóng</Button>}
      />
    )

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      dismissible={!isPending}
      title={kpi.name}
      description={`${kpi.orgUnitName ?? 'Chưa gắn đơn vị'} · ${kpi.kpiPeriod?.name ?? 'Chưa gắn đợt'}`}
      headerExtra={
        <span className="flex items-center gap-2">
          <StatusBadge status={kpi.status} />
            {isReviewable && onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(kpi)} aria-label="Chỉnh sửa chỉ tiêu">
              <Pencil aria-hidden="true" /> Sửa
            </Button>
          )}
        </span>
      }
      footer={footer}
              >
      <div className="space-y-6">
        {/* Nhãn phân loại */}
        {(kpi.kpiType === 'QUALITATIVE' || kpi.isReverseKpi || kpi.isBonusKpi || kpi.effectivePerspectiveName) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {kpi.kpiType === 'QUALITATIVE' && <Badge variant="outline">Định tính</Badge>}
            {kpi.isReverseKpi && <Badge variant="warning">KPI ngược</Badge>}
            {kpi.isBonusKpi && <Badge variant="success">KPI thưởng</Badge>}
            {kpi.effectivePerspectiveName && (
              <Badge variant="outline" title={`Hạng mục BSC: ${kpi.effectivePerspectiveName}`}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: perspectiveColor ?? 'var(--color-primary)' }} aria-hidden="true" />
                {kpi.effectivePerspectiveName}
              </Badge>
            )}
            </div>
          )}

        {kpi.description && (
          <p className="text-sm leading-5 text-[var(--color-muted-foreground)]">{kpi.description}</p>
        )}

        {/* Số liệu chính */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3">
          {kpi.kpiType !== 'QUALITATIVE' && (
            <Metric label="Mục tiêu" value={kpi.targetValue != null ? formatNumber(kpi.targetValue) : '—'} unit={kpi.unit} />
          )}
          {kpi.kpiType !== 'QUALITATIVE' && (
            <Metric label="Tối thiểu" value={kpi.minimumValue != null ? formatNumber(kpi.minimumValue) : '0'} unit={kpi.unit} />
          )}
          <Metric
            label={realWeight != null ? 'Trọng số thật' : 'Trọng số'}
            value={realWeight != null ? `${realWeight.toFixed(1)}%` : `${kpi.weight ?? '—'}%`}
            hint={realWeight != null ? `Form ${kpi.weight}% × tỷ trọng hạng mục` : undefined}
          />
          <Metric label="Tần suất" value={FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] ?? kpi.frequency} />
          <Metric label="Hạn riêng" value={formatDateTime(kpi.deadline)} />
          <Metric label="Hạn đợt" value={formatDateTime(kpi.kpiPeriod?.endDate)} />
        </dl>

        {/* Người thực hiện */}
        <section>
          <h3 className="text-eyebrow mb-2">Người thực hiện</h3>
          {kpi.assigneeNames?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {kpi.assigneeNames.map((name, i) => <Badge key={i} variant="secondary">{name}</Badge>)}
            </div>
          ) : (
            <p className="text-caption">Chưa giao cho ai.</p>
          )}
        </section>

        {/* Liên kết OKR */}
        {kpi.keyResultName && (
          <section className="rounded-card border border-[var(--color-border)] p-4">
            <h3 className="text-eyebrow mb-3 flex items-center gap-1.5"><Target size={12} aria-hidden="true" /> Liên kết OKR</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-[var(--color-muted-foreground)]">Mục tiêu</dt>
                <dd className="min-w-0 text-[var(--color-foreground)]">
                  {kpi.objectiveCode && <span className="mr-1.5 font-mono text-xs text-[var(--color-muted-foreground)]">{kpi.objectiveCode}</span>}
                  {kpi.objectiveName || '—'}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-[var(--color-muted-foreground)]">Kết quả then chốt</dt>
                <dd className="min-w-0 text-[var(--color-foreground)]">
                  {kpi.keyResultCode && <span className="mr-1.5 font-mono text-xs text-[var(--color-muted-foreground)]">{kpi.keyResultCode}</span>}
                  {kpi.keyResultName}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* Hạng mục BSC */}
          {kpi.effectivePerspectiveName && (
          <section className="flex items-center gap-3 rounded-card border border-[var(--color-border)] p-4">
            <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: perspectiveColor ?? 'var(--color-primary)' }} aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-eyebrow flex items-center gap-1.5"><Layers size={12} aria-hidden="true" /> Hạng mục BSC</h3>
              <p className="mt-0.5 truncate text-sm font-medium text-[var(--color-foreground)]">{kpi.effectivePerspectiveName}</p>
            </div>
          </section>
        )}

        {/* Lý do trả lại lần trước */}
        {kpi.rejectReason && (
          <section className="rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-4">
            <h3 className="text-eyebrow mb-1 text-[var(--color-error)]">Lý do trả lại lần trước</h3>
            <p className="text-sm leading-5 text-[var(--color-foreground)]">{kpi.rejectReason}</p>
          </section>
        )}

        {/* Nhập lý do trả lại */}
        {isReviewable && mode === 'reject' && (
          <section className="rounded-card border border-[var(--color-error-border)] p-4">
            <label htmlFor="kpi-reject-reason" className="text-label block">
              Lý do trả lại <span className="text-[var(--color-error)]" aria-hidden="true">*</span>
            </label>
            <textarea
              id="kpi-reject-reason"
              {...register('rejectReason')}
              rows={3}
              autoFocus
              aria-invalid={!!errors.rejectReason}
              className="mt-1.5 w-full resize-none rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              placeholder="Nêu cụ thể cần sửa gì để người tạo chỉnh lại đúng."
            />
            {errors.rejectReason && <p className="mt-1 text-caption text-[var(--color-error)]">{errors.rejectReason.message}</p>}
          </section>
        )}

        <p className="text-caption tabular-nums">
          Tạo lúc {formatDateTime(kpi.createdAt)}{kpi.createdByName ? ` · ${kpi.createdByName}` : ''}
                  </p>
                </div>
    </Dialog>
  )
}

function Metric({ label, value, unit, hint }: { label: string; value: string; unit?: string | null; hint?: string }) {
  return (
    <div className="bg-[var(--color-card)] px-4 py-3" title={hint}>
      <dt className="text-eyebrow">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1 text-lg font-semibold tabular-nums text-[var(--color-foreground)]">
        {value}
        {unit && <span className="text-caption">{unit}</span>}
      </dd>
    </div>
  )
}
