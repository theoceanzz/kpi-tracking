import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import type { OrthogonalEdgeData } from './workflowGraphModel'

type OrthogonalEdgeType = Edge<OrthogonalEdgeData, 'orthogonal'>

/** Bán kính bo góc. */
const RADIUS = 8

/**
 * Cạnh gấp khúc với đoạn ngang giữa đặt ở toạ độ y CHỈ ĐỊNH (`viaY`).
 *
 * `smoothstep` của XY Flow tự đặt đoạn ngang ở trung điểm giữa nguồn và đích; với lưới gấp dòng
 * thì trung điểm đó hay rơi đúng vào một dòng có nút (ví dụ dòng chứa bước Điều chỉnh), cạnh cắt
 * ngang qua thẻ. Ở đây mô hình tính sẵn khe trống nào đủ rộng và truyền vào, cạnh chỉ việc vẽ.
 */
function OrthogonalEdgeImpl({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<OrthogonalEdgeType>) {
  const viaY = data?.viaY ?? Number.NaN
  const targetSide = data?.targetSide ?? 'left'
  const tone = data?.tone ?? 'flow'
  // Kênh do mô hình cấp: mỗi loại cạnh một x bẻ góc khác nhau, để hai cạnh cùng rời một nút
  // không đè đoạn dọc lên nhau.
  const so = data?.sourceOffset ?? 24
  const to = data?.targetOffset ?? 24

  const points: [number, number][] = [[sourceX, sourceY]]
  if (Number.isNaN(viaY)) {
    if (targetSide === 'top') {
      // Nhánh phụ thẳng đứng: cùng cột nên chỉ cần một đoạn, lệch cột thì bẻ ở giữa.
      if (Math.abs(sourceX - targetX) > 1) {
        const midY = (sourceY + targetY) / 2
        points.push([sourceX, midY], [targetX, midY])
      }
    } else if (Math.abs(sourceY - targetY) > 1) {
      const midX = (sourceX + targetX) / 2
      points.push([midX, sourceY], [midX, targetY])
    }
  } else if (targetSide === 'top') {
    points.push([sourceX + so, sourceY], [sourceX + so, viaY], [targetX, viaY])
  } else {
    points.push([sourceX + so, sourceY], [sourceX + so, viaY], [targetX - to, viaY], [targetX - to, targetY])
  }
  points.push([targetX, targetY])

  const path = roundedPath(points)
  const label = data?.label
  const anchor = labelAnchor(points)

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={cn(
          tone === 'back' && '[&>path]:!stroke-[var(--color-danger)] [&>path]:![stroke-dasharray:5_4]',
          tone === 'side' && '[&>path]:!stroke-[var(--color-border-strong)] [&>path]:![stroke-dasharray:3_3]',
          tone === 'flow' && '[&>path]:!stroke-[var(--color-border-strong)]',
        )}
        style={{ strokeWidth: 1.75 }}
      />
      {label && anchor && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'pointer-events-none absolute rounded-control border px-1.5 py-0.5 text-[10px] font-bold',
              tone === 'back'
                ? 'border-[var(--color-danger-border)] bg-[var(--color-card)] text-[var(--color-danger)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]',
            )}
            // Đoạn dọc: nhãn đứng KỀ BÊN PHẢI đường kẻ thay vì đè lên nó — đè lên thì cạnh gấp
            // dòng chạy ngang qua đúng khe đó sẽ cắt xuyên chữ.
            style={{
              transform: anchor.vertical
                ? `translate(0, -50%) translate(${anchor.x + 8}px, ${anchor.y + 6}px)`
                : `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

/** Nối các điểm bằng đoạn thẳng, bo tròn tại mỗi chỗ bẻ góc. */
function roundedPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0]![0]} ${points[0]![1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!
    const [cx, cy] = points[i]!
    const [nx, ny] = points[i + 1]!
    // Bán kính không được vượt quá nửa đoạn ngắn hơn, không thì hai cung đè lên nhau.
    const r = Math.min(RADIUS, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2)
    const inX = cx - Math.sign(cx - px) * r
    const inY = cy - Math.sign(cy - py) * r
    const outX = cx + Math.sign(nx - cx) * r
    const outY = cy + Math.sign(ny - cy) * r
    d += ` L ${inX} ${inY} Q ${cx} ${cy} ${outX} ${outY}`
  }
  const last = points[points.length - 1]!
  d += ` L ${last[0]} ${last[1]}`
  return d
}

/** Điểm giữa của đoạn NGANG dài nhất — chỗ đặt nhãn ít khi đè lên nút. */
function labelAnchor(points: [number, number][]): { x: number; y: number; vertical: boolean } | null {
  let best: { x: number; y: number; vertical: boolean } | null = null
  let bestLen = 0
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!
    const [bx, by] = points[i]!
    if (Math.abs(ay - by) > 1) continue
    const len = Math.abs(bx - ax)
    if (len > bestLen) {
      bestLen = len
      best = { x: (ax + bx) / 2, y: ay, vertical: false }
    }
  }
  // Toàn đoạn dọc (nhánh phụ thẳng đứng): đặt ở giữa đoạn.
  if (!best && points.length >= 2) {
    const [ax, ay] = points[0]!
    const [bx, by] = points[points.length - 1]!
    best = { x: (ax + bx) / 2, y: (ay + by) / 2, vertical: true }
  }
  return best
}

const OrthogonalEdge = memo(OrthogonalEdgeImpl)
export default OrthogonalEdge
