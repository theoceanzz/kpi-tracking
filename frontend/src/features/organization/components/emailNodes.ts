import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { resolveAlertColors } from './emailNodeStyles'
import { ButtonView, CodeView, AlertView, InfoView, VariableView, ImageView } from './emailNodeViews'

/**
 * Các khối đặc thù của email, khai báo thành node TipTap thay vì hệ thống khối tự viết.
 *
 * <p>Điểm mấu chốt: `renderHTML` của mỗi node sinh ra ĐÚNG HTML sẽ gửi đi, và `parseHTML`
 * đọc ngược lại được nhờ thuộc tính `data-email`. Nhờ vậy HTML là nguồn sự thật duy nhất —
 * không cần lưu thêm cấu trúc khối, không cần bộ dựng HTML riêng ở backend.
 *
 * <p>Class CSS dùng ở đây khớp với EmailLayout và EmailTemplateCatalog bên backend.
 */

const withVariables = { addOptions: () => ({ variables: {} as Record<string, string> }) }

// ─────────────────────────────── Nút bấm ───────────────────────────────

export const EmailButton = Node.create({
  name: 'emailButton',
  ...withVariables,
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes: () => ({
    label: { default: 'Bấm vào đây' },
    url: { default: '{{link_he_thong}}' },
  }),

  parseHTML: () => [{
    tag: 'p[data-email="button"]',
    getAttrs: (el) => ({
      label: (el as HTMLElement).querySelector('a')?.textContent || '',
      url: (el as HTMLElement).querySelector('a')?.getAttribute('href') || '',
    }),
  }],

  renderHTML: ({ HTMLAttributes }) => [
    'p',
    { 'data-email': 'button', style: 'text-align:center;margin:32px 0;' },
    ['a', { href: HTMLAttributes.url, class: 'btn' }, HTMLAttributes.label],
  ],

  addNodeView: () => ReactNodeViewRenderer(ButtonView),
})

// ───────────────────────────── Ô mã nổi bật ─────────────────────────────

export const EmailCode = Node.create({
  name: 'emailCode',
  ...withVariables,
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes: () => ({
    label: { default: 'Mã xác thực' },
    value: { default: '{{ma_otp}}' },
  }),

  parseHTML: () => [{
    tag: 'div[data-email="code"]',
    getAttrs: (el) => ({
      label: (el as HTMLElement).querySelector('.token-label')?.textContent || '',
      value: (el as HTMLElement).querySelector('.token-value')?.textContent || '',
    }),
  }],

  renderHTML: ({ HTMLAttributes }) => [
    'div',
    { 'data-email': 'code', class: 'token-container' },
    ['span', { class: 'token-label' }, HTMLAttributes.label],
    ['div', { class: 'token-value' }, HTMLAttributes.value],
  ],

  addNodeView: () => ReactNodeViewRenderer(CodeView),
})

// ──────────────────────────── Khung nhấn mạnh ────────────────────────────
// Node CÓ NỘI DUNG: gõ chữ, in đậm, chèn biến ngay bên trong khung.

export const EmailAlert = Node.create({
  name: 'emailAlert',
  ...withVariables,
  group: 'block',
  content: 'block+',
  draggable: true,

  addAttributes: () => ({
    variant: {
      default: 'warning',
      parseHTML: el => el.getAttribute('data-variant') || 'warning',
      renderHTML: attrs => ({ 'data-variant': attrs.variant }),
    },
    /** Màu tự chọn; có giá trị thì đè lên mẫu màu sẵn của `variant`. */
    color: {
      default: null,
      parseHTML: el => el.getAttribute('data-color'),
      renderHTML: attrs => (attrs.color ? { 'data-color': attrs.color } : {}),
    },
  }),

  parseHTML: () => [{ tag: 'div[data-email="alert"]' }],

  renderHTML: ({ HTMLAttributes, node }) => {
    const { color, bg } = resolveAlertColors(node.attrs.variant, node.attrs.color)
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-email': 'alert',
        style: `background-color:${bg};border-left:4px solid ${color};border-radius:8px;`
          + `padding:14px 18px;margin:20px 0;color:${color};font-weight:600;`,
      }),
      0, // vị trí nội dung con
    ]
  },

  addNodeView: () => ReactNodeViewRenderer(AlertView),
})

