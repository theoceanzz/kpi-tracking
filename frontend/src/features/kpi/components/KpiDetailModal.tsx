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
    const periodScs = bscScorecards.filter(s => s.kpiPeriodId === kpi.kpiPeriodId)
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl mx-4 animate-in zoom-in-95 fade-in duration-300 max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col">
        
        {/* Header Section */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Chi tiết Chỉ tiêu KPI</h3>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest mt-1 ${status.bgColor} ${status.color}`}>
                <StatusIcon size={10} /> {status.label}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all hover:rotate-90"
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Overview & Description */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tên chỉ tiêu</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{kpi.name}</h4>
              {kpi.isReverseKpi && (
                <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-200 dark:border-orange-800/50">
                  ↓ KPI Ngược
                </span>
              )}
              {kpi.isBonusKpi && (
                <span className="inline-flex items-center gap-1 mt-2 ml-2 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/50">
                  + KPI Thưởng
                </span>
              )}
            </div>
            {kpi.description && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Mô tả chi tiết</p>
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                   <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
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
              color="text-indigo-600"
            />
            )}
            {kpi.kpiType !== 'QUALITATIVE' && (
            <MetricBox
              icon={BarChart3}
              label="Tối thiểu"
              value={kpi.minimumValue != null ? formatNumber(kpi.minimumValue) : '0'}
              unit={kpi.unit ?? ''}
              color="text-rose-600"
            />
            )}
            <MetricBox
              icon={Award}
              label={realWeight != null ? 'Trọng số thật (%)' : 'Trọng số (%)'}
              value={realWeight != null ? `${realWeight.toFixed(1)}% / ${kpi.weight}%` : `${kpi.weight ?? '—'}%`}
              color="text-blue-600"
            />
            <MetricBox
              icon={Calendar}
              label="Tần suất báo cáo"
              value={FREQUENCY_MAP[kpi.frequency as keyof typeof FREQUENCY_MAP] ?? kpi.frequency}
              color="text-purple-600"
            />
            <MetricBox
              icon={Clock}
              label="Hạn chót KPI (riêng)"
              value={formatDateTime(kpi.deadline)}
              color="text-orange-600"
            />
            <MetricBox
              icon={Calendar}
              label="Hạn chót đợt đánh giá"
              value={formatDateTime(kpi.kpiPeriod?.endDate)}
              color="text-amber-600"
            />
          </div>

          {/* Secondary Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Building2 size={14} /> Thông tin đơn vị
              </h5>
              <div className="space-y-3">
                <InfoRow label="Phòng ban" value={kpi.orgUnitName ?? '—'} />
                <InfoRow label="Đợt đánh giá" value={kpi.kpiPeriod?.name ?? '—'} />
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Users size={14} /> Người thực hiện
              </h5>
              <div className="flex flex-wrap gap-2">
                {kpi.assigneeNames?.map((name, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {name}
                  </span>
                )) || <span className="text-xs text-slate-400">Chưa được giao cho ai</span>}
              </div>
            </div>
          </div>

          {/* Decomposition Children */}
          {decompositionChildren.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <ListTree size={14} className="text-emerald-500" /> KPI con ({decompositionChildren.length})
                </h5>
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                  Math.abs(decompositionWeightTotal - (kpi.weight ?? 0)) < 0.01
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                )}>
                  Tổng trọng số con: {decompositionWeightTotal}/{kpi.weight ?? 0}%
                </span>
              </div>
              <div className="space-y-2">
                {decompositionChildren.map(child => {
                  const childStatus = STATUS_CONFIG[child.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG['DRAFT']!
                  return (
                    <div key={child.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{child.name}</p>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest mt-1 ${childStatus.bgColor} ${childStatus.color}`}>
                          {childStatus.label}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-black text-emerald-600">{child.weight ?? 0}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* OKR Info */}
          {kpi.keyResultName && (
            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Target size={14} className="text-violet-500" /> Liên kết OKR
              </h5>
              <div className="space-y-4 p-6 rounded-[24px] bg-violet-50/30 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/20">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Mục tiêu (Objective)</p>
                  <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 leading-tight">
                    {kpi.objectiveCode && <span className="bg-indigo-100 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded mr-1.5">{kpi.objectiveCode}</span>}
                    {kpi.objectiveName || '—'}
                  </p>
                </div>
                <div className="pt-4 border-t border-violet-100 dark:border-violet-900/20">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1.5">Kết quả then chốt (Key Result)</p>
                  <p className="text-sm font-bold text-violet-600 dark:text-violet-400 leading-tight">
                    {kpi.keyResultCode && <span className="bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded mr-1.5">{kpi.keyResultCode}</span>}
                    {kpi.keyResultName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* BSC Perspective Info */}
          {kpi.effectivePerspectiveName && (
            <div className="space-y-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Layers size={14} style={{ color: kpi.effectivePerspectiveColor || '#8b5cf6' }} /> Hạng mục BSC
              </h5>
              <div
                className="flex items-center gap-3 p-6 rounded-[24px] border"
                style={{
                  backgroundColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}12`,
                  borderColor: `${kpi.effectivePerspectiveColor || '#8b5cf6'}33`,
                }}
              >
                <span className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: kpi.effectivePerspectiveColor || '#8b5cf6' }} />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Thuộc hạng mục</p>
                  <p className="text-base font-black leading-tight" style={{ color: kpi.effectivePerspectiveColor || '#8b5cf6' }}>
                    {kpi.effectivePerspectiveName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reject Reason if any */}
          {kpi.status === 'REJECTED' && kpi.rejectReason && (
             <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-900/30">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <X size={18} className="shrink-0" />
                  <span className="text-xs font-black uppercase tracking-widest">Lý do từ chối</span>
                </div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300 leading-relaxed">
                   {kpi.rejectReason}
                </p>
             </div>
          )}

          {/* Audit Trail */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-8 gap-y-4">
             <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày tạo: {formatDateTime(kpi.createdAt)}</span>
             </div>
             {kpi.approvedByName && (
               <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duyệt bởi: {kpi.approvedByName}</span>
               </div>
             )}
          </div>
        </div>

        {/* Footer Section */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-8 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

function MetricBox({ icon: Icon, label, value, unit, color }: { icon: any; label: string; value: string; unit?: string; color: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-slate-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-black ${color}`}>{value}</span>
        {unit && <span className="text-xs font-bold text-slate-400 uppercase">{unit}</span>}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <span className="text-sm font-black text-slate-900 dark:text-white text-right">{value}</span>
    </div>
  )
}
