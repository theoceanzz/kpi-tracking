import { useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orgUnitSchema, type OrgUnitFormData } from '../schemas/orgUnitSchema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orgUnitApi } from '../api/orgUnitApi'
import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { Loader2, X, Building2, Shield } from 'lucide-react'
import type { OrgUnitResponse, OrgHierarchyLevelResponse } from '@/types/orgUnit'

interface OrgUnitFormModalProps {
  open: boolean
  onClose: () => void
  editUnit?: OrgUnitResponse | null
  initialParentId?: string | null
}

export default function OrgUnitFormModal({ open, onClose, editUnit, initialParentId }: OrgUnitFormModalProps) {
  const isEdit = !!editUnit
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId || ''

  // Get hierarchy levels for dropdown
  const { data: hierarchyLevels } = useQuery({
    queryKey: ['hierarchy-levels', orgId],
    queryFn: () => orgUnitApi.getHierarchyLevels(orgId),
    enabled: !!orgId && open,
  })

  // Get organization details for code pre-fill
  const { data: organization } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: () => orgUnitApi.getOrganization(orgId),
    enabled: !!orgId && open,
  })

  // Get tree for parent dropdown
  const { data: treeData } = useOrgUnitTree()

  // Flatten tree for parent dropdown
  const flattenTree = (nodes: any[], level = 0): { id: string; name: string; levelLabel: string }[] => {
    let result: { id: string; name: string; levelLabel: string }[] = []
    nodes.forEach(node => {
      result.push({ id: node.id, name: node.name, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children, level + 1))
      }
    })
    return result
  }
  const flatParents = useMemo(() => treeData ? flattenTree(treeData) : [], [treeData])

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<OrgUnitFormData>({
    resolver: zodResolver(orgUnitSchema),
    values: editUnit ? {
      name: editUnit.name,
      code: editUnit.code ?? '',
      orgHierarchyId: editUnit.orgHierarchyId,
      parentId: editUnit.parentId ?? null,
      email: editUnit.email ?? '',
      phone: editUnit.phone ?? '',
      address: editUnit.address ?? '',
      provinceId: undefined,
      districtId: undefined,
      roleIds: editUnit.allowedRoles?.map((r: any) => r.id) || [],
    } : { 
      name: '', 
      code: '',
      orgHierarchyId: '', 
      parentId: initialParentId ?? null,
      roleIds: []
    },
  })

  const watchParentId = watch('parentId')
  const isRoot = !watchParentId

  // Update code if it's root and organization data is available
  useEffect(() => {
    if (!isEdit && isRoot && organization?.code) {
      reset(prev => ({ ...prev, code: organization.code }))
    }
  }, [isEdit, isRoot, organization, reset])

  const createMutation = useMutation({
    mutationFn: (data: OrgUnitFormData) => {
      const payload = {
        name: data.name,
        code: data.code,
        orgHierarchyId: data.orgHierarchyId,
        parentId: data.parentId ?? undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        provinceId: data.provinceId ?? undefined,
        districtId: data.districtId ?? undefined,
        roleIds: data.roleIds || [],
      }
      return orgUnitApi.create(orgId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgUnits'] })
      toast.success('Tạo đơn vị thành công')
      reset()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Tạo đơn vị thất bại')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: OrgUnitFormData) => {
      const payload = {
        name: data.name,
        code: data.code,
        orgHierarchyId: data.orgHierarchyId,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        provinceId: data.provinceId ?? undefined,
        districtId: data.districtId ?? undefined,
        roleIds: data.roleIds || [],
      }
      return orgUnitApi.update(orgId, editUnit!.id, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgUnits'] })
      toast.success('Cập nhật đơn vị thành công')
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Cập nhật thất bại')
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => orgUnitApi.getRoles(), // Assuming this exists or using a generic list
  })

  const watchHierarchyId = watch('orgHierarchyId')
  const selectedLevel = useMemo(() => {
    if (!watchHierarchyId || !hierarchyLevels) return null
    return hierarchyLevels.find((l: any) => l.id === watchHierarchyId)
  }, [watchHierarchyId, hierarchyLevels])

  const { minDepth, maxDepth } = useMemo(() => {
    if (!hierarchyLevels || hierarchyLevels.length === 0) return { minDepth: 1, maxDepth: 5 }
    const orders = hierarchyLevels.map((l: any) => l.levelOrder)
    return {
      minDepth: Math.min(...orders),
      maxDepth: Math.max(...orders)
    }
  }, [hierarchyLevels])

  const filteredRoles = useMemo(() => {
    if (!selectedLevel) return allRoles
    const level = selectedLevel.levelOrder
    
    // Level 1: Root
    if (level === minDepth) {
      return allRoles.filter((r: any) => ['DIRECTOR', 'ADMIN', 'HR'].includes(r.name))
    }
    
    // Bottom level
    if (level >= maxDepth) {
      return allRoles.filter((r: any) => ['STAFF'].includes(r.name))
    }
    
    // Middle levels
    return allRoles.filter((r: any) => ['HEAD', 'DEPUTY', 'STAFF'].includes(r.name))
  }, [selectedLevel, allRoles, minDepth, maxDepth])

  const onSubmit = (data: OrgUnitFormData) => {
    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  if (!open) return null

  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-card)] rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Building2 size={20} className="text-indigo-600" />
              {isEdit ? 'Chỉnh sửa đơn vị' : 'Thêm đơn vị mới'}
            </h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">Thiết lập thông tin đơn vị tổ chức</p>
          </div>
          <button onClick={onClose} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors p-1 hover:bg-[var(--color-accent)] rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Tên đơn vị <span className="text-red-500">*</span></label>
              <input {...register('name')} className={inputCls} placeholder="VD: Phòng Kỹ thuật" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Mã bộ phận <span className="text-red-500">*</span></label>
              <input 
                {...register('code')} 
                disabled={isRoot && !isEdit}
                className={`${inputCls} ${isRoot && !isEdit ? 'bg-[var(--color-accent)] opacity-70 cursor-not-allowed' : ''}`}
                placeholder="VD: PKT, ACC, HR..." 
              />
              {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Cấp bậc tổ chức <span className="text-red-500">*</span></label>
            <select {...register('orgHierarchyId')} className={inputCls}>
              <option value="">— Chọn cấp bậc —</option>
              {hierarchyLevels?.map((level: OrgHierarchyLevelResponse) => (
                <option key={level.id} value={level.id}>
                  {level.unitTypeName}{level.managerRoleLabel ? ` (${level.managerRoleLabel})` : ''}
                </option>
              ))}
            </select>
            {errors.orgHierarchyId && <p className="text-red-500 text-xs mt-1">{errors.orgHierarchyId.message}</p>}
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Đơn vị cha</label>
              <select {...register('parentId')} className={inputCls}>
                <option value="">— Gốc (không có cha) —</option>
                {flatParents.map(p => (
                  <option key={p.id} value={p.id}>{p.levelLabel}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input {...register('email')} type="email" className={inputCls} placeholder="phong-kt@company.com" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Số điện thoại</label>
              <input {...register('phone')} className={inputCls} placeholder="0912 345 678" />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Địa chỉ</label>
              <input {...register('address')} className={inputCls} placeholder="Tầng 5, Tòa A" />
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--color-border)]">
            <label className="block text-sm font-bold mb-3 flex items-center gap-2">
              <Shield size={16} className="text-indigo-600" />
              Phạm vi vai trò được phép
            </label>
            <p className="text-[10px] text-[var(--color-muted-foreground)] mb-4 italic">Giới hạn các vai trò có thể gán cho thành viên trong đơn vị này. Nếu không chọn, sẽ không có vai trò nào được phép gán.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredRoles.map((role: any) => (
                <label key={role.id} className="flex items-center p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-accent)] transition-all cursor-pointer group">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    value={role.id}
                    {...register('roleIds')}
                  />
                  <div className="ml-3">
                    <p className="text-sm font-bold text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors uppercase">
                      {role.name}
                    </p>
                    <p className="text-[10px] text-[var(--color-muted-foreground)] font-bold uppercase">{role.isSystem ? 'Hệ thống' : 'Tùy chỉnh'}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--color-accent)] transition-all">Hủy</button>
            <button type="submit" disabled={isPending} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20">
              {isPending && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
