import { useState, useEffect } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { userSchema, type UserFormData, updateUserSchema, type UpdateUserFormData } from '../schemas/userSchema'
import { cn, getHighestRole } from '@/lib/utils'
import { useCreateUser } from '../hooks/useCreateUser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { roleApi } from '@/features/organization/api/role.api'
import { toast } from 'sonner'
import { Loader2, X, Eye, EyeOff, Wand2, Check } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { useOrgHierarchyLevels, useOrgUnitTree } from '@/features/organization/hooks/useOrganizationStructure'
import type { User } from '@/types/user'
import { ROLE_MAP } from '@/constants/roles'
import type { OrgUnitTreeResponse } from '@/features/organization/types/org-unit'
import { useMemo } from 'react'

interface UserFormModalProps {
  open: boolean
  onClose: () => void
  editUser?: User | null
}

// Roles are loaded dynamically from the API
interface RoleOption {
  id: string
  name: string
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngưng hoạt động' },
  { value: 'SUSPENDED', label: 'Tạm khóa' },
] as const


export default function UserFormModal({ open, onClose, editUser }: UserFormModalProps) {
  const isEdit = !!editUser
  const qc = useQueryClient()
  const { hasPermission } = usePermission()
  const canAssignRoles = hasPermission('ROLE:ASSIGN')

  // Load roles dynamically
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleApi.listRoles(),
  })

  const user = useAuthStore(state => state.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: hierarchyLevels = [] } = useOrgHierarchyLevels(organizationId)
  const { data: orgTree } = useOrgUnitTree(organizationId)
  const currentUser = useAuthStore(state => state.user)

  // Find the highest rank (lowest level number) of the current user
  const { currentUserLevel, currentUserRank } = useMemo(() => {
    if (!currentUser || !rolesData) return { currentUserLevel: 999, currentUserRank: 999 }
    
    const userRoleNames = currentUser.memberships?.map(m => m.roleName) || []
    const userRoles = rolesData.filter(r => userRoleNames.includes(r.name))
    
    const level = userRoles.length > 0 ? Math.min(...userRoles.map(r => r.level ?? 999)) : 999
    const rank = userRoles.length > 0 
      ? Math.min(...userRoles.filter(r => r.level === level).map(r => r.rank ?? 999)) 
      : 999
    
    return { currentUserLevel: level, currentUserRank: rank }
  }, [currentUser, rolesData])

  const isAdmin = useMemo(() => {
    return currentUser?.memberships?.some(m => m.roleName === 'ADMIN' || m.roleName === 'DIRECTOR_SYSTEM') || false
  }, [currentUser])

  const flattenedUnits = useMemo(() => {
    const list: { id: string, name: string, level: number }[] = []
    const flatten = (nodes: OrgUnitTreeResponse[]) => {
      nodes.forEach(node => {
        list.push({ id: node.id, name: node.name, level: node.level })
        if (node.children) flatten(node.children)
      })
    }
    if (orgTree) flatten(orgTree)
    return list
  }, [orgTree])

  const dynamicRoles = useMemo(() => {
    if (!rolesData) return []
    
    const filtered = rolesData.filter((r: any) => {
      // System Protection
      if (r.name === 'DIRECTOR_SYSTEM' && !currentUser?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')) {
        return false
      }

      if (isAdmin) {
        // Even Admins shouldn't see themselves or higher roles if hierarchy is strictly enforced
        // But usually Admins can manage almost everyone except the System Director
        return r.name !== 'DIRECTOR_SYSTEM' || currentUser?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')
      }

      if (hierarchyLevels.length > 0) {
        const activeRoleLevels = new Set(hierarchyLevels.map(l => l.roleLevel))
        
        // 1. Structural check: Must be in company hierarchy
        if (r.level === undefined || !activeRoleLevels.has(r.level)) return false

        // 2. Authority check: Cannot assign roles above or equal to own level/rank
        if (r.level !== undefined && r.level < currentUserLevel) return false
        if (r.level === currentUserLevel && r.rank !== undefined && r.rank <= currentUserRank) return false
      }
      return true
    })

    return filtered.map((r: any) => ({ id: r.id, name: r.name }))
  }, [rolesData, hierarchyLevels, currentUserLevel, currentUserRank, isAdmin, currentUser])

  const createMutation = useCreateUser()

  const updateMutation = useMutation({
    mutationFn: (data: UpdateUserFormData) => userApi.update(editUser!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['organization-users'] })
      qc.invalidateQueries({ queryKey: ['org-unit-members'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Cập nhật nhân sự thành công')
      onClose()
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Cập nhật thất bại'
      toast.error(errorMessage)
    },
  })

  if (!open) return null

  return isEdit ? (
    <EditUserForm editUser={editUser!} onClose={onClose} onSubmit={(data) => updateMutation.mutate(data)} isPending={updateMutation.isPending} canAssignRoles={canAssignRoles} dynamicRoles={dynamicRoles} flattenedUnits={flattenedUnits} orgTree={orgTree || []} rolesData={rolesData || []} />
  ) : (
    <CreateUserForm onClose={onClose} onSubmit={(data) => createMutation.mutate(data, { onSuccess: () => onClose() })} isPending={createMutation.isPending} canAssignRoles={canAssignRoles} dynamicRoles={dynamicRoles} flattenedUnits={flattenedUnits} orgTree={orgTree || []} rolesData={rolesData || []} />
  )
}

