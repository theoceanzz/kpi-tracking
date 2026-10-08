import rulesJson from './apiPermissions.generated.json'
import type { UserInfo } from '@/types/auth'

/**
 * Bảng quyền của từng endpoint, SINH TỰ ĐỘNG từ @PreAuthorize của controller backend
 * (`npm run api:permissions`, script `tools/api-permissions/extract.mjs`).
 *
 * Mục đích: frontend biết trước một lời gọi CHẮC CHẮN bị 403 vì người dùng thiếu quyền toàn cục —
 * loại lỗi "màn của nhân viên gọi API của quản lý" (log prod 2026-10-06: nhân viên gọi
 * `GET /submissions` và cây đơn vị, ăn 403 hàng loạt). Luật sâu hơn trong service (theo đơn vị, theo
 * người…) không nằm ở đây — backend vẫn là nơi quyết định.
 */
export interface ApiPermissionRule {
  method: string
  path: string
  /** Cần ít nhất một trong các quyền này. */
  anyOf?: string[]
  authenticated?: boolean
  platformAdmin?: boolean
  /** Biểu thức không đọc được — không kiểm (thà bỏ sót còn hơn chặn nhầm). */
  unknown?: string
  source: string
}

interface CompiledRule extends ApiPermissionRule {
  regex: RegExp
  /** Số đoạn đường dẫn cố định — đoạn cố định thắng đoạn biến (`/submissions/my` thắng `/submissions/{id}`). */
  literalSegments: number
}

const compile = (r: ApiPermissionRule): CompiledRule => {
  const segments = r.path.split('/').filter(Boolean)
  const pattern = segments
    .map(s => (/^\{.+\}$/.test(s) ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/')
  return {
    ...r,
    regex: new RegExp(`^/${pattern}/?$`),
    literalSegments: segments.filter(s => !/^\{.+\}$/.test(s)).length,
  }
}

const RULES: CompiledRule[] = (rulesJson as ApiPermissionRule[])
  .map(compile)
  .sort((a, b) => b.literalSegments - a.literalSegments)

/** Đường dẫn đầy đủ (`/api/v1/...`, bỏ query) của một request axios. */
export function requestPath(url: string | undefined, baseURL: string | undefined): string {
  const raw = url ?? ''
  if (/^https?:\/\//.test(raw)) return new URL(raw).pathname
  const basePath = baseURL
    ? (/^https?:\/\//.test(baseURL) ? new URL(baseURL).pathname : baseURL)
    : ''
  const path = raw.split('?')[0] ?? ''
  return `/${basePath}/${path}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1')
}

/** Luật áp cho một request; `undefined` = endpoint không có trong bảng (không kiểm). */
export function findRule(method: string, path: string): ApiPermissionRule | undefined {
  const m = method.toUpperCase()
  return RULES.find(r => r.method === m && r.regex.test(path))
}

/**
 * Lý do người dùng CHẮC CHẮN bị chặn khi gọi endpoint này, hoặc `null` nếu được gọi / không biết.
 * Quyền đọc từ `user.permissions` — cùng một hàm backend dùng để dựng authority trong JWT.
 */
export function missingPermission(
  method: string,
  path: string,
  user: Pick<UserInfo, 'permissions' | 'isPlatformAdmin'> | null | undefined,
): { rule: ApiPermissionRule; reason: string } | null {
  const rule = findRule(method, path)
  if (!rule || !user) return null
  if (rule.platformAdmin && !user.isPlatformAdmin) return { rule, reason: 'requires platform admin' }
  if (rule.anyOf?.length) {
    const perms = user.permissions ?? []
    if (!rule.anyOf.some(p => perms.includes(p))) return { rule, reason: `requires one of: ${rule.anyOf.join(', ')}` }
  }
  return null
}

/** Lỗi trả cho chỗ gọi khi lời gọi bị chặn trước — hình dạng giống 403 thật để UI xử lý y như nhau. */
export class PermissionPrecheckError extends Error {
  readonly code = 'ERR_PERMISSION_PRECHECK'
  readonly response: { status: 403; data: { code: string; message: string } }
  constructor(method: string, path: string, reason: string) {
    super(`[permission precheck] ${method.toUpperCase()} ${path} blocked before sending: ${reason}`)
    this.response = { status: 403, data: { code: 'ACCESS_DENIED', message: this.message } }
  }
}
