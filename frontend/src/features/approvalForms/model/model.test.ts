import { describe, expect, it } from 'vitest'
import type { FormSchema, FormWidget } from '../types'
import { parseFormula, FormulaError, displayFormula } from './formula'
import { computeFormState, pickName, rangeDuration } from './formState'
import { basicIssues, formConditionFields, schemaIssues } from './formIssues'

const w = (id: string, type: FormWidget['type'], extra: Partial<FormWidget> = {}): FormWidget => ({ id, type, title: id, ...extra })

describe('formula (khớp Formula.java)', () => {
  it('tính đúng thứ tự, tham chiếu, SUM cột, trống = 0, chia 0 = null', () => {
    const f = parseFormula('{a} * 2 + SUM({t.amount}) - (1 + 1)')
    expect(f.refs).toEqual([{ widget: 'a' }, { widget: 't', column: 'amount' }])
    expect(f.evaluate((r) => (r.column ? 100 : 3))).toBe(104)
    expect(parseFormula('{a} + 5').evaluate(() => null)).toBe(5)
    expect(parseFormula('10 / {a}').evaluate(() => 0)).toBeNull()
  })

  it('báo lỗi cú pháp', () => {
    for (const bad of ['1 +', '{t.c}', 'SUM({a})', '2 ^ 3', ' ']) {
      expect(() => parseFormula(bad)).toThrow(FormulaError)
    }
  })

  it('hiện tên widget thay cho id', () => {
    expect(displayFormula('SUM({t.amount}) + {x}', (id, c) => (c ? `${id}/${c}` : undefined))).toBe('SUM([t/amount]) + {x}')
  })
})

describe('trạng thái form (khớp FormValues.java)', () => {
  const schema: FormSchema = {
    widgets: [
      w('kind', 'RADIO', { options: [{ id: 'a', label: 'A' }, { id: 'other', label: 'Other' }] }),
      w('why', 'TEXT', { visibility: [{ widget: 'kind', operator: 'IN', values: ['other'] }] }),
      w('items', 'TABLE', { children: [w('amount', 'AMOUNT')] }),
      w('total', 'FORMULA', { expression: 'SUM({items.amount}) * 2', decimals: 0 }),
      w('period', 'DATE_RANGE', { dateFormat: 'DATE' }),
      w('big', 'TEXT', { visibility: [{ widget: 'total', operator: 'GT', values: ['1000'] }] }),
    ],
  }

  it('ẩn/hiện theo điều kiện, tính công thức và thời lượng', () => {
    const s = computeFormState(schema, {
      kind: 'a', items: [{ amount: 400 }, { amount: '200' }], period: { start: '2026-10-01', end: '2026-10-05' },
    })
    expect(s.visible.has('why')).toBe(false)
    expect(s.formulas.total).toBe(1200)
    expect(s.durations.period).toBe(5)
    expect(s.visible.has('big')).toBe(true)
    expect(computeFormState(schema, { kind: 'other' }).visible.has('why')).toBe(true)
  })

  it('thời lượng theo giờ', () => {
    expect(rangeDuration(w('p', 'DATE_RANGE', { dateFormat: 'DATETIME', durationUnit: 'HOUR' }),
      { start: '2026-10-01T08:00', end: '2026-10-01T17:30' })).toBe(9.5)
    expect(rangeDuration(w('p', 'DATE_RANGE'), { start: '2026-10-05', end: '2026-10-01' })).toBeNull()
  })

  it('tên song ngữ lùi về bản còn lại', () => {
    expect(pickName({ vi: 'Nghỉ phép' }, 'en')).toBe('Nghỉ phép')
    expect(pickName({ vi: 'Nghỉ phép', en: 'Leave' }, 'en')).toBe('Leave')
  })
})

describe('kiểm trước khi Phát hành (khớp FormSchemaValidator.java)', () => {
  it('bắt trùng tên, thiếu phương án, công thức trỏ sai, điều kiện hiện trỏ widget phía dưới', () => {
    const issues = schemaIssues({
      widgets: [
        w('a', 'NUMBER', { title: 'Same' }),
        w('b', 'TEXT', { title: 'same ' }),
        w('c', 'RADIO', { title: 'C', options: [] }),
        w('d', 'FORMULA', { title: 'D', expression: '{b} + 1' }),
        w('e', 'TEXT', { title: 'E', visibility: [{ widget: 'f', operator: 'IN', values: ['x'] }] }),
        w('f', 'RADIO', { title: 'F', options: [{ id: 'x', label: 'X' }] }),
      ],
    })
    expect(issues.map((i) => [i.widgetId, i.key])).toEqual([
      ['b', 'titleDuplicate'], ['c', 'optionsRequired'], ['d', 'formulaBadRef'], ['e', 'visibilityInvalid'],
    ])
    expect(issues.every((i) => i.step === 2)).toBe(true)
  })

  it('form không có ô nhập', () => {
    expect(schemaIssues({ widgets: [w('d', 'DESCRIPTION', { content: 'Hi' })] }).map((i) => i.key)).toEqual(['noInput'])
  })

  it('thông tin cơ bản', () => {
    const keys = basicIssues({
      name: { vi: ' ' }, description: {}, groupId: null, submitterScope: 'SPECIFIED', submitterCount: 0, adminCount: 0,
    }).map((i) => i.key)
    expect(keys).toEqual(['nameRequired', 'groupRequired', 'submittersRequired', 'adminsRequired'])
  })

  it('trường điều kiện duyệt: số và chọn ở cấp ngoài', () => {
    const fields = formConditionFields({
      widgets: [w('n', 'AMOUNT', { currency: 'VND' }), w('r', 'RADIO', { options: [{ id: 'x', label: 'X' }] }),
        w('t', 'TEXT'), w('tb', 'TABLE', { children: [w('c', 'NUMBER')] })],
    }, () => undefined)
    expect(fields.map((f) => [f.id, f.kind])).toEqual([['n', 'NUMBER'], ['r', 'OPTION']])
  })
})
