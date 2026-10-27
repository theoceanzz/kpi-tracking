import type { UserRole, UserStatus, UserMembership } from './auth'

// Matches BE: UserResponse
export interface User {
  id: string
  email: string
  fullName: string
  employeeCode?: string
  phone: string | null
  avatarUrl: string | null
  status: UserStatus
  organizationId: string
  memberships: UserMembership[]
  /** Chỉ có khi người này thuộc ≥ 2 nhánh (kiêm nhiệm): "% công sức" từng nhánh, đơn vị chính đứng đầu. */
  effortShares?: UserEffortShare[] | null
  roles: string[]
  permissions?: string[]
  createdAt: string
  updatedAt: string
}

export interface UserEffortShare {
  orgUnitId: string
  orgUnitName: string
  sharePercent: number
  /** true = đặt tay; false = chia đều. */
  configured: boolean
}

// Matches BE: CreateUserRequest
export interface CreateUserRequest {
  fullName: string
  email: string
  employeeCode?: string
  password: string
  phone?: string
  role: UserRole
  orgUnitId: string
}

// Matches BE: UpdateUserRequest
export interface UpdateUserRequest {
  fullName?: string
  email?: string
  phone?: string
  role?: UserRole
  status?: UserStatus
  orgUnitId?: string
}

// Matches BE: ImportUserResponse
export interface ImportUserResult {
  totalRows: number
  successfulImports: number
  errors: string[]
}
