import { Component, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Responsive } from 'react-grid-layout/legacy'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ResponsiveProps = ComponentProps<typeof Responsive>

/**
 * Thay cho `WidthProvider(Responsive)` của react-grid-layout.
 *
 * <p>WidthProvider gốc đẩy MỌI số đo của ResizeObserver vào lưới, kể cả 0 — thứ xảy ra khi
 * vùng chứa tạm thời không có bề ngang (đổi kích thước cửa sổ nhanh, chụp màn hình, in, thẻ
 * trình duyệt bị thu). Bề ngang 0 làm lưới nhảy sang breakpoint `xxs`, rồi lập tức nhảy về:
 * trong hai nhịp đó GridItem nhận bố cục của breakpoint này với số cột của breakpoint kia, ô
 * biểu đồ co giãn 347px ↔ 1074px mỗi nhịp, và Tooltip của Recharts (đo vị trí bằng ref) rơi
 * vào vòng lặp setState cho tới khi React ném "Maximum update depth exceeded" (lỗi trắng trang
 * chủ 15/09, tái hiện được trên bản build).
 *
 * <p>Ở đây: bỏ qua số đo ≤ 0, làm tròn về số nguyên và chỉ cập nhật khi thật sự đổi, nên lưới
 * không bao giờ thấy một breakpoint "ma".
 */
export function StableGridLayout(props: Omit<ResponsiveProps, 'width' | 'innerRef'>) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>(1280)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    let raf: number | null = null
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().width)
      if (next > 0) setWidth(prev => (prev === next ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(() => {
      if (raf !== null) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { raf = null; measure() })
    })
    observer.observe(node)
    return () => {
      if (raf !== null) cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return <Responsive {...(props as ResponsiveProps)} innerRef={ref} width={width} />
}

interface BoundaryProps { title: string; children: ReactNode }
interface BoundaryState { failed: boolean }

/**
 * Hàng rào lỗi cho TỪNG ô widget: một biểu đồ ném lỗi khi vẽ thì chỉ ô đó hiện "không vẽ được"
 * kèm nút thử lại, các ô còn lại và cả trang vẫn sống. Không có nó, React Router hứng lỗi và
 * thay toàn bộ trang bằng màn "Unexpected Application Error".
 */
export class WidgetErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`Widget "${this.props.title}" không vẽ được:`, error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] px-6 py-8 text-center"
      >
        <AlertCircle size={22} aria-hidden="true" className="text-[var(--color-error)]" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-medium text-[var(--color-foreground)]">Không vẽ được "{this.props.title}"</p>
          <p className="mt-1 text-caption">Các phần khác của trang không bị ảnh hưởng.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>
          <RotateCcw aria-hidden="true" /> Thử lại
        </Button>
      </div>
    )
  }
}
