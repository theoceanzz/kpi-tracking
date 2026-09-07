import {
  achievementSurface,
  ACHIEVEMENT_BANDS,
  KPI_KIND_COLORS,
  KPI_KIND_LABELS,
  RELATION_STROKE,
  type KpiKind,
} from '@/components/charts/chartPalette'

/**
 * Chú giải cho treemap KPI: quan hệ, loại KPI, và thang màu tiến độ.
 *
 * <p>Trước đây chú giải là một dòng chữ 10px viết thẳng ở nơi gọi — chỉ nói được liền/đứt, và
 * hoàn toàn không nói màu ô nghĩa là gì. Người xem thấy một mảng đỏ to nhưng không biết đỏ là
 * dưới 40% hay dưới 80%, tức là phần mang nhiều thông tin nhất của hình lại không có chỉ dẫn.
 *
 * <p>Ba nhóm tách nhau vì chúng mã hoá ba thứ độc lập: VIỀN nói quan hệ, CHẤM nói loại, NỀN nói
 * kết quả. Gộp lại một hàng sẽ khiến người đọc tưởng chúng cùng một thang.
 */
export function KpiTreemapLegend() {
  const kinds = Object.keys(KPI_KIND_COLORS) as KpiKind[]

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
      <Group label="Quan hệ">
        <span className="flex items-center gap-1.5">
          <span
            className="w-4 h-3.5 rounded-[3px] border-2"
            style={{ borderColor: RELATION_STROKE.DECOMPOSITION }}
          />
          Phân rã (cha–con)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="w-4 h-3.5 rounded-[3px] border-2 border-dashed"
            style={{ borderColor: RELATION_STROKE.DELEGATION }}
          />
          Thác nước
        </span>
      </Group>

      <Group label="Loại">
        {kinds.map(k => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-[2px] ring-1 ring-white dark:ring-slate-900"
              style={{ backgroundColor: KPI_KIND_COLORS[k] }}
            />
            {KPI_KIND_LABELS[k]}
          </span>
        ))}
      </Group>

      <Group label="Tiến độ">
        {/* Lấy màu qua chính `achievementSurface` chứ không chép lại bảng màu: chú giải mà lệch
            với ô thật thì còn tệ hơn không có chú giải. */}
        <span className="flex items-center gap-1">
          {ACHIEVEMENT_BANDS.map(b => (
            <span key={b.label} className="flex items-center gap-1">
              <span
                className="w-3.5 h-3.5 rounded-[2px]"
                style={{ backgroundColor: achievementSurface(b.from) }}
              />
              <span className="tabular-nums">{b.label}</span>
            </span>
          ))}
        </span>
      </Group>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      {children}
    </div>
  )
}

export default KpiTreemapLegend
