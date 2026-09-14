import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Hình minh hoạ loại biểu đồ, dùng trong bộ chọn "Thêm biểu đồ".
 *
 * Đây là HÌNH GIAO DIỆN, không phải biểu đồ dữ liệu: không trục, không chú giải, không nhãn số —
 * và `aria-hidden` vì tên biểu đồ đã nằm ngay cạnh dưới dạng chữ. Chuẩn `bieu-do-chuan` áp cho
 * biểu đồ thật, không áp cho mấy hình này.
 *
 * Mọi nét đều dùng `currentColor` để thừa hưởng màu trạng thái của thẻ chứa nó (thẻ đã thêm là nền
 * đậm chữ trắng, thẻ chưa thêm là chữ tím) — nhờ vậy không phải viết logic màu nào cả.
 */
export type ChartShape =
  | 'bar' | 'groupedBar' | 'stackedBar' | 'stacked100' | 'lollipop' | 'bullet'
  | 'line' | 'area' | 'stackedArea'
  | 'scatter'
  | 'pie' | 'donut' | 'treemap'
  | 'sankey'
  | 'histogram' | 'boxplot' | 'heatmap'
  | 'dumbbell' | 'table' | 'metricCard'

const AXIS = 'stroke-current opacity-25'
const INK = 'fill-current opacity-90'
const INK2 = 'fill-current opacity-45'
const INK3 = 'fill-current opacity-20'

/** Trục đáy dùng chung cho các hình có cột/đường. */
const baseline = <path d="M5 34h46" className={AXIS} strokeWidth="1.5" strokeLinecap="round" />

