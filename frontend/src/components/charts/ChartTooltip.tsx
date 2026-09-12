import type { ReactNode } from 'react'

export interface ChartTooltipRow {
  /** Ô màu bên trái. Bỏ trống khi dòng không gắn với một chuỗi nào trên biểu đồ. */
  color?: string
  label: string
  value: ReactNode
}

interface Props {
  title?: ReactNode
  rows: ChartTooltipRow[]
  /** Dòng bối cảnh dưới cùng, tách bằng đường kẻ — ví dụ "Tính trên 75 KPI (68 cũ · 7 mới)". */
  footer?: ReactNode
}

/**
 * Thẻ tooltip dùng chung cho mọi biểu đồ.
 *
 * <p>Trước khi có file này, các biểu đồ trong Thống kê chia làm hai phe: phần lớn dùng thẻ nền
 * sáng có viền, một số ít còn sót lại dùng "viên" nền đen chữ trắng. Hai kiểu nằm cạnh nhau trong
 * cùng một tab khiến người dùng tưởng chúng là hai loại thông tin khác nhau, trong khi thực ra chỉ
 * là hai lần ai đó viết lại cùng một thứ.
 *
 * <p>Tách ra đây để việc đó không tái diễn: muốn đổi dáng tooltip thì sửa một chỗ, không phải đi
 * lùng từng biểu đồ. Component này chỉ lo phần TRÌNH BÀY — mỗi biểu đồ tự quyết định định dạng giá
 * trị của mình (`%`, `điểm`, kèm mẫu số…) rồi truyền vào `rows`.
 */
export default function ChartTooltip({ title, rows, footer }: Props) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-card shadow-lg max-w-[300px]">
      {title != null && title !== '' && (
        <p className="font-bold text-[var(--color-foreground)] mb-3 break-words">{title}</p>
      )}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {r.color && (
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
            )}
            <span className="text-[var(--color-muted-foreground)] font-medium min-w-[120px]">{r.label}:</span>
            <span className="font-bold text-[var(--color-foreground)] tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      {footer != null && (
        <p className="text-xs text-[var(--color-subtle-foreground)] pt-2.5 mt-2.5 border-t border-[var(--color-border)]">
          {footer}
        </p>
      )}
    </div>
  )
}

export interface SeriesTooltipEntry {
  name?: string
  value?: number | string | null
  color?: string
  payload?: { fill?: string }
}

/** Làm tròn đến 1 chữ số thập phân — số nguyên giữ nguyên, số thực không tràn ra 12 chữ số. */
const round1 = (v: number) => String(Math.round(v * 10) / 10)

/**
 * Bản dùng ngay cho Recharts: `<Tooltip content={<SeriesTooltip unit="bài" />} />`.
 *
 * <p>Phủ trường hợp phổ biến nhất — mỗi chuỗi một dòng, giá trị là số kèm đơn vị — để không phải
 * viết lại một component tooltip cho từng biểu đồ. Biểu đồ nào cần bố cục riêng thì dùng thẳng
 * {@link ChartTooltip}.
 */
export function SeriesTooltip({ active, payload, label, unit = '', labelPrefix = '', format }: {
  active?: boolean
  payload?: SeriesTooltipEntry[]
  label?: ReactNode
  unit?: string
  /** Tiền tố cho tiêu đề, ví dụ `"Mức: "`. */
  labelPrefix?: string
  /** Định dạng riêng khi `unit` không đủ (ví dụ cần gắn liền `%` vào số). */
  format?: (value: number | string) => ReactNode
}) {
  if (!active || !payload?.length) return null
  // Bỏ dòng không có giá trị: chuỗi bỏ trống ở một mốc vẫn nằm trong payload, hiện ra thành
  // một dòng "—" vô nghĩa thay vì biến mất như trên biểu đồ.
  const rows = payload
    .filter(p => p.value != null && p.value !== '')
    .map(p => ({
      color: p.color ?? p.payload?.fill,
      label: p.name ?? '',
      value: format
        ? format(p.value as number | string)
        : `${typeof p.value === 'number' ? round1(p.value) : p.value}${unit ? ` ${unit}` : ''}`,
    }))
  if (rows.length === 0) return null
  const title = label == null || label === '' ? undefined : `${labelPrefix}${label}`
  return <ChartTooltip title={title} rows={rows} />
}
