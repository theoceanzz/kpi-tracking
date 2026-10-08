import { useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useRoles } from '@/features/organization/hooks/useRoles'
import { useOrgHierarchyLevels } from '@/features/organization/hooks/useOrganizationStructure'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import type { PickOption } from '../components/pickers/MultiSelectPopover'

export interface ProcessOptions {
  roles: PickOption[]
  units: PickOption[]
  levels: PickOption[]
  periods: PickOption[]
  roleName: Map<string, string>
  unitName: Map<string, string>
}

/** Danh sách chọn cho điều kiện và người duyệt: chức vụ, cây đơn vị, cấp đơn vị, kỳ KPI. */
export function useProcessOptions(): ProcessOptions {
  const organizationId = useAuthStore((s) => s.user?.memberships?.[0]?.organizationId)
  const { data: roles } = useRoles()
  const { data: tree } = useOrgUnitTree({ staleTime: 60_000 })
  const { data: levels } = useOrgHierarchyLevels(organizationId)
  const { data: periods } = useKpiPeriods({ page: 0, size: 200, organizationId })

  return useMemo(() => {
    const units: PickOption[] = []
    const walk = (nodes: OrgUnitTreeResponse[], depth: number) => {
      for (const n of nodes) {
        units.push({ value: n.id, label: n.name, depth })
        walk(n.children ?? [], depth + 1)
      }
    }
    walk(tree ?? [], 0)
    const roleOptions = (roles ?? []).map((r) => ({ value: r.id, label: r.name }))
    return {
      roles: roleOptions,
      units,
      levels: [...(levels ?? [])]
        .sort((a, b) => a.levelOrder - b.levelOrder)
        .map((l) => ({ value: l.id, label: l.unitTypeName })),
      periods: (periods?.content ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.cycleName ?? undefined })),
      roleName: new Map(roleOptions.map((o) => [o.value, o.label])),
      unitName: new Map(units.map((o) => [o.value, o.label])),
    }
  }, [roles, tree, levels, periods])
}
