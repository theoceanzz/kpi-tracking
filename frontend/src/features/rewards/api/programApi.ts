import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type {
  RewardProgram,
  RewardProgramRequest,
  RewardProgramRun,
  RewardTier,
} from '../types'

export const programApi = {
  getAll: () =>
    axiosInstance.get<ApiResponse<RewardProgram[]>>('/reward-programs').then((r) => r.data.data),

  getById: (id: string) =>
    axiosInstance
      .get<ApiResponse<RewardProgram>>(`/reward-programs/${id}`)
      .then((r) => r.data.data),

  create: (data: RewardProgramRequest) =>
    axiosInstance
      .post<ApiResponse<RewardProgram>>('/reward-programs', data)
      .then((r) => r.data.data),

  update: (id: string, data: RewardProgramRequest) =>
    axiosInstance
      .put<ApiResponse<RewardProgram>>(`/reward-programs/${id}`, data)
      .then((r) => r.data.data),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/reward-programs/${id}`).then((r) => r.data),

  /**
   * Tính bảng xếp hạng thành bản xem trước. Chưa phát điểm cho ai.
   *
   * @param tiers bậc thưởng riêng cho lần chạy này; bỏ trống thì dùng bậc mặc định
   *              của chương trình
   */
  preview: (programId: string, targetId: string, tiers?: RewardTier[]) =>
    axiosInstance
      .post<ApiResponse<RewardProgramRun>>(`/reward-programs/${programId}/preview`, {
        targetId,
        tiers,
      })
      .then((r) => r.data.data),

  getRuns: (programId: string) =>
    axiosInstance
      .get<ApiResponse<RewardProgramRun[]>>(`/reward-programs/${programId}/runs`)
      .then((r) => r.data.data),

  getRun: (runId: string) =>
    axiosInstance
      .get<ApiResponse<RewardProgramRun>>(`/reward-program-runs/${runId}`)
      .then((r) => r.data.data),

  /** Phát thưởng thật. Backend so vân tay với bản xem trước trước khi ghi sổ cái. */
  issue: (runId: string) =>
    axiosInstance
      .post<ApiResponse<RewardProgramRun>>(`/reward-program-runs/${runId}/issue`)
      .then((r) => r.data.data),

  revert: (runId: string) =>
    axiosInstance
      .post<ApiResponse<RewardProgramRun>>(`/reward-program-runs/${runId}/revert`)
      .then((r) => r.data.data),
}
