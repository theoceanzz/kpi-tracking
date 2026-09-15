import { useState, useRef, useMemo, useEffect } from 'react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import UserTable from '../components/UserTable'
import UserFormModal from '../components/UserFormModal'
import ImportGuideModal from '../components/ImportGuideModal'
import ExcelPreviewModal from '../components/ExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Pagination from '@/components/common/Pagination'

import { useUsers } from '../hooks/useUsers'
import { useOrgUnitTree, useOrgHierarchyLevels } from '@/features/organization/hooks/useOrganizationStructure'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { Plus, Upload, Loader2, Users } from 'lucide-react'
import type { User } from '@/types/user'
import type { OrgUnitTreeResponse } from '@/features/organization/types/org-unit'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRoles } from '@/features/organization/hooks/useRoles'
import { Button } from '@/components/ui/button'

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
  const pageTitle = usePageTitle('users', 'Quản lý nhân sự')
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

  const orgUnitCodeMap = useMemo(() => {
    const map: Record<string, string> = {}
    allUnits.forEach(u => {
      if (u.id && u.code) map[u.id] = u.code
    })
    return map
  }, [allUnits])

  const rootUnitId = useMemo(() => orgTree?.[0]?.id, [orgTree])

  // Fetch users with full parameters
  const { data, isLoading } = useUsers({
    keyword,
    page,
    size,
    role: roleFilter,
    // BE nhận orgUnitIds (List) — gửi orgUnitId số ít sẽ bị bỏ qua và không lọc được.
    orgUnitIds: orgUnitFilter === 'ALL' ? undefined : [orgUnitFilter],
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
    onError: (error) => toast.error(getApiErrorMessage(error, 'Xoá người dùng thất bại')),
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

      // Only show success toast if at least one row was actually imported
      if (result.successfulImports > 0) {
        toast.success(`Import thành công ${result.successfulImports}/${result.totalRows} dòng`)
      }

      // Handle errors more gracefully to avoid toast spam
      if (result.errors && result.errors.length > 0) {
        if (result.errors.length <= 3) {
          // If only a few errors, show them individually
          result.errors.forEach((e) => toast.error(e))
        } else {
          // If many errors, show a summary and log details to console (or could show in a modal)
          toast.error(`Phát hiện ${result.errors.length} lỗi trong quá trình import. Vui lòng kiểm tra lại dữ liệu.`)
          console.error('Import Errors:', result.errors)
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = getApiErrorMessage(error, 'Import thất bại')
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
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-users-header"
        title={pageTitle}
        description="Toàn bộ nhân sự của tổ chức: đơn vị, chức danh và trạng thái tài khoản."
        stats={[{ label: 'Nhân sự', value: data?.totalElements ?? 0, icon: Users }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canImport && (
              <Button variant="outline" id="tour-users-import" onClick={() => setShowImportGuide(true)} disabled={importMutation.isPending}>
                {importMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
                Nhập Excel
              </Button>
            )}
            {canCreate && (
              <Button id="tour-users-add" onClick={() => { setEditUser(null); setShowForm(true) }}>
                <Plus aria-hidden="true" /> Thêm nhân sự
              </Button>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </div>
        }
      />

      <FilterBar id="tour-users-filters" search={{ value: keyword, onChange: handleKeywordChange, placeholder: 'Tìm theo tên hoặc email…' }}>
        <Select value={roleFilter} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Chức danh"><SelectValue placeholder="Chức danh" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Mọi chức danh</SelectItem>
            {assignableRoles.map(role => <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={orgUnitFilter} onValueChange={handleOrgUnitChange}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Đơn vị"><SelectValue placeholder="Đơn vị" /></SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {allUnits.filter(u => !!u.id).map((unit: OrgUnitTreeResponse) => (
              <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(v) => handleSortChange(v as 'A-Z' | 'Z-A')}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Sắp xếp"><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="A-Z">Tên A → Z</SelectItem>
            <SelectItem value="Z-A">Tên Z → A</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div id="tour-users-table" className="space-y-4">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : (
          <>
            <UserTable
              users={data?.content || []}
              onRowClick={handleRowClick}
              onDelete={(u) => setDeleteUser(u)}
              canUpdate={canUpdate}
              canDelete={canDelete}
              orgUnitMap={orgUnitCodeMap}
              rootUnitId={rootUnitId}
            />
            {data && data.totalPages > 1 && (
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
        title="Xoá nhân sự khỏi hệ thống?"
        description={`"${deleteUser?.fullName}" sẽ không đăng nhập được nữa. Lịch sử KPI, bài nộp và đánh giá của người này vẫn được lưu.`}
        confirmLabel="Xoá nhân sự"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
