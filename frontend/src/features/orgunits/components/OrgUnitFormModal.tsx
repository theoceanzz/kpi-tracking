import { useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orgUnitSchema, type OrgUnitFormData } from '../schemas/orgUnitSchema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orgUnitApi } from '../api/orgUnitApi'
import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { useAuthStore } from '@/store/authStore'
import { useFormAssistStore } from '@/store/formAssistStore'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { Loader2, Shield } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, getValues } = useForm<OrgUnitFormData>({
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

  // Giới thiệu form này với trợ lý AI trong lúc nó đang mở.
  useEffect(() => {
    if (!open) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'org_unit_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      // code bị khoá ở đơn vị gốc lúc tạo (và bị effect bên dưới ghi đè bằng mã tổ chức);
      // parentId chỉ vẽ khi TẠO, mà lượt sửa còn không gửi nó lên máy chủ.
      fillableFields: () => [
        'name', 'email', 'phone', 'address', 'orgHierarchyId',
        ...(isRoot && !isEdit ? [] : ['code']),
        ...(isEdit ? [] : ['parentId']),
      ],
      setValue: (field, value) =>
        setValue(field as keyof OrgUnitFormData, value as never,
          { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('org_unit_form')
  }, [open, getValues, setValue, isEdit, isRoot])

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
      toast.error(getApiErrorMessage(err, 'Tạo đơn vị thất bại'))
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
      toast.error(getApiErrorMessage(err, 'Cập nhật thất bại'))
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

    // Root level: show all roles
    if (level === minDepth) {
      return allRoles
    }

    // Bottom level: staff only (rank=2)
    if (level >= maxDepth) {
      return allRoles.filter((r: any) => r.rank === 2)
    }

    // Middle levels: trưởng (rank=0), phó (rank=1), nhân viên (rank=2)
    return allRoles.filter((r: any) => r.rank === 0 || r.rank === 1 || r.rank === 2)
  }, [selectedLevel, allRoles, minDepth, maxDepth])

  const onSubmit = (data: OrgUnitFormData) => {
    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const inputCls = "w-full px-3 py-2.5 rounded-control border border-[var(--color-border)] bg-[var(--color-background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title={isEdit ? 'Chỉnh sửa đơn vị' : 'Thêm đơn vị mới'}
      description="Thiết lập thông tin đơn vị tổ chức"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="org-unit-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isEdit ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          }
        />
      }
    >
      <form id="org-unit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-label block font-medium mb-1.5">Tên đơn vị <span className="text-[var(--color-error)]">*</span></label>
            <input {...register('name')} className={inputCls} placeholder="VD: Phòng Kỹ thuật" />
            {errors.name && <p className="text-[var(--color-error)] text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-label block font-medium mb-1.5">Mã bộ phận <span className="text-[var(--color-error)]">*</span></label>
            <input 
              {...register('code')} 
              disabled={isRoot && !isEdit}
              className={`${inputCls} ${isRoot && !isEdit ? 'bg-[var(--color-accent)] opacity-70 cursor-not-allowed' : ''}`}
              placeholder="VD: PKT, ACC, HR..." 
            />
            {errors.code && <p className="text-[var(--color-error)] text-xs mt-1">{errors.code.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-label block font-medium mb-1.5">Cấp bậc tổ chức <span className="text-[var(--color-error)]">*</span></label>
          <select {...register('orgHierarchyId')} className={inputCls}>
            <option value="">— Chọn cấp bậc —</option>
            {hierarchyLevels?.map((level: OrgHierarchyLevelResponse) => (
              <option key={level.id} value={level.id}>
                {level.unitTypeName}{level.managerRoleLabel ? ` (${level.managerRoleLabel})` : ''}
              </option>
            ))}
          </select>
          {errors.orgHierarchyId && <p className="text-[var(--color-error)] text-xs mt-1">{errors.orgHierarchyId.message}</p>}
        </div>

        {!isEdit && (
          <div>
            <label className="text-label block font-medium mb-1.5">Đơn vị cha</label>
            <select {...register('parentId')} className={inputCls}>
              <option value="">— Gốc (không có cha) —</option>
              {flatParents.map(p => (
                <option key={p.id} value={p.id}>{p.levelLabel}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-label block font-medium mb-1.5">Email</label>
          <input {...register('email')} type="email" className={inputCls} placeholder="phong-kt@company.com" />
          {errors.email && <p className="text-[var(--color-error)] text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-label block font-medium mb-1.5">Số điện thoại</label>
            <input {...register('phone')} className={inputCls} placeholder="0912 345 678" />
            {errors.phone && <p className="text-[var(--color-error)] text-xs mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="text-label block font-medium mb-1.5">Địa chỉ</label>
            <input {...register('address')} className={inputCls} placeholder="Tầng 5, Tòa A" />
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)]">
          <label className="text-label block mb-3 flex items-center gap-2">
            <Shield size={16} className="text-[var(--color-primary)]" />
            Phạm vi vai trò được phép
          </label>
          <p className="text-caption mb-4 italic">Giới hạn các vai trò có thể gán cho thành viên trong đơn vị này. Nếu không chọn, sẽ không có vai trò nào được phép gán.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRoles.map((role: any) => (
              <label key={role.id} className="flex items-center p-3 rounded-card border border-[var(--color-border)] hover:bg-[var(--color-accent)] transition-all cursor-pointer group">
                <input 
                  type="checkbox"
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  value={role.id}
                  {...register('roleIds')}
                />
                <div className="ml-3">
                  <p className="text-sm font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-primary)] transition-colors">
                    {role.name}
                  </p>
                  <p className="text-caption">{role.isSystem ? 'Hệ thống' : 'Tùy chỉnh'}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

      </form>
    </Dialog>
  )
}
