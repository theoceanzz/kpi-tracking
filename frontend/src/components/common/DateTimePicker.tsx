import { useState } from 'react'
import { format, parse, isValid } from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, X } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/button'

const DAY_PICKER_CLASS_NAMES = {
  months: 'flex flex-col',
  month: 'space-y-2',
  month_caption: 'flex justify-center relative items-center h-9 px-8',
  caption_label: 'text-sm font-medium text-[var(--color-foreground)]',
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

const DayPickerChevron = (props: { orientation?: string }) =>
  props.orientation === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />

// --- DatePicker (date only, no time) ---
interface DatePickerProps {
  value: string // "yyyy-MM-dd"
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
}

export function DatePicker({ value, onChange, placeholder = 'Chọn ngày', className, onClear }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const validSelected = selectedDate && isValid(selectedDate) ? selectedDate : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 pl-2.5 pr-2 py-2 rounded-card',
            'border border-[var(--color-border)]',
            'bg-[var(--color-muted)] text-left transition-all',
            'hover:border-[var(--color-primary)] outline-none',
            className
          )}
        >
          <CalendarIcon size={13} className="text-[var(--color-subtle-foreground)] shrink-0" />
          <span className={cn('text-xs font-semibold uppercase text-[var(--color-muted-foreground)]', !value && 'text-[var(--color-subtle-foreground)]')}>
            {value && validSelected ? format(validSelected, 'dd/MM/yyyy') : placeholder}
          </span>
          {value && onClear && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClear() }}
              className="ml-0.5 p-0.5 rounded-control hover:bg-[var(--color-muted)] transition-colors"
            >
              <X size={11} className="text-[var(--color-subtle-foreground)]" />
            </button>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 z-[300] border-[var(--color-border)] shadow-2xl"
        align="start"
        collisionPadding={12}
        sideOffset={6}
      >
        <DayPicker
          mode="single"
          selected={validSelected}
          onSelect={(day) => {
            if (!day) return
            onChange(format(day, 'yyyy-MM-dd'))
            setOpen(false)
          }}
          defaultMonth={validSelected}
          classNames={DAY_PICKER_CLASS_NAMES}
          components={{ Chevron: DayPickerChevron }}
        />
      </PopoverContent>
    </Popover>
  )
}

// --- DateTimePicker (date + custom time) ---
interface DateTimePickerProps {
  value: string // "yyyy-MM-ddTHH:mm"
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({ value, onChange, placeholder = 'Chọn ngày giờ', className }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 639px)')

  const selectedDate = value ? new Date(value) : undefined
  const datePart = value ? value.slice(0, 10) : format(new Date(), 'yyyy-MM-dd')
  const timePart = value ? value.slice(11, 16) : '07:00'

