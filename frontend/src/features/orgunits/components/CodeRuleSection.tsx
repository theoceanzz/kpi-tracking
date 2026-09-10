import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Hash, Loader2, RotateCcw, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { codeRuleApi, type CodeRule, type CodeType, type UpdateCodeRuleRequest } from '../api/codeRuleApi'
import { useCodeRules, useUpdateCodeRules } from '../hooks/useCodeRules'
import { getApiErrorMessage } from '@/lib/apiError'

/**
 * Mẫu mã tự sinh cho Mục tiêu, Kết quả then chốt và Hạng mục BSC — mỗi công ty một kiểu.
 *
 * Bản nháp giữ ở đây và chỉ gửi những dòng THỰC SỰ đổi: mẫu mã cần gõ xong mới lưu được,
 * nên gạt công tắc mà lưu ngay lập tức sẽ khiến hai nửa của cùng một dòng lưu ở hai thời
 * điểm khác nhau — người dùng đọc không ra là mình đã lưu cái gì.
 *
 * Ô xem trước gọi thẳng backend chứ không tự dựng chuỗi ở trình duyệt: số thứ tự kế tiếp
 * phụ thuộc các mã đã tồn tại, chỉ máy chủ biết. Nhờ vậy thông báo lỗi mẫu cũng là đúng
 * thông báo người dùng sẽ gặp lúc lưu.
 */

/** Ý nghĩa từng token, hiện thành chip bấm được để chèn vào mẫu. */
const TOKEN_HINTS: Record<string, string> = {
  '{YYYY}': 'Năm 4 số (2026)',
  '{YY}': 'Năm 2 số (26)',
  '{MM}': 'Tháng 2 số (09)',
  '{ORG}': 'Mã công ty',
  '{UNIT}': 'Mã đơn vị được giao',
  '{PARENT}': 'Mã mục tiêu cha',
  '{###}': 'Số thứ tự (số dấu # là số chữ số)',
}

interface Draft {
  pattern: string
  autoGenerate: boolean
  allowManualOverride: boolean
}

