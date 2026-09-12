import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import StatusBadge from '@/components/common/StatusBadge'
import UserAvatar from '@/components/common/UserAvatar'
import { useEmployeeProgress } from '../hooks/useEmployeeProgress'
import { useUsers } from '@/features/users/hooks/useUsers'
import { formatDateTime, cn } from '@/lib/utils'
import { Target, CheckCircle, ChevronLeft, TrendingUp, AlertCircle, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { reminderApi } from '../api/reminderApi'
import type { KpiTask } from '@/types/stats'

export default function EmployeePerformancePage() {
  const { userId } = useParams<{ userId: string }>()
  const [page, setPage] = useState(0)
  const [remindingId, setRemindingId] = useState<string | null>(null)
  const [remindingAll, setRemindingAll] = useState(false)
  const size = 10

  const { data: progress, isLoading: progressLoading } = useEmployeeProgress(userId!, page, size)

  // Also fetch user details to show name
  const { data: usersData } = useUsers({ page: 0, size: 500 })
  const employee = usersData?.content.find(u => u.id === userId)

  if (progressLoading) return <div className="mx-auto max-w-[1400px]"><LoadingSkeleton type="table" rows={8} /></div>

  const tasksData = progress?.tasks
  const tasks = tasksData?.content ?? []
  const totalPages = tasksData?.totalPages ?? 0

  const handleRemind = async (taskId: string) => {
    if (!userId) return
    setRemindingId(taskId)
    try {
      await reminderApi.sendReminder(taskId, userId)
      toast.success('Đã gửi thông báo nhắc nhở nộp KPI')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gửi nhắc nhở thất bại'))
    } finally {
      setRemindingId(null)
    }
  }

  const handleRemindAll = async () => {
    const unfinishedTasks = tasks.filter(t => t.status !== 'APPROVED' && t.status !== 'PENDING' && t.status !== 'REJECTED')
    if (unfinishedTasks.length === 0) {
      toast.info('Không có nhiệm vụ nào cần nhắc nhở')
      return
    }

    setRemindingAll(true)
    try {
      await Promise.all(unfinishedTasks.map(t => reminderApi.sendReminder(t.id, userId!)))
      toast.success(`Đã gửi nhắc nhở cho ${unfinishedTasks.length} nhiệm vụ`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gửi nhắc nhở hàng loạt thất bại'))
    } finally {
      setRemindingAll(false)
    }
  }

  const completion = progress?.totalAssignedKpi ? Math.round(((progress?.approvedSubmissions ?? 0) / progress.totalAssignedKpi) * 100) : 0
  const remindable = tasks.filter(t => t.status !== 'APPROVED' && t.status !== 'PENDING' && t.status !== 'REJECTED')

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* Header: quay lại + nhân sự đang xem (P8) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="outline" size="icon" className="shrink-0">
            <Link to="/dashboard" aria-label="Về Tổng quan"><ChevronLeft aria-hidden="true" /></Link>
          </Button>
          <UserAvatar
            fullName={employee?.fullName}
            avatarUrl={employee?.avatarUrl}
            className="h-11 w-11 shrink-0 rounded-card"
            fallbackClassName="bg-[var(--color-primary-soft)] text-base font-semibold text-[var(--color-primary)]"
          />
          <div className="min-w-0">
            <h1 className="text-page-title truncate">{employee?.fullName ?? 'Nhân sự'}</h1>
            <p className="mt-0.5 truncate text-sm text-[var(--color-muted-foreground)]">{employee?.email}</p>
          </div>
        </div>
        {remindable.length > 0 && (
          <Button variant="outline" className="shrink-0" onClick={handleRemindAll} disabled={remindingAll}>
            <Bell aria-hidden="true" className={cn(remindingAll && 'animate-pulse')} /> Nhắc tất cả ({remindable.length})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Chỉ tiêu được giao" value={progress?.totalAssignedKpi ?? 0} icon={<Target />} color="indigo" />
        <StatCard label="Tỷ lệ hoàn thành" value={`${completion}%`} icon={<TrendingUp />} color="emerald" />
        <StatCard label="Điểm trung bình" value={progress?.averageScore ? Number(progress.averageScore).toFixed(1) : '—'} icon={<CheckCircle />} color="blue" />
        <StatCard label="Bài đã duyệt" value={progress?.approvedSubmissions ?? 0} icon={<CheckCircle />} color="emerald" />
        <StatCard label="Bài quá hạn" value={progress?.lateSubmissions ?? 0} icon={<AlertCircle />} color="red" highlight={(progress?.lateSubmissions ?? 0) > 0} />
      </div>

      <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 className="text-section-title">Tình trạng thực hiện KPI</h2>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">Từng chỉ tiêu được giao, tiến độ nộp bài và hạn.</p>
          </div>
          <span className="text-caption tabular-nums">{tasksData?.totalElements ?? 0} chỉ tiêu</span>
        </div>

        {tasks.length === 0 ? (
          <EmptyState icon={Target} title="Chưa được giao chỉ tiêu nào" description="Khi trưởng đơn vị giao và chỉ tiêu được duyệt, chúng sẽ hiện ở đây." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {tasks.map((task: KpiTask) => {
              const progressPercent = task.expectedSubmissions > 0
                ? Math.min(Math.round((task.submissionCount / task.expectedSubmissions) * 100), 100)
                : 0
              const canRemind = task.status !== 'APPROVED' && task.status !== 'PENDING' && task.status !== 'REJECTED'
              return (
                <li key={task.id} className="flex flex-col gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-muted)] lg:flex-row lg:items-center lg:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--color-foreground)]" title={task.name}>{task.name}</p>
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="mt-0.5 text-caption">
                      {task.periodName}
                      {' · '}Hạn{' '}
                      <span className={cn('tabular-nums', task.status === 'OVERDUE' && 'text-[var(--color-error)]')}>
                        {task.deadline ? formatDateTime(task.deadline).split(' ')[0] : '—'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 lg:w-64">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div
                        className={cn('h-full rounded-full transition-[width]', task.status === 'OVERDUE' ? 'bg-[var(--color-error-solid)]' : progressPercent >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[var(--color-muted-foreground)]">{task.submissionCount}/{task.expectedSubmissions}</span>
                  </div>
                  <div className="flex shrink-0 items-center justify-end">
                    {canRemind && (
                      <Button variant="outline" size="sm" onClick={() => handleRemind(task.id)} disabled={remindingId === task.id}>
                        <Bell aria-hidden="true" className={cn(remindingId === task.id && 'animate-pulse')} /> Nhắc nhở
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="border-t border-[var(--color-border)] px-5 py-3">
            <Pagination currentPage={page} totalPages={totalPages} totalElements={tasksData?.totalElements ?? 0} size={size} onPageChange={setPage} itemLabel="chỉ tiêu" />
          </div>
        )}
      </section>
    </div>
  )
}