  const hour = parseInt(timePart.slice(0, 2)) || 0
  const minute = parseInt(timePart.slice(3, 5)) || 0

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return
    onChange(`${format(day, 'yyyy-MM-dd')}T${timePart}`)
  }

  const changeHour = (delta: number) => {
    const next = ((hour + delta) + 24) % 24
    onChange(`${datePart}T${String(next).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }

  const changeMinute = (delta: number) => {
    const next = ((minute + delta) + 60) % 60
    onChange(`${datePart}T${String(hour).padStart(2, '0')}:${String(next).padStart(2, '0')}`)
  }

  // Desktop (>= sm = 640px): native datetime-local with text-transparent + formatted overlay
  if (!isMobile) {
    return (
      <div className={cn('relative', className)}>
        <input
          type="datetime-local"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className={cn(
            'w-full px-6 py-4 rounded-card',
            'border border-[var(--color-border)]',
            'bg-[var(--color-muted)]',
            'focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none',
            'text-sm font-medium transition-all text-transparent',
            '[color-scheme:light] dark:[color-scheme:dark]'
          )}
        />
        <div className="absolute inset-0 left-6 flex items-center pointer-events-none text-sm font-medium">
          {value
            ? <span className="text-[var(--color-foreground)]">{format(new Date(value), 'dd/MM/yyyy HH:mm')}</span>
            : <span className="text-[var(--color-subtle-foreground)] font-medium">{placeholder}</span>
          }
        </div>
      </div>
    )
  }

  // Mobile (< sm = 640px): custom popover picker
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-3 px-5 py-4 rounded-card',
            'border border-[var(--color-border)]',
            'bg-[var(--color-muted)] text-left transition-all',
            'hover:border-[var(--color-primary)]',
            'focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none',
            className
          )}
        >
          <CalendarIcon size={16} className="text-[var(--color-subtle-foreground)] shrink-0" />
          <span className={cn('flex-1 text-sm font-medium text-[var(--color-foreground)]', !value && 'text-[var(--color-subtle-foreground)] font-medium')}>
            {value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : placeholder}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 z-[300] border-[var(--color-border)] shadow-2xl"
        align="start"
        collisionPadding={12}
        sideOffset={6}
      >
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleDaySelect}
          defaultMonth={selectedDate}
          className="p-3 pb-2"
          classNames={DAY_PICKER_CLASS_NAMES}
          components={{ Chevron: DayPickerChevron }}
        />

        {/* Custom time picker */}
        <div className="border-t border-[var(--color-border)] px-3 py-2 flex items-center gap-3">
          {/* Hour */}
          <div className="flex flex-col items-center gap-0.5">
            <button type="button" onClick={() => changeHour(1)} className="p-1 rounded-control hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)]">
              <ChevronUp size={16} />
            </button>
            <span className="w-10 text-center text-lg font-semibold text-[var(--color-foreground)] tabular-nums leading-none py-1">
              {String(hour).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => changeHour(-1)} className="p-1 rounded-control hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)]">
              <ChevronDown size={16} />
            </button>
          </div>

          <span className="text-xl font-semibold text-[var(--color-subtle-foreground)] leading-none mb-0.5">:</span>

          {/* Minute */}
          <div className="flex flex-col items-center gap-0.5">
            <button type="button" onClick={() => changeMinute(5)} className="p-1 rounded-control hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)]">
              <ChevronUp size={16} />
            </button>
            <span className="w-10 text-center text-lg font-semibold text-[var(--color-foreground)] tabular-nums leading-none py-1">
              {String(minute).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => changeMinute(-5)} className="p-1 rounded-control hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)]">
              <ChevronDown size={16} />
            </button>
          </div>

          <Button size="sm" className="ml-auto" type="button" onClick={() => setOpen(false)}>
            <Check aria-hidden="true" />
            Xong
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// --- DateField (chỉ ngày, kiểu ô nhập trong form) ---
//
// Khác DatePicker ở trên: DatePicker là con chip nhỏ dùng cho thanh lọc, còn cái này
// là ô nhập đầy đủ cho biểu mẫu — giống ô BẮT ĐẦU/KẾT THÚC ở trang Kỳ.
//
// Dùng lại đúng mẹo của DateTimePicker bản desktop: input native nhưng chữ trong suốt,
// rồi phủ lên trên một lớp hiển thị do date-fns format. Nhờ vậy được cả hai thứ:
//   - Luôn hiện dd/MM/yyyy, không phụ thuộc locale trình duyệt (input native để mặc
//     định sẽ ra mm/dd/yyyy trên máy cài tiếng Anh).
//   - Lịch chọn ngày là của hệ điều hành nên KHÔNG BAO GIỜ bị modal che — popover tự
//     dựng thì phải canh z-index với từng modal lồng nhau, rất dễ vỡ.
//
// Lớp phủ dùng lại y hệt `className` của input (chỉ bỏ viền/nền) để khoảng đệm và cỡ
// chữ tự khớp, không phải canh tay khi caller đổi style.
interface DateFieldProps {
  value: string // "yyyy-MM-dd"
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  min?: string
  max?: string
}

export function DateField({ value, onChange, placeholder = 'Chọn ngày', className, min, max }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 639px)')

  const parsed = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined
  const valid = parsed && isValid(parsed) ? parsed : undefined

  // Mobile: lịch tự dựng, giống hệt nhánh mobile của DateTimePicker ở trên. Ô ngày
  // native trên điện thoại bung ra bộ chọn của hệ điều hành — mỗi máy một kiểu, và
  // vùng chạm vào đúng icon lịch nhỏ xíu rất khó bấm.
  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(className, 'flex items-center gap-2 text-left')}
          >
            <CalendarIcon size={15} className="text-[var(--color-subtle-foreground)] shrink-0" />
            {valid
              ? <span className="flex-1">{format(valid, 'dd/MM/yyyy')}</span>
              : <span className="flex-1 text-[var(--color-muted-foreground)]">{placeholder}</span>
            }
          </button>
        </PopoverTrigger>
        {/* z-[1100]: DateField chủ yếu dùng trong modal (z-[1000]), để mặc định z-50
            thì lịch mở ra nằm phía sau modal và không bấm được. */}
        <PopoverContent
          className="w-auto p-3 z-[1100] border-[var(--color-border)] shadow-2xl"
          align="start"
          collisionPadding={12}
          sideOffset={6}
        >
          <DayPicker
            mode="single"
            selected={valid}
            onSelect={(day) => {
              if (!day) return
              onChange(format(day, 'yyyy-MM-dd'))
              setOpen(false)
            }}
            defaultMonth={valid}
            startMonth={min ? parse(min, 'yyyy-MM-dd', new Date()) : undefined}
            endMonth={max ? parse(max, 'yyyy-MM-dd', new Date()) : undefined}
            disabled={[
              ...(min ? [{ before: parse(min, 'yyyy-MM-dd', new Date()) }] : []),
              ...(max ? [{ after: parse(max, 'yyyy-MM-dd', new Date()) }] : []),
            ]}
            classNames={DAY_PICKER_CLASS_NAMES}
            components={{ Chevron: DayPickerChevron }}
          />
        </PopoverContent>
      </Popover>
    )
  }

  // Desktop: input native (bộ chọn của trình duyệt vẫn tiện hơn trên chuột) nhưng chữ
  // trong suốt, phủ lên trên lớp hiển thị do date-fns format để luôn ra dd/MM/yyyy.
  return (
    <div className="relative">
      <input
        type="date"
        value={value || ''}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className={cn(className, 'text-transparent [color-scheme:light] dark:[color-scheme:dark]')}
      />
      <div
        className={cn(
          className,
          'absolute inset-0 flex items-center pointer-events-none border-transparent bg-transparent'
        )}
      >
        {valid
          ? <span>{format(valid, 'dd/MM/yyyy')}</span>
          : <span className="text-[var(--color-muted-foreground)]">{placeholder}</span>
        }
      </div>
    </div>
  )
}
