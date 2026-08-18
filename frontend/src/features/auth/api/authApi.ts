import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { AuthResponse, LoginRequest, RegisterRequest, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest, UserInfo, LarkAuthorizeUrl } from '@/types/auth'

export const authApi = {
  login: (data: LoginRequest) =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/login', data).then((r) => r.data.data),

  register: (data: RegisterRequest) =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/register', data).then((r) => r.data.data),

  // Không truyền token: cookie HttpOnly kg_rt / kg_at mang phiên, backend ghi đè cookie mới.
  refreshToken: () =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/refresh-token').then((r) => r.data.data),

  getLarkAuthorizeUrl: (organizationId: string) =>
    axiosInstance
      .get<ApiResponse<LarkAuthorizeUrl>>('/auth/lark/authorize-url', { params: { organizationId } })
      .then((r) => r.data.data),

  larkCallback: (code: string, state: string) =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/lark/callback', { code, state }).then((r) => r.data.data),

  changePassword: (data: ChangePasswordRequest) =>
    axiosInstance.post<ApiResponse<void>>('/auth/change-password', data).then((r) => r.data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    axiosInstance.post<ApiResponse<void>>('/auth/forgot-password', data).then((r) => r.data),

  resetPassword: (data: ResetPasswordRequest) =>
    axiosInstance.post<ApiResponse<void>>('/auth/reset-password', data).then((r) => r.data),

  verifyEmail: (token: string) =>
    axiosInstance.get<ApiResponse<void>>('/auth/verify-email', { params: { token } }).then((r) => r.data),

  resendVerification: (email: string) =>
    axiosInstance.post<ApiResponse<void>>('/auth/resend-verification', { email }).then((r) => r.data),

  // Bắt buộc gọi khi đăng xuất: chỉ backend mới xoá được cookie HttpOnly và thu hồi refresh token.
  logout: () =>
    axiosInstance.post<ApiResponse<void>>('/auth/logout').then((r) => r.data),

  getMe: () =>
    axiosInstance.get<ApiResponse<UserInfo>>('/auth/me').then((r) => r.data.data),

  uploadAvatar: (data: FormData) =>
    axiosInstance.post<ApiResponse<UserInfo>>('/auth/me/avatar', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r) => r.data.data),
  
  completeOnboarding: () =>
    axiosInstance.post<ApiResponse<void>>('/auth/me/onboarding').then((r) => r.data),
}
