export type UserRole = string // Roles are dynamic and user-defined
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface UserMembership {
  orgUnitId: string
  organizationId: string
  orgUnitName: string
  orgUnitCode: string
  organizationName: string
  roleName: string
  roleDisplayName?: string
  roleRank?: number
  levelOrder?: number
  roleLevel?: number
  unitTypeLabel?: string
}

// Matches BE: UserInfoResponse
export interface UserInfo {
  id: string
  email: string
  fullName: string
  employeeCode: string | null
  phone: string | null
  avatarUrl: string | null
  status: UserStatus
  memberships: UserMembership[]
  roles: string[]
  permissions: string[]
  createdAt: string
  updatedAt?: string
  requirePasswordChange?: boolean
  hasSeenOnboarding?: boolean
  isPlatformAdmin?: boolean
}

// Matches BE: AuthResponse
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: UserInfo
  hasSeenOnboarding?: boolean
}

export interface HierarchyLevel {
  unitTypeName: string
  managerRoleLabel?: string
}

// Matches BE: LoginRequest
export interface LoginRequest {
  email: string
  password: string
}

// Matches BE: RegisterRequest
export interface RegisterRequest {
  organizationName: string
  organizationCode: string
  fullName: string
  email: string
  password: string
  phone?: string
  hierarchyLevels: HierarchyLevel[]
}

export interface ChangePasswordRequest {
  currentPassword?: string
  newPassword: string
  confirmPassword: string
}

// Matches BE: ForgotPasswordRequest
export interface ForgotPasswordRequest {
  email: string
}

// Matches BE: ResetPasswordRequest
export interface ResetPasswordRequest {
  token: string
  newPassword: string
  confirmPassword: string
}
