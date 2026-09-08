import { useState } from 'react'
import { Treemap, Tooltip, ResponsiveContainer } from 'recharts'
import { achievementSurface, textOn } from '../chartPalette'
import { labelOnFill } from '../axisLabel'
import { AssigneeAvatars, type AssigneeBrief } from './AssigneeAvatars'

export interface TreemapLeaf {
  id?: string
  name: string
  /** Diện tích ô — thường là trọng số KPI. */
  size: number
  /** 0..100+, quyết định màu. Null = chưa có kết quả. */
  achievement?: number | null
  subText?: string
  /** Nhóm cha để gom ô (đơn vị, hạng mục…). Bỏ trống thì vẽ phẳng một tầng. */
  group?: string | null
  /** Người đảm nhiệm — hiện thành dãy avatar trong tooltip. */
  assignees?: AssigneeBrief[]
}

interface Props {
  data: TreemapLeaf[]
  height?: number
  onSelect?: (d: TreemapLeaf) => void
}

/**
 * Treemap trọng số: diện tích = công sức phân bổ, màu = kết quả đạt được.
 *
 * <p>Đặt hai thứ đó lên cùng một hình trả lời được câu mà bảng không trả lời nhanh: những ô TO mà
 * ĐỎ là nơi tổ chức dồn trọng số vào nhưng không ra kết quả — đúng chỗ cần can thiệp trước. Bảng
 * xếp theo tiến độ sẽ đẩy một KPI trọng số 1% lên đầu ngang với KPI trọng số 30%.
 *
 * <p>Khi có `onSelect`, mỗi ô là một nút mở chi tiết. Ô màu đặc không tự nói lên điều đó, nên phải
 * có tín hiệu: con trỏ đổi thành bàn tay, ô sáng lên và viền đậm khi rê chuột, một mũi tên ↗ hiện ở
 * góc ô, và tooltip nhắc "Bấm để xem chi tiết". Thiếu những thứ này người dùng sẽ không bao giờ
 * biết còn một tầng dữ liệu nữa nằm bên dưới.
 */
export default function WeightTreemap({ data, height = 380, onSelect }: Props) {
  // Trạng thái rê chuột giữ ở đây chứ không ở từng ô: Recharts dựng lại `content` cho mọi ô nên
  // state cục bộ trong ô sẽ mất sau mỗi lần vẽ.
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Recharts Treemap cần cây; gom theo `group` khi có, còn không thì để phẳng.
  const hasGroups = data.some(d => d.group)
  const tree = hasGroups
    ? Object.entries(
        data.reduce<Record<string, TreemapLeaf[]>>((acc, d) => {
          const k = d.group || 'Khác'
          ;(acc[k] ??= []).push(d)
          return acc
        }, {}),
      ).map(([name, children]) => ({
        name,
        children: children.map(c => ({ ...c, value: Math.max(c.size, 0.01) })),
      }))
    : data.map(d => ({ ...d, value: Math.max(d.size, 0.01) }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={tree}
        dataKey="value"
        aspectRatio={4 / 3}
        stroke="#fff"
        isAnimationActive={false}
        content={<TreemapCell onSelect={onSelect} hoveredId={hoveredId} onHover={setHoveredId} />}
      >
        <Tooltip content={<TreemapTooltip clickable={!!onSelect} />} />
      </Treemap>
    </ResponsiveContainer>
  )
}

interface CellProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  depth?: number
  achievement?: number | null
  id?: string
  size?: number
  subText?: string
  onSelect?: (d: TreemapLeaf) => void
  hoveredId?: string | null
  onHover?: (id: string | null) => void
}

