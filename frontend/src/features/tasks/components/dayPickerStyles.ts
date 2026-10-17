/**
 * Cùng bộ class lịch với DateTimePicker của form tạo đợt / kỳ. Lưu ý: `nav` định vị tuyệt đối — DayPicker phải nằm
 * trong một khung `relative` của riêng nó, không thì hai mũi tên bám vào mép popover và đè lên phần khác.
 */
export const DAY_PICKER_CLASS_NAMES = {
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
