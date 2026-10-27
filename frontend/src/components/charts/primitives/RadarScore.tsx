import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AXIS_COLORS, hexAlpha, seriesColor } from '../chartPalette'
import { SeriesTooltip } from '../ChartTooltip'

export interface RadarSeries {
  key: string
  label: string
  color?: string
}

interface Props {
  /** Một phần tử một trục; `axisKey` là tên trục, các khoá còn lại là chuỗi điểm. */
  data: Record<string, string | number | null>[]
  axisKey: string
  series: RadarSeries[]
  /** Thang điểm của chính phiếu — KHÔNG mặc định 0. */
  min: number
  max: number
  unit?: string
  height?: number
  emptyText: string
}

/**
 * So điểm của MỘT đối tượng trên nhiều tiêu chí cùng thang — mạnh mặt nào, yếu mặt nào.
 *
 * <p><b>Vì sao dựng lại một primitive đã bị xoá:</b> `PerspectiveRadar` bị xoá 09/2026 vì nó vẽ bốn
 * lĩnh vực BSC, trùng câu hỏi với bản đồ chiến lược. Hình này trả lời câu khác hẳn: điểm từng tiêu
 * chí GIÁ TRỊ CỐT LÕI của một người. Không hình nào trong sản phẩm đang trả lời câu đó — bảng xếp
 * hạng chỉ có một con số tổng, còn phiếu hạnh kiểm là một bảng số không so được bằng mắt.
 *
 * <p>Không chép lại bản cũ: nó dùng `<Tooltip formatter>` trần (chuẩn `bieu-do-chuan` cấm) và chữ
 * 9–10px (dưới sàn 12px).
 *
 * <p>Thang chạy từ `min` chứ không từ 0: thang hạnh kiểm là 1..5, kéo đáy về 0 thì mọi hình đều
 * phình ra gần vành ngoài và hết phân biệt được ai với ai.
 *
 * <p>Không in nhãn số lên đỉnh — đỉnh trên và dưới của đa giác chồng chữ vào nhau; số đọc ở tooltip.
 */
export default function RadarScore({
  data, axisKey, series, min, max, unit = '', height = 280, emptyText,
}: Props) {
  if (!data.length || !series.length) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyText}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Chú giải tự dựng bằng HTML: `<Legend>` của Recharts giành chỗ vẽ và bị cắt trên màn hẹp. */}
      {series.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
          {series.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color ?? seriesColor(i) }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* `height` là SỐ: `height="100%"` trong khung chỉ có `min-h` đo ra 0 và không vẽ gì cả. */}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey={axisKey}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 12, fontWeight: 500 }}
          />
          {/*
            Không in số trên trục bán kính: nó chạy NGANG từ tâm ra và đè thẳng lên nhãn tiêu chí
            bên phải. Thang điểm đã nói ở phụ đề, số từng đỉnh đọc ở tooltip.
          */}
          <PolarRadiusAxis domain={[min, max]} tick={false} axisLine={false} />
          <Tooltip content={<SeriesTooltip unit={unit} />} />
          {series.map((s, i) => {
            const color = s.color ?? seriesColor(i)
            return (
              <Radar
                key={s.key}
                name={s.label}
                dataKey={s.key}
                stroke={color}
                fill={hexAlpha(color, 0.28)}
                fillOpacity={1}
                strokeWidth={2}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
              />
            )
          })}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
