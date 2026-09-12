import { useMemo, useState } from 'react'
import { Check, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import type { FormPatch } from '../api/aiApi'
import { useFormAssistStore } from '@/store/formAssistStore'
import { Button } from '@/components/ui/button'

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
    <div className="w-full mt-2 rounded-card border border-[var(--color-ai-line)] bg-[var(--color-ai-soft)] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--color-ai)]">
        <PenLine className="h-4 w-4" />
        Đề xuất điền form
      </div>

      <ul className="space-y-1.5">
        {patch.entries.map(e => {
          const off = skipped.has(e.field)
          return (
            <li key={e.field}>
              <label className="text-label flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={!off}
                  disabled={applied}
                  onChange={() => toggle(e.field)}
                  className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--color-ai)]"
                />
                <span className={off ? 'opacity-40' : undefined}>
                  <span className="text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">{e.label}: </span>
                  <span className="font-medium text-[var(--color-foreground)]">{e.display}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {patch.entries[0]?.reason && (
        <p className="mt-2 text-xs italic text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">{patch.entries[0].reason}</p>
      )}

      {applied ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-sm text-[var(--color-success)]">
          <Check className="h-4 w-4" />
          Đã điền vào form — bạn kiểm tra lại rồi hãy lưu
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="mt-2.5" type="button" onClick={apply} disabled={chosen.length === 0}>
          Điền {chosen.length} ô đã chọn
        </Button>
      )}
    </div>
  )
}