export default function CodeRuleSection({ organizationId }: { organizationId: string }) {
  const { data: rules, isLoading } = useCodeRules(organizationId)
  const updateMutation = useUpdateCodeRules(organizationId)

  const [drafts, setDrafts] = useState<Partial<Record<CodeType, Draft>>>({})

  const draftOf = (rule: CodeRule): Draft =>
    drafts[rule.codeType] ?? {
      pattern: rule.pattern,
      autoGenerate: rule.autoGenerate,
      allowManualOverride: rule.allowManualOverride,
    }

  const patch = (rule: CodeRule, changes: Partial<Draft>) =>
    setDrafts(prev => ({ ...prev, [rule.codeType]: { ...draftOf(rule), ...changes } }))

  /** Dòng đã đổi so với máy chủ — cũng là những dòng sẽ được gửi lên. */
  const changed = useMemo(() => {
    if (!rules) return []
    return rules.filter(rule => {
      const draft = drafts[rule.codeType]
      if (!draft) return false
      return draft.pattern !== rule.pattern
        || draft.autoGenerate !== rule.autoGenerate
        || draft.allowManualOverride !== rule.allowManualOverride
    })
  }, [rules, drafts])

  const handleSave = () => {
    if (changed.length === 0) return
    const payload: UpdateCodeRuleRequest[] = changed.map(rule => {
      const draft = draftOf(rule)
      return {
        codeType: rule.codeType,
        pattern: draft.pattern.trim(),
        autoGenerate: draft.autoGenerate,
        allowManualOverride: draft.allowManualOverride,
      }
    })
    updateMutation.mutate(payload, { onSuccess: () => setDrafts({}) })
  }

  if (isLoading) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
        <LoadingSkeleton rows={4} />
      </section>
    )
  }
  if (!rules) return null

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Quy tắc sinh mã</h3>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
          Mã Mục tiêu, Kết quả then chốt và Hạng mục BSC do hệ thống tự cấp theo mẫu của công ty
        </p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rules.map(rule => {
          const draft = draftOf(rule)
          const isDirty = changed.some(c => c.codeType === rule.codeType)

          return (
            <div key={rule.codeType} className="px-6 sm:px-8 py-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Hash size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{rule.label}</h4>
                  <p className="text-[12px] font-medium text-slate-500 leading-relaxed">
                    {draft.autoGenerate
                      ? draft.allowManualOverride
                        ? 'Tự sinh, nhưng người dùng được phép gõ mã riêng khi tạo'
                        : 'Tự sinh, ô mã trong biểu mẫu bị khoá'
                      : 'Người dùng phải tự nhập mã như trước'}
                  </p>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <Switch
                    label="Tự sinh"
                    checked={draft.autoGenerate}
                    onChange={next => patch(rule, { autoGenerate: next })}
                  />
                  <Switch
                    label="Cho sửa tay"
                    checked={draft.allowManualOverride}
                    disabled={!draft.autoGenerate}
                    onChange={next => patch(rule, { allowManualOverride: next })}
                  />
                </div>
              </div>

              {draft.autoGenerate && (
                <div className="pl-0 sm:pl-14 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Mẫu mã
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        value={draft.pattern}
                        onChange={e => patch(rule, { pattern: e.target.value })}
                        spellCheck={false}
                        placeholder={rule.codeType === 'BSC_PERSPECTIVE' ? 'PSP_{##}' : 'OBJ-{YYYY}-{###}'}
                        className="w-full sm:w-72 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-mono font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                      />
                      <PreviewLine organizationId={organizationId} rule={rule} pattern={draft.pattern} />
                      {draft.pattern !== rule.pattern && (
                        <button
                          type="button"
                          onClick={() => patch(rule, { pattern: rule.pattern })}
                          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <RotateCcw size={12} /> Mẫu đang lưu
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {[...rule.supportedTokens, '{###}'].map(token => (
                      <button
                        key={token}
                        type="button"
                        title={TOKEN_HINTS[token] ?? token}
                        onClick={() => patch(rule, { pattern: draft.pattern + token })}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 transition-colors"
                      >
                        {token}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                    Mẫu phải có đúng một ô số thứ tự. Có <span className="font-mono font-bold">{'{YYYY}'}</span> thì
                    số tự đánh lại từ 1 mỗi năm; mã cũ giữ nguyên khi đổi mẫu.
                  </p>
                </div>
              )}

              {isDirty && (
                <p className="pl-0 sm:pl-14 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  Chưa lưu
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-6 sm:px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <p className="text-[11px] font-medium text-slate-400">
          Mã đã cấp cho dữ liệu cũ không bị đánh số lại.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={changed.length === 0 || updateMutation.isPending}
          className={cn(
            'px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2',
            changed.length === 0 || updateMutation.isPending
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20'
          )}
        >
          {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Lưu quy tắc
        </button>
      </div>
    </section>
  )
}

/** Mã kế tiếp theo mẫu đang gõ, hỏi thẳng máy chủ để đúng cả số thứ tự lẫn thông báo lỗi. */
function PreviewLine({
  organizationId,
  rule,
  pattern,
}: {
  organizationId: string
  rule: CodeRule
  pattern: string
}) {
  const debounced = useDebounce(pattern.trim(), 400)
  const isSaved = debounced === rule.pattern

  const { data, error, isFetching } = useQuery({
    queryKey: ['org-code-rules', organizationId, 'preview', rule.codeType, debounced],
    queryFn: () => codeRuleApi.preview(organizationId, rule.codeType, debounced),
    // Mẫu đang lưu thì lấy luôn preview kèm trong danh sách, khỏi gọi thêm một lượt.
    enabled: !!debounced && !isSaved,
    retry: false,
    staleTime: 30 * 1000,
  })

  if (isSaved) {
    if (rule.previewError) return <PreviewError message={rule.previewError} />
    return <PreviewValue value={rule.preview} />
  }
  if (isFetching) return <span className="text-[11px] font-bold text-slate-400">Đang dựng mã…</span>
  if (error) {
    const message = getApiErrorMessage(error, 'Mẫu mã không hợp lệ')
    return <PreviewError message={message} />
  }
  return <PreviewValue value={data} />
}

function PreviewValue({ value }: { value?: string | null }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
      Mã kế tiếp
      <code className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-black normal-case tracking-normal">
        {value}
      </code>
    </span>
  )
}

function PreviewError({ message }: { message: string }) {
  return <span className="text-[11px] font-bold text-red-500 max-w-md">{message}</span>
}

function Switch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={cn(
        'text-[9px] font-black uppercase tracking-widest',
        disabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
      )}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'w-12 h-6 shrink-0 rounded-full relative transition-all duration-300',
          disabled && 'opacity-40 cursor-not-allowed',
          checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
        )}
      >
        <div className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm',
          checked ? 'left-7' : 'left-1'
        )} />
      </button>
    </div>
  )
}
