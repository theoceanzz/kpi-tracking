import { z } from 'zod'
import { BscFixedPerspective, BscPerspectiveStatus, type PerspectiveResponse } from '../types'
import i18n from 'i18next'

const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/
// Cho phép chuỗi RỖNG: tổ chức bật sinh mã tự động thì ô mã bỏ trống là hợp lệ.
const CODE_PATTERN = /^[A-Za-z0-9_]*$/

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
  /** Tổ chức TẮT sinh mã tự động ⇒ mã là bắt buộc. Mặc định không bắt buộc. */
  requireCode?: boolean
}

/**
 * Vài ràng buộc phải đối chiếu với dữ liệu đang có trên server (trùng mã, trùng thứ tự
 * trong cùng lĩnh vực) nên schema được dựng theo ngữ cảnh thay vì khai báo tĩnh.
 */
export const createPerspectiveSchema = (
  { existing = [], currentId, requireCode = false }: PerspectiveSchemaContext = {},
) =>
  z.object({
    code: z.string()
      .max(50, i18n.t('bsc:perspectiveSchema.codeCanBeAtMost50'))
      .regex(CODE_PATTERN, i18n.t('bsc:perspectiveSchema.codeMayOnlyContainLettersDigits'))
      .refine(
        v => !v.trim() || !RESERVED_CODES.includes(v.trim().toUpperCase()),
        i18n.t('bsc:perspectiveSchema.thisCodeMatchesAFixedArea'),
      )
      .refine(
        v => !v.trim() || !existing.some(p => p.code?.toLowerCase() === v.trim().toLowerCase() && p.id !== currentId),
        i18n.t('bsc:perspectiveSchema.thisCodeIsAlreadyUsedBy'),
      )
      .optional(),
    name: z.string().min(1, i18n.t('bsc:perspectiveSchema.pleaseEnterTheItemName')),
    description: z.string().optional(),
    // BẮT BUỘC: thiếu một trong ba thì dòng chỉ tiêu của đơn vị không quy ra %đạt được — nó chỉ
    // rơi về trung bình tỉ lệ đạt của các KPI con, và người xem kết quả không biết "80" là 80 gì.
    targetValue: z.number({ message: i18n.t('bsc:perspectiveSchema.pleaseEnterTheDesiredTarget') })
      .min(0, i18n.t('bsc:perspectiveSchema.theDesiredTargetCannotBeNegative')),
    minimumValue: z.number({ message: i18n.t('bsc:perspectiveSchema.pleaseEnterTheMinimumResult') })
      .min(0, i18n.t('bsc:perspectiveSchema.theMinimumResultCannotBeNegative')),
    unit: z.string({ message: i18n.t('bsc:perspectiveSchema.pleaseEnterTheUnitOfMeasure') })
      .trim()
      .min(1, i18n.t('bsc:perspectiveSchema.pleaseEnterTheUnitOfMeasure'))
      .max(50, i18n.t('bsc:perspectiveSchema.unitOfMeasureCanBeAt')),
    color: z.string().min(1, i18n.t('bsc:perspectiveSchema.pleaseChooseAColor')).regex(HEX_COLOR, i18n.t('bsc:perspectiveSchema.invalidColor')),
    icon: z.string().optional(),
    displayOrder: z.number({ message: i18n.t('bsc:perspectiveSchema.pleaseEnterTheDisplayOrder') })
      .int(i18n.t('bsc:perspectiveSchema.orderMustBeAnInteger'))
      .min(0, i18n.t('bsc:perspectiveSchema.orderCannotBeNegative')),
    status: z.enum(BscPerspectiveStatus).optional(),
    fixedPerspective: z.enum(BscFixedPerspective, { message: i18n.t('bsc:perspectiveSchema.pleaseChooseAnAreaForThe') }),
    // Trọng số không thuộc hạng mục mà thuộc bộ tiêu chí — chỉ hiện khi mở từ modal bộ tiêu chí.
    weightPercentage: z.number({ message: i18n.t('bsc:perspectiveSchema.weightMustBeBetween0And') })
      .min(0, i18n.t('bsc:perspectiveSchema.weightMustBeBetween0And'))
      .max(100, i18n.t('bsc:perspectiveSchema.weightMustBeBetween0And'))
      .optional(),
  }).superRefine((data, ctx) => {
    if (requireCode && !data.code?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: i18n.t('bsc:perspectiveSchema.pleaseEnterACode') })
    }
    // Tối thiểu là SÀN nên không được vượt mục tiêu; hạng mục không có cờ "KPI ngược".
    if (data.minimumValue != null && data.targetValue != null && data.minimumValue > data.targetValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minimumValue'],
        message: i18n.t('bsc:perspectiveSchema.theMinimumResultCannotBeGreater'),
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
        message: i18n.t('bsc:perspectiveSchema.thisOrderIsAlreadyUsedBy'),
      })
    }
  })

export type PerspectiveFormValues = z.infer<ReturnType<typeof createPerspectiveSchema>>

/** Lĩnh vực cố định chỉ sửa được tên/màu/thứ tự — mã do backend giữ. */
export const createFixedPerspectiveSchema = (usedOrders: number[] = []) =>
  z.object({
    name: z.string().min(1, i18n.t('bsc:perspectiveSchema.pleaseEnterTheAreaName')).max(100, i18n.t('bsc:perspectiveSchema.nameCanBeAtMost100')),
    color: z.string().min(1, i18n.t('bsc:perspectiveSchema.pleaseChooseAColor')).regex(HEX_COLOR, i18n.t('bsc:perspectiveSchema.invalidColor')),
    displayOrder: z.number({ message: i18n.t('bsc:perspectiveSchema.pleaseEnterTheDisplayOrder') })
      .int(i18n.t('bsc:perspectiveSchema.orderMustBeAnInteger'))
      .min(0, i18n.t('bsc:perspectiveSchema.orderCannotBeNegative'))
      .refine(v => !usedOrders.includes(v), i18n.t('bsc:perspectiveSchema.thisOrderIsAlreadyUsedBy2')),
  })

export type FixedPerspectiveFormValues = z.infer<ReturnType<typeof createFixedPerspectiveSchema>>
