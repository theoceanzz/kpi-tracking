// Kiểm tra bản dịch (chạy: `npm run i18n:check`). Thiết kế: docs/I18N_DESIGN.md §3.1, §4.2.
//
// 1. Key của mọi ngôn ngữ phải có trong bản gốc tiếng Việt (không có key "mồ côi").
// 2. Namespace đã "reviewed" phải đủ key như bản tiếng Việt; namespace "draft" chỉ cảnh báo.
// 3. Biến nội suy {{x}} của bản dịch phải khớp bản tiếng Việt.
// 4. Không dùng từ cấm theo glossary (scripts/i18n/forbidden-terms.json), kể cả trong bản nháp,
//    và cả trong backend/src/main/resources/i18n/{messages,notifications,exports}_en.properties.
//
// Thoát với mã 1 nếu có lỗi.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(here, '..', '..')
const localesDir = join(frontendRoot, 'src', 'locales')
const SOURCE = 'vi'

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const reviewStatus = readJson(join(localesDir, 'review-status.json'))
const { terms } = readJson(join(here, 'forbidden-terms.json'))

const errors = []
const warnings = []

/** { 'a.b.c': 'value' }. Hậu tố số nhiều (_one, _other...) bị bỏ khi so khớp key giữa hai ngôn ngữ. */
function flatten(obj, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') flatten(value, path, out)
    else out[path] = String(value)
  }
  return out
}
const PLURAL = /_(zero|one|two|few|many|other)$/
const baseKey = (key) => key.replace(PLURAL, '')
const variables = (text) => new Set([...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)].map((m) => m[1]))

