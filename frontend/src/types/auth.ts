export type UserRole = 'DIRECTOR' | 'HEAD' | 'DEPUTY_HEAD' | 'STAFF'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

// Matches BE: UserInfoResponse
export interface UserInfo {
  id: string
  email: string
  fullName: string
  phone: string | null
  avatarUrl: string | null
  role: UserRole
  status: UserStatus
  companyId: string
  companyName: string
}

// Matches BE: AuthResponse
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  user: UserInfo
}

// Matches BE: LoginRequest
export interface LoginRequest {
  email: string
  password: string
}

// Matches BE: RegisterRequest
export interface RegisterRequest {
  companyName: string
  taxCode?: string
  fullName: string
  email: string
  password: string
  phone?: string
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
