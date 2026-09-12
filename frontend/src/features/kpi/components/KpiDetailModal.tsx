import { X, Target, Building2, Users, BarChart3, Award, Calendar, Clock, CheckCircle2, ListTree, Layers } from 'lucide-react'
import { useMemo } from 'react'
import { formatNumber, formatDateTime, FREQUENCY_MAP, STATUS_CONFIG } from '@/lib/utils'
import type { KpiCriteria } from '@/types/kpi'
import { useKpiChildren } from '../hooks/useKpiChildren'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useScorecards } from '@/features/bsc/hooks/useBsc'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'
import { Button } from '@/components/ui/button'





interface KpiDetailModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
}

export default function KpiDetailModal({ open, onClose, kpi }: KpiDetailModalProps) {
  const { data: children } = useKpiChildren(open && kpi?.hasChildren ? kpi.id : undefined)

  // Trọng số THẬT = form × %hạng_mục (từ bộ tiêu chí của đơn vị KPI).
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const enableBsc = org?.enableBsc
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const realWeight = useMemo(() => {
    if (!enableBsc || !bscScorecards || !kpi || kpi.weight == null || !kpi.effectivePerspectiveId || !kpi.kpiPeriodId) return null
    const periodScs = scorecardsForPeriod(bscScorecards, kpi.kpiPeriodId)
    if (!periodScs.length) return null
    const parent = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { parent.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    const unitId = kpi.orgUnitId || kpi.orgUnitIds?.[0]
    let sc: any = null
    if (unitId) {
      let cur: string | null = unitId, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some((u: any) => u.id === cur))
        if (found) { sc = found; break }
        cur = parent.get(cur) ?? null
      }
    }
    if (!sc) sc = periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    if (!sc) return null
    const sp = sc.perspectives.find((p: any) => p.perspectiveId === kpi.effectivePerspectiveId)
    if (!sp || sp.weightPercentage == null) return null
    return kpi.weight * sp.weightPercentage / 100
  }, [enableBsc, bscScorecards, orgUnitTreeData, kpi])

  if (!open || !kpi) return null

  const status = STATUS_CONFIG[kpi.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
  const StatusIcon = status.icon

  const decompositionChildren = children?.filter(c => c.parentRelationType === 'DECOMPOSITION') ?? []
  const decompositionWeightTotal = decompositionChildren.reduce((sum, c) => sum + (c.weight ?? 0), 0)

  return (
    <div className="fixed inset-x-0 top-0 h-screen z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
      
      <div className="relative bg-[var(--color-card)] rounded-card w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-hidden border border-[var(--color-border)] flex flex-col">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-card bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-foreground)]">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-section-title">Chi tiết Chỉ tiêu KPI</h3>
              <div className={`text-eyebrow inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border mt-1 ${status.bgColor} ${status.color}`}>
                <StatusIcon size={10} /> {status.label}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-card hover:bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] transition-all hover:rotate-90"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Overview & Description */}
          <div className="space-y-4">
            <div>
              <p className="text-eyebrow mb-2">Tên chỉ tiêu</p>
              <h4 className="text-2xl font-semibold text-[var(--color-foreground)] leading-tight">{kpi.name}</h4>
              {kpi.isReverseKpi && (
                <span className="text-eyebrow inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
                  ↓ KPI Ngược
                </span>
              )}
              {kpi.isBonusKpi && (
                <span className="text-eyebrow inline-flex items-center gap-1 mt-2 ml-2 px-2.5 py-1 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
                  + KPI Thưởng
                </span>
              )}
            </div>
            {kpi.description && (
              <div>
                <p className="text-eyebrow mb-2">Mô tả chi tiết</p>
                <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
                   <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed font-medium">
                     {kpi.description}
                   </p>
                </div>
              </div>
            )}
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kpi.kpiType !== 'QUALITATIVE' && (
            <MetricBox
              icon={Target}
              label="Mục tiêu yêu cầu"
              value={kpi.targetValue != null ? formatNumber(kpi.targetValue) : '—'}
              unit={kpi.unit ?? ''}
              color="text-[var(--color-primary)]"
            />
            )}
            {kpi.kpiType !== 'QUALITATIVE' && (
            <MetricBox
              icon={BarChart3}
              label="Tối thiểu"
              value={kpi.minimumValue != null ? formatNumber(kpi.minimumValue) : '0'}
              unit={kpi.unit ?? ''}
              color="text-[var(--color-error)]"
            />
            )}
            <MetricBox
              icon={Award}
              label={realWeight != null ? 'Trọng số thật (%)' : 'Trọng số (%)'}
              value={realWeight != null ? `${realWeight.toFixed(1)}% / ${kpi.weight}%` : `${kpi.weight ?? '—'}%`}
              color="text-[var(--color-info)]"
            />
            <MetricBox
              icon={Calendar}
              label="Tần suất báo cáo"
              value={FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] ?? kpi.frequency}
              color="text-[var(--color-primary)]"
            />
            <MetricBox
              icon={Clock}
              label="Hạn chót KPI (riêng)"
              value={formatDateTime(kpi.deadline)}
              color="text-[var(--color-warning)]"
            />
            <MetricBox
              icon={Calendar}
              label="Hạn chót đợt đánh giá"
              value={formatDateTime(kpi.kpiPeriod?.endDate)}
              color="text-[var(--color-warning)]"
            />
          </div>

          {/* Secondary Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <h5 className="text-sm font-medium text-[var(--color-subtle-foreground)] flex items-center gap-2">
                <Building2 size={14} /> Thông tin đơn vị
              </h5>
              <div className="space-y-3">
                <InfoRow label="Phòng ban" value={kpi.orgUnitName ?? '—'} />
                <InfoRow label="Đợt đánh giá" value={kpi.kpiPeriod?.name ?? '—'} />
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-sm font-medium text-[var(--color-subtle-foreground)] flex items-center gap-2">
                <Users size={14} /> Người thực hiện
              </h5>
              <div className="flex flex-wrap gap-2">
                {kpi.assigneeNames?.map((name, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-card bg-[var(--color-muted)] text-xs font-medium text-[var(--color-foreground)] border border-[var(--color-border)]">
                    {name}
                  </span>
                )) || <span className="text-xs text-[var(--color-subtle-foreground)]">Chưa được giao cho ai</span>}
              </div>
            </div>
          </div>

          {/* Decomposition Children */}
          {decompositionChildren.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium text-[var(--color-subtle-foreground)] flex items-center gap-2">
                  <ListTree size={14} className="text-[var(--color-success)]" /> KPI con ({decompositionChildren.length})
                </h5>
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  Math.abs(decompositionWeightTotal - (kpi.weight ?? 0)) < 0.01
                    ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                    : "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
                )}>
                  Tổng trọng số con: {decompositionWeightTotal}/{kpi.weight ?? 0}%
                </span>
              </div>
              <div className="space-y-2">
                {decompositionChildren.map(child => {
                  const childStatus = STATUS_CONFIG[child.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
                  return (
                    <div key={child.id} className="flex items-center justify-between gap-3 p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{child.name}</p>
                        <div className={`text-eyebrow inline-flex items-center gap-1 px-2 py-0.5 rounded-full border mt-1 ${childStatus.bgColor} ${childStatus.color}`}>
                          {childStatus.label}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[var(--color-success)]">{child.weight ?? 0}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* OKR Info */}
          {kpi.keyResultName && (
            <div className="space-y-4">
              <h5 className="text-sm font-medium text-[var(--color-subtle-foreground)] flex items-center gap-2">
                <Target size={14} className="text-[var(--color-primary)]" /> Liên kết OKR
              </h5>
              <div className="space-y-4 p-6 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)]">
                <div>
                  <p className="text-eyebrow mb-1.5">Mục tiêu (Objective)</p>
                  <p className="text-sm font-semibold text-[var(--color-primary)] leading-tight">
                    {kpi.objectiveCode && <span className="bg-[var(--color-primary-soft)] px-1.5 py-0.5 rounded mr-1.5">{kpi.objectiveCode}</span>}
                    {kpi.objectiveName || '—'}
                  </p>
                </div>
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <p className="text-eyebrow mb-1.5">Kết quả then chốt (Key Result)</p>
                  <p className="text-sm font-medium text-[var(--color-primary)] leading-tight">
                    {kpi.keyResultCode && <span className="bg-[var(--color-primary-soft)] px-1.5 py-0.5 rounded mr-1.5">{kpi.keyResultCode}</span>}
                    {kpi.keyResultName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* BSC Perspective Info */}
          {kpi.effectivePerspectiveName && (
            <div className="space-y-4">
              <h5 className="text-sm font-medium text-[var(--color-subtle-foreground)] flex items-center gap-2">
                <Layers size={14} style={{ color: kpi.effectivePerspectiveColor || '#8b5cf6' }} /> Hạng mục BSC
              </h5>
              <div
                className="flex items-center gap-3 p-6 rounded-card border"
                style={{
                  backgroundColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}12`,
                  borderColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}33`,
                }}
              >
                <span className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: kpi.effectivePerspectiveColor || '#8b5cf6' }} />
                <div>
                  <p className="text-eyebrow mb-1">Thuộc hạng mục</p>
                  <p className="text-base font-semibold leading-tight" style={{ color: kpi.effectivePerspectiveColor || '#8b5cf6' }}>
                    {kpi.effectivePerspectiveName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reject Reason if any */}
          {kpi.status === 'REJECTED' && kpi.rejectReason && (
             <div className="p-6 rounded-card bg-[var(--color-error-bg)] border border-[var(--color-error-border)]">
                <div className="flex items-center gap-2 text-[var(--color-error)] mb-2">
                  <X size={18} className="shrink-0" />
                  <span className="text-sm font-medium">Lý do từ chối</span>
                </div>
                <p className="text-sm font-medium text-[var(--color-error)] leading-relaxed">
                   {kpi.rejectReason}
                </p>
             </div>
          )}

          {/* Audit Trail */}
          <div className="pt-8 border-t border-[var(--color-border)] flex flex-wrap gap-x-8 gap-y-4">
             <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[var(--color-subtle-foreground)]" />
                <span className="text-eyebrow">Ngày tạo: {formatDateTime(kpi.createdAt)}</span>
             </div>
             {kpi.approvedByName && (
               <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                  <span className="text-eyebrow">Duyệt bởi: {kpi.approvedByName}</span>
               </div>
             )}
          </div>
        </div>

        {/* Footer Section */}
        <div className="px-8 py-6 bg-[var(--color-muted)] border-t border-[var(--color-border)] flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetricBox({ icon: Icon, label, value, unit, color }: { icon: any; label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="p-5 rounded-card bg-[var(--color-card)] border border-[var(--color-border)] shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-[var(--color-subtle-foreground)]" />
        <p className="text-eyebrow">{label}</p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${color}`}>{value}</span>
        {unit && <span className="text-eyebrow">{unit}</span>}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm font-medium text-[var(--color-subtle-foreground)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--color-foreground)] text-right">{value}</span>
    </div>
  )
}
