import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parse, isValid } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { CalendarClock, Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { dateFnsLocale, formatDate } from '@/i18n/format'
import { cn } from '@/lib/utils'
import { addDays, endOfWorkWeek, todayIso } from '../taskUtils'

/**
 * Cùng bộ class lịch với DateTimePicker của form tạo đợt / kỳ. Lưu ý: `nav` định vị tuyệt đối — DayPicker phải nằm
 * trong một khung `relative` của riêng nó, không thì hai mũi tên bám vào mép popover và đè lên phần khác.
 */
const DAY_PICKER_CLASS_NAMES = {
  months: 'flex flex-col',
  month: 'space-y-2',
  month_caption: 'flex justify-center relative items-center h-9 px-8',
  caption_label: 'text-sm font-medium text-[var(--color-foreground)] capitalize',
  nav: 'absolute inset-x-0 top-0 flex justify-between',
  button_previous: 'h-9 w-9 flex items-center justify-center rounded-card text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors',
  button_next: 'h-9 w-9 flex items-center justify-center rounded-card text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors',
  weekdays: 'flex',
  weekday: 'w-9 h-8 text-center text-caption uppercase',
  weeks: '',
  week: 'flex mt-1',
  day: 'w-9 h-9 p-0 text-center flex items-center justify-center',
  day_button: 'w-9 h-9 rounded-card text-sm font-medium transition-colors hover:bg-[var(--color-muted)]',
  selected: 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] rounded-card hover:bg-[var(--color-primary-hover)] font-semibold',
  today: 'text-[var(--color-primary)] font-semibold',
  outside: 'opacity-30',
  disabled: 'opacity-20 cursor-not-allowed',
  hidden: 'invisible',
}

const Chevron = (props: { orientation?: string }) =>
  props.orientation === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)
const pad = (n: number) => String(n).padStart(2, '0')

export interface DueValue {
  /** yyyy-MM-dd hoặc null (không có hạn). */
  date: string | null
  /** HH:mm hoặc null (cả ngày). */
  time: string | null
}

interface Props {
  value: DueValue
  /** Gọi một lần khi bấm Xong / đóng hộp (không gọi theo từng cú bấm — tránh lưu nhiều lần khi tự lưu). */
  onChange: (v: DueValue) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  tone?: string
  size?: 'sm' | 'default'
}

/**
 * Hạn hoàn thành gộp ngày + giờ trong MỘT ô: lịch + lối tắt Hôm nay / Ngày mai / Thứ 6 tuần này; hàng dưới có Xoá hạn,
 * công tắc "Đặt giờ" và Xong. Bật "Đặt giờ" mới hiện hai cột cuộn giờ – phút (24 giờ) bên trái lịch; tắt = hạn cả ngày.
 * Điện thoại: cột giờ nằm dưới lịch, thấp lại.
 */
