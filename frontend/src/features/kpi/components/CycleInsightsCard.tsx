import { GitBranch, Scale } from 'lucide-react'
import type { CycleApprovalStep, CycleCurve } from '@/types/kpi'
import CycleBellCurveCard from './CycleBellCurveCard'
import CycleApprovalTimeline from './CycleApprovalTimeline'

/**
 * Bell curve của kỳ và luồng duyệt theo cấp trên CÙNG MỘT HÀNG, mỗi cái một nửa, cỡ nhỏ.
 *
 * Hai khối này là hai góc nhìn "xung quanh" bảng nhân viên — một cái nhìn phân bố, một cái
 * nhìn ai đã khoá tới đâu — chứ không phải việc phải làm, nên không được cao hơn bảng.
 * Đặt cạnh nhau (thay vì tab) để liếc một cái thấy cả hai, không phải bấm qua lại.
 */
export default function CycleInsightsCard({
  curve, orgUnitName, chain, isChainLoading, getScoreColor, getScoreLabel, onSelectUnit,
}: {
  curve?: CycleCurve | null
  orgUnitName?: string
  chain: CycleApprovalStep[]
  isChainLoading: boolean
  getScoreColor: (s: number | null) => string
  getScoreLabel: (s: number | null) => string
  onSelectUnit?: (orgUnitId: string) => void
}) {
  const hasCurve = !!curve?.buckets?.length
  return (
    <div className={hasCurve ? 'grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start' : ''}>
      {hasCurve && curve && (
        <Panel icon={<Scale size={15} aria-hidden="true" />} title="Bell curve của kỳ" hint={orgUnitName}>
          <CycleBellCurveCard bare compact curve={curve} orgUnitName={orgUnitName} />
        </Panel>
      )}
      <Panel icon={<GitBranch size={15} aria-hidden="true" />} title="Luồng duyệt theo cấp" hint="Trưởng đơn vị → Giám đốc">
        <CycleApprovalTimeline
          bare
          steps={chain}
          isLoading={isChainLoading}
          getScoreColor={getScoreColor}
          getScoreLabel={getScoreLabel}
          onSelectUnit={onSelectUnit}
        />
      </Panel>
    </div>
  )
}

function Panel({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-2">
        <span className="text-[var(--color-primary)]">{icon}</span>
        <span className="text-eyebrow text-[var(--color-foreground)]">{title}</span>
        {hint && <span className="text-caption ml-auto truncate">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
