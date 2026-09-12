import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Plus, Trash2, Edit, FileBarChart } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import EntityCard from '@/components/common/EntityCard'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useReports } from '../hooks/useReports'
import { useCreateReport, useDeleteReport } from '../hooks/useReportMutations'
import { createReportSchema, type CreateReportFormData } from '../schemas/reportSchema'

const STATUS_LABELS: Record<string, { label: string; variant: 'warning' | 'success' | 'secondary' }> = {
  DRAFT: { label: 'Nháp', variant: 'warning' },
  PUBLISHED: { label: 'Đã xuất bản', variant: 'success' },
  ARCHIVED: { label: 'Lưu trữ', variant: 'secondary' },
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useReports({ page, size: 20 })
  const createMutation = useCreateReport()
  const deleteMutation = useDeleteReport()

  const filtered = data?.content?.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateReportFormData>({
    resolver: zodResolver(createReportSchema),
    defaultValues: { name: '', description: '' },
  })

  const handleCreate = handleSubmit((data) => {
    createMutation.mutate({ name: data.name, description: data.description || undefined }, {
      onSuccess: (report) => {
        setShowCreate(false)
        reset({ name: '', description: '' })
        navigate(`/reports/${report.id}`)
      }
    })
  })

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title="Báo cáo thống kê"
        description="Bảng điều khiển gồm các biểu đồ dựng từ nguồn dữ liệu đã tạo."
        stats={[{ label: 'Báo cáo', value: data?.totalElements ?? 0, icon: FileBarChart }]}
        actions={<Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> Tạo báo cáo</Button>}
      />

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Tìm báo cáo…' }} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-card bg-[var(--color-muted)]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={FileBarChart}
            title={search ? 'Không tìm thấy báo cáo' : 'Chưa có báo cáo nào'}
            description={search ? 'Thử từ khoá khác hoặc xoá tìm kiếm.' : 'Tạo báo cáo đầu tiên, kết nối nguồn dữ liệu rồi thêm biểu đồ.'}
            action={!search ? <Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> Tạo báo cáo</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(report => {
            const st = STATUS_LABELS[report.status]
            return (
              <EntityCard
                key={report.id}
                leading={<BarChart3 />}
                title={report.name}
                description={report.description}
                meta={<><span>{report.datasources?.length || 0} nguồn dữ liệu</span><span aria-hidden="true">·</span><span>{report.widgets?.length || 0} biểu đồ</span></>}
                footerLeft={<Badge variant={st?.variant ?? 'secondary'}>{st?.label ?? report.status}</Badge>}
                footerRight={new Date(report.createdAt).toLocaleDateString('vi-VN')}
                onOpen={() => navigate(`/reports/${report.id}`)}
                menu={[
                  { label: 'Mở & chỉnh sửa', icon: <Edit />, onClick: () => navigate(`/reports/${report.id}`) },
                  { label: 'Xoá', icon: <Trash2 />, destructive: true, onClick: () => setDeleteId(report.id) },
                ]}
              />
            )
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} itemLabel="báo cáo" />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) }) }}
        title="Xoá báo cáo?"
        description="Các biểu đồ trong báo cáo sẽ bị xoá; nguồn dữ liệu đã kết nối vẫn được giữ nguyên."
        confirmLabel="Xoá báo cáo"
        loading={deleteMutation.isPending}
      />

      {/* Tạo mới */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="md"
        dismissible={!createMutation.isPending}
        title="Tạo Báo cáo mới"
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowCreate(false)} disabled={createMutation.isPending}>Hủy</Button>}
            primary={<Button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? 'Đang tạo...' : 'Tạo'}</Button>}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-label block font-medium mb-1.5">Tên báo cáo <span className="text-[var(--color-error)]">*</span></label>
            <input {...register('name')} placeholder="VD: Báo cáo doanh thu Q1" className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30" autoFocus />
            {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-label block font-medium mb-1.5">Mô tả</label>
            <textarea {...register('description')} placeholder="Mô tả ngắn gọn..." rows={3} className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none" />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
