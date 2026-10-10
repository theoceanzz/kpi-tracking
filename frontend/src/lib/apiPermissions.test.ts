import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { InternalAxiosRequestConfig } from 'axios'
import { extractRules, OUTPUT, parseExpression, render } from '../../tools/api-permissions/extract.mjs'
import { findRule, missingPermission, PermissionPrecheckError, requestPath } from './apiPermissions'
import axiosInstance from './axios'
import { useAuthStore } from '@/store/authStore'
import type { UserInfo } from '@/types/auth'

const V1 = '/api/v1'
const person = (permissions: string[], isPlatformAdmin = false): UserInfo => ({
  id: 'u', email: 'u@co.vn', fullName: 'U', employeeCode: null, phone: null, avatarUrl: null,
  status: 'ACTIVE' as UserInfo['status'], roles: [], permissions, createdAt: '', isPlatformAdmin,
  memberships: [{ organizationId: 'org', orgUnitId: 'unit', organizationName: 'Co' } as unknown as UserInfo['memberships'][number]],
})
const STAFF = person(['SUBMISSION:CREATE', 'EVALUATION:VIEW_MY', 'KPI:VIEW_MY'])
const REVIEWER = person(['SUBMISSION:REVIEW', 'ORG:VIEW_TREE'])

describe('bảng quyền sinh từ @PreAuthorize', () => {
  it('KHỚP với code backend hiện tại — sửa @PreAuthorize thì chạy `npm run api:permissions`', () => {
    expect(readFileSync(OUTPUT, 'utf8').replace(/\r\n/g, '\n')).toBe(render(extractRules()))
  })

  it('không còn biểu thức nào không đọc được (đọc không được = không kiểm)', () => {
    expect(extractRules().filter(r => 'unknown' in r)).toEqual([])
  })

  it('đọc đúng các dạng biểu thức', () => {
    expect(parseExpression("hasAuthority('A')")).toEqual({ anyOf: ['A'] })
    expect(parseExpression("hasAnyAuthority('B', 'A')")).toEqual({ anyOf: ['A', 'B'] })
    expect(parseExpression("hasAuthority('A') or hasAuthority('C')")).toEqual({ anyOf: ['A', 'C'] })
    expect(parseExpression('isAuthenticated()')).toEqual({ authenticated: true })
    expect(parseExpression('@permissionChecker.isPlatformAdmin(authentication.name)')).toEqual({ platformAdmin: true })
    expect(parseExpression("hasAuthority('A') and hasAuthority('B')")).toHaveProperty('unknown')
  })
})

describe('tra luật cho một request', () => {
  it('đoạn cố định thắng đoạn biến: /submissions/my không bị coi là /submissions/{id}', () => {
    expect(findRule('GET', `${V1}/submissions/my`)?.path).toBe(`${V1}/submissions/my`)
    expect(findRule('GET', `${V1}/submissions`)?.anyOf).toEqual(['SUBMISSION:REVIEW', 'SUBMISSION:REVIEW_KPI'])
    expect(findRule('GET', `${V1}/organizations/abc/units/tree`)?.anyOf).toEqual(['ORG:VIEW', 'ORG:VIEW_TREE'])
  })

  it('method khác nhau là luật khác nhau', () => {
    expect(findRule('POST', `${V1}/submissions`)?.authenticated).toBe(true)
  })

  it('requestPath: ghép baseURL tương đối/tuyệt đối, bỏ query', () => {
    expect(requestPath('/submissions?page=0', '/api/v1')).toBe(`${V1}/submissions`)
    expect(requestPath('/submissions', 'https://api.keygo.vn/api/v1')).toBe(`${V1}/submissions`)
    expect(requestPath('organizations/x/units/tree', '/api/v1/')).toBe(`${V1}/organizations/x/units/tree`)
  })

  it('đúng hai lời gọi gây lỗi prod 2026-10-06: nhân viên bị chặn, người duyệt thì không', () => {
    for (const path of [`${V1}/submissions`, `${V1}/organizations/abc/units/tree`]) {
      expect(missingPermission('GET', path, STAFF)).not.toBeNull()
      expect(missingPermission('GET', path, REVIEWER)).toBeNull()
    }
    expect(missingPermission('GET', `${V1}/submissions/my`, STAFF)).toBeNull()
  })

  it('chưa đăng nhập / endpoint lạ: không chặn (backend tự xử)', () => {
    expect(missingPermission('GET', `${V1}/submissions`, null)).toBeNull()
    expect(missingPermission('GET', `${V1}/khong-co-endpoint-nay`, STAFF)).toBeNull()
  })
})

describe('axios: chặn TRƯỚC khi gửi (chế độ block — mặc định khi dev/test)', () => {
  // Thay tầng mạng: request nào thật sự "đi ra" thì adapter được gọi.
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
    ({ data: { data: [] }, status: 200, statusText: 'OK', headers: {}, config }))
  const original = axiosInstance.defaults.adapter

  beforeEach(() => {
    adapter.mockClear()
    axiosInstance.defaults.adapter = adapter as never
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    axiosInstance.defaults.adapter = original
    useAuthStore.setState({ user: null, isAuthenticated: false })
    vi.restoreAllMocks()
  })

  it('nhân viên gọi GET /submissions: không có request nào đi ra, nhận lỗi dạng 403', async () => {
    useAuthStore.setState({ user: STAFF, isAuthenticated: true })
    const err = await axiosInstance.get('/submissions').catch(e => e)
    expect(err).toBeInstanceOf(PermissionPrecheckError)
    expect(err.response.status).toBe(403)
    expect(adapter).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('GET /api/v1/submissions'))
  })

  it('nhân viên gọi /submissions/my và người duyệt gọi /submissions: đi bình thường', async () => {
    useAuthStore.setState({ user: STAFF, isAuthenticated: true })
    await axiosInstance.get('/submissions/my')
    useAuthStore.setState({ user: REVIEWER, isAuthenticated: true })
    await axiosInstance.get('/submissions')
    expect(adapter).toHaveBeenCalledTimes(2)
  })
})
