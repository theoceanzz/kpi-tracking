import { useState, useMemo } from 'react'
import { 
  Users, 
  UserPlus,
  UserMinus, 
  ChevronDown, 
  ChevronUp, 
  Shield,  
  Search,
  Loader2,
  X,
  Settings2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useOrgUnitMembers, useRoles, useAssignRole, useRevokeRole, useOrganizationUsers, useBulkAssignRole, useRemoveAllFromUnit, useRemoveBulkFromUnit } from '../hooks/useUserRoles'
import { useOrgUnit, useOrgHierarchyLevels } from '../hooks/useOrganizationStructure'
import { useUpdateUser } from '@/features/users/hooks/useUsers'
import { useAuthStore } from '@/store/authStore'
import UserAvatar from '@/components/common/UserAvatar'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'


interface MemberManagementProps {
  orgUnitId: string
}

type GroupedMember = {
  userId: string
  userFullName: string
  userEmail: string
  /** Lấy từ danh sách người dùng của tổ chức — bản ghi phân vai trò không có ảnh. */
  userAvatarUrl?: string | null
  userStatus?: string
  assignments: {
    roleId: string
    roleName: string
    assignedAt: string
  }[]
}

interface ConfirmModalState {
    isOpen: boolean
    userId: string
    roleId: string
    roleName: string
    userFullName: string
}

