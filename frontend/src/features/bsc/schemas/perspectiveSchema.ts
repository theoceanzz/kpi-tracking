import { z } from 'zod'
import { BscFixedPerspective, BscPerspectiveStatus, type PerspectiveResponse } from '../types'

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/
const CODE_PATTERN = /^[A-Za-z0-9_]+$/

/** Mã của 4 lĩnh vực cố định — hạng mục tự tạo không được trùng. */
const RESERVED_CODES = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']

/**
 * Ô số bỏ trống phải gửi null (xoá mục tiêu) chứ không phải NaN — react-hook-form
 * trả '' cho input rỗng. Dùng chung cho `setValueAs` và các phép so sánh trong form.
 */
export const numOrNull = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))

/** Ô số không bắt buộc: bỏ trống ⇒ undefined để `.optional()` cho qua. */
export const numOrUndefined = (v: unknown) => (v === '' || v == null ? undefined : Number(v))

interface PerspectiveSchemaContext {
  /** Danh sách hạng mục hiện có — để chặn trùng mã và trùng thứ tự hiển thị. */
  existing?: PerspectiveResponse[]
  /** Id hạng mục đang sửa, để loại chính nó khỏi phép kiểm trùng. */
  currentId?: string
}

/**
 * Vài ràng buộc phải đối chiếu với dữ liệu đang có trên server (trùng mã, trùng thứ tự
 * trong cùng lĩnh vực) nên schema được dựng theo ngữ cảnh thay vì khai báo tĩnh.
 */
export const createPerspectiveSchema = ({ existing = [], currentId }: PerspectiveSchemaContext = {}) =>
  z.object({
    code: z.string()
      .min(1, 'Vui lòng nhập mã')
      .max(50, 'Mã tối đa 50 ký tự')
      .regex(CODE_PATTERN, 'Mã chỉ gồm chữ, số và dấu gạch dưới (không dấu cách, không tiếng Việt)')
      .refine(
        v => !RESERVED_CODES.includes(v.trim().toUpperCase()),
        'Mã này trùng mã lĩnh vực cố định — hãy dùng mã khác',
      )
      .refine(
        v => !existing.some(p => p.code?.toLowerCase() === v.trim().toLowerCase() && p.id !== currentId),
        'Mã này đã được dùng bởi hạng mục khác',
      ),
    name: z.string().min(1, 'Vui lòng nhập tên hạng mục'),
    description: z.string().optional(),
    targetValue: z.number().min(0, 'Mục tiêu mong muốn không được âm').nullable().optional(),
    minimumValue: z.number().min(0, 'Kết quả tối thiểu không được âm').nullable().optional(),
    unit: z.string().max(50, 'Đơn vị tính tối đa 50 ký tự').nullable().optional(),
    color: z.string().min(1, 'Vui lòng chọn màu sắc').regex(HEX_COLOR, 'Màu không hợp lệ'),
    icon: z.string().optional(),
    displayOrder: z.number({ message: 'Vui lòng nhập thứ tự hiển thị' })
      .int('Thứ tự phải là số nguyên')
      .min(0, 'Thứ tự không được âm'),
    status: z.enum(BscPerspectiveStatus).optional(),
    fixedPerspective: z.enum(BscFixedPerspective, { message: 'Vui lòng chọn lĩnh vực cho hạng mục' }),
    // Trọng số không thuộc hạng mục mà thuộc bộ tiêu chí — chỉ hiện khi mở từ modal bộ tiêu chí.
    weightPercentage: z.number({ message: 'Trọng số phải trong khoảng 0 – 100' })
      .min(0, 'Trọng số phải trong khoảng 0 – 100')
      .max(100, 'Trọng số phải trong khoảng 0 – 100')
      .optional(),
  }).superRefine((data, ctx) => {
    // Tối thiểu là SÀN nên không được vượt mục tiêu; hạng mục không có cờ "KPI ngược".
    if (data.minimumValue != null && data.targetValue != null && data.minimumValue > data.targetValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimumValue'],
        message: 'Kết quả tối thiểu không được lớn hơn mục tiêu mong muốn',
      })
    }
    // Thứ tự hiển thị chỉ cần duy nhất TRONG CÙNG 1 lĩnh vực.
    const clash = existing.some(
      p => p.displayOrder === data.displayOrder && p.fixedPerspective === data.fixedPerspective && p.id !== currentId,
    )
    if (clash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['displayOrder'],
        message: 'Thứ tự này đã được dùng bởi hạng mục khác trong cùng lĩnh vực',
      })
    }
  })

export type PerspectiveFormValues = z.infer<ReturnType<typeof createPerspectiveSchema>>

/** Lĩnh vực cố định chỉ sửa được tên/màu/thứ tự — mã do backend giữ. */
export const createFixedPerspectiveSchema = (usedOrders: number[] = []) =>
  z.object({
    name: z.string().min(1, 'Vui lòng nhập tên lĩnh vực').max(100, 'Tên tối đa 100 ký tự'),
    color: z.string().min(1, 'Vui lòng chọn màu sắc').regex(HEX_COLOR, 'Màu không hợp lệ'),
    displayOrder: z.number({ message: 'Vui lòng nhập thứ tự hiển thị' })
      .int('Thứ tự phải là số nguyên')
      .min(0, 'Thứ tự không được âm')
      .refine(v => !usedOrders.includes(v), 'Thứ tự này đã được dùng bởi lĩnh vực khác'),
  })

export type FixedPerspectiveFormValues = z.infer<ReturnType<typeof createFixedPerspectiveSchema>>
