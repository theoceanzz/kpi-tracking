import { useState, useRef, useMemo, useEffect } from 'react'
import PageHeader from '@/components/common/PageHeader'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserTable from '../components/UserTable'
import UserFormModal from '../components/UserFormModal'
import ImportGuideModal from '../components/ImportGuideModal'
import ExcelPreviewModal from '../components/ExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'
import { ROLE_MAP } from '@/constants/roles'
import { useUsers } from '../hooks/useUsers'
import { useOrgUnitTree, useOrgHierarchyLevels } from '@/features/organization/hooks/useOrganizationStructure'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { Plus, Upload, Loader2, Filter, ArrowUpDown, Briefcase } from 'lucide-react'
import type { User } from '@/types/user'
import type { OrgUnitTreeResponse } from '@/features/organization/types/org-unit'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRoles } from '@/features/organization/hooks/useRoles'

export default function UsersPage() {
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [orgUnitFilter, setOrgUnitFilter] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<'A-Z' | 'Z-A'>('A-Z')
  const [page, setPage] = useState(0)
  const size = 10

  const [showForm, setShowForm] = useState(false)
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore(state => state.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: hierarchyLevels } = useOrgHierarchyLevels(organizationId)
  const { data: orgTree } = useOrgUnitTree(organizationId)
  const { data: allRoles } = useRoles()
  const qc = useQueryClient()

  const { hasPermission } = usePermission()
  const isAdmin = useMemo(() => {
    return hasPermission('ROLE:CREATE') || hasPermission('COMPANY:UPDATE') || 
           user?.memberships?.some(m => m.roleName === 'ADMIN' || m.roleName === 'DIRECTOR_SYSTEM') || false
  }, [user, hasPermission])

  const { currentUserLevel, currentUserRank } = useMemo(() => {
    if (!user) return { currentUserLevel: 999, currentUserRank: 999 }
    const levels = user.memberships?.map(m => m.roleLevel ?? 999) || []
    const level = levels.length > 0 ? Math.min(...levels) : 999
    const ranks = user.memberships?.filter(m => (m.roleLevel ?? 999) === level).map(m => m.roleRank ?? 999) || []
    const rank = ranks.length > 0 ? Math.min(...ranks) : 999
    return { currentUserLevel: level, currentUserRank: rank }
  }, [user])

  const assignableRoles = useMemo(() => {
    if (!allRoles) return []
    const activeRoleLevels = new Set(hierarchyLevels?.map(l => l.roleLevel) || [])

    return allRoles.filter((r: any) => {
      // 2. Authority check: Cannot assign roles above or equal to own level/rank
      // DIRECTOR_SYSTEM bypasses this check
      const isDirectorSystem = user?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')
      if (!isDirectorSystem) {
        if (r.level !== undefined && r.level < currentUserLevel) return false
        if (r.level === currentUserLevel && r.rank !== undefined && r.rank <= currentUserRank) return false
      }

      if (isAdmin) return true
      
      // 1. Structural check: Must be in company hierarchy
      if (r.level === undefined || !activeRoleLevels.has(r.level)) return false

      // 2. Authority check: Cannot assign roles above or equal to own level/rank
      if (r.level !== undefined && r.level < currentUserLevel) return false
      if (r.level === currentUserLevel && r.rank !== undefined && r.rank <= currentUserRank) return false
      
      return true
    })
  }, [allRoles, currentUserLevel, currentUserRank, isAdmin, user, hierarchyLevels])

  // Fetch Org Units for filter
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
    organizationId,
    sortBy, 
    direction 
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['users'] }); 
      qc.invalidateQueries({ queryKey: ['organization-users'] }); 
      qc.invalidateQueries({ queryKey: ['stats'] }); 
      toast.success('Đã xoá nhân sự'); 
      setDeleteUser(null) 
    },
    onError: () => toast.error('Xoá thất bại'),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const rootUnitId = orgTree?.[0]?.id
      return userApi.importFile(file, rootUnitId)
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['organization-users'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success(`Import thành công ${result.successfulImports}/${result.totalRows} dòng`)
      if (result.errors.length > 0) {
        result.errors.forEach((e) => toast.error(e))
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Import thất bại'
      toast.error(errorMessage)
    },
  })

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      e.target.value = ''
      setShowImportGuide(false)
    }
  }

  const handleConfirmImport = (modifiedFile: File) => {
    importMutation.mutate(modifiedFile, {
      onSuccess: () => {
        setSelectedFile(null)
      }
    })
  }

  const handleRowClick = (user: User) => {
    setEditUser(user)
    setShowForm(true)
  }

  const handleKeywordChange = (val: string) => {
    setKeyword(val)
    setPage(0)
  }

  const canCreate = hasPermission('USER:CREATE')
  const canImport = hasPermission('USER:IMPORT')
  const canUpdate = hasPermission('USER:UPDATE')
  const canDelete = hasPermission('USER:DELETE')

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
      <div id="tour-users-header">
        <PageHeader
          title="Quản lý Nhân sự"
          description="Cơ sở dữ liệu toàn bộ cán bộ nhân viên"
          action={
            <div className="flex flex-wrap gap-3">
              {canImport && (
                <button
                  id="tour-users-import"
                  onClick={() => setShowImportGuide(true)}
                  disabled={importMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-semibold hover:bg-[var(--color-accent)] transition-all shadow-sm bg-[var(--color-card)]"
                >
                  {importMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Import Hệ thống
                </button>
              )}
              {canCreate && (
                <button
                  id="tour-users-add"
                  onClick={() => { setEditUser(null); setShowForm(true) }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold hover:opacity-90 transition-all shadow-md"
                >
                  <Plus size={16} /> Bổ sung Nhân sự
                </button>
              )}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </div>
          }
        />
      </div>

      <div id="tour-users-filters" className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row flex-wrap gap-4 items-stretch xl:items-center justify-between">
        <div className="flex-1 min-w-[280px]">
          <input
            type="text"
            placeholder="Tìm kiếm theo Tên hoặc Email..."
            value={keyword}
            onChange={(e) => handleKeywordChange(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-medium text-sm focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
                <Select value={roleFilter} onValueChange={handleRoleChange}>
                    <SelectTrigger className="w-full sm:w-[180px] pl-9 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm shadow-sm h-11">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter size={14} className="text-[var(--color-muted-foreground)]" />
                        </div>
                        <SelectValue placeholder="Chức danh" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg">
                        <SelectItem value="ALL" className="font-medium cursor-pointer rounded-lg">Chức danh</SelectItem>
                        {assignableRoles.map(role => (
                          <SelectItem key={role.id} value={role.name} className="font-medium cursor-pointer rounded-lg">
                            {ROLE_MAP[role.name] || role.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="relative flex-1 sm:flex-none">
                <Select value={orgUnitFilter} onValueChange={handleOrgUnitChange}>
                    <SelectTrigger className="w-full sm:w-[220px] pl-9 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm shadow-sm h-11">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Briefcase size={14} className="text-[var(--color-muted-foreground)]" />
                        </div>
                        <SelectValue placeholder="Đơn vị" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                        {allUnits.filter(u => !!u.id).map((unit: OrgUnitTreeResponse) => (
                            <SelectItem key={unit.id} value={unit.id} className="font-medium cursor-pointer rounded-lg">
                                {unit.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="relative flex-1 sm:flex-none">
                <Select value={sortOrder} onValueChange={(v) => handleSortChange(v as 'A-Z' | 'Z-A')}>
                    <SelectTrigger className="w-full sm:w-[150px] pl-9 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] font-semibold text-sm shadow-sm h-11">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <ArrowUpDown size={14} className="text-[var(--color-muted-foreground)]" />
                        </div>
                        <SelectValue placeholder="Sắp xếp" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg">
                        <SelectItem value="A-Z" className="font-medium cursor-pointer rounded-lg">A → Z</SelectItem>
                        <SelectItem value="Z-A" className="font-medium cursor-pointer rounded-lg">Z → A</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>

      <div id="tour-users-table" className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-6"><LoadingSkeleton type="table" rows={6} /></div>
        ) : (
          <>
            <UserTable 
              users={data?.content || []} 
              onRowClick={handleRowClick} 
              onDelete={(u) => setDeleteUser(u)}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
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
      <ExcelPreviewModal 
        open={!!selectedFile} 
        file={selectedFile} 
        onClose={() => setSelectedFile(null)} 
        onImport={handleConfirmImport} 
        isImporting={importMutation.isPending} 
      />

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
