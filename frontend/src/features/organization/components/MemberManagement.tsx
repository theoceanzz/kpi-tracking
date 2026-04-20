import { useState, useMemo } from 'react'
import { 
  Users, 
  UserPlus, 
  ChevronDown, 
  ChevronUp, 
  Shield,  
  Search,
  Loader2,
  X,
  Settings2,
  AlertTriangle
} from 'lucide-react'
import { 
  useOrgUnitMembers, 
  useRoles, 
  useAssignRole, 
  useRevokeRole, 
  useOrganizationUsers 
} from '../hooks/useUserRoles'
import { toast } from 'sonner'

interface MemberManagementProps {
  orgUnitId: string
}

type GroupedMember = {
  userId: string
  userFullName: string
  userEmail: string
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
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  const { data: members = [], isLoading: isMembersLoading } = useOrgUnitMembers(orgUnitId)
  const { data: roles = [] } = useRoles()
  const { data: orgUsersData } = useOrganizationUsers()
  
  const orgUsers = orgUsersData?.content || []

  const assignMutation = useAssignRole()
  const revokeMutation = useRevokeRole()

  // Group members by userId
  const groupedMembers = useMemo(() => {
    const groups: Record<string, GroupedMember> = {}
    members.forEach(m => {
      if (!groups[m.userId]) {
        groups[m.userId] = {
          userId: m.userId,
          userFullName: m.userFullName,
          userEmail: m.userEmail,
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
  }, [members])

  // Filter users for selection
  const eligibleUsers = useMemo(() => {
    return orgUsers.filter(u => 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [orgUsers, searchQuery])

  // Get assignments for selected user (for Add Member flow)
  const selectedUserAssignments = useMemo(() => {
    if (!selectedUser) return []
    return groupedMembers.find(m => m.userId === selectedUser)?.assignments || []
  }, [selectedUser, groupedMembers])

  const handleAddMember = async () => {
    const userId = showManageModal?.userId || selectedUser
    if (!userId || !selectedRole) {
      toast.error('Vui lòng chọn người dùng và vai trò')
      return
    }

    // Check if user already has this role
    const existingEntry = members.find(m => m.userId === userId && m.roleId === selectedRole)
    if (existingEntry) {
      toast.error('Người dùng đã có vai trò này trong đơn vị')
      return
    }

    try {
      await assignMutation.mutateAsync({
        userId,
        roleId: selectedRole,
        orgUnitId
      })
      toast.success('Gán vai trò thành công')
      
      // Update local state for "instant" update in Manage Modal
      if (showManageModal) {
          const roleData = roles.find(r => r.id === selectedRole)
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
        setSelectedUser(null)
      }
    } catch (error) {
      toast.error('Không thể gán vai trò')
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
        toast.error('Không thể thu hồi vai trò')
    }
  }

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border overflow-hidden">
      <div 
        className="px-8 py-5 bg-gray-50/50 flex justify-between items-center cursor-pointer border-b"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Quản lý nhân sự</h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{groupedMembers.length} nhân viên • {members.length} phân quyền</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={(e) => {
              e.stopPropagation()
              setShowAddModal(true)
            }}
            className="flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 text-sm font-black transition-all shadow-lg shadow-blue-200"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Thêm nhân sự
          </button>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-0">
          {isMembersLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : groupedMembers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4 border-2 border-dashed border-gray-200">
                <Users className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold">Chưa có nhân sự nào trong đơn vị này</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/30 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                    <th className="px-8 py-5">Nhân sự</th>
                    <th className="px-8 py-5">Vai trò đảm nhiệm</th>
                    <th className="px-8 py-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {groupedMembers.map((member) => (
                    <tr key={member.userId} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-sm">
                                {member.userFullName.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-black text-gray-900">{member.userFullName}</p>
                                <p className="text-xs text-gray-500 font-medium">{member.userEmail}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-2">
                          {member.assignments.map((asgn) => (
                            <span key={asgn.roleId} className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-gray-100 text-gray-700 text-[10px] font-black shadow-sm group/badge hover:border-red-200 hover:bg-red-50 transition-all">
                              <Shield className="w-3 h-3 mr-2 text-blue-500 group-hover/badge:text-red-500" />
                              {asgn.roleName}
                              <button 
                                onClick={() => triggerRemoveConfirm({ userId: member.userId, userFullName: member.userFullName }, { roleId: asgn.roleId, roleName: asgn.roleName })}
                                className="ml-2 hover:text-red-600 opacity-0 group-hover/badge:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => setShowManageModal(member)}
                          className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                          title="Quản lý vai trò"
                        >
                          <Settings2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Update Member Modal */}
      {(showAddModal || showManageModal) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => { setShowAddModal(false); setShowManageModal(null); }} />
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl relative z-[201] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="p-10 border-b bg-gradient-to-r from-gray-50 to-white">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                        {showManageModal ? `Quản lý vai trò: ${showManageModal.userFullName}` : 'Phân công nhân sự mới'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2 font-medium">Thiết lập các vai trò cụ thể cho nhân sự trong đơn vị này.</p>
                </div>
                
                <div className="p-10 space-y-8">
                    {!showManageModal && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Chọn nhân sự từ hệ thống</label>
                            <div className="relative group">
                                <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Tìm theo tên hoặc email..."
                                    className="w-full pl-12 pr-6 py-3.5 bg-gray-50 border-none rounded-[1.25rem] outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold placeholder:text-gray-300"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            
                            <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-[1.25rem] bg-white divide-y scrollbar-hide shadow-inner">
                                {eligibleUsers.length === 0 ? (
                                    <p className="p-8 text-sm text-gray-400 text-center font-bold italic">Không tìm thấy người dùng phù hợp</p>
                                ) : (
                                    eligibleUsers.map(user => (
                                        <div 
                                            key={user.id}
                                            onClick={() => setSelectedUser(user.id)}
                                            className={`p-4 cursor-pointer flex items-center justify-between transition-all ${selectedUser === user.id ? 'bg-blue-600 text-white shadow-lg scale-[0.98]' : 'hover:bg-blue-50 text-gray-700'}`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${selectedUser === user.id ? 'bg-white/20' : 'bg-gray-100'}`}>
                                                    {user.fullName.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black ${selectedUser === user.id ? 'text-white' : 'text-gray-900'}`}>{user.fullName}</p>
                                                    <p className={`text-[10px] font-bold ${selectedUser === user.id ? 'text-blue-100' : 'text-gray-400'}`}>{user.email}</p>
                                                </div>
                                            </div>
                                            {selectedUser === user.id && <Shield className="w-4 h-4 text-white animate-pulse" />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {showManageModal && (
                        <div className="space-y-4">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Vai trò đang đảm nhiệm</label>
                             <div className="flex flex-wrap gap-3">
                                {showManageModal.assignments.map(asgn => (
                                    <div key={asgn.roleId} className="flex items-center px-4 py-2.5 bg-blue-50 rounded-2xl border border-blue-100 group">
                                        <Shield className="w-4 h-4 mr-2 text-blue-600" />
                                        <span className="text-sm font-black text-blue-700 mr-4">{asgn.roleName}</span>
                                        <button 
                                            onClick={() => triggerRemoveConfirm({ userId: showManageModal.userId, userFullName: showManageModal.userFullName }, { roleId: asgn.roleId, roleName: asgn.roleName })}
                                            className="p-1 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                            {(showManageModal || selectedUserAssignments.length > 0) ? 'Bổ sung vai trò' : 'Vai trò khởi đầu'}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {roles.map(role => {
                                const isAssigned = (showManageModal?.assignments || selectedUserAssignments).some(a => a.roleId === role.id)
                                return (
                                    <button
                                        key={role.id}
                                        disabled={isAssigned}
                                        onClick={() => setSelectedRole(role.id)}
                                        className={`flex items-center p-4 rounded-[1.25rem] border-2 transition-all text-left ${
                                            isAssigned 
                                            ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                                            : selectedRole === role.id 
                                                ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-600/10' 
                                                : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/50'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center mr-3 ${selectedRole === role.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            <Shield className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">{role.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase truncate max-w-[120px]">{role.id.split('-')[0]}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-10 bg-gray-50/50 flex space-x-4 border-t">
                    <button 
                        onClick={() => { setShowAddModal(false); setShowManageModal(null); }}
                        className="flex-1 px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-[1.25rem] hover:bg-gray-100 font-black transition-all shadow-sm"
                    >
                        Đóng
                    </button>
                    <button 
                        disabled={(!showManageModal && !selectedUser) || !selectedRole || assignMutation.isPending}
                        onClick={handleAddMember}
                        className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-[1.25rem] hover:bg-blue-700 font-black transition-all shadow-xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center"
                    >
                        {assignMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xác nhận gán'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} />
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-[301] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-8 text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Xác nhận thu hồi vai trò</h3>
                    <p className="text-gray-500 font-medium">
                        Bạn có chắc chắn muốn thu hồi vai trò <span className="text-gray-900 font-black">"{confirmModal.roleName}"</span> của <span className="text-gray-900 font-black">{confirmModal.userFullName}</span>?
                    </p>
                </div>
                <div className="p-6 bg-gray-50 flex space-x-3">
                    <button 
                        onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                        className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 font-bold transition-all"
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={handleConfirmedRemove}
                        disabled={revokeMutation.isPending}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold transition-all shadow-lg shadow-red-200 flex items-center justify-center"
                    >
                        {revokeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Xác nhận xóa'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
