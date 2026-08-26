import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, Loader2, Search, ShieldCheck, TriangleAlert, UserRoundSearch } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WidgetShell } from '../../components/WidgetShell'
import { useDashboardFilter } from '../../context/DashboardFilterContext'
import { orgUnitKpiApi, type MemberRiskRow } from '../../api/orgUnitKpiApi'
import { PRIORITY_META, PRIORITY_ORDER, countByPriority, type Priority, type PriorityFilter } from './priority'
import { PriorityChip, PriorityTabs, ShowMoreButton } from './PriorityParts'

const PAGE_SIZE = 5
const ALL_UNITS = '__ALL__'
/*
  Xếp hạng, đếm theo mức và lọc đều làm ở client nên phải lấy trọn danh sách trong một lần —
  phân trang phía server sẽ khiến các con số trên thẻ lọc chỉ đúng cho trang hiện tại.
*/
const FETCH_SIZE = 200

interface FocusRow extends MemberRiskRow {
  priority: Priority
  /** Một câu nói rõ vấn đề, cố tình KHÔNG nhắc lại các con số đã hiện ở cột chỉ số. */
  reason: string
}

/**
 * Xếp một thành viên vào mức ưu tiên, hoặc `null` nếu người đó đang ổn.
 *
 * <p>`overdueCount` của API là số chỉ tiêu mà bài nộp cuối CÙNG rơi sau hạn của đợt — tức là
 * nộp trễ, không phải "chưa nộp". Người chưa nộp gì cả không rơi vào đó mà lộ ra ở tiến độ
 * bằng 0, nên hai tín hiệu này phải xét cùng nhau.
 */
function classify(r: MemberRiskRow): FocusRow | null {
  if (r.totalKpis <= 0) return null
  const late = r.overdueCount > 0
  const p = r.avgProgress
  const mostlyLate = r.overdueRate >= 50

  const build = (priority: Priority, reason: string): FocusRow => ({ ...r, priority, reason })

  if (p <= 0 && !late) return build('URGENT', 'Chưa ghi nhận kết quả nào trong đợt/kỳ đang chọn.')
  if (mostlyLate) return build('URGENT', 'Phần lớn chỉ tiêu đều nộp sau hạn của đợt.')
  if (late && p < 50) return build('URGENT', 'Vừa nộp trễ hạn vừa hụt tiến độ, cần can thiệp ngay.')
  if (p < 30) return build('URGENT', 'Tiến độ gần như đứng yên dù đợt đang chạy.')
  if (late) return build('REVIEW', 'Có chỉ tiêu nộp sau hạn — cần siết lại lịch nộp.')
  if (p < 60) return build('REVIEW', 'Tiến độ còn cách khá xa mục tiêu của đợt.')
  if (p < 80) return build('MONITOR', 'Tiến độ hơi chậm, chưa có chỉ tiêu nào nộp trễ.')
  return null
}

/**
 * "Nhân sự cần can thiệp" — người quản lý nhìn đúng những ai đang có vấn đề trong đợt/kỳ đang
 * chọn, xếp theo mức ưu tiên.
 *
 * <p>Khác với widget "Rủi ro thành viên" (bảng đầy đủ, xếp theo cột, ai cũng có mặt), widget này
 * chỉ giữ lại người CÓ vấn đề và nói thẳng vấn đề đó là gì. Mỗi người đúng một dòng, mỗi con số
 * xuất hiện đúng một lần: câu chẩn đoán không lặp lại số ở cột chỉ số, và chi tiết từng chỉ tiêu
 * trễ nằm trong phần bung ra chứ không nhồi vào dòng tổng.
 *
 * <p>Bộ lọc đợt/kỳ của trang chủ lái cả bảng lẫn phần chi tiết bung ra, nên hai bên luôn khớp số.
 */