const languages = readdirSync(localesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
const namespacesOf = (lang) =>
  readdirSync(join(localesDir, lang)).filter((f) => f.endsWith('.json')).map((f) => basename(f, '.json'))

const source = Object.fromEntries(namespacesOf(SOURCE).map((ns) => [ns, flatten(readJson(join(localesDir, SOURCE, `${ns}.json`)))]))

function checkForbidden(lang, ns, key, text, where, sourceText = '') {
  if (lang === SOURCE) return
  for (const term of terms) {
    if (term.namespaces?.length && ns && !term.namespaces.includes(ns)) continue
    if (term.allowKeys?.includes(`${ns}:${key}`)) continue
    // Câu gốc chứa từ biện minh (vd. 'phòng ban' → department) thì bản dịch là đúng.
    if (term.unlessSource && new RegExp(term.unlessSource, 'i').test(sourceText)) continue
    if (new RegExp(term.pattern, 'i').test(text)) {
      errors.push(`${where}: "${text}" dùng từ cấm /${term.pattern}/ — dùng "${term.use}" (docs/i18n/GLOSSARY.md)`)
    }
  }
}

for (const lang of languages.filter((l) => l !== SOURCE)) {
  for (const ns of namespacesOf(lang)) {
    const where = `${lang}/${ns}.json`
    const translated = flatten(readJson(join(localesDir, lang, `${ns}.json`)))
    const sourceNs = source[ns]
    if (!sourceNs) {
      errors.push(`${where}: không có namespace tương ứng trong ${SOURCE}/`)
      continue
    }
    const sourceBase = new Map(Object.entries(sourceNs).map(([k, v]) => [baseKey(k), v]))
    const translatedBase = new Set(Object.keys(translated).map(baseKey))

    for (const [key, text] of Object.entries(translated)) {
      const original = sourceBase.get(baseKey(key))
      checkForbidden(lang, ns, key, text, `${where} › ${key}`, original ?? '')
      if (original === undefined) {
        errors.push(`${where} › ${key}: key không có trong bản gốc ${SOURCE}/${ns}.json`)
        continue
      }
      const want = [...variables(original)].sort().join(',')
      const got = [...variables(text)].sort().join(',')
      if (want !== got) errors.push(`${where} › ${key}: biến nội suy {${got}} khác bản gốc {${want}}`)
    }

    const status = reviewStatus[lang]?.[ns] ?? 'missing'
    const missing = [...sourceBase.keys()].filter((k) => !translatedBase.has(k))
    if (missing.length) {
      const msg = `${where}: thiếu ${missing.length} key so với bản gốc (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''})`
      if (status === 'reviewed') errors.push(msg)
      else warnings.push(`${msg} — namespace đang "${status}"`)
    }
  }
  for (const ns of Object.keys(source)) {
    if (!existsSync(join(localesDir, lang, `${ns}.json`))) warnings.push(`${lang}/${ns}.json: chưa có bản dịch`)
  }
}

// Backend: messages / notifications / exports. So từ cấm với câu gốc tiếng Việt cùng key để unlessSource
// áp dụng được (vd. 'phòng ban' → department là đúng). Namespace 'backend' — luật chỉ dành cho một
// namespace frontend (vd. delegat ở 'kpi') không áp vào đây: uỷ quyền ở backend là OrgUnitDelegation.
const backendDir = join(frontendRoot, '..', 'backend', 'src', 'main', 'resources', 'i18n')
const readProps = (file) => {
  const out = {}
  if (!existsSync(file)) return out
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const m = /^([^#!\s][^=]*)=(.*)$/.exec(line)
    if (m) out[m[1].trim()] = { text: m[2], line: i + 1 }
  })
  return out
}
for (const bundle of ['messages', 'notifications', 'exports']) {
  const vi = readProps(join(backendDir, `${bundle}.properties`))
  const en = readProps(join(backendDir, `${bundle}_en.properties`))
  for (const [key, { text, line }] of Object.entries(en)) {
    checkForbidden('en', 'backend', key, text, `${bundle}_en.properties:${line}`, vi[key]?.text ?? '')
  }
}

// ── 5. Mọi key dùng trong code phải có trong bản gốc tiếng Việt ─────────────────────────
// Thay cho kiểu tĩnh của i18next (kiểu hoá hàng nghìn key làm tsc quá chậm). Nhận ra ba dạng:
//   const { t } = useTranslation('ns') … t('Key.path', …)   (hoặc const { t: tr } = …)
//   i18n.t('ns:Key.path', …) / i18next.t('ns:Key.path', …)
const srcDir = join(frontendRoot, 'src')
const sourceKeys = Object.fromEntries(
  Object.entries(source).map(([ns, flat]) => [ns, new Set(Object.keys(flat).map(baseKey))])
)
function walkSrc(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) { if (entry.name !== 'locales') walkSrc(p, out) }
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}
let usedKeys = 0
for (const file of walkSrc(srcDir)) {
  const text = readFileSync(file, 'utf8')
  const rel = file.slice(frontendRoot.length + 1).split('\\').join('/')
  const lineOf = (i) => text.slice(0, i).split('\n').length
  const hookNames = new Map() // tên biến t → namespace
  for (const m of text.matchAll(/const \{ t(?:: (\w+))? \} = useTranslation\((?:'([\w-]+)')?\)/g)) {
    hookNames.set(m[1] || 't', m[2] || 'common')
  }
  for (const [name, ns] of hookNames) {
    // (?<![.\w]) — không khớp phần `.t(` của `i18n.t(`
    for (const m of text.matchAll(new RegExp(`(?<![.\\w])${name}\\('([^']+)'`, 'g'))) {
      usedKeys++
      const key = m[1]
      if (!sourceKeys[ns]?.has(key)) errors.push(`${rel}:${lineOf(m.index)} key '${key}' không có trong ${SOURCE}/${ns}.json`)
    }
  }
  for (const m of text.matchAll(/\bi18n(?:ext)?\.t\('([\w-]+):([^']+)'/g)) {
    usedKeys++
    if (!sourceKeys[m[1]]?.has(m[2])) errors.push(`${rel}:${lineOf(m.index)} key '${m[1]}:${m[2]}' không có trong ${SOURCE}/${m[1]}.json`)
  }
}
console.log(`Đã đối chiếu ${usedKeys} lượt dùng key trong code.`)

console.log('Trạng thái review:')
for (const [lang, byNs] of Object.entries(reviewStatus).filter(([k]) => !k.startsWith('$'))) {
  for (const [ns, status] of Object.entries(byNs)) console.log(`  ${lang}/${ns}: ${status}`)
}
for (const w of warnings) console.warn(`⚠ ${w}`)
for (const e of errors) console.error(`✖ ${e}`)
if (errors.length) {
  console.error(`\n${errors.length} lỗi bản dịch.`)
  process.exit(1)
}
console.log(`\n✔ Bản dịch hợp lệ (${warnings.length} cảnh báo).`)
