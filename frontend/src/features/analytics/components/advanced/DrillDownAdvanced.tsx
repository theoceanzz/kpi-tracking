import { Network, BoxSelect } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/common/CopyButton'
import { useRef } from 'react'
import Boxplot from '@/components/charts/primitives/Boxplot'
import FlowSankey from '@/components/charts/primitives/FlowSankey'
import { useKpiCascade, useUnitBoxplot } from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'

/** Khung card thống nhất với các khối khác của tab Phân cấp. */
function Panel({ title, icon, hint, children }: {
  title: string
  icon: React.ReactNode
  hint?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  return (
    <section ref={ref} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-black flex items-center gap-2 text-slate-700 dark:text-slate-200">
            {icon} {title}
          </h3>
          {hint && <p className="text-[11px] text-slate-400 font-medium mt-1">{hint}</p>}
        </div>
        <CopyButton targetRef={ref} />
      </div>
      {children}
    </section>
  )
}

function Empty({ children, height = 240 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-slate-400 font-medium text-center px-4" style={{ height }}>
      {children}
    </div>
  )
}

/** F1 — Luồng phân rã / uỷ quyền KPI giữa các đơn vị. */
export function KpiCascadeSection({ filter, className }: { filter: AdvancedFilter; className?: string }) {
  const { data, isLoading } = useKpiCascade(filter)
  return (
    <div className={cn(className)}>
      <Panel
        title="Luồng phân rã & uỷ quyền KPI"
        icon={<Network size={16} className="text-indigo-600" />}
        hint="Độ dày dải là tổng trọng số KPI chảy từ đơn vị này xuống đơn vị kia"
      >
        {isLoading ? (
          <Empty>Đang tải luồng KPI...</Empty>
        ) : !data || data.empty ? (
          <Empty>
            Chưa có KPI nào được phân rã hoặc uỷ quyền xuống đơn vị khác.<br />
            Luồng chỉ xuất hiện khi KPI con được tạo từ một KPI cha ở đơn vị trên.
          </Empty>
        ) : (
          <FlowSankey nodes={data.nodes} links={data.links} valueLabel={data.valueLabel} />
        )}
      </Panel>
    </div>
  )
}

/** D2 — Hộp phân tán điểm giữa các đơn vị con. */
export function UnitBoxplotSection({ filter, className }: { filter: AdvancedFilter; className?: string }) {
  const { data, isLoading } = useUnitBoxplot(filter)
  const boxes = data?.boxes ?? []
  return (
    <div className={cn(className)}>
      <Panel
        title="Phân tán điểm theo đơn vị"
        icon={<BoxSelect size={16} className="text-sky-600" />}
        hint="Hộp càng cao thì nội bộ đơn vị càng chênh lệch — điều mà điểm trung bình không cho thấy"
      >
        {isLoading ? (
          <Empty>Đang tải phân tán điểm...</Empty>
        ) : boxes.length === 0 ? (
          <Empty>Chưa đủ dữ liệu đánh giá để dựng phân tán</Empty>
        ) : (
          <Boxplot data={boxes} unit="điểm" yLabel="Điểm đánh giá" height={Math.max(280, Math.min(boxes.length * 60, 420))} />
        )}
      </Panel>
    </div>
  )
}

