import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY, resetSession, useAuthStore } from './authStore'
import { queryClient } from '@/lib/queryClient'
import { usePinnedFilesStore } from './pinnedFilesStore'
import type { UserInfo } from '@/types/auth'

const user = (id: string, orgId?: string): UserInfo => ({
  id, email: `${id}@test.vn`, fullName: id, employeeCode: null, phone: null, avatarUrl: null,
  status: 'ACTIVE' as UserInfo['status'], roles: [], permissions: [], createdAt: '',
  memberships: orgId
    ? [{ organizationId: orgId, orgUnitId: 'unit', organizationName: orgId } as unknown as UserInfo['memberships'][number]]
    : [],
})

const A = user('user-A', 'org-A')
const B = user('user-B', 'org-B')

/** Mô phỏng dữ liệu của phiên đang chạy: cache tổ chức, nháp form, tệp ghim. */
function seedSessionData(orgId: string) {
  queryClient.setQueryData(['organization', orgId], { id: orgId, name: `Công ty ${orgId}` })
  localStorage.setItem(`kg-draft:v1:${useAuthStore.getState().user?.id}:kpi:new`, JSON.stringify({ savedAt: Date.now(), values: { name: 'x' } }))
  usePinnedFilesStore.getState().pin([new File(['x'], 'a.txt')])
}

const draftKeys = () => Object.keys(localStorage).filter(k => k.startsWith('kg-draft:'))

describe('authStore — chuyển tài khoản không để lại dữ liệu của người trước', () => {
  beforeEach(() => {
    localStorage.clear()
    queryClient.clear()
    usePinnedFilesStore.getState().clear()
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('đăng nhập A → đăng xuất → đăng nhập B: không còn cache, nháp, tệp ghim của A', () => {
    useAuthStore.getState().setAuth(A)
    seedSessionData('org-A')

    resetSession()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    useAuthStore.getState().setAuth(B)
    expect(useAuthStore.getState().user?.memberships[0]?.organizationId).toBe('org-B')
    expect(queryClient.getQueryData(['organization', 'org-A'])).toBeUndefined()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(draftKeys()).toHaveLength(0)
    expect(usePinnedFilesStore.getState().files).toHaveLength(0)
  })

  it('đăng nhập B đè lên phiên A chưa đăng xuất (phiên A hết hạn): vẫn dọn sạch', () => {
    useAuthStore.getState().setAuth(A)
    seedSessionData('org-A')

    useAuthStore.getState().setAuth(B)

    expect(queryClient.getQueryData(['organization', 'org-A'])).toBeUndefined()
    expect(draftKeys()).toHaveLength(0)
  })

  it('đăng nhập lại đúng người cũ: dọn cache nhưng giữ nháp form', () => {
    useAuthStore.getState().setAuth(A)
    seedSessionData('org-A')

    useAuthStore.getState().setAuth(A)

    expect(queryClient.getQueryData(['organization', 'org-A'])).toBeUndefined()
    expect(draftKeys()).toHaveLength(1)
  })

  it('setUser (/auth/me) cùng người, cùng tổ chức: giữ cache', () => {
    useAuthStore.getState().setAuth(A)
    seedSessionData('org-A')

    useAuthStore.getState().setUser({ ...A, fullName: 'A mới' })

    expect(queryClient.getQueryData(['organization', 'org-A'])).toBeDefined()
    expect(useAuthStore.getState().user?.fullName).toBe('A mới')
  })

  it('setUser (/auth/me) trả người khác: dọn cache và dùng orgId mới', () => {
    useAuthStore.getState().setAuth(A)
    seedSessionData('org-A')

    useAuthStore.getState().setUser(B)

    expect(queryClient.getQueryData(['organization', 'org-A'])).toBeUndefined()
    expect(useAuthStore.getState().user?.memberships[0]?.organizationId).toBe('org-B')
  })

  it('setUser cùng người nhưng đổi tổ chức: dọn cache', () => {
    useAuthStore.getState().setAuth(A)
    seedSessionData('org-A')

    useAuthStore.getState().setUser(user('user-A', 'org-C'))

    expect(queryClient.getQueryData(['organization', 'org-A'])).toBeUndefined()
  })

  it('chỉ lưu hồ sơ + cờ đăng nhập vào localStorage, không có token', () => {
    useAuthStore.getState().setAuth(A)
    const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!)
    expect(Object.keys(saved.state).sort()).toEqual(['isAuthenticated', 'user'])
  })
})

describe('authStore — đồng bộ giữa các tab', () => {
  const reload = vi.fn()

  beforeEach(() => {
    reload.mockReset()
    // jsdom không cho gán location.reload trực tiếp — thay cả location.
    vi.stubGlobal('location', { ...window.location, reload })
    useAuthStore.setState({ user: A, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const otherTabWrites = (u: UserInfo | null) => {
    const newValue = JSON.stringify({ state: { user: u, isAuthenticated: !!u }, version: 1 })
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY, newValue }))
  }

  it('tab khác đăng nhập tài khoản khác → tải lại trang', () => {
    otherTabWrites(B)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('tab khác đăng xuất → tải lại trang', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY, newValue: null }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('tab khác chỉ cập nhật hồ sơ cùng người cùng tổ chức → không tải lại', () => {
    otherTabWrites({ ...A, fullName: 'A mới' })
    expect(reload).not.toHaveBeenCalled()
  })

  it('key khác (theme, sidebar…) → bỏ qua', () => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'kpi-theme', newValue: '{}' }))
    expect(reload).not.toHaveBeenCalled()
  })
})