// ───────────────────────────── Bảng thông tin ─────────────────────────────

export const EmailInfo = Node.create({
  name: 'emailInfo',
  ...withVariables,
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes: () => ({
    rows: {
      default: [] as { label: string; value: string }[],
      parseHTML: el => {
        try { return JSON.parse(el.getAttribute('data-rows') || '[]') } catch { return [] }
      },
      renderHTML: attrs => ({ 'data-rows': JSON.stringify(attrs.rows ?? []) }),
    },
  }),

  parseHTML: () => [{ tag: 'div[data-email="info"]' }],

  renderHTML: ({ HTMLAttributes, node }) => {
    const rows: { label: string; value: string }[] = node.attrs.rows ?? []
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-email': 'info', class: 'score-box' }),
      ...rows.map((r, i) => [
        'p',
        { style: `margin:0 0 ${i === rows.length - 1 ? '0' : '8px'};` },
        ['strong', {}, `${r.label}:`],
        ` ${r.value}`,
      ]),
    ] as never
  },

  addNodeView: () => ReactNodeViewRenderer(InfoView),
})

// ─────────────────────── Biến hệ thống (chèn trong dòng) ───────────────────────

export const EmailVariable = Node.create({
  name: 'emailVariable',
  ...withVariables,
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes: () => ({ name: { default: '' } }),

  // Biến trong HTML chỉ là chữ {{ten}} nên không có parseHTML — khi mở lại,
  // nó hiện dưới dạng chữ thường và vẫn được thay giá trị đúng lúc gửi.
  renderHTML: ({ HTMLAttributes }) => ['span', { 'data-email': 'var' }, `{{${HTMLAttributes.name}}}`],

  addNodeView: () => ReactNodeViewRenderer(VariableView),
})

// ─────────────────────────────────── Ảnh ───────────────────────────────────

export const EmailImage = Node.create({
  name: 'emailImage',
  ...withVariables,
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes: () => ({
    src: { default: '' },
    alt: { default: '' },
    width: { default: 300 },
    align: { default: 'center' },
  }),

  parseHTML: () => [{
    tag: 'p[data-email="image"]',
    getAttrs: (el) => {
      const node = el as HTMLElement
      const img = node.querySelector('img')
      const width = Number(img?.getAttribute('width'))
      return {
        src: img?.getAttribute('src') || '',
        alt: img?.getAttribute('alt') || '',
        width: Number.isFinite(width) && width > 0 ? width : 300,
        align: node.style.textAlign || 'center',
      }
    },
  }],

  // Mail client cũ (Outlook) bỏ qua CSS width nên phải ghi cả thuộc tính `width`.
  // `max-width:100%` giữ ảnh không tràn khung khi xem trên điện thoại.
  renderHTML: ({ HTMLAttributes }) => [
    'p',
    { 'data-email': 'image', style: `text-align:${HTMLAttributes.align};margin:20px 0;` },
    ['img', {
      src: HTMLAttributes.src,
      alt: HTMLAttributes.alt || '',
      width: String(HTMLAttributes.width),
      style: `width:${HTMLAttributes.width}px;max-width:100%;height:auto;border-radius:8px;`,
    }],
  ],

  addNodeView: () => ReactNodeViewRenderer(ImageView),
})

/** Truyền danh mục biến xuống mọi node view (dùng cho dropdown và chip). */
export const emailNodeExtensions = (variables: Record<string, string>) => [
  EmailButton.configure({ variables }),
  EmailCode.configure({ variables }),
  EmailAlert.configure({ variables }),
  EmailInfo.configure({ variables }),
  EmailVariable.configure({ variables }),
  EmailImage.configure({ variables }),
]
