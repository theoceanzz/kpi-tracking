import { useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { InfoHint } from '@/components/common/InfoHint'
import { useAiReviewSettings, useUpdateAiReviewSettings } from '../hooks/useAiReview'
import type { AiReviewSettings } from '../api/aiReviewApi'

const WEIGHTS: { key: keyof Omit<AiReviewSettings, 'enabled'>; label: string; hint: string }[] = [
  { key: 'weightTarget', label: 'Đạt chỉ tiêu', hint: 'Thực đạt so với mục tiêu — hệ thống tự tính. Vượt 100% vẫn tính 100%.' },
  { key: 'weightQuality', label: 'Chất lượng', hint: 'AI đọc nội dung bài nộp và tệp minh chứng, chọn mức trong thang chất lượng của công ty.' },
  { key: 'weightOnTime', label: 'Đúng hạn', hint: 'Tỷ lệ bài nộp trước hạn — hệ thống tự tính.' },
]

/**
 * Cấu hình AI đọc bài nộp và đề xuất điểm: bật/tắt cho tổ chức và trọng số ba thành phần điểm đề xuất.
 * Chỉ người có quyền `AI_REVIEW:CONFIG` sửa được; điểm AI luôn chỉ để tham khảo khi chấm.
 */
export default function AiReviewSettingsSection() {
  const { hasPermission } = useHasPermission()
  const canConfig = hasPermission('AI_REVIEW:CONFIG')
  const { data, isLoading } = useAiReviewSettings(canConfig)
  const save = useUpdateAiReviewSettings()
  // Bản nháp chỉ tồn tại khi người dùng đã sửa; chưa sửa thì hiện đúng dữ liệu máy chủ.
  const [edited, setDraft] = useState<AiReviewSettings | null>(null)
  const draft = edited ?? data

  if (!canConfig) return null
  if (isLoading || !draft) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
  }

  const total = draft.weightTarget + draft.weightQuality + draft.weightOnTime
  const dirty = JSON.stringify(draft) !== JSON.stringify(data)

  return (
    <div className="space-y-5 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bot size={20} className="mt-0.5 text-[var(--color-ai)]" aria-hidden="true" />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-foreground)]">
              AI gợi ý điểm khi chấm
              <InfoHint>
                Khi chấm, quản lý bấm “Nhờ AI xem trước”: AI đọc bài nộp, tệp minh chứng rồi gợi ý điểm từng chỉ tiêu.
                AI không tự ghi điểm.
              </InfoHint>
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">Điểm AI chỉ để tham khảo, quản lý vẫn là người quyết.</p>
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          {draft.enabled ? 'Đang bật' : 'Đang tắt'}
          <Switch checked={draft.enabled} onCheckedChange={enabled => setDraft({ ...draft, enabled })}
                  aria-label="Bật AI đánh giá bài nộp" />
        </label>
      </div>

      <div className="space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-foreground)]">
          Cách tính điểm gợi ý
          <InfoHint>
            Điểm gợi ý của một chỉ tiêu = trọng số chỉ tiêu × tổng ba phần bên dưới. Ba phần cộng lại phải đúng 100%.
          </InfoHint>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {WEIGHTS.map(w => (
            <div key={w.key} className="space-y-1">
              <span className="text-label flex items-center gap-1">{w.label}<InfoHint label={`Giải thích: ${w.label}`}>{w.hint}</InfoHint></span>
              <Input
                aria-label={w.label}
                type="number"
                min={0}
                max={100}
                value={draft[w.key]}
                onChange={e => setDraft({ ...draft, [w.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                suffix={<span className="text-xs text-[var(--color-muted-foreground)]">%</span>}
                invalid={total !== 100}
              />
            </div>
          ))}
        </div>
        <p className={total === 100 ? 'text-xs text-[var(--color-muted-foreground)]' : 'text-xs text-[var(--color-error)]'}>
          Tổng: {total}% {total !== 100 && '— phải bằng 100%'}
        </p>
      </div>

      <div className="flex justify-end">
        <Button disabled={!dirty || total !== 100 || save.isPending}
                onClick={() => save.mutate(draft, { onSuccess: () => setDraft(null) })}>
          {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Lưu cấu hình
        </Button>
      </div>
    </div>
  )
}
