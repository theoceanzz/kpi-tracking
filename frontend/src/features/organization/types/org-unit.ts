import { RoleResponse } from '../api/role.api'

export interface OrgUnitTreeResponse {
  id: string
  name: string
  parentId: string | null
  type: string // This maps to unitTypeName from backend
  path: string
  level: number
  status: string
  logoUrl: string | null
  allowedRoles?: RoleResponse[]
  children?: OrgUnitTreeResponse[]
}

export interface HierarchyLevelResponse {
  id: string
  levelOrder: number
  unitTypeName: string
  managerRoleLabel: string
}

export interface OrgUnitResponse {
  id: string
  name: string
  parentId: string | null
  organizationId: string
  orgHierarchyId: string
  type: string
  path: string
  level: number
  email?: string
  phone?: string
  address?: string
  provinceId?: string
  provinceName?: string
  districtId?: string
  districtName?: string
  logoUrl?: string
  status: string
  allowedRoles?: RoleResponse[]
  createdAt: string
  updatedAt: string
}

export interface ProvinceResponse {
  id: string
  name: string
  code: string
}

export interface DistrictResponse {
  id: string
  name: string
  provinceId: string
}

export interface CreateOrgUnitRequest {
  name: string
  parentId?: string | null
  unitTypeName: string
  email?: string
  phone?: string
  address?: string
  provinceId?: string
  districtId?: string
  roleIds?: string[]
}

export interface UpdateOrgUnitRequest {
  name?: string
  email?: string
  phone?: string
  address?: string
  provinceId?: string
  districtId?: string
  roleIds?: string[]
}