export function TeamFocusWidget() {
  const { from, to, periodId, periodIdTo } = useDashboardFilter('unit')
  const [filter, setFilter] = useState<PriorityFilter>('ALL')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [unitId, setUnitId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'team-focus', from, to, periodId, periodIdTo, unitId],
    queryFn: () => orgUnitKpiApi.getMemberRisks({
      from, to, periodId, periodIdTo,
      filterOrgUnitId: unitId,
      page: 0, size: FETCH_SIZE, sortBy: 'progress', sortDir: 'asc',
      // Kể cả KPI thuộc key result: widget này nói về NGƯỜI, mà vấn đề của một người thì không
      // phân biệt KPI đó nằm dưới mục tiêu hay đứng riêng (tổ chức bật OKR sẽ rỗng nếu bỏ qua).
      everyKpi: true,
    }),
    placeholderData: prev => prev,
  })

  const members = useMemo(() => data?.content ?? [], [data])
  const rows = useMemo(
    () => members
      .map(classify)
      .filter((r): r is FocusRow => r !== null)
      .sort((a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        b.overdueCount - a.overdueCount ||
        a.avgProgress - b.avgProgress,
      ),
    [members],
  )

  const counts = useMemo(() => countByPriority(rows), [rows])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filter !== 'ALL' && r.priority !== filter) return false
      if (!q) return true
      return r.fullName.toLowerCase().includes(q)
        || (r.orgUnitName ?? '').toLowerCase().includes(q)
        || r.reason.toLowerCase().includes(q)
    })
  }, [rows, filter, search])
  const shown = filtered.slice(0, visible)
  const healthy = members.length - rows.length
  const units = data?.availableOrgUnits ?? []

  const changeFilter = (v: PriorityFilter) => { setFilter(v); setVisible(PAGE_SIZE) }

  return (
    <WidgetShell
      title="Nhân sự cần can thiệp"
      icon={<TriangleAlert size={17} />}
      isLoading={isLoading && !data}
      error={error}
      onRetry={() => refetch()}
      actions={
        <>
          {units.length > 0 && (
            <Select
              value={unitId ?? ALL_UNITS}
              onValueChange={v => { setUnitId(v === ALL_UNITS ? undefined : v); setVisible(PAGE_SIZE) }}
            >
              <SelectTrigger className="h-8 max-w-[150px] gap-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
                {units.map(u => (
                  // `code` chính là id đơn vị; tiền tố gạch cho thấy bậc trong cây, giống bảng bên Phân tích
                  <SelectItem key={u.code} value={u.code}>{'-'.repeat(u.depth ?? 0)}{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Link
            to="/performance?section=submissions-org-unit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[9px] font-black uppercase tracking-[0.14em] hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white transition-colors"
          >
            Trung tâm duyệt <ExternalLink size={11} aria-hidden="true" />
          </Link>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <PriorityTabs counts={counts} total={rows.length} value={filter} onChange={changeFilter} />

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE) }}
            placeholder="Tìm nhân sự, đơn vị, lý do…"
            aria-label="Tìm trong danh sách nhân sự cần can thiệp"
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none text-xs font-semibold transition-all"
          />
        </div>

        {shown.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <ShieldCheck size={24} aria-hidden="true" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
              {members.length === 0
                ? 'Chưa có nhân sự nào được giao chỉ tiêu trong đợt/kỳ đang chọn.'
                : rows.length === 0
                  ? 'Toàn bộ nhân sự trong phạm vi của bạn đang bám đúng tiến độ.'
                  : search.trim()
                    ? 'Không có nhân sự nào khớp từ khoá đang tìm.'
                    : 'Không có nhân sự nào ở mức ưu tiên này.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 -mx-0.5 px-0.5">
              {shown.map(r => (
                <FocusRowItem
                  key={r.userId}
                  row={r}
                  periodId={periodId}
                  periodIdTo={periodIdTo}
                  expanded={expanded === r.userId}
                  onToggle={() => setExpanded(prev => (prev === r.userId ? null : r.userId))}
                />
              ))}
            </ul>
            <ShowMoreButton
              hidden={filtered.length - shown.length}
              expanded={visible > PAGE_SIZE}
              onMore={() => setVisible(v => v + PAGE_SIZE)}
              onLess={() => setVisible(PAGE_SIZE)}
            />
          </>
        )}

        {/* Mẫu số của bức tranh: bao nhiêu người KHÔNG nằm trong danh sách trên */}
        {members.length > 0 && (
          <p className="shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            {healthy} / {members.length} nhân sự đang bám đúng tiến độ
          </p>
        )}
      </div>
    </WidgetShell>
  )
}

function FocusRowItem({ row, periodId, periodIdTo, expanded, onToggle }: {
  row: FocusRow
  periodId?: string
  periodIdTo?: string
  expanded: boolean
  onToggle: () => void
}) {
  const meta = PRIORITY_META[row.priority]

  return (
    <li className="relative rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
      <span className={cn('absolute left-0 top-3 bottom-3 w-1 rounded-full', meta.bar)} aria-hidden="true" />

      <div className="flex items-center gap-3 p-3 pl-4">
        {row.avatarUrl
          ? <img src={row.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          : (
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 shrink-0" aria-hidden="true">
              {row.fullName.charAt(0).toUpperCase()}
            </div>
          )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <PriorityChip priority={row.priority} />
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{row.fullName}</p>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
              · {row.orgUnitName || 'Chưa gán đơn vị'}
            </span>
          </div>

          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">{row.reason}</p>

          <div className="h-1 w-full max-w-[220px] bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700 motion-reduce:transition-none', meta.bar)}
              style={{ width: `${Math.max(0, Math.min(100, row.avgProgress))}%` }}
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-5 shrink-0 border-l border-slate-100 dark:border-slate-800 pl-4">
          <Metric label="Tiến độ TB" value={`${row.avgProgress.toFixed(1)}%`} />
          <Metric label="Trễ hạn" value={`${row.overdueCount}/${row.totalKpis}`} highlight={row.overdueCount > 0} />
        </div>

        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`Chi tiết của ${row.fullName}`}
          className="shrink-0 w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center hover:bg-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
        >
          <ChevronDown size={16} className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>

      {/* Trên màn hẹp hai chỉ số xuống dòng riêng thay vì bị cắt mất */}
      <div className="sm:hidden flex items-center gap-5 px-4 pb-3 pl-4">
        <Metric label="Tiến độ TB" value={`${row.avgProgress.toFixed(1)}%`} />
        <Metric label="Trễ hạn" value={`${row.overdueCount}/${row.totalKpis}`} highlight={row.overdueCount > 0} />
      </div>

      {expanded && <OverdueDetail row={row} periodId={periodId} periodIdTo={periodIdTo} />}
    </li>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.14em]">{label}</p>
      <p className={cn(
        'text-sm font-black tabular-nums mt-0.5',
        highlight ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white',
      )}>
        {value}
      </p>
    </div>
  )
}

/** Đúng những chỉ tiêu làm nên con số "trễ hạn" của dòng trên — thứ không hiện ở bất kỳ đâu khác. */
function OverdueDetail({ row, periodId, periodIdTo }: { row: FocusRow; periodId?: string; periodIdTo?: string }) {
  const { data, isFetching } = useQuery({
    queryKey: ['dashboard', 'team-focus', 'overdue', row.userId, periodId, periodIdTo],
    queryFn: () => orgUnitKpiApi.getMemberOverdueKpis(row.userId, { periodId, periodIdTo, everyKpi: true }),
  })
  const kpis = data ?? []

  return (
    <div className="mx-3 mb-3 ml-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3 space-y-2">
      {isFetching ? (
        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Đang tải chi tiết…
        </p>
      ) : kpis.length === 0 ? (
        <p className="text-[11px] font-semibold text-slate-400">
          Không có chỉ tiêu nào nộp sau hạn — vấn đề nằm ở tiến độ, không ở lịch nộp.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {kpis.map(k => {
            const last = k.submissions[k.submissions.length - 1]
            return (
              <li key={k.kpiId} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{k.kpiName}</span>
                <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap tabular-nums">
                  hạn {formatDate(k.deadline)}
                  {last?.submittedAt ? ` · nộp ${formatDate(last.submittedAt)}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        to={`/employees/${row.userId}/performance`}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        <UserRoundSearch size={12} aria-hidden="true" /> Xem hồ sơ hiệu suất
      </Link>
    </div>
  )
}
