// Kiểu cho test (src/lib/apiPermissions.test.ts) import script sinh bảng quyền.
export const CONTROLLER_DIR: string
export const OUTPUT: string
export function parseExpression(expr: string): Record<string, unknown>
export function extractRules(dir?: string): Record<string, unknown>[]
export function render(rules: Record<string, unknown>[]): string
