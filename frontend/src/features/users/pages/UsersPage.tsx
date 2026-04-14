import { useState, useRef, useMemo } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserTable from '../components/UserTable'
import UserFormModal from '../components/UserFormModal'
import ImportGuideModal from '../components/ImportGuideModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useUsers } from '../hooks/useUsers'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { useAuthStore } from '@/store/authStore'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { toast } from 'sonner'
import { Plus, Upload, Loader2, Filter, ArrowUpDown } from 'lucide-react'
import type { User } from '@/types/user'

export default function UsersPage() {
  const { user: authUser } = useAuthStore()
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<'A-Z' | 'Z-A'>('A-Z')

  const [showForm, setShowForm] = useState(false)
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  // Fetch all users 
  const { data, isLoading } = useUsers({ keyword, page: 0, size: 500 })
  const { data: deptData } = useDepartments(0, 1000)

  const departmentMap = useMemo(() => {
     const map: Record<string, string> = {}
     if (deptData?.content) {
        deptData.content.forEach(dept => {
           dept.members?.forEach(m => {
              map[m.userId] = dept.name
           })
        })
     }
     return map
  }, [deptData])

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

  // Client-side filtering & sorting
  const processedUsers = useMemo(() => {
    if (!data?.content) return []

    let result = data.content.filter(u => u.id !== authUser?.id && u.role !== 'DIRECTOR')

    if (roleFilter !== 'ALL') {
      result = result.filter(u => u.role === roleFilter)
    }

    result.sort((a, b) => {
      const nameA = a.fullName?.toLowerCase() || ''
      const nameB = b.fullName?.toLowerCase() || ''
      if (sortOrder === 'A-Z') return nameA.localeCompare(nameB)
      return nameB.localeCompare(nameA)
    })

    return result
  }, [data?.content, authUser?.id, roleFilter, sortOrder])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Nhân sự"
        description="Cơ sở dữ liệu toàn bộ cán bộ nhân viên"
        action={
          <div className="flex gap-3">
            <button
              onClick={() => setShowImportGuide(true)}
              disabled={importMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold hover:bg-[var(--color-accent)] transition-all shadow-sm bg-[var(--color-card)]"
            >
              {importMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import Hệ thống
            </button>
            <button
              onClick={() => { setEditUser(null); setShowForm(true) }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-md"
            >
              <Plus size={16} /> Bổ sung Nhân sự
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </div>
        }
      />

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-auto">
          <input
            type="text"
            placeholder="Tìm kiếm theo Tên hoặc Email..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full min-w-[300px] px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-medium text-sm focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] outline-none transition-all"
          />
        </div>

        <div className="flex w-full md:w-auto gap-3 items-center">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Filter size={14} className="text-[var(--color-muted-foreground)]" />
                </div>
                <select 
                    value={roleFilter} 
                    onChange={e => setRoleFilter(e.target.value)}
                    className="pl-9 pr-8 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all cursor-pointer"
                >
                    <option value="ALL">Tất cả chức vụ</option>
                    <option value="HEAD">Trưởng phòng</option>
                    <option value="DEPUTY">Phó phòng</option>
                    <option value="STAFF">Nhân viên</option>
                </select>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ArrowUpDown size={14} className="text-[var(--color-muted-foreground)]" />
                </div>
                <select 
                    value={sortOrder} 
                    onChange={e => setSortOrder(e.target.value as 'A-Z' | 'Z-A')}
                    className="pl-9 pr-8 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all cursor-pointer"
                >
                    <option value="A-Z">Tên A đến Z</option>
                    <option value="Z-A">Tên Z đến A</option>
                </select>
            </div>
        </div>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton type="table" rows={6} /></div>
        ) : (
          <UserTable users={processedUsers} departmentMap={departmentMap} onRowClick={handleRowClick} onDelete={(u) => setDeleteUser(u)} />
        )}
      </div>

      <UserFormModal open={showForm} onClose={() => { setShowForm(false); setEditUser(null) }} editUser={editUser} />
      <ImportGuideModal open={showImportGuide} onClose={() => setShowImportGuide(false)} onSelectFile={() => fileRef.current?.click()} />

      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
        title="Tiến hành Xoá Nhân sự"
        description={`Bạn có chắc chắn muốn rời "${deleteUser?.fullName}" khỏi hệ thống? Hành động này không thể hoàn tác nhưng quy trình của họ vẫn sẽ được lưu trữ.`}
        confirmLabel="Đồng ý Xoá"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
