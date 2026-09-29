import { useMemo, useState } from 'react'
import { BarChart3, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { InfoHint } from '@/components/common/InfoHint'
import AiUnitSelect from './AiUnitSelect'
import { useAiReviewReport } from '../hooks/useAiReview'

/** Ngưỡng nghiệm thu trong tài liệu phân tích: sai số trung bình ≤ 8 điểm, ≥ 70 % trong ±5 điểm. */
const MAE_TARGET = 8
const WITHIN_TARGET = 70

function fmt(v?: number | null, digits = 1) {
  return v == null ? '—' : v.toFixed(digits).replace(/\.0$/, '')
}

function Metric({ label, value, hint, info, ok }: {
  label: string; value: string; hint?: string; info: string; ok?: boolean | null
}) {
  const tone = ok == null ? 'text-[var(--color-foreground)]' : ok ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'
  return (
    <div className="rounded-control border border-[var(--color-border)] p-3">
      <p className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">{label}<InfoHint label={`Giải thích: ${label}`}>{info}</InfoHint></p>
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p>}
    </div>
  )
}

/**
 * Báo cáo giám sát chất lượng chấm: điểm AI đề xuất so với điểm quản lý đã chốt trong một đợt — theo
 * người và theo đơn vị. Là số đo "AI có đáng tin không" trước khi mở rộng dùng.
 */
export default function AiReviewReportSection() {
  const organizationId = useAuthStore(s => s.user?.memberships?.[0]?.organizationId)
  const { data: periodsData } = useKpiPeriods({ organizationId, size: 200, sortBy: 'startDate', direction: 'desc' })
  const periods = useMemo(() => periodsData?.content ?? [], [periodsData])
  const [picked, setPicked] = useState<string | null>(null)
  const periodId = picked ?? periods[0]?.id
  const [unitId, setUnitId] = useState<string | null>(null)
  const { data: report, isLoading, isError } = useAiReviewReport(periodId, unitId ?? undefined)

  return (
    <div className="space-y-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BarChart3 size={20} className="mt-0.5 text-[var(--color-ai)]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">AI lệch bao nhiêu so với quản lý</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">Mục tiêu: lệch trung bình ≤ {MAE_TARGET} điểm, ≥ {WITHIN_TARGET}% trong ±5.</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select value={periodId} onValueChange={setPicked}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Chọn đợt" /></SelectTrigger>
            <SelectContent>
              {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <AiUnitSelect value={unitId} onChange={setUnitId} allLabel="Mọi đơn vị" className="w-full sm:w-52" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
      ) : isError || !report ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Chưa xem được báo cáo cho đợt này.</p>
      ) : report.rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Đợt này chưa có lượt AI đánh giá nào xong.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Số người so được" info="Người có cả điểm AI gợi ý và điểm quản lý đã chốt trong đợt." value={String(report.compared)} hint={`trên ${report.rows.length} lượt AI`} />
            <Metric label="Sai số trung bình" info={`Trung bình khoảng cách giữa điểm AI và điểm quản lý. Càng nhỏ càng tốt — mục tiêu ≤ ${MAE_TARGET} điểm.`} value={`${fmt(report.meanAbsoluteError)} điểm`}
                    ok={report.meanAbsoluteError == null ? null : report.meanAbsoluteError <= MAE_TARGET} />
            <Metric label="Trong ±5 điểm" info={`Phần trăm số người mà AI lệch không quá 5 điểm so với quản lý. Mục tiêu ≥ ${WITHIN_TARGET}%.`} value={`${fmt(report.withinFivePercent)}%`}
                    ok={report.withinFivePercent == null ? null : report.withinFivePercent >= WITHIN_TARGET} />
            <Metric label="Độ lệch trung bình" info="Số dương: AI chấm cao hơn quản lý. Số âm: AI chấm thấp hơn." value={`${report.meanBias != null && report.meanBias > 0 ? '+' : ''}${fmt(report.meanBias)}`}
                    hint={report.meanBias == null ? undefined : report.meanBias > 0 ? 'AI chấm rộng tay hơn' : 'AI chấm chặt hơn'} />
          </div>

          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                  <th className="py-2 pr-3 font-medium">Nhân viên</th>
                  <th className="py-2 pr-3 font-medium">Đơn vị</th>
                  <th className="py-2 pr-3 text-right font-medium">AI</th>
                  <th className="py-2 pr-3 text-right font-medium">Quản lý</th>
                  <th className="py-2 text-right font-medium">Lệch</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map(r => (
                  <tr key={r.reviewId} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 pr-3">{r.userName ?? '—'}</td>
                    <td className="py-2 pr-3 text-[var(--color-muted-foreground)]">{r.unitName ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{fmt(r.aiScore)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.managerScore == null ? 'chưa chấm' : fmt(r.managerScore)}</td>
                    <td className={`py-2 text-right tabular-nums ${r.difference != null && Math.abs(r.difference) > 5 ? 'text-[var(--color-warning)]' : ''}`}>
                      {r.difference == null ? '—' : `${r.difference > 0 ? '+' : ''}${fmt(r.difference)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.units.length > 1 && (
            <div className="space-y-1">
              <p className="text-label">Theo đơn vị</p>
              {report.units.map(u => (
                <p key={u.unitName} className="flex justify-between text-sm">
                  <span>{u.unitName} <span className="text-xs text-[var(--color-muted-foreground)]">({u.compared} người)</span></span>
                  <span className="tabular-nums">sai số {fmt(u.meanAbsoluteError)} · lệch {fmt(u.meanBias)}</span>
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