export function MemberManagement({ orgUnitId }: MemberManagementProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState<GroupedMember | null>(null)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
      isOpen: false,
      userId: '',
      roleId: '',
      roleName: '',
      userFullName: ''
  })
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: orgUnit } = useOrgUnit(orgId, orgUnitId)

  const { data: orgUnitTree } = useOrgUnitTree()
  const rootUnitId = orgUnitTree?.[0]?.id

  const { data: members = [], isLoading: isMembersLoading } = useOrgUnitMembers(orgUnitId)
  const { data: roles = [] } = useRoles()
  const { data: orgUsersData } = useOrganizationUsers(rootUnitId)
  
  const orgUsers = orgUsersData?.content || []

  const assignMutation = useAssignRole()
  const bulkAssignMutation = useBulkAssignRole()
  const revokeMutation = useRevokeRole()
  const removeAllMutation = useRemoveAllFromUnit()
  const removeBulkMutation = useRemoveBulkFromUnit()
  const updateUserMutation = useUpdateUser()

  const { data: hierarchyLevels = [] } = useOrgHierarchyLevels(orgId)

  // Roles available for this specific unit based on scope
  const filteredRoles = useMemo(() => {
    let result = roles

    // 1. Filter by hierarchy level count
    if (hierarchyLevels.length > 0) {
      const levelCount = hierarchyLevels.length
      result = result.filter(r => {
        if (r.isSystem) {
          return r.name !== 'DIRECTOR_SYSTEM'
        }
        
        // Staff (rank 2) always shown
        if (r.rank === 2) return true
        
        // Director-level (level 0, rank 0)
        if (r.level === 0 && r.rank === 0) return levelCount >= 1
        
        // Mid-level (level 1) only if 3+ hierarchy levels
        if (r.level === 1) return levelCount > 2
        
        // Team-level (level 2, rank 0 or 1) always shown
        if (r.level === 2 && (r.rank === 0 || r.rank === 1)) return true
        
        return true
      })
    }

    // 2. Filter by unit allowed roles
    if (orgUnit?.allowedRoles) {
      if (orgUnit.allowedRoles.length === 0) return []
      const allowedIds = new Set(orgUnit.allowedRoles.map(r => r.id))
      return result.filter(r => allowedIds.has(r.id))
    }

    return result
  }, [roles, orgUnit?.allowedRoles, hierarchyLevels])

  // Group members by userId
  const groupedMembers = useMemo(() => {
    const groups: Record<string, GroupedMember> = {}
    members.forEach(m => {
      if (!groups[m.userId]) {
        const userGlobal = orgUsers.find(u => u.id === m.userId)
        groups[m.userId] = {
          userId: m.userId,
          userFullName: m.userFullName,
          userEmail: m.userEmail,
          userAvatarUrl: userGlobal?.avatarUrl,
          userStatus: userGlobal?.status || 'ACTIVE',
          assignments: []
        }
      }
      const group = groups[m.userId]
      if (group) {
        group.assignments.push({
          roleId: m.roleId,
          roleName: m.roleName,
          assignedAt: m.assignedAt
        })
      }
    })
    return Object.values(groups)
  }, [members, orgUsers])

  // Filter users for selection (exclude existing members)
  const eligibleUsers = useMemo(() => {
    const memberUserIds = new Set(members.map(m => m.userId))
    return orgUsers.filter(u => 
      !memberUserIds.has(u.id) && (
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  }, [orgUsers, searchQuery, members])

  // Get assignments for selected user (for role exclusion in Manage Modal)
  const selectedUserAssignments = useMemo(() => {
    const firstSelected = selectedUsers[0]
    if (!firstSelected) return []
    return groupedMembers.find(m => m.userId === firstSelected)?.assignments || []
  }, [selectedUsers, groupedMembers])

  // Track which ranks (0/1) are already taken by other users in this unit
  const takenRanks = useMemo(() => {
    const ranksByUserId: Record<number, string> = {}
    members.forEach(m => {
      const role = roles.find(r => r.id === m.roleId)
      if (role && (role.rank === 0 || role.rank === 1)) {
        ranksByUserId[role.rank] = m.userId
      }
    })
    return ranksByUserId
  }, [members, roles])

  const handleAddMember = async () => {
    if (!selectedRole) {
      toast.error('Vui lòng chọn vai trò')
      return
    }
    
    try {
      if (showManageModal) {
        // Single assignment for management modal
        await assignMutation.mutateAsync({
          userId: showManageModal.userId,
          roleId: selectedRole,
          orgUnitId
        })
      } else {
        // Bulk assignment for new members
        if (selectedUsers.length === 0) {
          toast.error('Vui lòng chọn ít nhất một nhân sự')
          return
        }

        // Prevent bulk assigning manager/deputy roles
        const selectedRoleObj = roles.find(r => r.id === selectedRole)
        if (selectedRoleObj && (selectedRoleObj.rank === 0 || selectedRoleObj.rank === 1) && selectedUsers.length > 1) {
            toast.error(`Mỗi đơn vị chỉ được phép có tối đa một ${selectedRoleObj.rank === 0 ? 'Trưởng' : 'Phó'}. Không thể gán hàng loạt.`)
            return
        }

        await bulkAssignMutation.mutateAsync({
          userIds: selectedUsers,
          roleId: selectedRole,
          orgUnitId
        })
      }
      
      toast.success('Gán vai trò thành công')
      
      // Update local state for "instant" update in Manage Modal
      if (showManageModal) {
          const roleData = filteredRoles.find(r => r.id === selectedRole)
          setShowManageModal({
              ...showManageModal,
              assignments: [
                  ...showManageModal.assignments,
                  { 
                      roleId: selectedRole, 
                      roleName: roleData?.name || 'Unknown', 
                      assignedAt: new Date().toISOString() 
                  }
              ]
          })
      }

      setSelectedRole(null)
      if (!showManageModal) {
        setShowAddModal(false)
        setSelectedUsers([])
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể gán vai trò'))
    }
  }

  const triggerRemoveConfirm = (member: { userId: string, userFullName: string }, role: { roleId: string, roleName: string }) => {
      setConfirmModal({
          isOpen: true,
          userId: member.userId,
          userFullName: member.userFullName,
          roleId: role.roleId,
          roleName: role.roleName
      })
  }

  const handleConfirmedRemove = async () => {
    const { userId, roleId, roleName } = confirmModal
    try {
        await revokeMutation.mutateAsync({ userId, roleId, orgUnitId })
        toast.success(`Đã thu hồi vai trò ${roleName}`)
        
        // Update local state for "instant" update
        if (showManageModal && showManageModal.userId === userId) {
            setShowManageModal({
                ...showManageModal,
                assignments: showManageModal.assignments.filter(a => a.roleId !== roleId)
            })
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
    } catch (error) {
        toast.error(getApiErrorMessage(error, 'Không thể thu hồi vai trò'))
    }
  }

  const handleRemoveAllFromUnit = async () => {
    try {
        if (selectedMemberIds.length > 0 && selectedMemberIds.length < groupedMembers.length) {
            await removeBulkMutation.mutateAsync({ userIds: selectedMemberIds, orgUnitId })
            toast.success(`Đã xóa ${selectedMemberIds.length} nhân sự khỏi đơn vị`)
        } else {
            await removeAllMutation.mutateAsync(orgUnitId)
            toast.success(`Đã xóa toàn bộ nhân sự khỏi đơn vị`)
        }
        setShowRemoveAllConfirm(false)
        setSelectedMemberIds([])
    } catch (error) {
        toast.error(getApiErrorMessage(error, 'Không thể xoá nhân sự'))
    }
  }

  const handleStatusChange = async (newStatus: 'ACTIVE' | 'INACTIVE') => {
      if (!showManageModal) return
      try {
          await updateUserMutation.mutateAsync({
              id: showManageModal.userId,
              data: { status: newStatus }
          })
          setShowManageModal({
              ...showManageModal,
              userStatus: newStatus
          })
      } catch {
          // Error handled by mutation
      }
  }

  return (
    <div className="bg-[var(--color-card)] rounded-card shadow-sm border overflow-hidden">
      <div
        className="px-4 md:px-8 py-4 md:py-5 bg-[var(--color-muted)] flex justify-between items-center cursor-pointer border-b gap-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 md:w-12 md:h-12 rounded-card bg-[var(--color-info-bg)] flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 md:w-6 md:h-6 text-[var(--color-info)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-section-title md:text-lg text-[var(--color-foreground)] whitespace-nowrap">Quản lý nhân sự</h2>
            <p className="text-eyebrow md:text-xs text-[var(--color-muted-foreground)] truncate">{groupedMembers.length} nhân viên • {members.length} phân quyền</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedMemberIds.length > 0 && (
            <Button variant="ghost" size="sm" className="md:px-5 md:py-2.5 md:text-sm whitespace-nowrap text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" onClick={(e) => {
                e.stopPropagation()
                setShowRemoveAllConfirm(true)
              }} disabled={removeAllMutation.isPending || removeBulkMutation.isPending}>
              <UserMinus aria-hidden="true" className="w-3.5 h-3.5 mr-1.5" />
              {selectedMemberIds.length === groupedMembers.length ? 'Xóa toàn bộ' : `Xóa (${selectedMemberIds.length})`}
            </Button>
          )}
          <Button size="sm" className="md:px-5 md:py-2.5 md:text-sm whitespace-nowrap" onClick={(e) => {
              e.stopPropagation()
              setShowAddModal(true)
            }}>
            <UserPlus aria-hidden="true" className="w-3.5 h-3.5 mr-1.5" />
            Thêm nhân sự
          </Button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--color-subtle-foreground)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-subtle-foreground)]" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-0">
          {isMembersLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-[var(--color-info)] animate-spin" />
            </div>
          ) : groupedMembers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--color-muted)] mb-4 border-2 border-dashed border-[var(--color-border)]">
                <Users className="w-10 h-10 text-[var(--color-subtle-foreground)]" />
              </div>
              <p className="text-[var(--color-muted-foreground)] font-semibold">Chưa có nhân sự nào trong đơn vị này</p>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--color-muted)] text-eyebrow border-b">
                    <th className="px-8 py-5 w-10">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-[var(--color-border-strong)] text-[var(--color-info)] focus:ring-[var(--color-info-solid)]"
                        checked={groupedMembers.length > 0 && selectedMemberIds.length === groupedMembers.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberIds(groupedMembers.map(m => m.userId))
                          } else {
                            setSelectedMemberIds([])
                          }
                        }}
                      />
                    </th>
                    <th className="px-8 py-5">Nhân sự</th>
                    <th className="px-8 py-5">Vai trò đảm nhiệm</th>
                    <th className="px-8 py-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {groupedMembers.map((member) => (
                    <tr key={member.userId} className={`hover:bg-gray-50/50 transition-colors group ${selectedMemberIds.includes(member.userId) ? 'bg-[var(--color-info-bg)]' : ''}`}>
                      <td className="px-8 py-5">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded border-[var(--color-border-strong)] text-[var(--color-info)] focus:ring-[var(--color-info-solid)]"
                          checked={selectedMemberIds.includes(member.userId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds(prev => [...prev, member.userId])
                            } else {
                              setSelectedMemberIds(prev => prev.filter(id => id !== member.userId))
                            }
                          }}
                        />
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                            <UserAvatar
                                fullName={member.userFullName}
                                avatarUrl={member.userAvatarUrl}
                                className="w-10 h-10 rounded-full"
                                fallbackClassName="bg-[var(--color-info-bg)] text-[var(--color-info)] font-semibold text-sm"
                            />
                            <div>
                                <p className="text-sm font-semibold text-[var(--color-foreground)]">{member.userFullName}</p>
                                <p className="text-xs text-[var(--color-muted-foreground)] font-medium">{member.userEmail}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-2">
                          {member.assignments.map((asgn) => (
                            <span key={asgn.roleId} className="inline-flex items-center px-3 py-1.5 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-foreground)] text-xs font-semibold shadow-sm group/badge hover:border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)] transition-all">
                              <Shield className="w-3 h-3 mr-2 text-[var(--color-info)] group-hover/badge:text-[var(--color-error)]" />
                              {asgn.roleName}
                              <button 
                                onClick={() => triggerRemoveConfirm({ userId: member.userId, userFullName: member.userFullName }, { roleId: asgn.roleId, roleName: asgn.roleName })}
                                className="ml-2 hover:text-[var(--color-error)] opacity-0 group-hover/badge:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="icon" aria-label="Quản lý vai trò" onClick={() => {
                             setSelectedRole(null)
                             setShowManageModal(member)
                          }} title="Quản lý vai trò">
                          <Settings2 aria-hidden="true" className="w-5 h-5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-[var(--color-border)]">
              {groupedMembers.map((member) => (
                <div key={member.userId} className={`p-5 space-y-3 ${selectedMemberIds.includes(member.userId) ? 'bg-[var(--color-info-bg)]' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[var(--color-border-strong)] text-[var(--color-info)] focus:ring-[var(--color-info-solid)] shrink-0"
                        checked={selectedMemberIds.includes(member.userId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMemberIds(prev => [...prev, member.userId])
                          } else {
                            setSelectedMemberIds(prev => prev.filter(id => id !== member.userId))
                          }
                        }}
                      />
                      <UserAvatar
                        fullName={member.userFullName}
                        avatarUrl={member.userAvatarUrl}
                        className="w-9 h-9 rounded-full"
                        fallbackClassName="bg-[var(--color-info-bg)] text-[var(--color-info)] font-semibold text-sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{member.userFullName}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)] font-medium truncate">{member.userEmail}</p>
                      </div>
                    </label>
                    <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Quản lý vai trò" onClick={() => { setSelectedRole(null); setShowManageModal(member) }} title="Quản lý vai trò">
                      <Settings2 aria-hidden="true" className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pl-7">
                    {member.assignments.map((asgn) => (
                      <span key={asgn.roleId} className="inline-flex items-center px-3 py-1.5 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-foreground)] text-xs font-semibold shadow-sm">
                        <Shield className="w-3 h-3 mr-2 text-[var(--color-info)]" />
                        {asgn.roleName}
                        <button
                          onClick={() => triggerRemoveConfirm({ userId: member.userId, userFullName: member.userFullName }, { roleId: asgn.roleId, roleName: asgn.roleName })}
                          className="ml-2 active:text-[var(--color-error)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
      )}

      {/* Gán / quản lý vai trò thành viên */}
      <Dialog
        open={showAddModal || !!showManageModal}
        onClose={() => { setShowAddModal(false); setShowManageModal(null); setSelectedRole(null); }}
        size="lg"
        dismissible={!(assignMutation.isPending || bulkAssignMutation.isPending)}
        title={showManageModal ? `Quản lý vai trò: ${showManageModal.userFullName}` : 'Phân công nhân sự mới'}
        description="Thiết lập các vai trò cụ thể cho nhân sự trong đơn vị này."
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => { setShowAddModal(false); setShowManageModal(null); }}>Đóng</Button>}
            primary={
              <Button
                disabled={(!showManageModal && selectedUsers.length === 0) || !selectedRole || assignMutation.isPending || bulkAssignMutation.isPending}
                onClick={handleAddMember}
              >
                {(assignMutation.isPending || bulkAssignMutation.isPending) && <Loader2 className="animate-spin" aria-hidden="true" />}
                Xác nhận gán
              </Button>
            }
          />
        }
      >
        <div className="space-y-6">
          {!showManageModal && (
              <div className="space-y-3">
                  <label className="text-label pl-1">Chọn nhân sự từ hệ thống</label>
                  <div className="relative group">
                      <Search className="absolute left-4 top-3.5 w-5 h-5 text-[var(--color-subtle-foreground)] group-focus-within:text-[var(--color-info)] transition-colors" />
                      <input 
                          type="text"
                          placeholder="Tìm theo tên hoặc email..."
                          className="w-full pl-12 pr-6 py-3.5 bg-[var(--color-muted)] border-none rounded-card outline-none focus:ring-2 focus:ring-[var(--color-info-solid)] transition-all text-sm font-medium placeholder:text-[var(--color-subtle-foreground)]"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                      />
                  </div>
                  
                  <div className="max-h-52 overflow-y-auto border border-[var(--color-border)] rounded-card bg-[var(--color-card)] divide-y scrollbar-hide">
                      {eligibleUsers.length === 0 ? (
                          <p className="p-8 text-sm text-[var(--color-subtle-foreground)] text-center font-medium italic">Không tìm thấy người dùng phù hợp</p>
                      ) : (
                          eligibleUsers.map(user => {
                              const isSelected = selectedUsers.includes(user.id)
                              return (
                                  <div 
                                      key={user.id}
                                      onClick={() => {
                                          setSelectedUsers(prev => 
                                              isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id]
                                          )
                                      }}
                                      className={`p-4 cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-[var(--color-info-solid)] text-white scale-[0.98]' : 'hover:bg-[var(--color-info-bg)] text-[var(--color-foreground)]'}`}
                                  >
                                      <div className="flex items-center space-x-3">
                                          <UserAvatar
                                              fullName={user.fullName}
                                              avatarUrl={user.avatarUrl}
                                              className="w-8 h-8 rounded-full"
                                              fallbackClassName={`text-xs font-semibold ${isSelected ? 'bg-white/20' : 'bg-[var(--color-muted)]'}`}
                                          />
                                          <div>
                                              <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-[var(--color-foreground)]'}`}>{user.fullName}</p>
                                              <p className={`text-xs font-semibold ${isSelected ? 'text-[var(--color-info)]' : 'text-[var(--color-subtle-foreground)]'}`}>{user.email}</p>
                                          </div>
                                      </div>
                                      {isSelected && <CheckCircle2 className="w-4 h-4 text-white animate-pulse" />}
                                  </div>
                              )
                          })
                      )}
                  </div>
              </div>
          )}

          {showManageModal && (
              <div className="space-y-6">
                   {/* Global Status Toggle */}
                   <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[var(--color-foreground)] leading-tight">Trạng thái tài khoản <span className="block sm:inline text-[var(--color-muted-foreground)] font-semibold">(Toàn hệ thống)</span></h4>
                          <p className="text-caption font-medium mt-1">
                              Vô hiệu hóa sẽ chặn quyền truy cập của người dùng này vào toàn bộ hệ thống.
                          </p>
                      </div>
                      <button
                          onClick={() => handleStatusChange(showManageModal.userStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                          disabled={updateUserMutation.isPending}
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none ${showManageModal.userStatus === 'ACTIVE' ? 'bg-[var(--color-info-solid)]' : 'bg-[var(--color-border)]'}`}
                      >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${showManageModal.userStatus === 'ACTIVE' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                          <label className="text-label pl-1">Vai trò đang đảm nhiệm</label>
                          <div className="group relative">
                              <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] cursor-help" />
                              <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-[var(--color-foreground)] text-[var(--color-background)] text-xs rounded-card opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl font-medium leading-relaxed">
                                  Lưu ý: "Thu hồi" chỉ gỡ vai trò tại đơn vị này. Để chặn hoàn toàn hãy dùng mục Trạng thái ở trên.
                              </div>
                          </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                          {showManageModal.assignments.map(asgn => (
                              <div key={asgn.roleId} className="flex items-center px-4 py-2.5 bg-[var(--color-info-bg)] rounded-card border border-[var(--color-info-border)] group">
                                  <Shield className="w-4 h-4 mr-2 text-[var(--color-info)]" />
                                  <span className="text-sm font-semibold text-[var(--color-info)] mr-4">{asgn.roleName}</span>
                                  <button 
                                      onClick={() => triggerRemoveConfirm({ userId: showManageModal.userId, userFullName: showManageModal.userFullName }, { roleId: asgn.roleId, roleName: asgn.roleName })}
                                      className="p-1 hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)] rounded-control transition-colors"
                                  >
                                      <X className="w-4 h-4" />
                                  </button>
                              </div>
                          ))}
                      </div>
                   </div>
              </div>
          )}

          <div className="space-y-3">
              <label className="text-label pl-1">
                  {(showManageModal || selectedUserAssignments.length > 0) ? 'Bổ sung vai trò' : 'Vai trò khởi đầu'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                  {filteredRoles.length === 0 && (
                      <div className="col-span-2 p-4 rounded-card bg-[var(--color-error-bg)] border border-[var(--color-error-border)] flex items-center gap-3 text-[var(--color-error)]">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <p className="text-xs font-medium italic">
                              Đơn vị này chưa được thiết lập phạm vi vai trò. Vui lòng quay lại mục "Sơ đồ tổ chức" để cấu hình trước khi gán nhân sự.
                          </p>
                      </div>
                  )}
                  {filteredRoles.map(role => {
                      const isAssigned = (showManageModal?.assignments || selectedUserAssignments).some(a => a.roleId === role.id)
                      
                      // NEW LOGIC: Check if rank (0/1) is taken by ANOTHER user
                      const currentUserId = showManageModal?.userId || (selectedUsers.length === 1 ? selectedUsers[0] : null)
                      const rankTakenByUserId = role.rank !== undefined ? takenRanks[role.rank] : undefined
                      const isRankTakenByOther = (role.rank === 0 || role.rank === 1) && 
                                               rankTakenByUserId && 
                                               rankTakenByUserId !== currentUserId

                      const isDisabled = isAssigned || isRankTakenByOther || (selectedUsers.length > 1 && (role.rank === 0 || role.rank === 1))
                      
                      return (
                          <button
                              key={role.id}
                              disabled={isDisabled}
                              onClick={() => setSelectedRole(role.id)}
                              className={`flex items-center p-4 rounded-card border-2 transition-all text-left relative ${
                                  isDisabled 
                                  ? 'bg-[var(--color-muted)] border-[var(--color-border)] opacity-50 cursor-not-allowed'
                                  : selectedRole === role.id 
                                      ? 'border-[var(--color-info-border)] bg-[var(--color-info-bg)] ring-2 ring-[var(--color-info-solid)]' 
                                      : 'border-[var(--color-border)] hover:border-[var(--color-info-border)] hover:bg-[var(--color-info-bg)]'
                              }`}
                          >
                              <div className={`w-8 h-8 rounded-card flex items-center justify-center mr-3 ${selectedRole === role.id ? 'bg-[var(--color-info-solid)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-subtle-foreground)]'}`}>
                                  <Shield className="w-4 h-4" />
                              </div>
                              <div className="flex-1 overflow-hidden">
                                  <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{role.name}</p>
                                  <p className="text-caption font-medium truncate">
                                      {isRankTakenByOther ? 'Đã có người đảm nhiệm' : (selectedUsers.length > 1 && (role.rank === 0 || role.rank === 1)) ? 'Không thể gán hàng loạt' : ''}
                                  </p>
                              </div>
                              {isRankTakenByOther && (
                                  <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] absolute top-2 right-2" />
                              )}
                          </button>
                      )
                  })}
              </div>
          </div>
        </div>
      </Dialog>

      {/* Xác nhận thu hồi một vai trò */}
      <ConfirmDialog
        open={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmedRemove}
        title="Xác nhận thu hồi vai trò"
        description={`Thu hồi vai trò "${confirmModal.roleName}" của ${confirmModal.userFullName}? Người này sẽ mất các quyền đi kèm vai trò trong đơn vị.`}
        confirmLabel="Xác nhận xóa"
        loading={revokeMutation.isPending}
      />

      {/* Xác nhận thu hồi toàn bộ vai trò */}
      <ConfirmDialog
        open={showRemoveAllConfirm}
        onClose={() => setShowRemoveAllConfirm(false)}
        onConfirm={handleRemoveAllFromUnit}
        title={selectedMemberIds.length > 0 && selectedMemberIds.length < groupedMembers.length ? 'Xóa nhân sự đã chọn' : 'Xóa toàn bộ nhân sự'}
        description={selectedMemberIds.length > 0 && selectedMemberIds.length < groupedMembers.length
          ? `Thu hồi tất cả vai trò của ${selectedMemberIds.length} nhân viên đã chọn. Bạn có chắc chắn?`
          : `Thu hồi tất cả vai trò của ${groupedMembers.length} nhân viên trong đơn vị này. Bạn có chắc chắn?`}
        confirmLabel="Xác nhận xóa"
        loading={removeAllMutation.isPending || removeBulkMutation.isPending}
      />
    </div>
  )
}
