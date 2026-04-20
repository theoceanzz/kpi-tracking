import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { orgUnitSchema, type OrgUnitFormData } from '../schemas/orgUnitSchema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orgUnitApi } from '../api/orgUnitApi'
import { useOrgUnitTree } from '../hooks/useOrgUnitTree'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { Loader2, X, Building2 } from 'lucide-react'
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

  const { register, handleSubmit, formState: { errors }, reset } = useForm<OrgUnitFormData>({
    resolver: zodResolver(orgUnitSchema),
    values: editUnit ? {
      name: editUnit.name,
      orgHierarchyId: editUnit.orgHierarchyId,
      parentId: editUnit.parentId ?? null,
      email: editUnit.email ?? '',
      phone: editUnit.phone ?? '',
      address: editUnit.address ?? '',
      provinceId: undefined,
      districtId: undefined,
    } : { 
      name: '', 
      orgHierarchyId: '', 
      parentId: initialParentId ?? null 
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: OrgUnitFormData) => {
      const payload = {
        name: data.name,
        orgHierarchyId: data.orgHierarchyId,
        parentId: data.parentId ?? undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        provinceId: data.provinceId ?? undefined,
        districtId: data.districtId ?? undefined,
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
        orgHierarchyId: data.orgHierarchyId,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        provinceId: data.provinceId ?? undefined,
        districtId: data.districtId ?? undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Tên đơn vị <span className="text-red-500">*</span></label>
            <input {...register('name')} className={inputCls} placeholder="VD: Phòng Kỹ thuật" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
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
              <input {...register('phone')} className={inputCls} placeholder="0123 456 789" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Địa chỉ</label>
              <input {...register('address')} className={inputCls} placeholder="Tầng 5, Tòa A" />
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
