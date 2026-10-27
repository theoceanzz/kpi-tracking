import type { FormSchema, FormWidget } from '../types'

/** Thao tác thuần trên form của trình sửa (widget ngoài cùng hoặc cột bảng, tìm theo id). */

export function findWidget(schema: FormSchema, id: string | null): { widget: FormWidget; parent: FormWidget | null } | null {
  if (!id) return null
  for (const w of schema.widgets) {
    if (w.id === id) return { widget: w, parent: null }
    const c = w.children?.find((x) => x.id === id)
    if (c) return { widget: c, parent: w }
  }
  return null
}

export function replaceWidget(schema: FormSchema, next: FormWidget): FormSchema {
  return {
    widgets: schema.widgets.map((w) => {
      if (w.id === next.id) return next
      if (w.children?.some((c) => c.id === next.id)) return { ...w, children: w.children.map((c) => (c.id === next.id ? next : c)) }
      return w
    }),
  }
}

/**
 * Bỏ một widget. Điều kiện hiện của widget khác trỏ vào nó cũng bị bỏ (không để lại điều kiện "mồ côi"); công thức thì
 * giữ nguyên để hộp lỗi chỉ cho người soạn biết công thức đang trỏ vào trường đã xoá.
 */
export function removeWidget(schema: FormSchema, id: string): FormSchema {
  return {
    widgets: schema.widgets
      .filter((w) => w.id !== id)
      .map((w) => ({
        ...w,
        children: w.children ? w.children.filter((c) => c.id !== id) : w.children,
        visibility: w.visibility ? w.visibility.filter((r) => r.widget !== id) : w.visibility,
      })),
  }
}

/** Chèn widget ngoài cùng ở vị trí `index` (mặc định cuối), hoặc thêm cột vào bảng `parentId`. */
export function insertWidget(schema: FormSchema, w: FormWidget, index?: number, parentId?: string): FormSchema {
  if (parentId) {
    return { widgets: schema.widgets.map((p) => (p.id === parentId ? { ...p, children: [...(p.children ?? []), w] } : p)) }
  }
  const list = [...schema.widgets]
  list.splice(index ?? list.length, 0, w)
  return { widgets: list }
}

/** Đổi chỗ cột trong bảng (lên / xuống). */
export function moveChild(schema: FormSchema, parentId: string, childId: string, delta: -1 | 1): FormSchema {
  return {
    widgets: schema.widgets.map((p) => {
      if (p.id !== parentId || !p.children) return p
      const i = p.children.findIndex((c) => c.id === childId)
      const j = i + delta
      if (i < 0 || j < 0 || j >= p.children.length) return p
      const children = [...p.children]
      ;[children[i], children[j]] = [children[j]!, children[i]!]
      return { ...p, children }
    }),
  }
}