const SHAPES: Record<ChartShape, ReactNode> = {
  bar: (
    <>
      {baseline}
      <rect x="8" y="19" width="8" height="14" rx="1.5" className={INK} />
      <rect x="20" y="11" width="8" height="22" rx="1.5" className={INK} />
      <rect x="32" y="23" width="8" height="10" rx="1.5" className={INK} />
      <rect x="44" y="15" width="7" height="18" rx="1.5" className={INK} />
    </>
  ),

  groupedBar: (
    <>
      {baseline}
      <rect x="8" y="18" width="5" height="15" rx="1" className={INK} />
      <rect x="14" y="23" width="5" height="10" rx="1" className={INK2} />
      <rect x="25" y="11" width="5" height="22" rx="1" className={INK} />
      <rect x="31" y="17" width="5" height="16" rx="1" className={INK2} />
      <rect x="42" y="21" width="5" height="12" rx="1" className={INK} />
      <rect x="48" y="26" width="5" height="7" rx="1" className={INK2} />
    </>
  ),

  stackedBar: (
    <>
      {baseline}
      <rect x="9" y="24" width="9" height="9" rx="1" className={INK} />
      <rect x="9" y="17" width="9" height="7" className={INK2} />
      <rect x="23" y="19" width="9" height="14" rx="1" className={INK} />
      <rect x="23" y="10" width="9" height="9" className={INK2} />
      <rect x="37" y="26" width="9" height="7" rx="1" className={INK} />
      <rect x="37" y="18" width="9" height="8" className={INK2} />
    </>
  ),

  // Ba cột PHẢI cao bằng nhau — đó là toàn bộ ý nghĩa của "100%". Tầng trên cùng vì thế không
  // được nhạt tới mức biến mất trên nền trắng, không thì hình đọc thành cột chồng thường.
  stacked100: (
    <>
      <rect x="9" y="20" width="9" height="14" rx="1" className={INK} />
      <rect x="9" y="12" width="9" height="8" className={INK2} />
      <rect x="9" y="6" width="9" height="6" rx="1" className="fill-current opacity-30" />
      <rect x="23" y="24" width="9" height="10" rx="1" className={INK} />
      <rect x="23" y="14" width="9" height="10" className={INK2} />
      <rect x="23" y="6" width="9" height="8" rx="1" className="fill-current opacity-30" />
      <rect x="37" y="17" width="9" height="17" rx="1" className={INK} />
      <rect x="37" y="10" width="9" height="7" className={INK2} />
      <rect x="37" y="6" width="9" height="4" rx="1" className="fill-current opacity-30" />
    </>
  ),

  lollipop: (
    <>
      <path d="M9 5v30" className={AXIS} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 10h29M9 20h20M9 30h35" className="stroke-current opacity-35" strokeWidth="2" strokeLinecap="round" />
      <circle cx="38" cy="10" r="4" className={INK} />
      <circle cx="29" cy="20" r="4" className={INK} />
      <circle cx="44" cy="30" r="4" className={INK} />
    </>
  ),

  bullet: (
    <>
      <rect x="6" y="9" width="44" height="8" rx="2" className={INK3} />
      <rect x="6" y="11" width="26" height="4" rx="2" className={INK} />
      <path d="M38 8v10" className="stroke-current opacity-90" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="6" y="24" width="44" height="8" rx="2" className={INK3} />
      <rect x="6" y="26" width="35" height="4" rx="2" className={INK} />
      <path d="M30 23v10" className="stroke-current opacity-90" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),

  line: (
    <>
      {baseline}
      <path d="M7 27 19 17 31 22 43 9 51 14" fill="none" className="stroke-current" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="19" cy="17" r="2.5" className={INK} />
      <circle cx="31" cy="22" r="2.5" className={INK} />
      <circle cx="43" cy="9" r="2.5" className={INK} />
    </>
  ),

  area: (
    <>
      {baseline}
      <path d="M6 26 18 16 30 21 42 9 52 14V34H6Z" className={INK3} />
      <path d="M6 26 18 16 30 21 42 9 52 14" fill="none" className="stroke-current" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),

  stackedArea: (
    <>
      {baseline}
      <path d="M6 14 18 8 30 13 42 6 52 10V34H6Z" className={INK3} />
      <path d="M6 25 18 19 30 23 42 17 52 21V34H6Z" className={INK2} />
      <path d="M6 25 18 19 30 23 42 17 52 21" fill="none" className="stroke-current opacity-90" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),

  scatter: (
    <>
      <path d="M9 5v29h42" fill="none" className={AXIS} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="27" r="2.5" className={INK} />
      <circle cx="23" cy="19" r="2.5" className={INK} />
      <circle cx="27" cy="28" r="2.5" className={INK2} />
      <circle cx="33" cy="14" r="2.5" className={INK} />
      <circle cx="38" cy="22" r="2.5" className={INK2} />
      <circle cx="45" cy="10" r="2.5" className={INK} />
    </>
  ),

  pie: (
    <>
      <circle cx="28" cy="20" r="13" className={INK3} />
      <path d="M28 20V7A13 13 0 0 1 39.3 26.5Z" className={INK} />
      <path d="M28 20 15.5 16.5" className="stroke-current opacity-45" strokeWidth="1.5" />
    </>
  ),

  donut: (
    <>
      <circle cx="28" cy="20" r="12" fill="none" className="stroke-current opacity-20" strokeWidth="8" />
      <circle
        cx="28" cy="20" r="12" fill="none"
        className="stroke-current opacity-90" strokeWidth="8"
        strokeDasharray="45 30.4" transform="rotate(-90 28 20)"
      />
    </>
  ),

  treemap: (
    <>
      <rect x="5" y="6" width="26" height="17" rx="2" className={INK} />
      <rect x="33" y="6" width="18" height="17" rx="2" className={INK2} />
      <rect x="5" y="25" width="16" height="9" rx="2" className={INK2} />
      <rect x="23" y="25" width="12" height="9" rx="2" className={INK3} />
      <rect x="37" y="25" width="14" height="9" rx="2" className={INK3} />
    </>
  ),

  sankey: (
    <>
      <path d="M11 13.5C24 13.5 32 10.5 45 10.5" fill="none" className="stroke-current opacity-40" strokeWidth="7" />
      <path d="M11 19C24 19 32 22.5 45 23" fill="none" className="stroke-current opacity-22" strokeWidth="4" />
      <path d="M11 27.5C24 27.5 32 31 45 32" fill="none" className="stroke-current opacity-30" strokeWidth="5" />
      <rect x="6" y="8" width="5" height="12" rx="1.5" className={INK} />
      <rect x="6" y="23" width="5" height="10" rx="1.5" className={INK} />
      <rect x="45" y="6" width="5" height="9" rx="1.5" className={INK} />
      <rect x="45" y="19" width="5" height="8" rx="1.5" className={INK} />
      <rect x="45" y="29" width="5" height="6" rx="1.5" className={INK} />
    </>
  ),

  histogram: (
    <>
      {baseline}
      <rect x="7" y="28" width="7" height="5" className={INK2} />
      <rect x="14.5" y="21" width="7" height="12" className={INK} />
      <rect x="22" y="12" width="7" height="21" className={INK} />
      <rect x="29.5" y="16" width="7" height="17" className={INK} />
      <rect x="37" y="25" width="7" height="8" className={INK2} />
      <rect x="44.5" y="30" width="7" height="3" className={INK2} />
    </>
  ),

  // Râu dọc xuyên hộp + vạch trung vị nằm trong hộp. Bản trước vẽ râu ngang lệch khỏi hộp nên
  // đọc thành hai hộp chồng lẫn nhau chứ không ra hình hộp-râu.
  boxplot: (
    <>
      <path d="M18 7v26M13 7h10M13 33h10" className="stroke-current opacity-40" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="11" y="14" width="14" height="13" rx="2" className={INK2} />
      <path d="M11 21h14" className="stroke-current opacity-90" strokeWidth="2" strokeLinecap="round" />
      <path d="M39 5v30M34 5h10M34 35h10" className="stroke-current opacity-40" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="32" y="12" width="14" height="15" rx="2" className={INK2} />
      <path d="M32 17h14" className="stroke-current opacity-90" strokeWidth="2" strokeLinecap="round" />
    </>
  ),

  heatmap: (
    <>
      <rect x="7" y="8" width="12" height="8" rx="1.5" className={INK3} />
      <rect x="21" y="8" width="12" height="8" rx="1.5" className={INK2} />
      <rect x="35" y="8" width="12" height="8" rx="1.5" className={INK} />
      <rect x="7" y="18" width="12" height="8" rx="1.5" className={INK2} />
      <rect x="21" y="18" width="12" height="8" rx="1.5" className={INK} />
      <rect x="35" y="18" width="12" height="8" rx="1.5" className={INK2} />
      <rect x="7" y="28" width="12" height="8" rx="1.5" className={INK} />
      <rect x="21" y="28" width="12" height="8" rx="1.5" className={INK3} />
      <rect x="35" y="28" width="12" height="8" rx="1.5" className={INK2} />
    </>
  ),

  dumbbell: (
    <>
      <path d="M14 10h22M20 20h24M11 30h17" className="stroke-current opacity-35" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="10" r="3.5" className={INK2} />
      <circle cx="36" cy="10" r="3.5" className={INK} />
      <circle cx="20" cy="20" r="3.5" className={INK2} />
      <circle cx="44" cy="20" r="3.5" className={INK} />
      <circle cx="11" cy="30" r="3.5" className={INK2} />
      <circle cx="28" cy="30" r="3.5" className={INK} />
    </>
  ),

  table: (
    <>
      <rect x="6" y="7" width="44" height="7" rx="2" className={INK} />
      <rect x="6" y="17" width="19" height="4" rx="1.5" className={INK2} />
      <rect x="29" y="17" width="21" height="4" rx="1.5" className={INK3} />
      <rect x="6" y="24" width="19" height="4" rx="1.5" className={INK2} />
      <rect x="29" y="24" width="21" height="4" rx="1.5" className={INK3} />
      <rect x="6" y="31" width="19" height="4" rx="1.5" className={INK2} />
      <rect x="29" y="31" width="21" height="4" rx="1.5" className={INK3} />
    </>
  ),

  metricCard: (
    <>
      <rect x="6" y="7" width="16" height="4" rx="2" className={INK3} />
      <rect x="6" y="14" width="27" height="11" rx="2.5" className={INK} />
      <rect x="6" y="29" width="20" height="4" rx="2" className={INK2} />
      <path d="M40 24l6-7 5 5" fill="none" className="stroke-current opacity-45" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
}

export default function ChartTypePreview({ shape, className }: { shape: ChartShape; className?: string }) {
  return (
    <svg viewBox="0 0 56 40" aria-hidden="true" focusable="false" className={cn('w-14 h-10 shrink-0', className)}>
      {SHAPES[shape]}
    </svg>
  )
}
