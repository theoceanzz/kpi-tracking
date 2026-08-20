import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileWarning, PiggyBank } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { kpiApi } from '@/features/kpi/api/kpiApi'
import { rewardApi } from '@/features/rewards/api/rewardApi'
import { WidgetShell } from '../../components/WidgetShell'
import { LabeledBar, MetricTile, compactNumber } from '../shared/Primitives'

// ── KPI do tôi tạo bị từ chối ─────────────────────────────────────────────────
/**
 * KPI bị cấp trên trả lại nằm im cho tới khi người tạo sửa. Trước đây không có chỗ nào
 * trên trang chủ báo việc này, nên chỉ tiêu có thể treo cả kỳ mà không ai nhận ra.
 */
export function HeadRejectedKpiWidget() {
  const { user } = useAuthStore()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['kpi-criteria', 'rejected-by-me', user?.id],
    queryFn: () => kpiApi.getAll({ status: 'REJECTED', createdById: user!.id, page: 0, size: 10 }),
    enabled: !!user?.id,
  })
  const items = data?.content ?? []

  return (
    <WidgetShell
      title="KPI của tôi bị trả lại"
      icon={<FileWarning size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={items.length === 0}
      emptyMessage="Không có KPI nào bạn tạo bị trả lại."
      actions={items.length > 0 ? (
        <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 text-[10px] font-black tabular-nums">
          {data?.totalElements ?? items.length} MỤC
        </span>
      ) : undefined}
    >
      <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
        {items.map(k => (
          <li key={k.id} className="py-3">
            <Link
              to={`/performance?section=kpi-criteria&kpiId=${k.id}`}
              className="block rounded-xl -mx-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{k.name}</p>
              {/* Lý do trả lại là thứ quyết định phải sửa gì, nên hiện thẳng chứ không bắt bấm vào xem */}
              {k.rejectReason && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 line-clamp-2">
                  <span className="font-black uppercase tracking-wider text-[10px]">Lý do: </span>
                  {k.rejectReason}
                </p>
              )}
              <p className="text-[10px] font-bold text-slate-400 mt-1 truncate">
                {k.kpiPeriod?.name ?? ''}
                {k.updatedAt ? ` · ${formatDateTime(k.updatedAt).split(' ')[0]}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  )
}

// ── Ngân sách thưởng cá nhân ──────────────────────────────────────────────────
export function HeadMyBudgetWidget() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rewards', 'budgets', 'me'],
    queryFn: () => rewardApi.getMyBudget(),
  })

  const allocated = data?.allocatedPoints ?? 0
  const used = data?.usedPoints ?? 0
  const percent = allocated > 0 ? Math.round((used / allocated) * 100) : 0

  return (
    <WidgetShell
      title="Ngân sách thưởng của tôi"
      icon={<PiggyBank size={17} />}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isEmpty={!data || allocated === 0}
      emptyMessage="Bạn chưa được cấp ngân sách thưởng cho kỳ này."
      actions={
        <Link
          to="/rewards"
          className="min-h-[36px] px-3 inline-flex items-center rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          Trao thưởng
        </Link>
      }
    >
      <div className="flex-1 flex flex-col justify-center gap-4">
        <LabeledBar
          label={data?.kpiPeriodName ?? data?.kpiCycleName ?? 'Kỳ hiện tại'}
          percent={percent}
          tone={percent >= 90 ? 'red' : percent >= 70 ? 'amber' : 'indigo'}
          right={`${compactNumber(used)}/${compactNumber(allocated)} điểm`}
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Còn lại" value={compactNumber(data?.remainingPoints ?? 0)} tone="emerald" />
          <MetricTile
            label="Tối đa mỗi lần"
            value={data?.maxPerAward != null ? compactNumber(data.maxPerAward) : 'Không giới hạn'}
            tone="slate"
          />
        </div>
        {/* Ngày hạn mức lệch với kỳ nghĩa là ai đó sửa ngày kỳ sau khi cấp — số liệu dễ sai */}
        {data?.cycleDatesOutOfSync && (
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            Ngày của hạn mức đang lệch so với kỳ được gắn, cần kiểm tra lại.
          </p>
        )}
      </div>
    </WidgetShell>
  )
}
