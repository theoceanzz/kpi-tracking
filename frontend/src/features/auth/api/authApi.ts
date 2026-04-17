import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { AuthResponse, LoginRequest, RegisterRequest, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest, UserInfo } from '@/types/auth'

export const authApi = {
  login: (data: LoginRequest) =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/login', data).then((r) => r.data.data),

  register: (data: RegisterRequest) =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/register', data).then((r) => r.data.data),

  refreshToken: (refreshToken: string) =>
    axiosInstance.post<ApiResponse<AuthResponse>>('/auth/refresh-token', { refreshToken }).then((r) => r.data.data),

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

  logout: (refreshToken: string) =>
    axiosInstance.post<ApiResponse<void>>('/auth/logout', { refreshToken }).then((r) => r.data),

  getMe: () =>
    axiosInstance.get<ApiResponse<UserInfo>>('/auth/me').then((r) => r.data.data),

  uploadAvatar: (data: FormData) =>
    axiosInstance.post<ApiResponse<UserInfo>>('/auth/me/avatar', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r) => r.data.data),
}
