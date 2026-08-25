import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { aiApi, type PendingAction } from '../api/aiApi'

interface Props {
  action: PendingAction
  /** Báo lại kết quả để khung chat chèn thành một lời của trợ lý. */
  onDone?: (text: string) => void
}

/** Nhãn tiếng Việt của từng loại việc, dùng cho câu cảnh báo. */
const KIND_LABEL: Record<PendingAction['kind'], string> = {
  SUBMISSION_REVIEW: 'bản nộp',
  KPI_CRITERIA_REVIEW: 'chỉ tiêu KPI',
  KPI_ADJUSTMENT_REVIEW: 'yêu cầu điều chỉnh',
  SEND_REMINDER: 'lượt nhắc nhở',
}

/**
 * Thẻ xác nhận một thao tác GHI do trợ lý đề nghị.
 *
 * <p>Cùng khuôn với {@link FormPatchPreview}: hiện trước từng mục, cho bỏ chọn, rồi mới cho bấm.
 * Khác ở hai chỗ, và cả hai đều quan trọng:
 * <ul>
 *   <li>bấm xong thì <b>backend ghi thật</b> (form patch chỉ điền vào ô, người dùng còn phải tự
 *       bấm Lưu) — nên màu và chữ ở đây phải nói rõ mức độ, không dùng lại tông tím nhẹ nhàng;</li>
 *   <li>việc này <b>không có nút hoàn tác</b>, nên danh sách phải nêu đủ tên và số liệu để người
 *       dùng thẩm định được, chứ không chỉ đếm "3 mục".</li>
 * </ul>
 *
 * <p>Bấm một lần là xong: backend tiêu mất lời mời sau lần xác nhận đầu, nên thẻ tự khoá lại thay
 * vì để người dùng bấm lần hai rồi nhận câu "không còn hiệu lực".
 */
export default function PendingActionCard({ action, onDone }: Props) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const chosen = useMemo(
    () => action.items.filter(i => !skipped.has(i.id)),
    [action.items, skipped],
  )

  const isReject = action.decision === 'REJECT'
  const what = KIND_LABEL[action.kind]

  const toggle = (id: string) => {
    setSkipped(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const run = async () => {
    if (busy || chosen.length === 0) return
    setBusy(true)
    try {
      // Gửi danh sách đã chọn kể cả khi chọn hết: backend vẫn lọc theo lời mời gốc, và gửi tường
      // minh thì hành vi giống nhau ở mọi trường hợp.
      const res = await aiApi.confirmAction(action.id, chosen.map(i => i.id))
      setResult(res.text)
      onDone?.(res.text)
      if (res.failed > 0) toast.warning(`${res.succeeded} mục xong, ${res.failed} mục không thực hiện được`)
      else toast.success(res.text)
    } catch (e) {
      const message =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thực hiện được. Bạn thử lại giúp mình nhé.'
      setResult(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="mt-2 w-full rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
        <div className="flex items-start gap-1.5 text-emerald-800 dark:text-emerald-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">{result}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-700 dark:bg-amber-950/40">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
        <ShieldCheck className="h-4 w-4" />
        {action.title}
      </div>

      <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Thao tác này {isReject ? 'từ chối' : 'thay đổi'} dữ liệu thật và{' '}
          <strong>không hoàn tác được</strong>. Bạn xem lại danh sách rồi hãy xác nhận.
        </span>
      </p>

      <ul className="space-y-1.5">
        {action.items.map(item => {
          const off = skipped.has(item.id)
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!off}
                  disabled={busy}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-3.5 w-3.5 shrink-0 accent-amber-600"
                />
                <span className={off ? 'opacity-40' : undefined}>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
                  {item.detail && (
                    <span className="text-gray-600 dark:text-gray-400"> — {item.detail}</span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {action.note && (
        <p className="mt-2 text-xs italic text-gray-600 dark:text-gray-400">
          Ghi chú sẽ lưu kèm: {action.note}
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={busy || chosen.length === 0}
        className={`mt-2.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isReject ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
        }`}
      >
        {busy
          ? 'Đang thực hiện…'
          : `Xác nhận ${isReject ? 'từ chối' : ''} ${chosen.length} ${what}`.replace(/\s+/g, ' ')}
      </button>
    </div>
  )
}
