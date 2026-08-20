import { useMemo } from 'react'
import { Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { WidgetShell } from '../../components/WidgetShell'
import { LabeledBar, MetricTile, progressTone } from '../shared/Primitives'

/**
 * Điểm cuối cùng được ghép từ nhiều nguồn (hệ thống, hành vi, BSC, % hoàn thành KPI).
 * Chỉ thấy một con số tổng thì không biết mình mất điểm ở đâu để mà sửa, nên tách rõ từng phần.
 */
export function StaffScoreBreakdownWidget() {
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: organization } = useOrganization(organizationId)

  const { data, isLoading, error, refetch } = useEvaluations({
    userId: user?.id,
    size: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  })

  /**
   * Lấy phiếu do quản lý chấm gần nhất. Phiếu tự đánh giá (SELF) không phải kết quả
   * chính thức nên không dùng làm nguồn cho khối này.
   */
  const latest = useMemo(() => {
    const list = data?.content ?? []
    return list.find(e => e.evaluatorRole !== 'SELF') ?? list[0] ?? null
  }, [data])

  const maxScore = organization?.evaluationMaxScore ?? 100
  const toPercent = (v?: number | null) => (v == null ? null : (v / maxScore) * 100)

  const parts = useMemo(() => {
    if (!latest) return []
    return [
      { key: 'system', label: 'Điểm hệ thống', raw: latest.systemScore, percent: toPercent(latest.systemScore) },
      { key: 'behavior', label: 'Điểm hành vi', raw: latest.behaviorScore, percent: toPercent(latest.behaviorScore) },
      { key: 'bsc', label: 'Điểm BSC', raw: latest.bscScore, percent: toPercent(latest.bscScore) },
    ].filter(p => p.raw != null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, maxScore])

  /** Điểm chính thức đã do backend quyết (BSC hay hệ thống), không tự suy lại ở đây. */
  const official = latest?.officialScore ?? latest?.score ?? null
  const isShadowBsc = latest?.bscScoringMode === 'SHADOW'

  return (
    <WidgetShell
      title="Điểm gần nhất được cấu thành thế nào"
      icon={<Layers size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!latest}
      emptyMessage="Chưa có phiếu đánh giá nào cho bạn."
      actions={latest ? (
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[140px]">
          {latest.kpiPeriodName}
        </span>
      ) : undefined}
    >
      {latest && (
        <>
          <div className="shrink-0 mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-black tabular-nums text-slate-900 dark:text-white">
                {official != null ? official.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
                Điểm chính thức / {maxScore}
              </p>
            </div>
            {latest.evaluatorName && (
              <p className="text-[11px] font-bold text-slate-500 text-right min-w-0 truncate">
                {latest.evaluatorRoleName ?? 'Quản lý'}<br />
                <span className="text-slate-400">{latest.evaluatorName}</span>
              </p>
            )}
          </div>

          {/* BSC ở chế độ chạy thử không tính vào điểm chính thức — phải nói rõ, không để hiểu nhầm */}
          {isShadowBsc && (
            <p className="shrink-0 mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              Điểm BSC đang ở chế độ chạy thử, chưa tính vào điểm chính thức.
            </p>
          )}

          <ul className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
            {parts.map(p => (
              <li key={p.key}>
                <LabeledBar
                  label={p.label}
                  percent={p.percent ?? 0}
                  tone={progressTone(p.percent ?? 0)}
                  right={`${p.raw!.toFixed(1)}/${maxScore}`}
                />
              </li>
            ))}
            {latest.kpiCompletionPercent != null && (
              <li>
                <LabeledBar
                  label="Mức hoàn thành KPI"
                  percent={latest.kpiCompletionPercent}
                  tone={progressTone(latest.kpiCompletionPercent)}
                  right={`${Math.round(latest.kpiCompletionPercent)}%`}
                />
              </li>
            )}
          </ul>

          {(latest.matrixRating != null || latest.comment) && (
            <div className="shrink-0 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {latest.matrixRating != null && (
                <MetricTile
                  label="Xếp loại ma trận hiệu suất"
                  value={`Loại ${latest.matrixRating}`}
                  tone={latest.matrixRating >= 4 ? 'emerald' : latest.matrixRating >= 3 ? 'indigo' : 'amber'}
                />
              )}
              {latest.comment && (
                <p className={cn('text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3')}>
                  <span className="font-black uppercase tracking-wider text-[10px] text-slate-400">Nhận xét: </span>
                  {latest.comment}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </WidgetShell>
  )
}