function CreateUserForm({ onClose, onSubmit, isPending, canAssignRoles, dynamicRoles, flattenedUnits, orgTree, rolesData }: { onClose: () => void; onSubmit: (data: UserFormData) => void; isPending: boolean; canAssignRoles: boolean; dynamicRoles: RoleOption[]; flattenedUnits: { id: string, name: string, level: number }[]; orgTree: OrgUnitTreeResponse[]; rolesData: any[] }) {
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { email: '', fullName: '', password: '', phone: '', role: dynamicRoles?.[dynamicRoles.length - 1]?.name || '', orgUnitId: '' },
  })

  // Watch selected unit to filter roles by allowedRoles
  const selectedOrgUnitId = useWatch({ control, name: 'orgUnitId' })

  const filteredRoles = useMemo(() => {
    if (!selectedOrgUnitId || !orgTree) return dynamicRoles
    
    // Find the selected node in the tree
    let selectedNode: OrgUnitTreeResponse | undefined
    const findNode = (nodes: OrgUnitTreeResponse[]) => {
      for (const node of nodes) {
        if (node.id === selectedOrgUnitId) {
          selectedNode = node
          return
        }
        if (node.children) findNode(node.children)
      }
    }
    findNode(orgTree)

    if (!selectedNode || !selectedNode.allowedRoles || selectedNode.allowedRoles.length === 0) {
      return dynamicRoles
    }

    const allowedIds = new Set(selectedNode.allowedRoles.map(r => r.id))
    return dynamicRoles.filter(r => {
      return allowedIds.has(r.id) || rolesData?.find(rd => rd.id === r.id)?.rank === 2
    })
  }, [selectedOrgUnitId, orgTree, dynamicRoles])

  const pwd = useWatch({ control, name: 'password', defaultValue: '' })

  const hasLength = pwd.length >= 8
  const hasUpper = /[A-Z]/.test(pwd)
  const hasLower = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)

  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length

  let strengthLabel = 'Chưa nhập'
  let strengthColor = 'bg-gray-200 dark:bg-gray-700'
  let strengthTextColor = 'text-gray-400'

  if (pwd.length > 0) {
    if (strengthScore <= 2) {
      strengthLabel = 'Yếu'
      strengthColor = 'bg-red-500'
      strengthTextColor = 'text-red-500'
    } else if (strengthScore <= 3) {
      strengthLabel = 'Trung bình'
      strengthColor = 'bg-yellow-500'
      strengthTextColor = 'text-yellow-500'
    } else {
      strengthLabel = 'Mạnh'
      strengthColor = 'bg-emerald-500'
      strengthTextColor = 'text-emerald-500'
    }
  }

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let newPwd = 'A' + 'a' + '1' + '!'
    for (let i = 0; i < 8; i++) {
      newPwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    newPwd = newPwd.split('').sort(() => 0.5 - Math.random()).join('')
    setValue('password', newPwd, { shouldValidate: true })
    setShowPassword(true)
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Thêm nhân sự mới</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
            <input {...register('fullName')} className={inputCls} placeholder="Nguyễn Văn A" />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mã nhân viên</label>
            <input {...register('employeeCode')} className={inputCls} placeholder="VD: NV001" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email <span className="text-red-500">*</span></label>
            <input {...register('email')} type="email" className={inputCls} placeholder="name@tochuc.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mật khẩu <span className="text-red-500">*</span></label>
            <div className="relative">
              <input 
                {...register('password')} 
                type={showPassword ? 'text' : 'password'} 
                className={inputCls + " pr-24"} 
                placeholder="Tối thiểu 8 ký tự" 
              />
              
              <button
                type="button"
                onClick={generatePassword}
                className="absolute inset-y-0 right-10 pr-1 flex items-center text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors text-xs font-semibold"
                title="Gợi ý Mật khẩu"
              >
                <Wand2 size={16} className="mr-0.5"/> Gợi ý
              </button>

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {pwd && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mb-2">
                  <span className="text-slate-400">Độ mạnh</span>
                  <span className={strengthTextColor}>{strengthLabel}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700/50 rounded-full overflow-hidden flex gap-1 mb-3">
                  <div className={`h-full flex-1 rounded-full ${strengthScore >= 1 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                  <div className={`h-full flex-1 rounded-full ${strengthScore >= 2 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                  <div className={`h-full flex-1 rounded-full ${strengthScore >= 4 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                  <div className={`h-full flex-1 rounded-full ${strengthScore >= 5 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-[10px] font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasLength ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent')}><Check size={10} strokeWidth={3}/></div>
                    <span className={hasLength ? "text-slate-900 dark:text-white" : ""}>8+ ký tự</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasUpper && hasLower ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent')}><Check size={10} strokeWidth={3}/></div>
                    <span className={(hasUpper && hasLower) ? "text-slate-900 dark:text-white" : ""}>Hoa & thường</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasNumber ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent')}><Check size={10} strokeWidth={3}/></div>
                    <span className={hasNumber ? "text-slate-900 dark:text-white" : ""}>Có chữ số</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasSpecial ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent')}><Check size={10} strokeWidth={3}/></div>
                    <span className={hasSpecial ? "text-slate-900 dark:text-white" : ""}>Ký tự đặc biệt</span>
                  </div>
                </div>
              </div>
            )}
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
            <input {...register('phone')} className={inputCls} placeholder="0912 345 678" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Đơn vị <span className="text-red-500">*</span></label>
            <Controller
              name="orgUnitId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Chọn đơn vị" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {flattenedUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <span className="flex items-center">
                          {'\u00A0'.repeat(Math.max(0, unit.level * 2))}
                          {unit.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.orgUnitId && <p className="text-red-500 text-xs mt-1">{errors.orgUnitId.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vai trò <span className="text-red-500">*</span></label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={!canAssignRoles}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRoles.map((opt) => (
                      <SelectItem key={opt.id} value={opt.name}>
                        {ROLE_MAP[opt.name] || opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!canAssignRoles && <p className="text-[10px] text-amber-600 mt-1 font-medium">Bạn không có quyền thay đổi vai trò hệ thống</p>}
          </div>
          <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
            <button 
              type="submit" 
              disabled={isPending} 
              className="flex-1 px-6 py-3.5 rounded-2xl text-sm font-black bg-[var(--color-primary)] text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 size={18} className="animate-spin" />}
              Tạo mới
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserForm({ editUser, onClose, onSubmit, isPending, canAssignRoles, dynamicRoles, flattenedUnits, orgTree, rolesData }: { editUser: User; onClose: () => void; onSubmit: (data: UpdateUserFormData) => void; isPending: boolean; canAssignRoles: boolean; dynamicRoles: RoleOption[]; flattenedUnits: { id: string, name: string, level: number }[]; orgTree: OrgUnitTreeResponse[]; rolesData: any[] }) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { 
      email: editUser.email, 
      fullName: editUser.fullName, 
      employeeCode: editUser.employeeCode ?? '',
      phone: editUser.phone ?? '', 
      role: getHighestRole(editUser) || dynamicRoles?.[dynamicRoles.length - 1]?.name || '', 
      status: editUser.status,
      orgUnitId: editUser.memberships?.[0]?.orgUnitId || ''
    },
  })

  // Ensure form resets when editUser changes
  useEffect(() => {
    reset({
      email: editUser.email,
      fullName: editUser.fullName,
      employeeCode: editUser.employeeCode ?? '',
      phone: editUser.phone ?? '',
      role: getHighestRole(editUser) || dynamicRoles?.[dynamicRoles.length - 1]?.name || '',
      status: editUser.status,
      orgUnitId: editUser.memberships?.[0]?.orgUnitId || ''
    })
  }, [editUser, reset, dynamicRoles])

  // Watch selected unit to filter roles by allowedRoles
  const selectedOrgUnitId = useWatch({ control, name: 'orgUnitId' })

  const filteredRoles = useMemo(() => {
    let roles = dynamicRoles
    if (selectedOrgUnitId && orgTree) {
      // Find the selected node in the tree
      let selectedNode: OrgUnitTreeResponse | undefined
      const findNode = (nodes: OrgUnitTreeResponse[]) => {
        for (const node of nodes) {
          if (node.id === selectedOrgUnitId) {
            selectedNode = node
            return
          }
          if (node.children) findNode(node.children)
        }
      }
      findNode(orgTree)

      if (selectedNode && selectedNode.allowedRoles && selectedNode.allowedRoles.length > 0) {
        const allowedIds = new Set(selectedNode.allowedRoles.map(r => r.id))
        roles = dynamicRoles.filter(r => {
          return allowedIds.has(r.id) || rolesData?.find(rd => rd.id === r.id)?.rank === 2
        })
      }
    }

    // IMPORTANT: Always ensure the user's current role is in the list so it's not blank
    const currentRoleName = getHighestRole(editUser)
    if (currentRoleName && !roles.find(r => r.name === currentRoleName)) {
      const actualRole = rolesData?.find(rd => rd.name === currentRoleName)
      if (actualRole) {
        roles = [...roles, { id: actualRole.id, name: actualRole.name }]
      }
    }

    return roles
  }, [selectedOrgUnitId, orgTree, dynamicRoles, editUser, rolesData])

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Chỉnh sửa nhân sự</h3>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Họ và tên</label>
            <input {...register('fullName')} className={inputCls} />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Mã nhân viên</label>
            <input {...register('employeeCode')} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input {...register('email')} type="email" className={inputCls} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
            <input {...register('phone')} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Đơn vị</label>
            <Controller
              name="orgUnitId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Chọn đơn vị" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {flattenedUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <span className="flex items-center">
                          {'\u00A0'.repeat(Math.max(0, unit.level * 2))}
                          {unit.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vai trò</label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={!canAssignRoles}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredRoles.map((opt) => (
                      <SelectItem key={opt.id} value={opt.name}>
                        {ROLE_MAP[opt.name] || opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!canAssignRoles && <p className="text-[10px] text-amber-600 mt-1 font-medium">Bạn không có quyền thay đổi vai trò hệ thống</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Trạng thái</label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={onClose} className="flex-1 px-6 py-3.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Hủy</button>
            <button 
              type="submit" 
              disabled={isPending} 
              className="flex-1 px-6 py-3.5 rounded-2xl text-sm font-black bg-[var(--color-primary)] text-white hover:shadow-lg hover:shadow-[var(--color-primary)]/20 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 size={18} className="animate-spin" />}
              Cập nhật
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
