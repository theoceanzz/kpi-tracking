// Đọc @PreAuthorize của các controller backend → bảng "endpoint nào cần quyền gì" cho frontend.
//
//   npm run api:permissions          ghi lại src/lib/apiPermissions.generated.json
//
// Frontend dùng bảng này để KHÔNG gọi API mà người dùng chắc chắn bị 403 (xem src/lib/apiPermissions.ts).
// Bảng sinh ra từ chính code backend nên sửa quyền ở backend thì chạy lại lệnh này — test
// `apiPermissions.test.ts` đỏ nếu quên.
//
// Chỉ đọc luật ở CONTROLLER (class + method). Luật sâu hơn trong service (theo đơn vị, theo người…)
// không đưa vào: bảng này chỉ chặn những lời gọi CHẮC CHẮN bị 403 vì thiếu quyền toàn cục.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const CONTROLLER_DIR = resolve(here, '../../../backend/src/main/java/com/kpitracking/controller')
export const OUTPUT = resolve(here, '../../src/lib/apiPermissions.generated.json')

const MAPPING = /^@(Get|Post|Put|Patch|Delete|Request)Mapping\b/

/** Hằng String trong file (vd ANY_STATS_PERMISSION) — cho @PreAuthorize(TÊN_HẰNG). */
function stringConstants(src) {
  const out = {}
  for (const m of src.matchAll(/static\s+final\s+String\s+(\w+)\s*=\s*((?:"[^"]*"\s*\+?\s*)+);/g)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]*)"/g)].map(x => x[1]).join('')
  }
  return out
}

/** Gom các annotation (có thể nhiều dòng) đứng trước một khai báo. */
function blocks(src) {
  const lines = src.split(/\r?\n/)
  const result = []
  let annos = []
  let cur = null
  let depth = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (cur !== null) {
      cur += ' ' + line
      depth += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length
      if (depth <= 0) { annos.push(cur); cur = null }
      continue
    }
    if (line.startsWith('@')) {
      depth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length
      if (depth > 0) cur = line
      else annos.push(line)
      continue
    }
    if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue
    if (annos.length) {
      result.push({ annos, decl: line })
      annos = []
    }
  }
  return result
}

/** Chuỗi trong annotation: @XMapping("a"), (value = "a"), ({"a","b"}), (path = {...}); không có = "". */
function mappingPaths(anno) {
  const args = anno.replace(MAPPING, '').trim()
  if (!args) return ['']
  const inner = args.slice(1, -1)
  const valuePart = inner.match(/(?:^|,)\s*(?:value|path)\s*=\s*(\{[^}]*\}|"[^"]*")/)
  const target = valuePart ? valuePart[1] : (inner.trim().startsWith('"') || inner.trim().startsWith('{') ? inner : '')
  const strs = [...target.matchAll(/"([^"]*)"/g)].map(m => m[1])
  return strs.length ? strs : ['']
}

function httpMethod(anno) {
  const kind = anno.match(MAPPING)[1]
  if (kind !== 'Request') return kind.toUpperCase()
  const m = anno.match(/RequestMethod\.(\w+)/)
  return m ? m[1] : 'ANY'
}

/**
 * Biểu thức SpEL → luật:
 *   { anyOf: [...] }        hasAuthority / hasAnyAuthority nối bằng `or`
 *   { authenticated: true } isAuthenticated() / permitAll
 *   { platformAdmin: true } @permissionChecker.isPlatformAdmin(...)
 *   { unknown: '<biểu thức>' } dạng khác — frontend KHÔNG kiểm (thà bỏ sót còn hơn chặn nhầm)
 */
export function parseExpression(expr) {
  const e = expr.trim()
  if (/^(isAuthenticated\(\)|permitAll\(\))$/.test(e)) return { authenticated: true }
  if (/^@permissionChecker\.isPlatformAdmin\(authentication\.name\)$/.test(e)) return { platformAdmin: true }
  const parts = e.split(/\s+or\s+/)
  const anyOf = []
  for (const p of parts) {
    const m = p.trim().match(/^has(?:Any)?Authority\(([^)]*)\)$/)
    if (!m) return { unknown: e }
    anyOf.push(...[...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]))
  }
  return anyOf.length ? { anyOf: [...new Set(anyOf)].sort() } : { unknown: e }
}

function preAuthorize(annos, constants) {
  const a = annos.find(x => x.startsWith('@PreAuthorize'))
  if (!a) return null
  const arg = a.slice('@PreAuthorize('.length, -1).trim()
  const expr = arg.startsWith('"') ? [...arg.matchAll(/"([^"]*)"/g)].map(m => m[1]).join('') : constants[arg]
  return expr == null ? { unknown: arg } : parseExpression(expr)
}

const join2 = (a, b) => ('/' + [a, b].filter(Boolean).join('/')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1')

export function extractRules(dir = CONTROLLER_DIR) {
  const rules = []
  for (const file of readdirSync(dir).filter(f => f.endsWith('.java')).sort()) {
    const src = readFileSync(join(dir, file), 'utf8')
    const constants = stringConstants(src)
    const bs = blocks(src)
    const cls = bs.find(b => /\bclass\s+\w+/.test(b.decl))
    if (!cls) continue
    const base = cls.annos.filter(a => a.startsWith('@RequestMapping')).flatMap(mappingPaths)[0] ?? ''
    const classRule = preAuthorize(cls.annos, constants)
    for (const b of bs) {
      if (b === cls) continue
      const mapping = b.annos.find(a => MAPPING.test(a))
      if (!mapping) continue
      const rule = preAuthorize(b.annos, constants) ?? classRule ?? { authenticated: true }
      for (const p of mappingPaths(mapping)) {
        rules.push({ method: httpMethod(mapping), path: join2(base, p), ...rule, source: file })
      }
    }
  }
  return rules.sort((x, y) => (x.path + x.method).localeCompare(y.path + y.method))
}

export function render(rules) {
  return JSON.stringify(rules, null, 2) + '\n'
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rules = extractRules()
  writeFileSync(OUTPUT, render(rules))
  const unknown = rules.filter(r => r.unknown)
  console.log(`Đã ghi ${rules.length} endpoint → ${OUTPUT}`)
  console.log(`  cần quyền: ${rules.filter(r => r.anyOf).length}, chỉ cần đăng nhập: ${rules.filter(r => r.authenticated).length}, quản trị nền tảng: ${rules.filter(r => r.platformAdmin).length}, không đọc được (bỏ qua): ${unknown.length}`)
  unknown.forEach(r => console.log(`  ? ${r.method} ${r.path}  ${r.unknown}`))
}
