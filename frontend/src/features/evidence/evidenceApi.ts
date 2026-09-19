import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import type { Attachment } from '@/types/submission'

/** Lượt chấm mà tệp minh chứng gắn vào — khoá đích do backend quy ước (EvidenceTargetType). */
export type EvidenceTargetType = 'PERIOD_EVALUATION' | 'CYCLE_EVALUATION' | 'CONDUCT_EVALUATION'

export interface EvidenceTarget {
  targetType: EvidenceTargetType
  /** PERIOD: "<periodId>:<userId>" · CYCLE: "<cycleId>:<userId>" · CONDUCT: "<scope>:<scopeId>:<userId>". */
  targetKey: string
}

export const evidenceKey = {
  period: (periodId: string, userId: string): EvidenceTarget => ({ targetType: 'PERIOD_EVALUATION', targetKey: `${periodId}:${userId}` }),
  cycle: (cycleId: string, userId: string): EvidenceTarget => ({ targetType: 'CYCLE_EVALUATION', targetKey: `${cycleId}:${userId}` }),
  conduct: (scope: 'PERIOD' | 'CYCLE', scopeId: string, userId: string): EvidenceTarget =>
    ({ targetType: 'CONDUCT_EVALUATION', targetKey: `${scope}:${scopeId}:${userId}` }),
}

export const evidenceApi = {
  list: (t: EvidenceTarget) =>
    axiosInstance.get<ApiResponse<Attachment[]>>('/evidence', { params: t }).then(r => r.data.data),

  upload: (t: EvidenceTarget, files: File[], note?: string) => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    if (note) form.append('note', note)
    return axiosInstance
      .post<ApiResponse<Attachment[]>>('/evidence', form, { params: t, headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data.data)
  },

  remove: (id: string) => axiosInstance.delete<ApiResponse<void>>(`/evidence/${id}`).then(r => r.data),
}
