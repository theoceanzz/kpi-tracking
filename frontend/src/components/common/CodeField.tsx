import type { UseFormRegisterReturn } from 'react-hook-form'
import { Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ô nhập MÃ cho các biểu mẫu có mã tự sinh theo quy tắc của tổ chức (Mục tiêu, Kết quả then
 * chốt, Hạng mục BSC).
 *
 * Ba trạng thái, do thiết lập của tổ chức quyết định:
 *
 * 1. Tự sinh, không cho sửa (`locked`) — ô chỉ đọc, hiện mã sẽ được cấp. Không gửi mã lên
 *    máy chủ: form cha tự bỏ trường `code` đi.
 * 2. Tự sinh, cho sửa tay (`optional`) — gõ được, bỏ trống thì lấy mã tự sinh.
 * 3. Tắt tự sinh — bắt buộc nhập, y như trước khi có tính năng này.
 *
 * Mã sinh sẵn hiện ở dạng placeholder chứ không điền vào ô: điền vào sẽ thành một giá trị
 * người dùng tưởng là đã chốt, trong khi mã thật chỉ được cấp lúc lưu (người khác tạo trước
 * là số đã khác).
 */
export interface CodeFieldRule {
  locked: boolean
  optional: boolean
  preview: string | null
}

const TONES = {
  indigo: 'focus:ring-indigo-500/10 focus:border-indigo-500',
  emerald: 'focus:ring-emerald-500/10 focus:border-emerald-500',
} as const

export default function CodeField({
  rule,
  register,
  error,
  currentCode,
  label = 'Mã',
  fallbackPlaceholder,
  tone = 'indigo',
  inputClassName = 'rounded-xl py-2.5',
  className,
}: {
  rule: CodeFieldRule
  register: UseFormRegisterReturn
  error?: string
  /** Mã hiện tại khi đang SỬA — lúc bị khoá thì đây là thứ hiện trong ô. */
  currentCode?: string | null
  label?: string
  /** Placeholder khi tổ chức tắt tự sinh (không có mã mẫu để gợi ý). */
  fallbackPlaceholder: string
  tone?: keyof typeof TONES
  /** Bo góc / chiều cao riêng của từng modal. */
  inputClassName?: string
  className?: string
}) {
  const base = cn(
    'w-full px-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 outline-none transition-all',
    inputClassName,
    TONES[tone],
  )

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
        {label}
        {rule.locked ? (
          <span className="text-emerald-600 dark:text-emerald-400"> · tự sinh</span>
        ) : rule.optional ? null : (
          <span className="text-red-500"> *</span>
        )}
      </label>

      {rule.locked ? (
        <>
          <input
            readOnly
            value={currentCode ?? rule.preview ?? ''}
            placeholder="Tự sinh khi lưu"
            className={cn(base, 'font-mono cursor-not-allowed text-slate-500 dark:text-slate-400')}
          />
          {!currentCode && (
            <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400 ml-1">
              <Wand2 size={11} className="shrink-0" />
              Mã do quy tắc của công ty cấp lúc lưu
            </p>
          )}
        </>
      ) : (
        <>
          <input
            {...register}
            spellCheck={false}
            placeholder={(rule.optional ? rule.preview : null) ?? fallbackPlaceholder}
            className={base}
          />
          {rule.optional && !currentCode && (
            <p className="text-[10px] font-bold text-slate-400 ml-1">Bỏ trống để dùng mã tự sinh</p>
          )}
        </>
      )}

      {error && <p className="text-[10px] font-bold text-red-500 ml-1">{error}</p>}
    </div>
  )
}
