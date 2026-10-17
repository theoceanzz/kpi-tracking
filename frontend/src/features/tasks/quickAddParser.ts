import { addDays, weekdayOf } from './taskUtils'
import type { TaskPriority } from './types'

export interface QuickAddPerson { id: string; name: string }
export interface QuickAddTag { id: string; name: string }

export type QuickAddToken =
  | { kind: 'person'; id: string; label: string }
  | { kind: 'tag'; id: string; label: string }
  | { kind: 'priority'; value: TaskPriority }
  | { kind: 'date'; value: string }
  | { kind: 'time'; value: string }

export interface QuickAddResult {
  /** Tên việc sau khi bỏ các phần đã hiểu. */
  title: string
  assigneeIds: string[]
  tagIds: string[]
  priority?: TaskPriority
  dueDate?: string
  /** HH:mm */
  dueTime?: string
  tokens: QuickAddToken[]
}

/** Bỏ dấu tiếng Việt từng ký tự (giữ nguyên độ dài chuỗi để vị trí khớp với bản gốc), chữ thường. */
function fold(text: string): string {
  return [...text].map((c) => {
    if (c === 'đ' || c === 'Đ') return 'd'
    const b = c.normalize('NFD').replace(/[̀-ͯ]/g, '')
    return (b.length === 1 ? b : c).toLowerCase()
  }).join('')
}

const PRIORITY: Record<string, TaskPriority> = {
  cao: 'HIGH', high: 'HIGH', h: 'HIGH', '1': 'HIGH',
  tb: 'MEDIUM', trung: 'MEDIUM', medium: 'MEDIUM', m: 'MEDIUM', '2': 'MEDIUM',
  thap: 'LOW', low: 'LOW', l: 'LOW', '3': 'LOW',
}

