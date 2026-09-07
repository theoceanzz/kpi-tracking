import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ClipboardList, ExternalLink } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { WidgetShell } from '../../components/WidgetShell'
import { useDashboardFilter } from '../../context/DashboardFilterContext'
import { useNow } from '../../hooks/useNow'
import { personalKpiApi } from '../../api/personalKpiApi'
import { personalObjectiveApi, type KpiDetail } from '../../api/personalObjectiveApi'
import { PRIORITY_META, PRIORITY_ORDER, countByPriority, type Priority, type PriorityFilter } from './priority'
import { PriorityChip, PriorityTabs, ShowMoreButton } from './PriorityParts'

/** Số dòng hiện trước khi phải bấm "xem thêm". */
const PAGE_SIZE = 5
/** Hạn còn dưới ngần này ngày thì coi là "sắp đến hạn". */
const DUE_SOON_DAYS = 3
/** Tiến độ thấp hơn phần thời gian đã trôi ngần này điểm % thì coi là chậm. */
const PACE_GAP = 15

const DAY = 86_400_000

/**
 * Việc mà một chỉ tiêu đang chờ ở người thực hiện. Mỗi KPI chỉ sinh ĐÚNG MỘT việc — trạng thái
 * nặng nhất — để danh sách không lặp một cái tên ở nhiều dòng.
 */
type TodoState = 'REJECTED' | 'OVERDUE' | 'DUE_SOON' | 'BEHIND' | 'NOT_STARTED' | 'PENDING'

const STATE_LABEL: Record<TodoState, string> = {
  REJECTED: 'Bị từ chối',
  OVERDUE: 'Quá hạn',
  DUE_SOON: 'Sắp đến hạn',
  BEHIND: 'Chậm tiến độ',
  NOT_STARTED: 'Chưa bắt đầu',
  PENDING: 'Chờ duyệt',
}

interface TodoItem {
  key: string
  state: TodoState
  priority: Priority
  kpiName: string
  periodName?: string | null
  /** Hạn chót của đợt chứa KPI; null = đợt không đặt hạn. */
  deadlineMs: number | null
  /** 0-100, null với KPI thưởng/định tính (không đo bằng %). */
  progress: number | null
  /** Kết quả của KPI định tính — thay chỗ cho con số tiến độ. */
  levelName?: string | null
  /** Phần thời gian của đợt đã trôi, chỉ dùng cho dòng "chậm tiến độ". */
  elapsedPercent: number | null
  action: { label: string; to: string }
}

const clampPercent = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Đọc một dòng KPI thành việc-cần-làm, hoặc `null` nếu chỉ tiêu đó đang không đòi hỏi gì.
 *
 * <p>Thứ tự các nhánh chính là thứ tự ưu tiên: bị từ chối → quá hạn → sắp đến hạn → chậm tiến
 * độ → chưa bắt đầu → chờ duyệt. Nhánh nào khớp trước thì dừng, nên một chỉ tiêu vừa chậm vừa
 * có bài chờ duyệt chỉ hiện đúng việc nặng hơn.
 */
