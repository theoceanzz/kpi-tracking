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
import { cn, getHighestRole, getPrimaryMembership } from '@/lib/utils'
import { useCreateUser } from '../hooks/useCreateUser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/userApi'
import { roleApi } from '@/features/organization/api/role.api'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { Loader2, Eye, EyeOff, Wand2, Check, AlertCircle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { useOrgHierarchyLevels, useOrgUnitTree } from '@/features/organization/hooks/useOrganizationStructure'
import type { User } from '@/types/user'

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
    if (!currentUser) return { currentUserLevel: 999, currentUserRank: 999 }
    
    // Use the values directly from the user memberships instead of looking up by name in rolesData
    const levels = currentUser.memberships?.map(m => m.roleLevel ?? 999) || []
    const level = levels.length > 0 ? Math.min(...levels) : 999
    
    const ranks = currentUser.memberships?.filter(m => (m.roleLevel ?? 999) === level).map(m => m.roleRank ?? 999) || []
    const rank = ranks.length > 0 ? Math.min(...ranks) : 999
    
    return { currentUserLevel: level, currentUserRank: rank }
  }, [currentUser])

  const isAdmin = useMemo(() => {
    // Admins are those who have specific system management permissions
    return hasPermission('ROLE:CREATE') || hasPermission('COMPANY:UPDATE') || 
           currentUser?.memberships?.some(m => m.roleName === 'ADMIN' || m.roleName === 'DIRECTOR_SYSTEM') || false
  }, [hasPermission, currentUser])

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

      // 2. Authority check: Cannot assign roles above or equal to own level/rank
      // DIRECTOR_SYSTEM bypasses this check
      const isDirectorSystem = currentUser?.memberships?.some(m => m.roleName === 'DIRECTOR_SYSTEM')
      if (!isDirectorSystem) {
        if (r.level !== undefined && r.level < currentUserLevel) return false
        if (r.level === currentUserLevel && r.rank !== undefined && r.rank <= currentUserRank) return false
      }

      if (isAdmin) return true

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
      const errorMessage = getApiErrorMessage(error, 'Cập nhật thất bại')
      toast.error(errorMessage)
    },
  })

  if (!open) return null

  return isEdit ? (
    <EditUserForm editUser={editUser!} onClose={onClose} onSubmit={(data) => updateMutation.mutate(data)} isPending={updateMutation.isPending} canAssignRoles={canAssignRoles} dynamicRoles={dynamicRoles} flattenedUnits={flattenedUnits} orgTree={orgTree || []} rolesData={rolesData || []} />
  ) : (
    <CreateUserForm onClose={onClose} onSubmit={(data) => createMutation.mutate(data, { onSuccess: () => onClose() })} isPending={createMutation.isPending} canAssignRoles={canAssignRoles} dynamicRoles={dynamicRoles} flattenedUnits={flattenedUnits} orgTree={orgTree || []} />
  )
}

