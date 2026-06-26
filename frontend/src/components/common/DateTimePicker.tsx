import { useState } from 'react'
import { format, parse, isValid } from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Check, X } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const DAY_PICKER_CLASS_NAMES = {
  months: 'flex flex-col',
  month: 'space-y-2',
  month_caption: 'flex justify-center relative items-center h-9 px-8',
  caption_label: 'text-sm font-bold text-slate-900 dark:text-white',
  nav: 'absolute inset-x-0 top-0 flex justify-between',
  button_previous: 'h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
  button_next: 'h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
  weekdays: 'flex',
  weekday: 'w-9 h-8 text-center text-[11px] font-black text-slate-400 uppercase',
  weeks: '',
  week: 'flex mt-1',
  day: 'w-9 h-9 p-0 text-center flex items-center justify-center',
  day_button: 'w-9 h-9 rounded-xl text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700',
  selected: 'bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold',
  today: 'text-indigo-600 dark:text-indigo-400 font-bold',
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
            'flex items-center gap-1.5 pl-2.5 pr-2 py-2 rounded-xl',
            'border border-slate-100 dark:border-slate-800',
            'bg-slate-50/50 dark:bg-slate-800/50 text-left transition-all',
            'hover:border-indigo-300 dark:hover:border-indigo-700 outline-none',
            className
          )}
        >
          <CalendarIcon size={13} className="text-slate-400 shrink-0" />
          <span className={cn('text-[11px] font-black uppercase text-slate-600 dark:text-slate-400', !value && 'text-slate-400')}>
            {value && validSelected ? format(validSelected, 'dd/MM/yyyy') : placeholder}
          </span>
          {value && onClear && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClear() }}
              className="ml-0.5 p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={11} className="text-slate-400" />
            </button>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3 border-slate-200 dark:border-slate-800 shadow-2xl"
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-3 px-5 py-4 rounded-[20px]',
            'border border-slate-100 dark:border-slate-800',
            'bg-slate-50/50 dark:bg-slate-800/50 text-left transition-all',
            'hover:border-indigo-300 dark:hover:border-indigo-700',
            'focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none',
            className
          )}
        >
          <CalendarIcon size={16} className="text-slate-400 shrink-0" />
          <span className={cn('flex-1 text-sm font-bold text-slate-900 dark:text-white', !value && 'text-slate-400 font-medium')}>
            {value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : placeholder}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 border-slate-200 dark:border-slate-800 shadow-2xl"
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

        {/* Custom time picker — no native input */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 flex items-center gap-3">
          {/* Hour */}
          <div className="flex flex-col items-center gap-0.5">
            <button type="button" onClick={() => changeHour(1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500">
              <ChevronUp size={16} />
            </button>
            <span className="w-10 text-center text-lg font-black text-slate-900 dark:text-white tabular-nums leading-none py-1">
              {String(hour).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => changeHour(-1)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500">
              <ChevronDown size={16} />
            </button>
          </div>

          <span className="text-xl font-black text-slate-400 leading-none mb-0.5">:</span>

          {/* Minute */}
          <div className="flex flex-col items-center gap-0.5">
            <button type="button" onClick={() => changeMinute(5)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500">
              <ChevronUp size={16} />
            </button>
            <span className="w-10 text-center text-lg font-black text-slate-900 dark:text-white tabular-nums leading-none py-1">
              {String(minute).padStart(2, '0')}
            </span>
            <button type="button" onClick={() => changeMinute(-5)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500">
              <ChevronDown size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors"
          >
            <Check size={13} />
            Xong
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
