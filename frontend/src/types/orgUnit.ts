export type OrgUnitStatus = 'TRIAL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export interface OrgUnitTreeResponse {
  id: string
  name: string
  code: string
  parentId: string | null
  type: string
  path: string
  level: number
  status: string
  logoUrl: string | null
  children: OrgUnitTreeResponse[]
}

export interface OrgUnitResponse {
  id: string
  name: string
  code: string
  parentId: string | null
  orgHierarchyId: string
  organizationId: string
  type: string
  path: string
  level: number
  email: string | null
  phone: string | null
  address: string | null
  provinceId: string | null
  provinceName: string | null
  districtId: string | null
  districtName: string | null
  status: string
  logoUrl: string | null
  allowedRoles?: { id: string; name: string; isSystem: boolean }[]
  createdAt: string
  updatedAt: string
}

export interface OrgHierarchyLevelResponse {
  id: string
  unitTypeName: string
  managerRoleLabel: string | null
  levelOrder: number
  roleLevel: number
}

export interface CreateOrgUnitRequest {
  name: string
  code: string
  parentId?: string
  orgHierarchyId: string
  email?: string
  phone?: string
  address?: string
  provinceId?: number
  districtId?: number
}

export interface UpdateOrgUnitRequest {
  name?: string
  code?: string
  orgHierarchyId?: string
  email?: string
  phone?: string
  address?: string
  provinceId?: number
  districtId?: number
  status?: OrgUnitStatus
}

export interface MoveOrgUnitRequest {
  newParentId: string | null
}
