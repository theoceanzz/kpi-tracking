import { useState, useMemo } from 'react'
import { 
  Shield, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShieldCheck,
  AlertCircle,
  Loader2,
  Key,
  Layers,
  Filter,
  History,
  Lock,
  MoreVertical,
  Zap
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../hooks/useRoles'
import { useOrgHierarchyLevels } from '../hooks/useOrganizationStructure'
import { useAuthStore } from '@/store/authStore'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '../hooks/usePageTitle'
import { RoleResponse } from '../api/role.api'
import RolePermissionDrawer from '../components/RolePermissionDrawer'
import HierarchyPermissionModal from '../components/HierarchyPermissionModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChoiceChip } from '@/components/ui/choice-chip'

export default function RoleManagementPage() {
  const { refreshUser } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPermissionDrawerOpen, setIsPermissionDrawerOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null)
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleResponse | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; role: RoleResponse | null }>({
    isOpen: false,
    role: null
  })
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{ name: string; level: number; rank: number }>({ 
    name: '', 
    level: 2,
    rank: 2
  })
  
  const { data: roles = [], isLoading } = useRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()

  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: hierarchyLevels = [] } = useOrgHierarchyLevels(orgId)

  const rawTitle = usePageTitle('roles', 'Phân quyền vai trò')

  const filteredRoles = useMemo(() => {
    // Get unique role levels from organization hierarchy
    const activeRoleLevels = new Set(hierarchyLevels.map(l => l.roleLevel))
    
    return roles.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      if (activeRoleLevels.size > 0) {
        // Only show roles that belong to the active hierarchy levels
        if (r.isSystem && r.name === 'DIRECTOR_SYSTEM') return false
        
        if (r.level === undefined) return false
        return activeRoleLevels.has(r.level as number)
      }
      return true
    })
  }, [roles, hierarchyLevels, searchQuery])
  
  const getLevelInfo = (level: number | undefined) => {
    if (level === undefined) return { label: 'N/A', color: 'gray' }
    const hl = hierarchyLevels.find(l => l.roleLevel === level)
    if (!hl) return { label: 'Khác', color: 'gray' }
    
    // Determine relative position for colors
    const levels = [...new Set(hierarchyLevels.map(l => l.roleLevel))].sort((a, b) => a - b)
    const index = levels.indexOf(level)
    
    if (index === 0) return { label: hl.unitTypeName, color: 'rose' }
    if (index === levels.length - 1) return { label: hl.unitTypeName, color: 'emerald' }
    return { label: hl.unitTypeName, color: 'amber' }
  }

  // Stats calculation
  const stats = useMemo(() => ({
    total: filteredRoles.length,
    system: filteredRoles.filter(r => r.isSystem).length,
    custom: filteredRoles.filter(r => !r.isSystem).length,
    highLevel: filteredRoles.filter(r => r.level === 0).length
  }), [filteredRoles])



  const handleOpenModal = (role?: RoleResponse) => {
    if (role) {
      setEditingRole(role)
      setFormData({ 
        name: role.name, 
        level: role.level ?? 2,
        rank: role.rank ?? 2
      })
    } else {
      setEditingRole(null)
      setFormData({ name: '', level: 2, rank: 2 })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Vui lòng nhập tên vai trò')
      return
    }

    // Validation: 1 level can only have 1 rank 0 and 1 rank 1
    if (formData.rank !== 2) {
      const duplicate = roles.find(r => 
        r.level === formData.level && 
        r.rank === formData.rank && 
        r.id !== editingRole?.id
      )
      if (duplicate) {
        const rankName = formData.rank === 0 ? "TRƯỞNG" : "PHÓ"
        toast.error(`Mỗi phân cấp chỉ được phép có tối đa 1 ${rankName}. Hiện tại đã có vai trò "${duplicate.name}" ở phân cấp này.`)
        return
      }
    }
    try {
        if (editingRole) {
        await updateMutation.mutateAsync({
          roleId: editingRole.id,
          payload: { 
            name: formData.name, 
            level: formData.level, 
            rank: formData.rank
          }
        })
      } else {
        await createMutation.mutateAsync({ 
          name: formData.name, 
          level: formData.level, 
          rank: formData.rank
        })
      }
      setIsModalOpen(false)
      // Refresh current user info in case their own role was renamed
      refreshUser()
    } catch { /* lỗi ở đây không đổi được gì cho người dùng */ }
  }

  const handleDelete = (role: RoleResponse) => {
    if (role.isSystem) return
    setDeleteConfirm({ isOpen: true, role })
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirm.role) {
      try {
        await deleteMutation.mutateAsync(deleteConfirm.role.id)
        setDeleteConfirm({ isOpen: false, role: null })
      } catch { /* lỗi ở đây không đổi được gì cho người dùng */ }
    }
  }

  const handleOpenPermissions = (role: RoleResponse) => {
    setSelectedRoleForPerms(role)
    setIsPermissionDrawerOpen(true)
  }

  return (
    // Không tự bọc `max-w`: trang này nằm trong khung Thiết lập công ty, khung đó đã lo
    // bề ngang. Bọc thêm ở đây làm cả trang hẹp hơn và lệch mép so với hàng tab bên trên.
    <div className="space-y-5 pb-12">
      <WorkspaceHeader
        id="tour-roles-header"
        title={rawTitle}
        description="Vai trò và quyền hạn kèm theo từng vai trò. Quyền theo phân cấp áp cho mọi vai trò cùng cấp."
        stats={[
          { label: 'Vai trò', value: stats.total, icon: Layers },
          { label: 'Hệ thống', value: stats.system, icon: Lock },
          { label: 'Tuỳ chỉnh', value: stats.custom, icon: ShieldCheck },
          { label: 'Cấp lãnh đạo', value: stats.highLevel, icon: Key },
        ]}
        actions={
          /* Hai nút đi chung một cụm để khi thiếu chỗ thì cùng xuống hàng, không tách mỗi nút một nơi quanh dãy số liệu. */
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" id="tour-roles-hierarchy-btn" onClick={() => setIsHierarchyModalOpen(true)}>
              <Zap aria-hidden="true" /> Quyền theo phân cấp
            </Button>
            <Button onClick={() => handleOpenModal()}><Plus aria-hidden="true" /> Thêm vai trò</Button>
          </div>
        }
      />

      {/* Main Content Area */}
      <div id="tour-roles-table" className="bg-[var(--color-card)] rounded-card shadow-sm border border-[var(--color-border)] overflow-hidden">
        {/* Advanced Toolbar */}
        <div className="p-4 bg-[var(--color-muted)] flex flex-col md:flex-row gap-4 justify-between items-center border-b border-[var(--color-border)]">
          <div className="relative w-full md:w-[450px] group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-[18px] h-[18px] text-[var(--color-subtle-foreground)] group-focus-within:text-[var(--color-primary)] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên vai trò hoặc định danh..."
              className="w-full pl-12 pr-6 py-2.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-card outline-none focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] transition-all font-medium text-sm shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
             <div className="text-eyebrow flex items-center gap-1.5 px-4 py-2 rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
               <Filter size={14} />
               Phân loại
             </div>
             <div className="h-8 w-px bg-[var(--color-border)] mx-1" />
             <div className="text-xs font-medium text-[var(--color-subtle-foreground)]">
               Hiển thị <span className="text-[var(--color-foreground)]">{filteredRoles.length}</span> kết quả
             </div>
          </div>
        </div>

        {/* Premium Table Container */}
        <div className="hidden md:block overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-muted)] text-eyebrow whitespace-nowrap">
                <th className="px-6 py-4 border-b border-[var(--color-border)]">Thông tin vai trò</th>
                <th className="px-6 py-4 border-b border-[var(--color-border)] text-center">Vị trí</th>
                <th className="px-6 py-4 border-b border-[var(--color-border)]">Phân cấp hệ thống</th>
                <th className="px-6 py-4 border-b border-[var(--color-border)]">Ngày tạo</th>
                <th className="px-6 py-4 border-b border-[var(--color-border)] text-right">Quản lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 border-4 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
                      <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--color-primary)] w-6 h-6" />
                    </div>
                    <p className="text-eyebrow text-[var(--color-muted-foreground)] mt-4 animate-pulse">Đang tải dữ liệu vai trò...</p>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 bg-[var(--color-muted)] rounded-card flex items-center justify-center text-[var(--color-subtle-foreground)]">
                        <Shield size={40} />
                      </div>
                      <div>
                        <p className="text-section-title text-[var(--color-muted-foreground)]">Không tìm thấy vai trò</p>
                        <p className="text-[var(--color-subtle-foreground)] font-medium mt-1">Thử thay đổi từ khóa tìm kiếm của bạn.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role, index) => (
                  <tr key={role.id} className="group hover:bg-[var(--color-primary-soft)] transition-all duration-300">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-card flex items-center justify-center transition-all duration-500 shadow-sm",
                          role.isSystem 
                            ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rotate-3 group-hover:rotate-0"
                            : "bg-[var(--color-card)] text-[var(--color-primary)] border border-[var(--color-border)] group-hover:border-[var(--color-primary)] group-hover:shadow-md"
                        )}>
                          {role.isSystem ? <ShieldCheck size={24} /> : <Shield size={24} />}
                        </div>
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                             <span className="font-semibold text-[var(--color-foreground)] text-base whitespace-nowrap">{role.name}</span>
                             {role.isSystem && (
                               <span className="px-2 py-0.5 bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium rounded-control border border-[var(--color-border)] flex items-center gap-1">
                                 <Lock size={8} /> Hệ thống
                               </span>
                             )}
                           </div>
                            {/* <span className="text-caption tracking-wider font-mono">ID: {role.id.split('-')[0]}</span> */}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={cn(
"text-eyebrow inline-flex px-3 py-1 rounded-full border whitespace-nowrap",
                        role.rank === 0 ? "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)]" :
                        role.rank === 1 ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]" :
                        "bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] border-[var(--color-border)]"
                      )}>
                        {role.rank === 0 ? 'Trưởng' : role.rank === 1 ? 'Phó' : 'Thành viên'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const info = getLevelInfo(role.level);
                        return (
                          <div className={cn(
"text-eyebrow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border transition-colors whitespace-nowrap",
                            info.color === 'rose' ? "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]" :
                            info.color === 'amber' ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]" :
                            "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                              info.color === 'rose' ? "bg-[var(--color-error-solid)]" : 
                              info.color === 'amber' ? "bg-[var(--color-warning-solid)]" : "bg-[var(--color-success-solid)]"
                            )} />
                            {info.label}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-[var(--color-muted-foreground)] whitespace-nowrap">
                         <History size={14} className="text-[var(--color-subtle-foreground)]" />
                         <span className="font-medium text-sm">{format(new Date(role.createdAt), 'dd MMM, yyyy', { locale: vi })}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <div className="relative">
                          <ChoiceChip selected={activeMenuId === role.id} variant="solid" onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === role.id ? null : role.id);
                            }}>
                            <MoreVertical />
                          </ChoiceChip>

                          {activeMenuId === role.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                              <div className={cn(
                                "absolute right-0 w-56 bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] py-2 z-20 animate-in fade-in zoom-in-95 duration-200",
                                index >= filteredRoles.length / 2 ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
                              )}>
                                <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" onClick={() => {
                                    handleOpenPermissions(role);
                                    setActiveMenuId(null);
                                  }}>
                                  <div className="w-8 h-8 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
                                    <Key aria-hidden="true" />
                                  </div>
                                  Phân quyền
                                </button>
                                
                                <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" onClick={() => {
                                    handleOpenModal(role);
                                    setActiveMenuId(null);
                                  }}>
                                  <div className="w-8 h-8 rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)] flex items-center justify-center">
                                    <Edit2 aria-hidden="true" />
                                  </div>
                                  Chỉnh sửa
                                </button>

                                {!role.isSystem ? (
                                  <>
                                    <div className="h-px bg-[var(--color-muted)] my-1 mx-4" />
                                    <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => {
                                        handleDelete(role);
                                        setActiveMenuId(null);
                                      }}>
                                      <div className="w-8 h-8 rounded-control bg-[var(--color-error-bg)] text-[var(--color-error)] flex items-center justify-center">
                                        <Trash2 aria-hidden="true" />
                                      </div>
                                      Xóa vai trò
                                    </button>
                                  </>
                                ) : (
                                  <div className="text-eyebrow px-4 py-3 mt-1 border-t border-gray-50 bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] flex items-center gap-2">
                                    <AlertCircle size={14} className="text-[var(--color-subtle-foreground)]" />
                                    Hệ thống bảo vệ
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden min-h-[400px]">
          {isLoading ? (
            <div className="py-24 text-center">
              <div className="relative inline-block">
                <div className="w-16 h-16 border-4 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
                <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--color-primary)] w-6 h-6" />
              </div>
              <p className="text-eyebrow text-[var(--color-muted-foreground)] mt-4 animate-pulse">Đang tải dữ liệu vai trò...</p>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="px-8 py-20 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-[var(--color-muted)] rounded-card flex items-center justify-center text-[var(--color-subtle-foreground)]">
                  <Shield size={40} />
                </div>
                <div>
                  <p className="text-section-title text-[var(--color-muted-foreground)]">Không tìm thấy vai trò</p>
                  <p className="text-[var(--color-subtle-foreground)] font-medium mt-1">Thử thay đổi từ khóa tìm kiếm của bạn.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {filteredRoles.map((role, index) => {
                const info = getLevelInfo(role.level)
                const isMenuOpen = activeMenuId === role.id
                return (
                  <div key={role.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                          "w-9 h-9 rounded-card flex items-center justify-center shadow-sm shrink-0",
                          role.isSystem ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "bg-[var(--color-card)] text-[var(--color-primary)] border border-[var(--color-border)]"
                        )}>
                          {role.isSystem ? <ShieldCheck size={17} /> : <Shield size={17} />}
                        </div>
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="font-semibold text-[var(--color-foreground)] text-sm truncate">{role.name}</span>
                          {role.isSystem && (
                            <span className="px-1.5 py-0.5 bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-medium rounded-control border border-[var(--color-border)] flex items-center gap-0.5 shrink-0">
                              <Lock size={7} /> Hệ thống
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative shrink-0">
                        <ChoiceChip selected={isMenuOpen} variant="solid" onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : role.id) }}>
                          <MoreVertical />
                        </ChoiceChip>
                        {isMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                            <div className={cn(
                              "absolute right-0 w-56 bg-[var(--color-card)] rounded-card shadow-2xl border border-[var(--color-border)] py-2 z-20 animate-in fade-in zoom-in-95 duration-200",
                              index >= filteredRoles.length / 2 ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
                            )}>
                              <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" onClick={() => { handleOpenPermissions(role); setActiveMenuId(null) }}>
                                <div className="w-8 h-8 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
                                  <Key aria-hidden="true" />
                                </div>
                                Phân quyền
                              </button>
                              <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" onClick={() => { handleOpenModal(role); setActiveMenuId(null) }}>
                                <div className="w-8 h-8 rounded-control bg-[var(--color-muted)] text-[var(--color-muted-foreground)] flex items-center justify-center">
                                  <Edit2 aria-hidden="true" />
                                </div>
                                Chỉnh sửa
                              </button>
                              {!role.isSystem ? (
                                <>
                                  <div className="h-px bg-[var(--color-muted)] my-1 mx-4" />
                                  <button type="button" className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={() => { handleDelete(role); setActiveMenuId(null) }}>
                                    <div className="w-8 h-8 rounded-control bg-[var(--color-error-bg)] text-[var(--color-error)] flex items-center justify-center">
                                      <Trash2 aria-hidden="true" />
                                    </div>
                                    Xóa vai trò
                                  </button>
                                </>
                              ) : (
                                <div className="text-eyebrow px-4 py-3 mt-1 border-t border-gray-50 bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] flex items-center gap-2">
                                  <AlertCircle size={14} className="text-[var(--color-subtle-foreground)]" />
                                  Hệ thống bảo vệ
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={cn(
"text-eyebrow inline-flex px-2.5 py-0.5 rounded-full border",
                        role.rank === 0 ? "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)]" :
                        role.rank === 1 ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]" :
                        "bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] border-[var(--color-border)]"
                      )}>
                        {role.rank === 0 ? 'Trưởng' : role.rank === 1 ? 'Phó' : 'Thành viên'}
                      </div>
                      <div className={cn(
"text-eyebrow inline-flex items-center gap-1 px-2.5 py-0.5 rounded-control border",
                        info.color === 'rose' ? "bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]" :
                        info.color === 'amber' ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]" :
                        "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                          info.color === 'rose' ? "bg-[var(--color-error-solid)]" :
                          info.color === 'amber' ? "bg-[var(--color-warning-solid)]" : "bg-[var(--color-success-solid)]"
                        )} />
                        {info.label}
                      </div>
                      <div className="flex items-center gap-1 text-[var(--color-subtle-foreground)] ml-auto">
                        <History size={11} className="text-[var(--color-subtle-foreground)]" />
                        <span className="font-medium text-xs">{format(new Date(role.createdAt), 'dd MMM, yyyy', { locale: vi })}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tạo / sửa vai trò */}
      <Dialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="md"
        dismissible={!(createMutation.isPending || updateMutation.isPending)}
        title={editingRole ? 'Chỉnh sửa vai trò' : 'Tạo vai trò mới'}
        description="Cấu hình tên gọi và vị trí trong cây phân cấp của tổ chức."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={createMutation.isPending || updateMutation.isPending}>Đóng</Button>}
            primary={
              <Button type="submit" form="role-form" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="animate-spin" aria-hidden="true" />}
                {editingRole ? 'Cập nhật thay đổi' : 'Xác nhận tạo mới'}
              </Button>
            }
          />
        }
      >
        <form id="role-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="role-name" className="text-label block">Tên định danh vai trò <span className="text-[var(--color-error)]">*</span></label>
            <input
              id="role-name"
              type="text"
              className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              placeholder="VD: Trưởng phòng Marketing"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-label block">Phân lớp quản lý <span className="text-[var(--color-error)]">*</span></label>
              <Select value={String(formData.level)} onValueChange={(val) => setFormData({ ...formData, level: Number(val) })} disabled={editingRole?.isSystem}>
                <SelectTrigger className="w-full" aria-label="Phân lớp quản lý">
                  <SelectValue placeholder="Chọn cấp độ" />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {hierarchyLevels.map((lvl) => (
                    <SelectItem key={lvl.id} value={String(lvl.roleLevel)}>{lvl.unitTypeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-label block">Định danh vị trí <span className="text-[var(--color-error)]">*</span></label>
              <Select value={String(formData.rank)} onValueChange={(val) => setFormData({ ...formData, rank: Number(val) })} disabled={editingRole?.isSystem}>
                <SelectTrigger className="w-full" aria-label="Định danh vị trí">
                  <SelectValue placeholder="Chọn vị trí" />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  <SelectItem value="0">Trưởng</SelectItem>
                  <SelectItem value="1">Phó</SelectItem>
                  <SelectItem value="2">Thành viên</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {editingRole?.isSystem && (
            <p className="text-caption">Vai trò hệ thống: chỉ đổi được tên, phân lớp và vị trí đã cố định.</p>
          )}
        </form>
      </Dialog>

      <RolePermissionDrawer 
        role={selectedRoleForPerms}
        isOpen={isPermissionDrawerOpen}
        onClose={() => setIsPermissionDrawerOpen(false)}
        hierarchyLevels={hierarchyLevels}
      />

      <HierarchyPermissionModal 
        isOpen={isHierarchyModalOpen}
        onClose={() => setIsHierarchyModalOpen(false)}
        hierarchyLevels={hierarchyLevels}
      />

      <ConfirmDialog 
        open={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, role: null })}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xoá vai trò"
        description={`Bạn có chắc chắn muốn xoá vai trò "${deleteConfirm.role?.name}" khỏi hệ thống? Tất cả nhân sự thuộc vai trò này sẽ bị ảnh hưởng.`}
        confirmLabel="Vẫn xoá vai trò"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