function toTodo(d: KpiDetail, now: number): TodoItem | null {
  const subs = [...(d.mySubmissions ?? [])].sort(
    (a, b) => new Date(b.submitDate).getTime() - new Date(a.submitDate).getTime(),
  )
  const latest = subs[0]
  const hasPending = subs.some(s => s.status === 'PENDING')
  const measurable = d.progress != null
  const done = measurable ? (d.progress ?? 0) >= 100 : subs.some(s => s.status === 'APPROVED')

  const deadlineMs = d.periodEnd ? new Date(d.periodEnd).getTime() : null
  const startMs = d.periodStart ? new Date(d.periodStart).getTime() : null
  const daysLeft = deadlineMs !== null ? Math.ceil((deadlineMs - now) / DAY) : null
  const elapsedPercent = startMs !== null && deadlineMs !== null && deadlineMs > startMs
    ? clampPercent(((now - startMs) / (deadlineMs - startMs)) * 100)
    : null

  /*
    KPI cha (thác nước/phân rã) không phải việc để nộp: kết quả được tổng hợp từ các KPI con,
    và chính các con mới nằm trong danh sách này nếu được giao cho mình. Đưa cả cha vào là đếm
    một việc hai lần.
  */
  const isAggregate = (d.children?.length ?? 0) > 0

  const base = {
    key: d.kpiId,
    kpiName: d.kpiName,
    periodName: d.periodName,
    deadlineMs,
    progress: d.progress ?? null,
    levelName: d.qualitativeLevelName,
    elapsedPercent,
  }
  const submitAction = { label: 'Nộp kết quả', to: `/submissions/new?kpiId=${d.kpiId}` }

  if (latest?.status === 'REJECTED') {
    return {
      ...base, state: 'REJECTED', priority: 'URGENT',
      action: { label: 'Sửa & nộp lại', to: `/submissions/edit/${latest.id}` },
    }
  }

  if (!done && daysLeft !== null && daysLeft < 0) {
    return { ...base, state: 'OVERDUE', priority: 'URGENT', action: submitAction }
  }

  if (!done && daysLeft !== null && daysLeft <= DUE_SOON_DAYS) {
    return {
      ...base, state: 'DUE_SOON',
      priority: daysLeft <= 1 ? 'URGENT' : 'REVIEW',
      action: submitAction,
    }
  }

  if (!done && measurable && elapsedPercent !== null && (d.progress ?? 0) < elapsedPercent - PACE_GAP) {
    return { ...base, state: 'BEHIND', priority: 'REVIEW', action: submitAction }
  }

  if (!done && !isAggregate && subs.length === 0) {
    return {
      ...base, state: 'NOT_STARTED',
      // Đợt mới mở thì chưa nộp gì là bình thường; chỉ thành việc cần xem xét khi đã đi quá nửa đợt.
      priority: (elapsedPercent ?? 0) >= 50 ? 'REVIEW' : 'MONITOR',
      action: submitAction,
    }
  }

  if (hasPending) {
    return {
      ...base, state: 'PENDING', priority: 'MONITOR',
      action: { label: 'Xem bài nộp', to: '/me?section=my-submissions' },
    }
  }

  return null
}