export default function TaskDuePicker({ value, onChange, disabled, placeholder, className, tone, size = 'default' }: Props) {
  const { t } = useTranslation('tasks')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DueValue>(value)

  const openWith = (o: boolean) => {
    if (o) setDraft(value)
    else if (draft.date !== value.date || draft.time !== value.time) onChange(draft)
    setOpen(o)
  }
  const commit = (v: DueValue) => {
    setDraft(v)
    onChange(v)
    setOpen(false)
  }

  const parsed = draft.date ? parse(draft.date, 'yyyy-MM-dd', new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined
  const hour = draft.time ? Number(draft.time.slice(0, 2)) : null
  const minute = draft.time ? Number(draft.time.slice(3, 5)) : null
  const setTime = (h: number, m: number) => setDraft((d) => ({ ...d, date: d.date ?? todayIso(), time: `${pad(h)}:${pad(m)}` }))

  const display = value.date ? `${formatDate(value.date)}${value.time ? ` ${value.time.slice(0, 5)}` : ''}` : (placeholder ?? t('due.pick'))
  const today = todayIso()
  const quick: { label: string; date: string }[] = [
    { label: t('due.today'), date: today },
    { label: t('due.tomorrow'), date: addDays(today, 1) },
    { label: t('due.endOfWorkWeek'), date: endOfWorkWeek(today) },
  ]

  return (
    <Popover open={open} onOpenChange={openWith}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled}
          className={cn(
            'flex w-full items-center gap-2 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-left text-sm transition-colors hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
            size === 'sm' ? 'h-8 text-xs' : 'h-9',
            className,
          )}>
          <CalendarClock size={14} className="shrink-0 text-[var(--color-subtle-foreground)]" />
          <span className={cn('flex-1 truncate', value.date ? (tone ?? 'text-[var(--color-foreground)]') : 'text-[var(--color-muted-foreground)]')}>{display}</span>
          {value.date && !disabled && (
            <span role="button" tabIndex={0} aria-label={t('detail.clearDue')}
              onClick={(e) => { e.stopPropagation(); commit({ date: null, time: null }) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); commit({ date: null, time: null }) } }}
              className="rounded p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]">
              <X size={13} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-24px)] p-0" align="start" collisionPadding={12} sideOffset={6}>
        <div className="flex flex-col-reverse sm:flex-row">
          {/* Giờ – phút: chỉ hiện khi bật "Đặt giờ", nằm bên trái lịch (điện thoại: dưới lịch). */}
          {draft.time != null && (
            <div className="flex gap-1 border-t border-[var(--color-border)] px-2 py-2 sm:w-[132px] sm:border-r sm:border-t-0">
              <TimeColumn label={t('due.hour')} values={HOURS} value={hour} onPick={(h) => setTime(h, minute ?? 0)} />
              <TimeColumn label={t('due.minute')} values={MINUTES} value={minute} onPick={(m) => setTime(hour ?? 17, m)} />
            </div>
          )}

          {/* Lịch + lối tắt */}
          <div className="flex flex-col">
            <div className="relative p-3 pb-1">
              <DayPicker
                mode="single"
                locale={dateFnsLocale()}
                weekStartsOn={1}
                selected={selected}
                onSelect={(day) => { if (day) setDraft((d) => ({ ...d, date: format(day, 'yyyy-MM-dd') })) }}
                defaultMonth={selected}
                classNames={DAY_PICKER_CLASS_NAMES}
                components={{ Chevron }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1 px-3 pb-2">
              {quick.map((q) => (
                <button key={q.label} type="button" onClick={() => setDraft((d) => ({ ...d, date: q.date }))}
                  className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors',
                    draft.date === q.date ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]')}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-3 py-2">
          <button type="button" onClick={() => commit({ date: null, time: null })}
            className="rounded px-1.5 py-1 text-xs text-[var(--color-error)] hover:bg-[var(--color-muted)]">
            {t('detail.clearDue')}
          </button>
          <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)]">
            <Switch size="sm" checked={draft.time != null}
              onCheckedChange={(on) => setDraft((d) => ({ ...d, date: d.date ?? (on ? todayIso() : null), time: on ? (d.time ?? '17:00') : null }))} />
            {t('due.setTime')}
            {draft.time && <span className="tabular-nums text-[var(--color-primary)]">{draft.time}</span>}
          </label>
          <div className="flex-1" />
          <Button size="sm" onClick={() => commit(draft)}><Check /> {t('due.done')}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Một cột cuộn chọn giờ hoặc phút; tự cuộn tới giá trị đang chọn khi mở. */
function TimeColumn({ label, values, value, onPick }: {
  label: string; values: number[]; value: number | null; onPick: (v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-selected="true"]')
    if (el && ref.current) ref.current.scrollTop = el.offsetTop - ref.current.clientHeight / 2 + el.clientHeight / 2
  }, [value])
  return (
    <div className="flex flex-1 flex-col">
      <span className="pb-1 text-center text-[10px] uppercase tracking-wide text-[var(--color-subtle-foreground)]">{label}</span>
      <div ref={ref} className="relative h-28 overflow-y-auto overscroll-contain sm:h-[244px] [scrollbar-width:thin]">
        {values.map((v) => (
          <button key={v} type="button" data-selected={v === value} onClick={() => onPick(v)}
            className={cn('block w-full rounded-control py-1.5 text-center text-sm tabular-nums transition-colors',
              v === value ? 'bg-[var(--color-primary)] font-semibold text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]')}>
            {pad(v)}
          </button>
        ))}
      </div>
    </div>
  )
}
