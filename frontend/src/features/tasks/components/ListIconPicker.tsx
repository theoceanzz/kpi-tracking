import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smile, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** Bộ biểu tượng gợi ý cho danh sách (dự án, sự kiện, tuyển dụng, bán hàng…). */
const ICONS = ['📋', '✅', '🚀', '🎯', '📌', '🗂️', '📅', '🎉', '💼', '🧑‍💻', '🛠️', '📈', '💡', '📣', '🧾', '🤝',
  '🏆', '🔥', '⭐', '📦', '🧪', '🎨', '📚', '🏢', '🛒', '💰', '🧭', '🔔', '📝', '🌱', '⚙️', '❤️']

/**
 * Chọn biểu tượng emoji cho danh sách (hiện cạnh tên ở cột trái, như Lark). Bấm ô để mở bảng chọn; chọn lại ô đang chọn
 * hoặc bấm × để bỏ biểu tượng (khi đó cột trái dùng ô màu).
 */
export default function ListIconPicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={t('lists.icon')} title={t('lists.icon')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-[var(--color-border)] bg-[var(--color-card)] text-lg hover:border-[var(--color-border-strong)] disabled:opacity-50">
          {value || <Smile size={16} className="text-[var(--color-subtle-foreground)]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {ICONS.map((ic) => (
            <button key={ic} type="button" onClick={() => { onChange(ic === value ? '' : ic); setOpen(false) }}
              className={cn('flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-[var(--color-muted)]',
                ic === value && 'bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary)]')}>
              {ic}
            </button>
          ))}
        </div>
        {value && (
          <button type="button" onClick={() => { onChange(''); setOpen(false) }}
            className="mt-2 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]">
            <X size={12} /> {t('lists.removeIcon')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
