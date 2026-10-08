import { describe, expect, it } from 'vitest'
import { canViewOrgTree, needsOrganization, orgIdOf } from './session'
import type { UserInfo } from '@/types/auth'

const user = (over: Partial<UserInfo> = {}): UserInfo => ({
  id: 'u1', email: 'a@zam.vn', fullName: 'A', employeeCode: null, phone: null, avatarUrl: null,
  status: 'ACTIVE' as UserInfo['status'], memberships: [], roles: [], permissions: [], createdAt: '',
  ...over,
})

const membership = (organizationId: string) =>
  ({ organizationId, orgUnitId: 'unit', organizationName: 'Org' }) as unknown as UserInfo['memberships'][number]

describe('orgIdOf', () => {
  it('lấy tổ chức của membership đầu tiên', () => {
    expect(orgIdOf(user({ memberships: [membership('org-A'), membership('org-B')] }))).toBe('org-A')
  })

  it('không có user / không có membership → undefined', () => {
    expect(orgIdOf(null)).toBeUndefined()
    expect(orgIdOf(user())).toBeUndefined()
  })
})

describe('needsOrganization', () => {
  it('chưa đăng nhập → false (để ProtectedRoute đưa về /login, không phải /no-organization)', () => {
    expect(needsOrganization(null)).toBe(false)
  })

  it('theo cờ backend khi có', () => {
    expect(needsOrganization(user({ needsOrganization: true, memberships: [membership('x')] }))).toBe(true)
    expect(needsOrganization(user({ needsOrganization: false }))).toBe(false)
  })

  it('hồ sơ cache bản cũ (thiếu cờ): suy ra từ memberships', () => {
    expect(needsOrganization(user())).toBe(true)
    expect(needsOrganization(user({ memberships: [membership('org-A')] }))).toBe(false)
  })

  it('quản trị nền tảng không cần tổ chức', () => {
    expect(needsOrganization(user({ isPlatformAdmin: true, needsOrganization: true }))).toBe(false)
  })
})

describe('canViewOrgTree — khớp @PreAuthorize của OrgUnitController', () => {
  it('ORG:VIEW hoặc ORG:VIEW_TREE thì được, nhân viên thường thì không', () => {
    expect(canViewOrgTree(user({ permissions: ['ORG:VIEW'] }))).toBe(true)
    expect(canViewOrgTree(user({ permissions: ['ORG:VIEW_TREE'] }))).toBe(true)
    expect(canViewOrgTree(user({ permissions: ['SUBMISSION:CREATE', 'EVALUATION:VIEW_MY'] }))).toBe(false)
    expect(canViewOrgTree(null)).toBe(false)
  })
})
