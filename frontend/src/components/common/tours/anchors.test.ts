import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Mỗi `tourTarget('x')` trong bài hướng dẫn phải có `tourAnchor('x')` (hoặc `data-tour="x"`) ở đâu
 * đó trong mã nguồn. Bước trỏ vào neo không tồn tại sẽ bị bỏ qua lặng lẽ lúc chạy — người viết
 * bài không hay biết, chỉ thấy bài ngắn đi. Test này bắt lỗi gõ sai tên neo ngay ở CI.
 */
const SRC = join(__dirname, '..', '..', '..')
const TOURS = __dirname

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

const files = walk(SRC)
const read = (f: string) => readFileSync(f, 'utf8')

const anchors = new Set<string>()
/** Neo dựng theo mẫu, vd. tourAnchor(`section.card.${id}`) → tiền tố "section.card.". */
const anchorPrefixes = new Set<string>()
for (const f of files) {
  for (const m of read(f).matchAll(/tourAnchor\(\s*'([^']+)'\s*\)|data-tour="([^"]+)"/g)) anchors.add(m[1] ?? m[2]!)
  for (const m of read(f).matchAll(/tourAnchor\(\s*`([^`$]+)\$\{/g)) anchorPrefixes.add(m[1]!)
}
const hasAnchor = (name: string) => anchors.has(name) || [...anchorPrefixes].some((p) => name.startsWith(p))

describe('neo của bài hướng dẫn', () => {
  const tourFiles = files.filter((f) => f.startsWith(TOURS))
  const targets: { name: string; file: string }[] = []
  for (const f of tourFiles) {
    for (const m of read(f).matchAll(/tourTarget\(\s*'([^']+)'\s*\)/g)) targets.push({ name: m[1]!, file: relative(SRC, f) })
  }

  it('có ít nhất một bài dùng neo data-tour', () => {
    expect(targets.length).toBeGreaterThan(0)
  })

  it('mọi tourTarget đều có neo tương ứng trong mã nguồn', () => {
    const missing = targets.filter((t) => !hasAnchor(t.name)).map((t) => `${t.file}: ${t.name}`)
    expect(missing).toEqual([])
  })
})