function CreateUserForm({ onClose, onSubmit, isPending, canAssignRoles, dynamicRoles, flattenedUnits, orgTree }: { onClose: () => void; onSubmit: (data: UserFormData) => void; isPending: boolean; canAssignRoles: boolean; dynamicRoles: RoleOption[]; flattenedUnits: { id: string, name: string, level: number }[]; orgTree: OrgUnitTreeResponse[] }) {
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, control, setValue, getValues, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { 
      email: '', 
      fullName: '', 
      password: '', 
      phone: '', 
      role: '', 
      orgUnitId: orgTree?.[0]?.id || '' 
    },
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

    if (!selectedNode || !selectedNode.allowedRoles) {
      return dynamicRoles
    }

    if (selectedNode.allowedRoles.length === 0) {
      return []
    }

    const allowedIds = new Set(selectedNode.allowedRoles.map(r => r.id))
    return dynamicRoles.filter(r => allowedIds.has(r.id))
  }, [selectedOrgUnitId, orgTree, dynamicRoles])

  // Auto-select first role when filtered list changes
  useEffect(() => {
    const roles = filteredRoles
    if (roles.length > 0) {
      const currentRole = getValues('role')
      if (!currentRole || !roles.find(r => r.name === currentRole)) {
        setValue('role', roles[0]?.name || '')
      }
    }
  }, [filteredRoles, setValue, getValues])

  const pwd = useWatch({ control, name: 'password', defaultValue: '' })

  const hasLength = pwd.length >= 8
  const hasUpper = /[A-Z]/.test(pwd)
  const hasLower = /[a-z]/.test(pwd)
  const hasNumber = /[0-9]/.test(pwd)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pwd)

  const strengthScore = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length

  let strengthLabel = 'Chưa nhập'
  let strengthColor = 'bg-[var(--color-border)]'
  let strengthTextColor = 'text-[var(--color-subtle-foreground)]'

  if (pwd.length > 0) {
    if (strengthScore <= 2) {
      strengthLabel = 'Yếu'
      strengthColor = 'bg-[var(--color-error-solid)]'
      strengthTextColor = 'text-[var(--color-error)]'
    } else if (strengthScore <= 3) {
      strengthLabel = 'Trung bình'
      strengthColor = 'bg-[var(--color-warning-solid)]'
      strengthTextColor = 'text-[var(--color-warning)]'
    } else {
      strengthLabel = 'Mạnh'
      strengthColor = 'bg-[var(--color-success-solid)]'
      strengthTextColor = 'text-[var(--color-success)]'
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

  const inputCls = "w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50 transition-all shadow-sm"

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title="Thêm nhân sự mới"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="create-user-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Tạo mới
            </Button>
          }
        />
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-label block font-medium mb-1.5">Họ và tên <span className="text-[var(--color-error)]">*</span></label>
          <input {...register('fullName')} className={inputCls} placeholder="Nguyễn Văn A" />
          {errors.fullName && <p className="text-[var(--color-error)] text-xs mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Mã nhân viên</label>
          <input {...register('employeeCode')} className={inputCls} placeholder="VD: NV001" />
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Email <span className="text-[var(--color-error)]">*</span></label>
          <input {...register('email')} type="email" className={inputCls} placeholder="name@tochuc.com" />
          {errors.email && <p className="text-[var(--color-error)] text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Mật khẩu <span className="text-[var(--color-error)]">*</span></label>
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
            <div className="mt-2.5 p-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="text-eyebrow flex justify-between items-center mb-2">
                <span className="text-[var(--color-subtle-foreground)]">Độ mạnh</span>
                <span className={strengthTextColor}>{strengthLabel}</span>
              </div>
              <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full overflow-hidden flex gap-1 mb-3">
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 1 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 2 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 4 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
                <div className={`h-full flex-1 rounded-full ${strengthScore >= 5 ? strengthColor : 'bg-transparent'} transition-all duration-300`} />
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 gap-x-1 text-caption">
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasLength ? 'bg-[var(--color-success-solid)] text-white' : 'bg-[var(--color-border)] text-transparent')}><Check size={10} strokeWidth={3}/></div>
                  <span className={hasLength ? "text-[var(--color-foreground)]" : ""}>8+ ký tự</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasUpper && hasLower ? 'bg-[var(--color-success-solid)] text-white' : 'bg-[var(--color-border)] text-transparent')}><Check size={10} strokeWidth={3}/></div>
                  <span className={(hasUpper && hasLower) ? "text-[var(--color-foreground)]" : ""}>Hoa & thường</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasNumber ? 'bg-[var(--color-success-solid)] text-white' : 'bg-[var(--color-border)] text-transparent')}><Check size={10} strokeWidth={3}/></div>
                  <span className={hasNumber ? "text-[var(--color-foreground)]" : ""}>Có chữ số</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors", hasSpecial ? 'bg-[var(--color-success-solid)] text-white' : 'bg-[var(--color-border)] text-transparent')}><Check size={10} strokeWidth={3}/></div>
                  <span className={hasSpecial ? "text-[var(--color-foreground)]" : ""}>Ký tự đặc biệt</span>
                </div>
              </div>
            </div>
          )}
          {errors.password && <p className="text-[var(--color-error)] text-xs mt-1">{errors.password.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Số điện thoại</label>
          <input {...register('phone')} className={inputCls} placeholder="0912 345 678" />
          {errors.phone && <p className="text-[var(--color-error)] text-xs mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Đơn vị <span className="text-[var(--color-error)]">*</span></label>
          <Controller
            name="orgUnitId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] z-[300]">
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
          {errors.orgUnitId && <p className="text-[var(--color-error)] text-xs mt-1">{errors.orgUnitId.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Vai trò <span className="text-[var(--color-error)]">*</span></label>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={!canAssignRoles}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {filteredRoles.map((opt) => (
                    <SelectItem key={opt.id} value={opt.name}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {!canAssignRoles && <p className="text-xs text-[var(--color-warning)] mt-1 font-medium">Bạn không có quyền thay đổi vai trò hệ thống</p>}
          {filteredRoles.length === 0 && selectedOrgUnitId && (
            <p className="text-xs text-[var(--color-error)] mt-1 font-medium italic animate-pulse flex items-center gap-1">
              <AlertCircle size={12} /> Đơn vị này chưa được thiết lập phạm vi vai trò. Hãy cấu hình ở mục "Sơ đồ tổ chức".
            </p>
          )}
        </div>
      </form>
    </Dialog>
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
      orgUnitId: getPrimaryMembership(editUser)?.orgUnitId || ''
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
      orgUnitId: getPrimaryMembership(editUser)?.orgUnitId || ''
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

      if (selectedNode && selectedNode.allowedRoles) {
        if (selectedNode.allowedRoles.length === 0) {
          roles = []
        } else {
          const allowedIds = new Set(selectedNode.allowedRoles.map(r => r.id))
          roles = dynamicRoles.filter(r => allowedIds.has(r.id))
        }
      }
    }

    // IMPORTANT: Always ensure the user's current role is in the list so it's not blank
    const currentRoleName = getHighestRole(editUser)
    if (currentRoleName && !roles.find(r => r.name === currentRoleName)) {
      const actualRole = rolesData?.find((rd: any) => rd.name === currentRoleName)
      if (actualRole) {
        roles = [...roles, { id: actualRole.id, name: actualRole.name }]
      }
    }

    return roles
  }, [selectedOrgUnitId, orgTree, dynamicRoles, editUser, rolesData])

  const inputCls = "w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title="Chỉnh sửa nhân sự"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="edit-user-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Cập nhật
            </Button>
          }
        />
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-label block font-medium mb-1.5">Họ và tên</label>
          <input {...register('fullName')} className={inputCls} />
          {errors.fullName && <p className="text-[var(--color-error)] text-xs mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Mã nhân viên</label>
          <input {...register('employeeCode')} className={inputCls} />
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Email</label>
          <input {...register('email')} type="email" className={inputCls} />
          {errors.email && <p className="text-[var(--color-error)] text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Số điện thoại</label>
          <input {...register('phone')} className={inputCls} placeholder="0912 345 678" />
          {errors.phone && <p className="text-[var(--color-error)] text-xs mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Đơn vị</label>
          <Controller
            name="orgUnitId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Chọn đơn vị" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] z-[300]">
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
          <label className="text-label block font-medium mb-1.5">Vai trò</label>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={!canAssignRoles}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {filteredRoles.map((opt) => (
                    <SelectItem key={opt.id} value={opt.name}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {!canAssignRoles && <p className="text-xs text-[var(--color-warning)] mt-1 font-medium">Bạn không có quyền thay đổi vai trò hệ thống</p>}
          {filteredRoles.length === 0 && selectedOrgUnitId && (
            <p className="text-xs text-[var(--color-error)] mt-1 font-medium italic animate-pulse flex items-center gap-1">
              <AlertCircle size={12} /> Đơn vị này chưa được thiết lập phạm vi vai trò. Hãy cấu hình ở mục "Sơ đồ tổ chức".
            </p>
          )}
        </div>
        <div>
          <label className="text-label block font-medium mb-1.5">Trạng thái</label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
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
      </form>
    </Dialog>
  )
}
