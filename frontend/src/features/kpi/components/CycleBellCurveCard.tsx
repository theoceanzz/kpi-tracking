import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import BellCurveChart from '@/components/charts/BellCurveChart'
import type { CycleCurve } from '@/types/kpi'

/**
 * Bell curve của KỲ cho đơn vị đang xem: phân bố THỰC TẾ của thành viên đặt cạnh khung hạn mức
 * đã cấu hình ở "Xếp loại đơn vị". Thẻ chỉ lo phần đầu (tên đơn vị, hồ sơ, chế độ); biểu đồ và
 * chú giải dùng chung `BellCurveChart` với khối Xếp loại đơn vị ở Thống kê.
 */
export default function CycleBellCurveCard({ curve, orgUnitName }: {
  curve: CycleCurve
  orgUnitName?: string
}) {
  if (!curve.buckets?.length) return null

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
          <Scale size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-section-title text-[var(--color-foreground)] leading-tight">
            Bell curve của kỳ{orgUnitName ? ` · ${orgUnitName}` : ''}
          </h3>
          <p className="text-caption font-medium">
            {curve.evaluated}/{curve.headcount} người đã có điểm kỳ
            {curve.configured && curve.profileName ? ` · hồ sơ "${curve.profileName}"` : ''}
            {curve.configured ? ` · dung sai ±${curve.tolerance}%` : ''}
          </p>
        </div>
        {curve.configured && (
          <span className={cn(
            'text-eyebrow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border whitespace-nowrap',
            curve.mode === 'block'
              ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
              : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
          )}>
            {curve.mode === 'block' ? 'Chặn khi vượt trần' : 'Chỉ cảnh báo'}
          </span>
        )}
      </div>

      <div className="p-5">
        <BellCurveChart curve={curve} />
      </div>
    </div>
  )
}
