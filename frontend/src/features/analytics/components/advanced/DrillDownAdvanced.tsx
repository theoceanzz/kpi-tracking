import { Network, BoxSelect } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/common/CopyButton'
import { useRef } from 'react'
import Boxplot from '@/components/charts/primitives/Boxplot'
import FlowSankey from '@/components/charts/primitives/FlowSankey'
import { useKpiCascade, useUnitBoxplot } from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'
import { useTranslation } from 'react-i18next'

/**
 * Khung card thống nhất với các khối khác của tab So sánh các đơn vị. `bare` bỏ vỏ (khi nằm trong
 * ô lưới đã có ChartWrapper) nhưng vẫn giữ dòng gợi ý đọc hình.
 */
function Panel({ title, icon, hint, children, bare }: {
  title: string
  icon: React.ReactNode
  hint?: string
  children: React.ReactNode
  bare?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  if (bare) {
    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {hint && <p className="text-xs text-slate-500 mb-3">{hint}</p>}
        {children}
      </div>
    )
  }
  return (
    <section ref={ref} className="bg-[var(--color-card)] p-6 rounded-2xl border border-[var(--color-border)] shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--color-foreground)]">
            {icon} {title}
          </h3>
          {hint && <p className="text-xs text-slate-400 font-medium mt-1">{hint}</p>}
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
export function KpiCascadeSection({ filter, className, bare }: { filter: AdvancedFilter; className?: string; bare?: boolean }) {
  const { t } = useTranslation('analytics')
  const { data, isLoading } = useKpiCascade(filter)
  return (
    <div className={cn(bare && 'flex-1 min-h-0 flex flex-col', className)}>
      <Panel
        bare={bare}
        title={t('DrillDownAdvanced.kpiCascadingDelegationFlow')}
        icon={<Network size={16} className="text-[var(--color-primary)]" />}
        hint={t('DrillDownAdvanced.bandThicknessIsTheTotalKpi')}
      >
        {isLoading ? (
          <Empty>{t('DrillDownAdvanced.loadingKpiFlow')}</Empty>
        ) : !data || data.empty ? (
          <Empty>
            {t('DrillDownAdvanced.noKpiHasBeenCascadedOr')}<br />
            {t('DrillDownAdvanced.flowsAppearOnlyWhenAChild')}
          </Empty>
        ) : (
          <FlowSankey nodes={data.nodes} links={data.links} valueLabel={data.valueLabel} />
        )}
      </Panel>
    </div>
  )
}

/** D2 — Hộp phân tán điểm giữa các đơn vị con. */
export function UnitBoxplotSection({ filter, className, bare }: { filter: AdvancedFilter; className?: string; bare?: boolean }) {
  const { t } = useTranslation('analytics')
  const { data, isLoading } = useUnitBoxplot(filter)
  const boxes = data?.boxes ?? []
  return (
    <div className={cn(bare && 'flex-1 min-h-0 flex flex-col', className)}>
      <Panel
        bare={bare}
        title={t('DrillDownAdvanced.scoreSpreadByUnit')}
        icon={<BoxSelect size={16} className="text-sky-600" />}
        hint={t('DrillDownAdvanced.theTallerTheBoxTheLarger')}
      >
        {isLoading ? (
          <Empty>{t('DrillDownAdvanced.loadingScoreSpread')}</Empty>
        ) : boxes.length === 0 ? (
          <Empty>{t('DrillDownAdvanced.notEnoughEvaluationDataToBuild')}</Empty>
        ) : (
          <Boxplot data={boxes} unit={t('DrillDownAdvanced.points')} yLabel={t('DrillDownAdvanced.evaluationScore')} height={Math.max(280, Math.min(boxes.length * 60, 420))} />
        )}
      </Panel>
    </div>
  )
}

