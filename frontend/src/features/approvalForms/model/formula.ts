/**
 * Công thức của widget Công thức — cùng ngữ pháp với `Formula.java` (bản có hiệu lực ở backend):
 *
 *   biểu thức := hạng (('+' | '-') hạng)*
 *   hạng      := thừa số (('*' | '/') thừa số)*
 *   thừa số   := số | '{' id '}' | 'SUM' '(' '{' bảng '.' cột '}' ')' | '(' biểu thức ')' | '-' thừa số
 *
 * Widget trống / bị ẩn tính là 0. Chia cho 0 ⇒ null.
 */

export interface FormulaRef {
  widget: string
  /** Có cột ⇒ `SUM({widget.column})`. */
  column?: string
}

export class FormulaError extends Error {}

type Node =
  | { k: 'num'; v: number }
  | { k: 'ref'; ref: FormulaRef }
  | { k: 'neg'; inner: Node }
  | { k: 'bin'; op: string; l: Node; r: Node }

export interface Formula {
  refs: FormulaRef[]
  evaluate: (value: (ref: FormulaRef) => number | null | undefined) => number | null
}

export function parseFormula(expression: string | null | undefined): Formula {
  const s = expression ?? ''
  if (!s.trim()) throw new FormulaError('empty')
  let i = 0
  const refs: FormulaRef[] = []
  const done = () => i >= s.length
  const skip = () => { while (!done() && /\s/.test(s[i]!)) i++ }
  const accept = (c: string) => {
    if (!done() && s[i] === c) { i++; return true }
    return false
  }
  const expect = (c: string) => { if (!accept(c)) throw new FormulaError(`expected ${c}`) }

  const ref = (): FormulaRef => {
    expect('{')
    const close = s.indexOf('}', i)
    if (close < 0) throw new FormulaError('missing }')
    const body = s.slice(i, close).trim()
    i = close + 1
    if (!body) throw new FormulaError('empty reference')
    const dot = body.indexOf('.')
    const r: FormulaRef = dot < 0 ? { widget: body } : { widget: body.slice(0, dot), column: body.slice(dot + 1) }
    if (!r.widget || r.column === '') throw new FormulaError('bad reference')
    refs.push(r)
    return r
  }

  const factor = (): Node => {
    skip()
    if (done()) throw new FormulaError('unexpected end')
    const c = s[i]!
    if (accept('-')) return { k: 'neg', inner: factor() }
    if (accept('(')) {
      const inner = expr()
      skip()
      expect(')')
      return inner
    }
    if (c === '{') {
      const r = ref()
      if (r.column !== undefined) throw new FormulaError('column reference outside SUM')
      return { k: 'ref', ref: r }
    }
    if (s.startsWith('SUM', i)) {
      i += 3
      skip()
      expect('(')
      skip()
      const r = ref()
      if (r.column === undefined) throw new FormulaError('SUM needs {table.column}')
      skip()
      expect(')')
      return { k: 'ref', ref: r }
    }
    if (/[0-9.]/.test(c)) {
      const start = i
      while (!done() && /[0-9.]/.test(s[i]!)) i++
      const v = Number(s.slice(start, i))
      if (!Number.isFinite(v)) throw new FormulaError('bad number')
      return { k: 'num', v }
    }
    throw new FormulaError(`unexpected ${c}`)
  }

  const term = (): Node => {
    let left = factor()
    for (;;) {
      skip()
      if (accept('*')) left = { k: 'bin', op: '*', l: left, r: factor() }
      else if (accept('/')) left = { k: 'bin', op: '/', l: left, r: factor() }
      else return left
    }
  }

  function expr(): Node {
    let left = term()
    for (;;) {
      skip()
      if (accept('+')) left = { k: 'bin', op: '+', l: left, r: term() }
      else if (accept('-')) left = { k: 'bin', op: '-', l: left, r: term() }
      else return left
    }
  }

  const root = expr()
  skip()
  if (!done()) throw new FormulaError(`unexpected ${s[i]}`)

  const ev = (n: Node, value: (ref: FormulaRef) => number | null | undefined): number => {
    switch (n.k) {
      case 'num': return n.v
      case 'ref': return value(n.ref) ?? 0
      case 'neg': return -ev(n.inner, value)
      case 'bin': {
        const l = ev(n.l, value)
        const r = ev(n.r, value)
        if (n.op === '+') return l + r
        if (n.op === '-') return l - r
        if (n.op === '*') return l * r
        return r === 0 ? Number.NaN : l / r
      }
    }
  }

  return {
    refs,
    evaluate: (value) => {
      const v = ev(root, value)
      return Number.isFinite(v) ? v : null
    },
  }
}

/** Biểu thức lưu trữ (`{id}`) → chữ cho người đọc (`[Tiêu đề]`). */
export function displayFormula(expression: string, titleOf: (widget: string, column?: string) => string | undefined): string {
  return expression.replace(/\{([^}.]+)(?:\.([^}]+))?\}/g, (raw, w: string, c?: string) => {
    const title = titleOf(w, c)
    return title ? `[${title}]` : raw
  })
}

interface TitledWidget {
  id: string
  title: string
  children?: { id: string; title: string }[] | null
}

/**
 * Công thức cho người soạn: `{id}` → `[Tiêu đề]`, `SUM({bảng.cột})` → `SUM([Tiêu đề cột])`. Tiêu đề trong form là duy
 * nhất nên đổi qua lại không mất thông tin.
 */
export function formulaToText(expression: string, widgets: TitledWidget[]): string {
  const top = new Map(widgets.map((w) => [w.id, w]))
  return expression.replace(/\{([^}.]+)(?:\.([^}]+))?\}/g, (raw, id: string, column?: string) => {
    const w = top.get(id)
    if (!w) return raw
    if (column === undefined) return `[${w.title}]`
    const c = w.children?.find((x) => x.id === column)
    return c ? `[${c.title}]` : raw
  })
}

/** Ngược lại với {@link formulaToText}: `[Tiêu đề]` → `{id}`; trong `SUM(…)` tiêu đề cột → `{bảng.cột}`. */
export function formulaFromText(text: string, widgets: TitledWidget[]): string {
  const byTitle = new Map<string, string>()
  const columnByTitle = new Map<string, string>()
  for (const w of widgets) {
    byTitle.set(w.title.trim().toLowerCase(), w.id)
    for (const c of w.children ?? []) columnByTitle.set(c.title.trim().toLowerCase(), `${w.id}.${c.id}`)
  }
  return text
    .replace(/SUM\s*\(\s*\[([^\]]+)\]\s*\)/g, (raw, title: string) => {
      const ref = columnByTitle.get(title.trim().toLowerCase())
      return ref ? `SUM({${ref}})` : raw
    })
    .replace(/\[([^\]]+)\]/g, (raw, title: string) => {
      const id = byTitle.get(title.trim().toLowerCase())
      return id ? `{${id}}` : raw
    })
}