/** "Quá hạn 3 ngày" / "Còn 5 ngày" — nói bằng chữ để không phải tự nhẩm từ ngày tháng. */
function deadlineText(deadlineMs: number | null, now: number): string {
  if (deadlineMs === null) return 'Đợt chưa đặt hạn'
  const days = Math.ceil((deadlineMs - now) / DAY)
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày · ${formatDate(new Date(deadlineMs))}`
  if (days === 0) return `Hết hạn hôm nay · ${formatDate(new Date(deadlineMs))}`
  return `Còn ${days} ngày · ${formatDate(new Date(deadlineMs))}`
}

/**
 * "Công việc cần làm" — danh sách việc của chính người đang đăng nhập trong đợt/kỳ đang chọn.
 *
 * <p>Các widget cá nhân khác trả lời "tôi đang ở đâu" (chỉ số, xu hướng, bảng chi tiết); widget
 * này trả lời "giờ tôi phải làm gì": mỗi dòng là một chỉ tiêu đang chờ mình cùng đúng một nút
 * dẫn thẳng tới chỗ xử lý. Chỉ tiêu đang đúng tiến độ cố tình KHÔNG xuất hiện — chúng đã nằm
 * trong bảng "Chi tiết KPI của tôi" rồi.
 *
 * <p>Nguồn dữ liệu là đúng endpoint chi tiết KPI mà tab thống kê cá nhân dùng, nên bộ lọc
 * đợt/kỳ trên trang chủ lái widget này y hệt các widget "của tôi" còn lại.
 */
export function MyTodoWidget({ source }: { source: 'kpi' | 'objective' }) {
  const { from, to, periodId, periodIdTo } = useDashboardFilter('personal')
  const now = useNow()
  const [filter, setFilter] = useState<PriorityFilter>('ALL')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'my-todo', source, from, to, periodId, periodIdTo],
    queryFn: () => {
      const params = { from, to, periodId, periodIdTo, page: 0, size: 200 }
      return source === 'objective'
        ? personalObjectiveApi.getDetailedKpis(params)
        : personalKpiApi.getDetailedKpis(params)
    },
    placeholderData: prev => prev,
  })

  // `now` cố định trong vòng đời widget (xem `useNow`): đếm lại mỗi lần render sẽ làm một dòng
  // tự nhảy mức ưu tiên giữa chừng dù chẳng có gì thay đổi.
  const items = useMemo(
    () => (data?.content ?? [])
      .map(d => toTodo(d, now))
      .filter((t): t is TodoItem => t !== null)
      .sort((a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (a.deadlineMs ?? Number.MAX_SAFE_INTEGER) - (b.deadlineMs ?? Number.MAX_SAFE_INTEGER) ||
        (a.progress ?? 0) - (b.progress ?? 0),
      ),
    [data, now],
  )

  const counts = useMemo(() => countByPriority(items), [items])
  const shown = useMemo(
    () => (filter === 'ALL' ? items : items.filter(i => i.priority === filter)).slice(0, visible),
    [items, filter, visible],
  )
  const matching = filter === 'ALL' ? items.length : counts[filter]

  const changeFilter = (v: PriorityFilter) => { setFilter(v); setVisible(PAGE_SIZE) }

  return (
    <WidgetShell
      title="Công việc cần làm"
      icon={<ClipboardList size={17} />}
      isLoading={isLoading && !data}
      error={error}
      onRetry={() => refetch()}
      actions={
        <Link
          to="/me?section=my-kpi"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-[0.14em] hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white transition-colors"
        >
          KPI của tôi <ExternalLink size={11} aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <PriorityTabs counts={counts} total={items.length} value={filter} onChange={changeFilter} />

        {shown.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center px-6 py-8">
            <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
              {items.length === 0
                ? 'Không có chỉ tiêu nào đang chờ bạn trong đợt/kỳ đang chọn.'
                : 'Không có mục nào ở mức ưu tiên này.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 -mx-0.5 px-0.5">
              {shown.map(item => <TodoRow key={item.key} item={item} now={now} />)}
            </ul>
            <ShowMoreButton
              hidden={matching - shown.length}
              expanded={visible > PAGE_SIZE}
              onMore={() => setVisible(v => v + PAGE_SIZE)}
              onLess={() => setVisible(PAGE_SIZE)}
            />
          </>
        )}
      </div>
    </WidgetShell>
  )
}

function TodoRow({ item, now }: { item: TodoItem; now: number }) {
  const meta = PRIORITY_META[item.priority]
  const overdue = item.state === 'OVERDUE' || item.state === 'REJECTED'

  return (
    <li className="relative flex items-center gap-3 p-3 pl-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 transition-colors overflow-hidden">
      <span className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-full', meta.bar)} aria-hidden="true" />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Nhãn nói TRẠNG THÁI, màu nói MỨC ƯU TIÊN — màu không được là tín hiệu duy nhất nên
              mức ưu tiên vẫn được đọc lên cho trình đọc màn hình. */}
          <PriorityChip
            priority={item.priority}
            label={STATE_LABEL[item.state]}
            srSuffix={`— mức ${meta.label}`}
          />
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.kpiName}</p>
        </div>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
          {item.periodName ? `${item.periodName} · ` : ''}
          <span className={cn(overdue && 'text-red-500 dark:text-red-400')}>{deadlineText(item.deadlineMs, now)}</span>
          {item.state === 'BEHIND' && item.elapsedPercent !== null
            ? ` · đợt đã trôi ${Math.round(item.elapsedPercent)}%`
            : ''}
        </p>

        {item.progress !== null && (
          <div className="h-1 w-full max-w-[220px] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', meta.bar)}
              style={{ width: `${clampPercent(item.progress)}%` }}
            />
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-base font-black text-slate-900 dark:text-white tabular-nums leading-none">
          {item.progress !== null ? `${Math.round(item.progress)}%` : (item.levelName ?? '—')}
        </p>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.14em] mt-1">
          {item.progress !== null ? 'Tiến độ' : 'Kết quả'}
        </p>
      </div>

      <Link
        to={item.action.to}
        aria-label={`${item.action.label}: ${item.kpiName}`}
        className="shrink-0 inline-flex items-center gap-1 min-h-[36px] px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-[0.12em] hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
      >
        {item.action.label} <ArrowUpRight size={12} aria-hidden="true" />
      </Link>
    </li>
  )
}
