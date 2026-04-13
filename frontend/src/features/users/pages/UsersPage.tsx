import { useState, useRef } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserTable from '../components/UserTable'
import UserFormModal from '../components/UserFormModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useUsers } from '../hooks/useUsers'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { toast } from 'sonner'
import { Plus, Upload, Loader2 } from 'lucide-react'
import type { User } from '@/types/user'

export default function UsersPage() {
  const [keyword, setKeyword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useUsers({ keyword, page: 0, size: 20 })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Đã xoá nhân sự'); setDeleteUser(null) },
    onError: () => toast.error('Xoá thất bại'),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => userApi.importFile(file),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Import thành công ${result.successfulImports}/${result.totalRows} dòng`)
      if (result.errors.length > 0) {
        result.errors.forEach((e) => toast.error(e))
      }
    },
    onError: () => toast.error('Import thất bại'),
  })

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      importMutation.mutate(file)
      e.target.value = ''
    }
  }

  const handleRowClick = (user: User) => {
    setEditUser(user)
    setShowForm(true)
  }

  return (
    <div>
      <PageHeader
        title="Quản lý nhân sự"
        description="Danh sách toàn bộ nhân viên trong công ty"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-accent)] transition"
            >
              {importMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import Excel
            </button>
            <button
              onClick={() => { setEditUser(null); setShowForm(true) }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition"
            >
              <Plus size={16} /> Thêm nhân sự
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </div>
        }
      />

      <div className="mb-4">
        <input
          type="text"
          placeholder="Tìm kiếm theo tên hoặc email..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={5} />
      ) : (
        <UserTable users={data?.content ?? []} onRowClick={handleRowClick} onDelete={(u) => setDeleteUser(u)} />
      )}

      <UserFormModal open={showForm} onClose={() => { setShowForm(false); setEditUser(null) }} editUser={editUser} />

      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
        title="Xoá nhân sự"
        description={`Bạn có chắc muốn xoá "${deleteUser?.fullName}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
