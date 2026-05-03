export type UserRole = 'DIRECTOR' | 'HEAD' | 'DEPUTY' | 'STAFF'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface UserMembership {
  orgUnitId: string
  organizationId: string
  orgUnitName: string
  organizationName: string
  roleName: string
  roleLabel?: string
  unitTypeLabel?: string
}

// Matches BE: UserInfoResponse
export interface UserInfo {
  id: string
  email: string
  fullName: string
  phone: string | null
  avatarUrl: string | null
  status: UserStatus
  memberships: UserMembership[]
  roles: string[]
  permissions: string[]
  createdAt: string
  updatedAt?: string
}

// Matches BE: AuthResponse
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: UserInfo
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

// Matches BE: ChangePasswordRequest
export interface ChangePasswordRequest {
  currentPassword: string
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

