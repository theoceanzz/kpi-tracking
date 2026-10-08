import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/lib/queryClient'
import { resetSession, useAuthStore } from '@/store/authStore'
import type { UserInfo } from '@/types/auth'

vi.mock('../api/orgUnitApi', () => ({
  orgUnitApi: { getTree: vi.fn(async () => []), getSubtree: vi.fn(async () => []), getChain: vi.fn(async () => []) },
}))
import { orgUnitApi } from '../api/orgUnitApi'
import { useOrgUnitSubtree, useOrgUnitTree } from './useOrgUnitTree'

/** Ba tài khoản CÙNG một công ty — đúng kịch bản log prod (cùng org, đổi tài khoản). */
const ORG = 'org-same-company'
const person = (id: string, permissions: string[]): UserInfo => ({
  id, email: `${id}@co.vn`, fullName: id, employeeCode: null, phone: null, avatarUrl: null,
  status: 'ACTIVE' as UserInfo['status'], roles: [], permissions, createdAt: '',
  memberships: [{ organizationId: ORG, orgUnitId: 'unit-1', organizationName: 'Co' } as unknown as UserInfo['memberships'][number]],
})
const DIRECTOR = person('giam-doc', ['ORG:VIEW', 'SUBMISSION:REVIEW', 'EVALUATION:VIEW'])
const UNIT_HEAD = person('truong-don-vi', ['ORG:VIEW_TREE', 'SUBMISSION:REVIEW'])
const STAFF = person('nhan-vien', ['SUBMISSION:CREATE', 'EVALUATION:VIEW_MY'])

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)
// Không bật `globals` nên RTL không tự gỡ hook — gỡ tay, không thì hook test trước còn gắn và gọi lại API.
afterEach(cleanup)

const getTree = vi.mocked(orgUnitApi.getTree)
const getSubtree = vi.mocked(orgUnitApi.getSubtree)

describe('useOrgUnitTree — chỉ gọi khi có quyền xem cây đơn vị (ORG:VIEW / ORG:VIEW_TREE)', () => {
  beforeEach(() => {
    localStorage.clear()
    queryClient.clear()
    getTree.mockClear()
    getSubtree.mockClear()
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })
  afterEach(() => queryClient.clear())

  it('nhân viên (không có quyền): KHÔNG gọi /units/tree — trước đây ăn 403 hàng loạt', async () => {
    useAuthStore.getState().setAuth(STAFF)
    const { result } = renderHook(() => useOrgUnitTree(), { wrapper })
    await act(async () => { await Promise.resolve() })
    expect(getTree).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
    expect(result.current.isError).toBe(false)
  })

  it('nhân viên: cũng KHÔNG gọi /units/{id}/subtree', async () => {
    useAuthStore.getState().setAuth(STAFF)
    renderHook(() => useOrgUnitSubtree('unit-1'), { wrapper })
    await act(async () => { await Promise.resolve() })
    expect(getSubtree).not.toHaveBeenCalled()
  })

  it('giám đốc (ORG:VIEW) và trưởng đơn vị (ORG:VIEW_TREE): có gọi', async () => {
    for (const u of [DIRECTOR, UNIT_HEAD]) {
      getTree.mockClear()
      useAuthStore.getState().setAuth(u)
      const { unmount } = renderHook(() => useOrgUnitTree(), { wrapper })
      await waitFor(() => expect(getTree).toHaveBeenCalledWith(ORG))
      unmount()
    }
  })

  it('cùng công ty: giám đốc → đăng xuất → nhân viên — không mang cây của giám đốc sang, không gọi API', async () => {
    useAuthStore.getState().setAuth(DIRECTOR)
    const first = renderHook(() => useOrgUnitTree(), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    resetSession()
    useAuthStore.getState().setAuth(STAFF)
    getTree.mockClear()

    const { result } = renderHook(() => useOrgUnitTree(), { wrapper })
    await act(async () => { await Promise.resolve() })
    expect(getTree).not.toHaveBeenCalled()
    // Cùng orgId nên cùng queryKey — nếu cache không được dọn, nhân viên sẽ "thấy" cây của giám đốc.
    expect(result.current.data).toBeUndefined()
  })

  it('cùng công ty: giám đốc → đăng xuất → trưởng đơn vị — tải lại cây theo quyền của trưởng đơn vị', async () => {
    useAuthStore.getState().setAuth(DIRECTOR)
    const first = renderHook(() => useOrgUnitTree(), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    resetSession()
    useAuthStore.getState().setAuth(UNIT_HEAD)
    getTree.mockClear()

    renderHook(() => useOrgUnitTree(), { wrapper })
    await waitFor(() => expect(getTree).toHaveBeenCalledTimes(1))
  })
})