/** Ngày kế tiếp (sau hôm nay) rơi vào thứ `wd` (0 = CN … 6 = T7). */
function nextWeekday(today: string, wd: number): string {
  let d = addDays(today, 1)
  while (weekdayOf(d) !== wd) d = addDays(d, 1)
  return d
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Hiểu câu gõ nhanh kiểu Lark: `Họp khách @Nam ngày mai 15h !cao #sale` ⇒ tên "Họp khách", người thực hiện Nam, hạn ngày
 * mai 15:00, ưu tiên cao, nhãn sale. Nhận (không dấu, không phân biệt hoa thường):
 * - `@tên` — khớp cả họ tên hoặc một chữ trong tên (ưu tiên tên gọi, chữ cuối); chỉ người có trong danh sách.
 * - `#nhãn` — nhãn đã có của tổ chức.
 * - `!cao | !tb | !thap` (hoặc `!high | !medium | !low`, `!1 | !2 | !3`).
 * - ngày: `hôm nay`, `ngày mai`, `ngày kia`, `thứ 2`…`thứ 7`, `chủ nhật`, `tuần sau`, `today`, `tomorrow`, `dd/mm[/yyyy]`.
 *   Chữ "mai" / "kia" đứng một mình KHÔNG tính (dễ trùng tên người).
 * - giờ: `15h`, `15h30`, `15:30`, `3pm`.
 * Phần không hiểu giữ nguyên làm tên việc.
 */
export function parseQuickAdd(text: string, ctx: { people: QuickAddPerson[]; tags: QuickAddTag[]; today: string }): QuickAddResult {
  const norm = fold(text)
  const ranges: [number, number][] = []
  const taken = (s: number, e: number) => ranges.some(([a, b]) => s < b && e > a)
  const res: QuickAddResult = { title: '', assigneeIds: [], tagIds: [], tokens: [] }
  const boundary = (i: number) => i >= norm.length || /\s/.test(norm[i]!)

  // @người, #nhãn: khớp dài nhất.
  const matchNamed = (sigil: '@' | '#', items: { id: string; name: string }[], wordFallback: boolean) => {
    for (let i = 0; i < norm.length; i++) {
      if (norm[i] !== sigil || (i > 0 && !/\s/.test(norm[i - 1]!))) continue
      const rest = norm.slice(i + 1)
      let best: { id: string; name: string; len: number; score: number } | null = null
      for (const it of items) {
        const full = fold(it.name).trim()
        if (full && rest.startsWith(full) && boundary(i + 1 + full.length)) {
          const cand = { id: it.id, name: it.name, len: full.length, score: 1000 + full.length }
          if (!best || cand.score > best.score) best = cand
        } else if (wordFallback) {
          const word = rest.match(/^[^\s@#!]+/)?.[0]
          if (!word) continue
          const words = full.split(/\s+/)
          const idx = words.lastIndexOf(word)
          if (idx >= 0) {
            const cand = { id: it.id, name: it.name, len: word.length, score: idx === words.length - 1 ? 2 : 1 }
            if (!best || cand.score > best.score) best = cand
          }
        }
      }
      if (best && !taken(i, i + 1 + best.len)) {
        ranges.push([i, i + 1 + best.len])
        if (sigil === '@') {
          if (!res.assigneeIds.includes(best.id)) { res.assigneeIds.push(best.id); res.tokens.push({ kind: 'person', id: best.id, label: best.name }) }
        } else if (!res.tagIds.includes(best.id)) { res.tagIds.push(best.id); res.tokens.push({ kind: 'tag', id: best.id, label: best.name }) }
      }
    }
  }
  matchNamed('@', ctx.people, true)
  matchNamed('#', ctx.tags, false)

  const scan = (re: RegExp, fn: (m: RegExpExecArray) => boolean) => {
    for (const m of norm.matchAll(re)) {
      const lead = m[1]?.length ?? 0
      const s = m.index! + lead, e = m.index! + m[0].length
      if (taken(s, e)) continue
      if (fn(m as RegExpExecArray)) ranges.push([s, e])
    }
  }

  scan(/(^|\s)!([a-z0-9]+)(?=\s|$)/g, (m) => {
    const p = PRIORITY[m[2]!]
    if (!p || res.priority) return false
    res.priority = p
    res.tokens.push({ kind: 'priority', value: p })
    return true
  })

  const WD: Record<string, number> = { '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6 }
  scan(/(^|\s)(hom nay|today|ngay mai|tomorrow|ngay kia|tuan sau|next week|chu nhat|thu ([2-7])|(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?)(?=\s|$)/g, (m) => {
    if (res.dueDate) return false
    const w = m[2]!
    let d: string | null = null
    if (w === 'hom nay' || w === 'today') d = ctx.today
    else if (w === 'ngay mai' || w === 'tomorrow') d = addDays(ctx.today, 1)
    else if (w === 'ngay kia') d = addDays(ctx.today, 2)
    else if (w === 'tuan sau' || w === 'next week') d = nextWeekday(ctx.today, 1)
    else if (w === 'chu nhat') d = nextWeekday(ctx.today, 0)
    else if (m[3]) d = nextWeekday(ctx.today, WD[m[3]]!)
    else if (m[4] && m[5]) {
      const day = Number(m[4]), mon = Number(m[5])
      if (day < 1 || day > 31 || mon < 1 || mon > 12) return false
      let year = m[6] ? Number(m[6]) : Number(ctx.today.slice(0, 4))
      let iso = `${year}-${pad(mon)}-${pad(day)}`
      // Không ghi năm mà ngày đã qua ⇒ năm sau.
      if (!m[6] && iso < ctx.today) { year += 1; iso = `${year}-${pad(mon)}-${pad(day)}` }
      d = iso
    }
    if (!d) return false
    res.dueDate = d
    res.tokens.push({ kind: 'date', value: d })
    return true
  })

  scan(/(^|\s)(\d{1,2})(?:h(\d{2})?|:(\d{2})|\s?(am|pm))(?=\s|$)/g, (m) => {
    if (res.dueTime) return false
    let h = Number(m[2])
    const min = Number(m[3] ?? m[4] ?? 0)
    if (m[5] === 'pm' && h < 12) h += 12
    if (m[5] === 'am' && h === 12) h = 0
    if (h > 23 || min > 59) return false
    res.dueTime = `${pad(h)}:${pad(min)}`
    res.tokens.push({ kind: 'time', value: res.dueTime })
    return true
  })
  // Có giờ mà không có ngày ⇒ hôm nay (giờ đã qua thì ngày mai).
  if (res.dueTime && !res.dueDate) {
    const now = new Date()
    const nowHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    res.dueDate = res.dueTime > nowHm ? ctx.today : addDays(ctx.today, 1)
    res.tokens.push({ kind: 'date', value: res.dueDate })
  }

  const chars = [...text]
  res.title = chars.filter((_, i) => !ranges.some(([a, b]) => i >= a && i < b)).join('').replace(/\s+/g, ' ').trim()
  return res
}
