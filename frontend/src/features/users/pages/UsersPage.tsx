import { useState, useRef, useMemo, useEffect } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserTable from '../components/UserTable'
import UserFormModal from '../components/UserFormModal'
import ImportGuideModal from '../components/ImportGuideModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'
import { useUsers } from '../hooks/useUsers'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { Plus, Upload, Loader2, Filter, ArrowUpDown, Briefcase } from 'lucide-react'
import type { User } from '@/types/user'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import { toast } from 'sonner'

export default function UsersPage() {
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [orgUnitFilter, setOrgUnitFilter] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<'A-Z' | 'Z-A'>('A-Z')
  const [page, setPage] = useState(0)
  const size = 5

  const [showForm, setShowForm] = useState(false)
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  // Fetch Org Units for filter
  const { data: orgTree } = useOrgUnitTree()
  const allUnits = useMemo(() => {
    const flatten = (items: OrgUnitTreeResponse[]): OrgUnitTreeResponse[] => {
      return items.reduce((acc, item) => [
        ...acc, 
        item, 
        ...flatten(item.children || [])
      ], [] as OrgUnitTreeResponse[])
    }
    return flatten(orgTree || [])
  }, [orgTree])

  // Set default org unit to the first one (Chi nhánh Hà Nội)
  useEffect(() => {
    const firstUnitId = orgTree?.[0]?.id
    if (firstUnitId && orgUnitFilter === 'ALL') {
      setOrgUnitFilter(firstUnitId)
    }
  }, [orgTree, orgUnitFilter])

  // Map sort order to backend parameters
  const sortBy = 'fullName'
  const direction = sortOrder === 'A-Z' ? 'asc' : 'desc'

  // Fetch users with full parameters
  const { data, isLoading } = useUsers({ 
    keyword, 
    page, 
    size, 
    role: roleFilter, 
    orgUnitId: orgUnitFilter === 'ALL' ? undefined : orgUnitFilter,
    sortBy, 
    direction 
  })

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

  const handleKeywordChange = (val: string) => {
    setKeyword(val)
    setPage(0)
  }

  const handleRoleChange = (val: string) => {
    setRoleFilter(val)
    setPage(0)
  }

  const handleOrgUnitChange = (val: string) => {
    setOrgUnitFilter(val)
    setPage(0)
  }

  const handleSortChange = (val: 'A-Z' | 'Z-A') => {
    setSortOrder(val)
    setPage(0)
  }

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
            onChange={(e) => handleKeywordChange(e.target.value)}
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
                    onChange={e => handleRoleChange(e.target.value)}
                    className="pl-9 pr-8 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all cursor-pointer"
                >
                    <option value="ALL">Lọc theo chức danh</option>
                    <option value="HEAD">Trưởng phòng</option>
                    <option value="DEPUTY">Phó phòng</option>
                    <option value="STAFF">Nhân viên</option>
                </select>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase size={14} className="text-[var(--color-muted-foreground)]" />
                </div>
                <select 
                    value={orgUnitFilter} 
                    onChange={e => handleOrgUnitChange(e.target.value)}
                    className="pl-9 pr-8 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm appearance-none outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 transition-all cursor-pointer min-w-[240px]"
                >
                    {allUnits.map((unit: OrgUnitTreeResponse) => (
                        <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                </select>
            </div>

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ArrowUpDown size={14} className="text-[var(--color-muted-foreground)]" />
                </div>
                <select 
                    value={sortOrder} 
                    onChange={e => handleSortChange(e.target.value as 'A-Z' | 'Z-A')}
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
          <>
            <UserTable users={data?.content || []} onRowClick={handleRowClick} onDelete={(u) => setDeleteUser(u)} />
            {data && (
               <Pagination 
                currentPage={page}
                totalPages={data.totalPages}
                totalElements={data.totalElements}
                size={size}
                onPageChange={setPage}
               />
            )}
          </>
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
