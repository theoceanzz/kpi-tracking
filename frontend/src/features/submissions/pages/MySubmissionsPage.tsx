import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import StatusBadge from '@/components/common/StatusBadge'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import Pagination from '@/components/common/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { Link } from 'react-router-dom'
import { formatDateTime, formatNumber, cn } from '@/lib/utils'
import type { SubmissionStatus } from '@/types/submission'
import { Plus, Pencil, Send, Loader2, Eye, Inbox, FileText, Clock, CheckCircle2, Star } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TabKey = SubmissionStatus | ''
const TABS: { key: TabKey; label: string }[] = [
  { key: '', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'PENDING', label: 'Chờ duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'REJECTED', label: 'Bị trả lại' },
]

/** Phần trăm hoàn thành so với mục tiêu — cùng công thức cũ. */
const pctOf = (actual: number, target: number | null) =>
  target ? Math.min(Math.round((actual / target) * 100), 100) : actual <= 100 ? actual : 0

export default function MySubmissionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [finishedPeriodId, setFinishedPeriodId] = useState<string | null>(null)
  // Mở form tự đánh giá tại chỗ. Không điều hướng sang mục "Đánh giá của tôi": mục đó
  // gác bằng EVALUATION:VIEW_MY nên trưởng đơn vị đi sang là rơi về lưới thẻ của /me.
  const [selfEvalPeriodId, setSelfEvalPeriodId] = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState('ALL')
  
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const pageTitle = usePageTitle('my-submissions', 'Báo cáo của tôi')
  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })
  
  const qc = useQueryClient()
  
  const { data: myKpiData } = useMyKpi({ page: 0, size: 500 })

  const { data, isLoading } = useMySubmissions({
    status: activeTab || undefined,
    page,
    size: pageSize,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    sortBy,
    sortDir
  })

  const handleSortSelect = (value: string) => {
    const parts = value.split(':')
    if (parts.length === 2) {
      setSortBy(parts[0]!)
      setSortDir(parts[1]! as 'asc' | 'desc')
      setPage(0)
    }
  }

  const submitMutation = useMutation({
    mutationFn: (id: string) => submissionApi.update(id, { isDraft: false }),
    onSuccess: (_, submissionId) => {
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      
      // Check if this was the last submission for the period
      const sub = allItems.find(s => s.id === submissionId)
      if (sub && myKpiData?.content) {
        const periodId = sub.kpiPeriod?.id
        const periodKpis = myKpiData.content.filter(k => k.kpiPeriodId === periodId) || []
        
        const isAllFinished = periodKpis.every(k => {
          const isCurrentKpi = k.id === sub.kpiCriteriaId
          const currentCount = isCurrentKpi ? k.submissionCount + 1 : k.submissionCount
          return currentCount >= k.expectedSubmissions
        })

        if (isAllFinished) {
          setFinishedPeriodId(periodId || null)
          setShowSuccess(true)
        } else {
          toast.success('Đã gửi báo cáo để duyệt')
        }
      } else {
        toast.success('Đã gửi báo cáo để duyệt')
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gửi duyệt thất bại'))
  })

  const allItems = data?.content ?? []
  const filteredItems = allItems.filter(s => 
    s.kpiCriteriaName.toLowerCase().includes(search.toLowerCase())
  )

  // Quick stats
  const { data: allData } = useMySubmissions({ size: 1000 })
  const stats = useMemo(() => {
    const all = allData?.content ?? []
    return {
      total: all.length,
      approved: all.filter(s => s.status === 'APPROVED').length,
      pending: all.filter(s => s.status === 'PENDING').length,
    }
  }, [allData])

  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const countOf = (key: TabKey) => {
    const all = allData?.content ?? []
    return key === '' ? all.length : all.filter(s => s.status === key).length
  }
  const draftCount = countOf('DRAFT')

  const resultCell = (sub: (typeof allItems)[number]) => {
    if (sub.kpiType === 'QUALITATIVE') return <Badge variant="outline">{sub.qualitativeLevelName ?? 'Định tính'}</Badge>
    const pct = pctOf(sub.actualValue, sub.targetValue)
  return (
      <div className="flex items-center justify-end gap-3 tabular-nums">
        <span className="font-medium text-[var(--color-foreground)]">{formatNumber(sub.actualValue)}</span>
        {sub.targetValue != null && (
          <span className="flex items-center gap-1.5 text-caption" title={`Mục tiêu ${formatNumber(sub.targetValue)}`}>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-muted)]" aria-hidden="true">
              <span className={cn('block h-full rounded-full', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${pct}%` }} />
            </span>
            {pct}%
          </span>
        )}
      </div>
    )
  }
      
  const rowActions = (sub: (typeof allItems)[number]) => (
    <div className="flex items-center justify-end gap-1">
      {sub.status === 'DRAFT' ? (
        <>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Sửa bản nháp" title="Sửa bản nháp">
            <Link to={`/submissions/edit/${sub.id}`}><Pencil aria-hidden="true" /></Link>
          </Button>
          <Button size="sm" onClick={() => { setPendingId(sub.id); setShowConfirm(true) }} disabled={submitMutation.isPending && submitMutation.variables === sub.id}>
            {submitMutation.isPending && submitMutation.variables === sub.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Gửi duyệt
          </Button>
        </>
      ) : (
        <Button asChild variant="ghost" size="icon-sm" aria-label="Xem chi tiết" title="Xem chi tiết">
          <Link to={`/submissions/${sub.id}`}><Eye aria-hidden="true" /></Link>
        </Button>
      )}
          </div>
  )

  const emptyTitle = search ? 'Không tìm thấy báo cáo' : activeTab === 'DRAFT' ? 'Không có bản nháp' : activeTab === 'PENDING' ? 'Không có báo cáo chờ duyệt' : activeTab === 'REJECTED' ? 'Không có báo cáo bị trả lại' : 'Bạn chưa nộp báo cáo nào'
  const emptyDesc = search ? 'Thử từ khoá khác hoặc xoá tìm kiếm.' : 'Vào "KPI của tôi" để nộp báo cáo cho chỉ tiêu đang đảm nhận.'

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-my-sub-header"
        title={pageTitle}
        description="Báo cáo kết quả bạn đã nộp cho từng chỉ tiêu và trạng thái duyệt của chúng."
        stats={[
          { label: 'Đã nộp', value: stats.total, icon: FileText },
          { label: 'Chờ duyệt', value: stats.pending, icon: Clock },
          { label: 'Đã duyệt', value: stats.approved, icon: CheckCircle2 },
        ]}
        actions={
          <Button asChild>
            <Link to="/submissions/new"><Plus aria-hidden="true" /> Nộp báo cáo</Link>
          </Button>
        }
      />

      <FilterBar
        id="tour-my-sub-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: 'Tìm theo tên chỉ tiêu…' }}
        trailing={
          <SegmentedControl ariaLabel="Dạng hiển thị" value={viewMode} onChange={setViewMode}
            options={[{ value: 'TABLE', label: 'Bảng' }, { value: 'CARD', label: 'Thẻ' }]} />
        }
          >
        <Select value={selectedPeriodId} onValueChange={v => { setSelectedPeriodId(v); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả các đợt</SelectItem>
            {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
        <Select value={`${sortBy}:${sortDir}`} onValueChange={handleSortSelect}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sắp xếp"><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">Mới nhất trước</SelectItem>
            <SelectItem value="createdAt:asc">Cũ nhất trước</SelectItem>
            <SelectItem value="kpiCriteriaName:asc">Tên A → Z</SelectItem>
            <SelectItem value="kpiCriteriaName:desc">Tên Z → A</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div id="tour-my-sub-tabs" className="flex items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Lọc theo trạng thái"
          value={activeTab}
          onChange={(k) => { setActiveTab(k); setPage(0) }}
          options={TABS.map(t => ({ value: t.key, label: <>{t.label}<span className="text-[var(--color-muted-foreground)] tabular-nums">{countOf(t.key)}</span></> }))}
        />
        {draftCount > 0 && activeTab !== 'DRAFT' && (
          <Button variant="ghost" type="button" onClick={() => { setActiveTab('DRAFT'); setPage(0) }}>
            {draftCount} bản nháp chưa gửi
                </Button>
              )}
            </div>

      <div id="tour-my-sub-list">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState icon={Inbox} title={emptyTitle} description={emptyDesc} action={activeTab === '' && !search ? <Button asChild variant="outline"><Link to="/me?section=my-kpi">Xem KPI của tôi</Link></Button> : undefined} />
          </div>
        ) : (
          <>
            {viewMode === 'TABLE' && (
              <div className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
                <table className="w-full">
              <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Chỉ tiêu</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Đợt</th>
                      <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Kết quả</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Ngày nộp</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Trạng thái</th>
                      <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                </tr>
              </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredItems.map(sub => (
                      <tr key={sub.id} className="transition-colors hover:bg-[var(--color-muted)]">
                        <td className="px-4 py-3">
                          <div className="min-w-0 max-w-[360px]">
                            <Link to={`/submissions/${sub.id}`} className="block max-w-full truncate text-sm font-medium text-[var(--color-foreground)] hover:underline underline-offset-4" title={sub.kpiCriteriaName}>{sub.kpiCriteriaName}</Link>
                            {sub.status === 'REJECTED' && sub.reviewNote
                              ? <p className="mt-0.5 line-clamp-1 text-caption text-[var(--color-error)]" title={sub.reviewNote}>Lý do: {sub.reviewNote}</p>
                              : sub.note && <p className="mt-0.5 line-clamp-1 text-caption" title={sub.note}>{sub.note}</p>}
                      </div>
                    </td>
                        <td className="px-4 py-3"><p className="max-w-[180px] truncate text-sm text-[var(--color-muted-foreground)]" title={sub.kpiPeriod?.name}>{sub.kpiPeriod?.name || '—'}</p></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">{resultCell(sub)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm tabular-nums text-[var(--color-muted-foreground)]">{formatDateTime(sub.createdAt).split(' ')[0]}</td>
                        <td className="px-4 py-3"><StatusBadge status={sub.status} /></td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{rowActions(sub)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            )}

            <div className={cn('grid grid-cols-1 gap-3', viewMode === 'CARD' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:hidden')}>
              {filteredItems.map(sub => (
                <div key={sub.id} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/submissions/${sub.id}`} className="line-clamp-2 text-sm font-medium text-[var(--color-foreground)]">{sub.kpiCriteriaName}</Link>
                      <p className="mt-0.5 truncate text-caption">{sub.kpiPeriod?.name || '—'} · {formatDateTime(sub.createdAt).split(' ')[0]}</p>
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>
                  {sub.status === 'REJECTED' && sub.reviewNote && <p className="mt-2 line-clamp-2 text-caption text-[var(--color-error)]">Lý do: {sub.reviewNote}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                    {resultCell(sub)}
                    {rowActions(sub)}
                  </div>
                </div>
              ))}
            </div>
          </>
      )}
      </div>

      {data && data.totalElements > pageSize && (
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} totalElements={data.totalElements} size={pageSize} itemLabel="báo cáo" />
        </div>
      )}

      {/* Gửi duyệt là không hoàn tác được → hộp xác nhận chuẩn, nút chính là hành động (không phải phá huỷ) */}
      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        size="sm"
        title="Gửi báo cáo này để duyệt?"
        description="Sau khi gửi, bạn không sửa được nữa cho tới khi quản lý trả lại."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowConfirm(false)}>Hủy</Button>}
            primary={<Button onClick={() => { if (pendingId) { submitMutation.mutate(pendingId); setShowConfirm(false) } }}><Send aria-hidden="true" /> Gửi duyệt</Button>}
          />
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">Quản lý trực tiếp sẽ nhận thông báo và chấm điểm báo cáo này.</p>
      </Dialog>

      {/* Nộp xong báo cáo cuối của đợt → mời tự đánh giá ngay, vì đây là bước kế tiếp trong luồng */}
      <Dialog
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        size="sm"
        title="Đã nộp đủ báo cáo của đợt"
        description="Bạn đã hoàn thành toàn bộ chỉ tiêu trong đợt này."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowSuccess(false)}>Để sau</Button>}
            primary={<Button onClick={() => { setShowSuccess(false); setSelfEvalPeriodId(finishedPeriodId) }}><Star aria-hidden="true" /> Tự đánh giá ngay</Button>}
          />
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">Bước tiếp theo là tự đánh giá kết quả của đợt để quản lý có căn cứ chấm điểm.</p>
      </Dialog>

      <EvaluationFormModal open={!!selfEvalPeriodId} onClose={() => setSelfEvalPeriodId(null)} initialPeriodId={selfEvalPeriodId ?? undefined} />
    </div>
  )
}
