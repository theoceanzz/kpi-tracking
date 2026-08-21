import { useMemo, useState } from 'react'
import { Check, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import type { FormPatch } from '../api/aiApi'
import { useFormAssistStore } from '@/store/formAssistStore'

interface Props {
  patch: FormPatch
}

/**
 * Bản xem trước các ô trợ lý đề xuất điền, kèm nút chấp nhận.
 *
 * <p>Cố ý KHÔNG tự điền vào form. Người dùng thấy trước từng ô sẽ đổi thành gì và vì sao, bỏ chọn
 * ô nào không muốn, rồi mới bấm điền. Trợ lý đề xuất sai thì không mất gì — quan trọng vì nó có
 * thể hiểu nhầm ý và ghi đè thứ người dùng đang gõ dở.
 */
export default function FormPatchPreview({ patch }: Props) {
  const active = useFormAssistStore(s => s.active)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState(false)

  const chosen = useMemo(
    () => patch.entries.filter(e => !skipped.has(e.field)),
    [patch.entries, skipped],
  )

  // Người dùng đã đóng form trong lúc chờ trả lời -> không còn chỗ nào để điền.
  if (!active || active.formId !== patch.formId) return null

  const toggle = (field: string) => {
    setSkipped(prev => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  const apply = () => {
    chosen.forEach(e => active.setValue(e.field, e.value))
    setApplied(true)
    toast.success(`Đã điền ${chosen.length} ô. Bạn kiểm tra lại rồi hãy lưu.`)
  }

  return (
    <div className="w-full mt-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-800 dark:bg-violet-950/40">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-violet-800 dark:text-violet-200">
        <PenLine className="h-4 w-4" />
        Đề xuất điền form
      </div>

      <ul className="space-y-1.5">
        {patch.entries.map(e => {
          const off = skipped.has(e.field)
          return (
            <li key={e.field}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!off}
                  disabled={applied}
                  onChange={() => toggle(e.field)}
                  className="mt-1 h-3.5 w-3.5 shrink-0 accent-violet-600"
                />
                <span className={off ? 'opacity-40' : undefined}>
                  <span className="text-gray-600 dark:text-gray-400">{e.label}: </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{e.display}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {patch.entries[0]?.reason && (
        <p className="mt-2 text-xs italic text-gray-500 dark:text-gray-400">{patch.entries[0].reason}</p>
      )}

      {applied ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          Đã điền vào form — bạn kiểm tra lại rồi hãy lưu
        </div>
      ) : (
        <button
          type="button"
          onClick={apply}
          disabled={chosen.length === 0}
          className="mt-2.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Điền {chosen.length} ô đã chọn
        </button>
      )}
    </div>
  )
}