function TreemapCell(props: CellProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', depth = 0, achievement, onSelect, hoveredId, onHover } = props
  // depth 1 = ô nhóm khi có gom nhóm: chỉ vẽ khung + nhãn, không tô màu kết quả.
  const isGroup = depth === 1 && !!props.id === false && achievement === undefined

  if (isGroup) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="none" stroke="#cbd5e1" strokeWidth={2} />
        {width > 60 && height > 20 && (
          <text x={x + 6} y={y + 15} fontSize={12} fontWeight={800} fill="#64748b">{name}</text>
        )}
      </g>
    )
  }

  // Chữ trắng trên lime/hổ phách chỉ đạt ~2:1 nên nhìn như mờ — phải chọn màu chữ theo nền.
  const bg = achievementSurface(achievement)
  const fg = textOn(bg)
  const clickable = !!(onSelect && props.id)
  const hovered = clickable && hoveredId === props.id
  // Cùng cỡ chữ và cùng khoảng cách dòng với HierarchicalTreemap — hai treemap đứng cạnh nhau
  // trong cùng một trang mà chữ khác cỡ thì đọc như hai chất lượng khác nhau.
  const canLabel = width > 54 && height > 28
  // Mũi tên ↗ chỉ vẽ khi ô đủ chỗ, nếu không nó sẽ đè lên tên KPI.
  const showCue = hovered && width > 46 && height > 36
  const cueX = x + width - 15
  const cueY = y + 15

  return (
    <g
      onClick={clickable ? () => onSelect!({ id: props.id, name, size: props.size ?? 0, achievement, subText: props.subText }) : undefined}
      onMouseEnter={clickable ? () => onHover?.(props.id ?? null) : undefined}
      onMouseLeave={clickable ? () => onHover?.(null) : undefined}
      style={{ cursor: clickable ? 'pointer' : undefined }}
    >
      <rect
        x={x} y={y} width={width} height={height}
        fill={bg}
        // Rê chuột: ô sáng hẳn lên và viền đổi sang màu đậm — đủ tương phản để thấy rõ ô nào đang
        // được nhắm, kể cả trên nền nhiều ô cùng màu.
        // Không giảm độ đục: 0.85 pha màu về phía nền trắng, ăn mất tương phản với chữ mà
        // chẳng đổi lại được gì.
        fillOpacity={1}
        stroke={hovered ? '#0f172a' : '#fff'}
        strokeWidth={hovered ? 2.5 : 1.5}
        style={{ transition: 'fill-opacity 120ms ease-out' }}
      />
      {canLabel && (
        <>
          <text x={x + 6} y={y + 18} fontSize={14} fontWeight={800} {...labelOnFill(fg)}>
            {name.length > Math.floor(width / 7) ? `${name.slice(0, Math.floor(width / 7))}…` : name}
          </text>
          {height > 46 && achievement != null && (
            <text x={x + 6} y={y + 38} fontSize={17} fontWeight={900} {...labelOnFill(fg)}>
              {Math.round(achievement)}%
            </text>
          )}
        </>
      )}
      {showCue && (
        <g pointerEvents="none">
          <circle cx={cueX} cy={cueY} r={9} fill="#fff" fillOpacity={0.95} />
          {/* Mũi tên chéo ↗ = "mở ra xem thêm", cùng ngôn ngữ với các liên kết đi tới trang khác. */}
          <path
            d={`M${cueX - 3.5} ${cueY + 3.5} L${cueX + 3.5} ${cueY - 3.5} M${cueX - 0.5} ${cueY - 3.5} L${cueX + 3.5} ${cueY - 3.5} L${cueX + 3.5} ${cueY + 0.5}`}
            stroke="#0f172a"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      )}
    </g>
  )
}

function TreemapTooltip({ active, payload, clickable }: {
  active?: boolean
  payload?: { payload: TreemapLeaf & { value?: number } }[]
  clickable?: boolean
}) {
  const d = payload?.[0]?.payload
  if (!active || !d || !d.name) return null
  const people = d.assignees ?? []
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-lg">
      <p className="font-bold text-slate-900 dark:text-white">{d.name}</p>
      {d.subText && <p className="text-xs text-slate-500 mb-2">{d.subText}</p>}
      <div className="space-y-1 text-sm">
        {d.size != null && (
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium min-w-[90px]">Trọng số:</span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">{Math.round(d.size * 10) / 10}</span>
          </div>
        )}
        {d.achievement != null && (
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium min-w-[90px]">Tiến độ:</span>
            <span className="font-bold tabular-nums" style={{ color: achievementSurface(d.achievement) }}>
              {Math.round(d.achievement)}%
            </span>
          </div>
        )}
      </div>
      <AssigneeAvatars people={people} />
      {clickable && d.id && (
        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800">
          Bấm để xem chi tiết →
        </p>
      )}
    </div>
  )
}
