import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient, shouldRetryQuery } from '@/lib/queryClient'

vi.mock('../api/submissionApi', () => ({
  submissionApi: { getAll: vi.fn(async () => ({ content: [] })), getMy: vi.fn(async () => ({ content: [] })) },
}))
import { submissionApi } from '../api/submissionApi'
import { submissionSourceFor, useEvaluationSubmissions } from './useSubmissions'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)
// Không bật `globals` nên RTL không tự gỡ hook — gỡ tay, không thì hook test trước còn gắn và gọi lại API.
afterEach(cleanup)

const getAll = vi.mocked(submissionApi.getAll)
const getMy = vi.mocked(submissionApi.getMy)

describe('bài nộp trong phiếu đánh giá — đúng API theo người xem', () => {
  beforeEach(() => {
    queryClient.clear()
    getAll.mockClear()
    getMy.mockClear()
  })

  it('submissionSourceFor: phiếu của mình → my, phiếu người khác → all', () => {
    expect(submissionSourceFor('me', 'me')).toBe('my')
    expect(submissionSourceFor('staff', 'boss')).toBe('all')
    expect(submissionSourceFor(null, 'me')).toBeNull()
  })

  it('nhân viên tự đánh giá: gọi /submissions/my, KHÔNG gọi /submissions (cần SUBMISSION:REVIEW → 403)', async () => {
    renderHook(() => useEvaluationSubmissions({ evaluationUserId: 'nv', myUserId: 'nv', kpiPeriodId: 'p1', enabled: true }), { wrapper })
    await waitFor(() => expect(getMy).toHaveBeenCalledWith({ page: 0, size: 500, kpiPeriodId: 'p1' }))
    expect(getAll).not.toHaveBeenCalled()
  })

  it('quản lý xem phiếu nhân viên: gọi /submissions lọc theo người đó', async () => {
    renderHook(() => useEvaluationSubmissions({ evaluationUserId: 'nv', myUserId: 'boss', kpiPeriodId: 'p1', enabled: true }), { wrapper })
    await waitFor(() => expect(getAll).toHaveBeenCalledWith({ page: 0, size: 500, submittedById: 'nv', kpiPeriodId: 'p1' }))
    expect(getMy).not.toHaveBeenCalled()
  })

  it('modal còn đóng (trang Đánh giá gắn sẵn modal): không gọi gì', async () => {
    renderHook(() => useEvaluationSubmissions({ evaluationUserId: undefined, myUserId: 'nv', kpiPeriodId: undefined, enabled: false }), { wrapper })
    await act(async () => { await Promise.resolve() })
    expect(getAll).not.toHaveBeenCalled()
    expect(getMy).not.toHaveBeenCalled()
  })
})

describe('shouldRetryQuery — không gọi lại lỗi 4xx', () => {
  const err = (status?: number) => (status ? { response: { status } } : new Error('network'))

  it('403/401/404/422: không thử lại (gọi lại vẫn ra đúng lỗi đó)', () => {
    for (const s of [401, 403, 404, 422]) expect(shouldRetryQuery(0, err(s))).toBe(false)
  })

  it('lỗi mạng / 5xx: thử lại đúng 1 lần', () => {
    expect(shouldRetryQuery(0, err())).toBe(true)
    expect(shouldRetryQuery(0, err(503))).toBe(true)
    expect(shouldRetryQuery(1, err(503))).toBe(false)
  })
})
