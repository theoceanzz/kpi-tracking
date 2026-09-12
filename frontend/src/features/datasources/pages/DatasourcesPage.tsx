import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Database, Plus, Trash2, Edit, Table2, BarChart3 } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import EntityCard from '@/components/common/EntityCard'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDatasources } from '../hooks/useDatasources'
import { useCreateDatasource, useDeleteDatasource } from '../hooks/useDatasourceMutations'
import { createDatasourceSchema, type CreateDatasourceFormData } from '../schemas/datasourceSchema'
import type { Datasource } from '@/types/datasource'

export default function DatasourcesPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useDatasources({ page, size: 20 })
  const createMutation = useCreateDatasource()
  const deleteMutation = useDeleteDatasource()

  const filtered = data?.content?.filter(ds =>
    ds.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateDatasourceFormData>({
    resolver: zodResolver(createDatasourceSchema),
    defaultValues: { name: '', description: '' },
  })

  const handleCreate = handleSubmit((data) => {
    createMutation.mutate({ name: data.name, description: data.description || undefined }, {
      onSuccess: () => { setShowCreate(false); reset({ name: '', description: '' }) }
    })
  })

  const getTypeIcon = (ds: Datasource) => ((ds.columns?.length || 0) === 0 ? <Table2 /> : <Database />)

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        title="Nguồn dữ liệu"
        description="Bảng dữ liệu nhập tay như Excel, dùng làm nguồn cho báo cáo thống kê."
        stats={[{ label: 'Nguồn dữ liệu', value: data?.totalElements ?? 0, icon: Database }]}
        actions={<Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> Tạo nguồn dữ liệu</Button>}
      />

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Tìm nguồn dữ liệu…' }} />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 animate-pulse rounded-card bg-[var(--color-muted)]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={Database}
            title={search ? 'Không tìm thấy nguồn dữ liệu' : 'Chưa có nguồn dữ liệu nào'}
            description={search ? 'Thử từ khoá khác hoặc xoá tìm kiếm.' : 'Tạo nguồn dữ liệu đầu tiên rồi thêm cột và nhập liệu.'}
            action={!search ? <Button onClick={() => setShowCreate(true)}><Plus aria-hidden="true" /> Tạo nguồn dữ liệu</Button> : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(ds => (
            <EntityCard
              key={ds.id}
              leading={ds.icon ? <span className="text-lg">{ds.icon}</span> : getTypeIcon(ds)}
              title={ds.name}
              description={ds.description}
              meta={<><span className="flex items-center gap-1"><Table2 size={12} aria-hidden="true" /> {ds.columns?.length || 0} cột</span><span className="flex items-center gap-1"><BarChart3 size={12} aria-hidden="true" /> {ds.rowCount} hàng</span></>}
              footerLeft={ds.orgUnitName}
              footerRight={new Date(ds.createdAt).toLocaleDateString('vi-VN')}
              onOpen={() => navigate(`/datasources/${ds.id}`)}
              menu={[
                { label: 'Mở & chỉnh sửa', icon: <Edit />, onClick: () => navigate(`/datasources/${ds.id}`) },
                { label: 'Xoá', icon: <Trash2 />, destructive: true, onClick: () => setDeleteId(ds.id) },
              ]}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination currentPage={page} totalPages={data.totalPages} totalElements={data.totalElements} size={20} onPageChange={setPage} itemLabel="nguồn dữ liệu" />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { if (deleteId) deleteMutation.mutate(deleteId, { onSettled: () => setDeleteId(null) }) }}
        title="Xoá nguồn dữ liệu?"
        description="Toàn bộ cột và dòng dữ liệu sẽ bị xoá. Báo cáo đang dùng nguồn này sẽ mất biểu đồ liên quan."
        confirmLabel="Xoá nguồn dữ liệu"
        loading={deleteMutation.isPending}
      />

      {/* Tạo mới */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        size="md"
        dismissible={!createMutation.isPending}
        title="Tạo Datasource mới"
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowCreate(false)} disabled={createMutation.isPending}>Hủy</Button>}
            primary={<Button onClick={handleCreate} disabled={createMutation.isPending}>{createMutation.isPending ? 'Đang tạo...' : 'Tạo'}</Button>}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-label block font-medium mb-1.5">Tên datasource <span className="text-[var(--color-error)]">*</span></label>
            <input
              type="text"
              {...register('name')}
              placeholder="VD: Doanh thu Q1 2026"
              className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
              autoFocus
            />
            {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-label block font-medium mb-1.5">Mô tả</label>
            <textarea
              {...register('description')}
              placeholder="Mô tả ngắn gọn..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 resize-none"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
