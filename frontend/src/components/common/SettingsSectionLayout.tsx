import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useStageVisible } from '@/features/kpi/workflow/hooks/useStageVisible'
import { useNavLabels } from '@/features/organization/hooks/useNavLabels'
import { findNavItem, type NavItem } from '@/config/navigation'
import { useTourScope } from '@/hooks/useTourScope'

export interface SectionRenderer {
  /** Trùng với `id` của mục trong `sections` của cây nav. */
  id: string
  render: () => ReactNode
  /** Ẩn mục khi tổ chức tắt tính năng liên quan. Mặc định hiện. */
  visible?: boolean
  /** Số việc đang chờ. Hiện trên thẻ và trên tab; `true` chỉ hiện chấm đỏ. */
  badge?: number | boolean | null
}

/** Chấm/số việc chờ, dùng chung cho thẻ ở lưới và tab. */
function Badge({ value, tone = 'solid' }: { value: number | boolean | null | undefined; tone?: 'solid' | 'dot' }) {
  if (!value) return null
  if (typeof value === 'number' && tone === 'solid') {
    return (
      <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-destructive)] px-1 text-[10px] font-semibold tabular-nums leading-none text-white">
        {value}
      </span>
    )
  }
  return <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-destructive)]" />
}

/**
 * Khung trang thiết lập, hai trạng thái:
 *
 * 1. Chưa chọn mục — lưới thẻ to chia theo cụm chức năng. Vào trang là thấy ngay có
 *    những gì, thẻ đủ rộng để đọc mô tả và dễ bấm.
 * 2. Đã chọn mục — lưới thu lại thành một hàng tab mảnh, trả gần hết chiều cao cho
 *    nội dung. Bảng nhân sự hay ma trận đánh giá cần chỗ đó.
 *
 * Cố ý KHÔNG dùng menu dọc cố định: app đã có sidebar thật ngay cạnh, thêm một cột
 * điều hướng nữa sẽ đọc thành "hai sidebar" và cắt mất ~260px bề ngang.
 *
 * Lưới căn trái theo cùng một mép chứ không căn giữa kiểu kim tự tháp: mắt quét danh
 * sách bằng cách bám mép trái, mỗi hàng thụt một kiểu thì phải dò lại từ đầu ở từng
 * hàng. Số thẻ mỗi cụm (2 – 3 – 4) tự tạo ra hình bậc thang mà không phải căn giữa.
 *
 * Mục đang mở lưu ở `?section=` nên bookmark được và F5 không mất chỗ.
 */
export default function SettingsSectionLayout({
  navId,
  sections,
  title,
  subtitle,
  eyebrow,
}: {
  /** `id` của mục nav sở hữu trang này — nơi lấy danh sách mục con và nhãn. */
  navId: string
  sections: SectionRenderer[]
  title: string
  subtitle?: string
  eyebrow?: ReactNode
}) {
  const { hasPermission } = useHasPermission()
  const stageVisible = useStageVisible()
  const { labelOf } = useNavLabels()
  const [searchParams, setSearchParams] = useSearchParams()

  const navItem = findNavItem(navId)
  const defs: NavItem[] = navItem?.sections ?? []

  const visible = defs.filter(def => {
    const renderer = sections.find(s => s.id === def.id)
    if (!renderer || renderer.visible === false) return false
    // Cùng phép lọc như sidebar: tổ chức tắt bước nào thì mục của bước đó biến mất khỏi cả
    // hàng tab lẫn lưới thẻ, không riêng menu bên trái.
    if (!stageVisible([def.path, ...(def.legacyKeys ?? [])])) return false
    return !def.permission || hasPermission(def.permission, def.requireAllPermissions)
  })

  const active = visible.find(s => s.id === searchParams.get('section'))

  /** Mục đang có việc chờ (số hoặc chấm) đứng trước mục không có. */
  const pendingWeight = (id: string) => (sections.find(s => s.id === id)?.badge ? 1 : 0)

  // Hai tầng đầu của điều hướng — dòng sidebar và mục trong trang — báo lên cho hệ
  // hướng dẫn từ đúng chỗ biết chúng, thay vì để layout đoán lại từ URL.
  useTourScope(navId, active?.id ?? null)

  const setSection = (id: string | null) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (id) p.set('section', id)
      else p.delete('section')
      return p
    })
  }

  /* ── Chưa chọn mục: lưới thẻ ── */
  if (!active) {
    // Gom theo cụm nhưng giữ nguyên thứ tự khai báo trong cây nav.
    const groups: { name: string; items: NavItem[] }[] = []
    visible.forEach(def => {
      const name = def.group ?? ''
      const last = groups[groups.length - 1]
      if (last && last.name === name) last.items.push(def)
      else groups.push({ name, items: [def] })
    })

    return (
      <div className="mx-auto max-w-[1600px] space-y-8 pb-20">
        <div>
          {eyebrow}
          <h1 className="text-page-title">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{subtitle}</p>}
        </div>

        {visible.length === 0 && (
          <div className="rounded-card border border-dashed border-[var(--color-border)] p-10 text-center">
            <p className="text-sm font-medium text-[var(--color-foreground)]">Không có mục nào khả dụng với tài khoản của bạn ở trang này.</p>
            <p className="mt-1 text-caption">Vai trò hiện tại chưa được cấp quyền, hoặc các tính năng liên quan đang tắt.</p>
          </div>
        )}

        <div id="tour-settings-nav" className="@container space-y-8">
          {groups.map(group => (
            <div key={group.name} className="space-y-3">
              {group.name && (
                <div className="flex items-center gap-3">
                  <h2 className="text-eyebrow">{group.name}</h2>
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                </div>
              )}
              {/* Số cột đếm theo bề ngang THẬT của vùng nội dung (`@container` ở trên), không
                  theo bề ngang khung nhìn: thanh bên chiếm ~285px và còn đóng/mở được, nên cùng
                  một màn 1280px lúc thì còn ~950px lúc lại ~1200px cho lưới. Bám khung nhìn thì
                  màn nhỏ đã nhảy sang 4 cột khi mỗi thẻ chỉ còn ~225px — mô tả vỡ 4-5 dòng.
                  Ngưỡng (32rem / 48rem / 64rem) đặt sao cho thẻ không bao giờ hẹp hơn ~245px.

                  Mọi cụm dùng CHUNG bộ ngưỡng, không co theo số thẻ — nhờ vậy thẻ ở mọi hàng
                  rộng bằng nhau và thẳng mép trái. */}
              <div className="grid gap-4 grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
                {/* Thẻ đang có việc chờ nổi lên đầu cụm: số đỏ là chỗ cần vào trước, để nó
                    nằm lẫn giữa lưới là người dùng phải quét cả lưới mới thấy. Sort ổn định
                    nên các thẻ còn lại giữ nguyên thứ tự khai báo trong cây nav. */}
                {[...group.items]
                  .sort((a, b) => pendingWeight(b.id) - pendingWeight(a.id))
                  .map(def => (
                  <button type="button" className="group block w-full rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]" key={def.id} id={`tour-card-${def.id}`} onClick={() => setSection(def.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] [&_svg]:size-[18px]" aria-hidden="true">
                        {def.icon}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 mt-1">
                        <Badge aria-hidden="true" value={sections.find(s => s.id === def.id)?.badge} />
                        <ChevronRight aria-hidden="true"
                          className="text-[var(--color-subtle-foreground)] transition-colors group-hover:text-[var(--color-foreground)]"
                        />
                      </div>
                    </div>
                    <h3 className="mt-3 text-sm font-medium leading-5 text-[var(--color-foreground)]">
                      {labelOf(def)}
                    </h3>
                    {def.description && (
                      <p className="mt-1 text-caption leading-4">{def.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Đã chọn mục: hàng tab mảnh + nội dung ── */
  // Chỉ hiện các mục CÙNG CỤM với mục đang mở. Đủ cả chín mục thì hàng tab dài
  // ~1400px và vẫn tràn, trong khi tiêu đề ngay trên đã nói rõ đang ở đâu. Nhảy sang
  // cụm khác đi qua lưới thẻ — cũng là việc hiếm khi làm giữa chừng.
  const siblings = visible.filter(def => def.group === active.group)

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-20">
      {/* KHÔNG lặp lại tên mục ở đây: đường dẫn phân cấp trên header đã ghi nó ở crumb
          cuối, và hàng tab ngay dưới cũng đang tô sáng đúng mục đó. Nút quay lại cũng
          nằm trên header — điều hướng thuộc về khung, và ở đó thì cuộn xuống vẫn thấy. */}

      {/* Cụm chỉ có một mục thì hàng tab không nói thêm được gì — bỏ hẳn cho gọn. */}
      {siblings.length > 1 && (
        <div id="tour-section-tabs" className="flex items-stretch border-b border-[var(--color-border)] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {siblings.map(def => {
            const isActive = def.id === active.id
            return (
              <button
                key={def.id}
                id={`tour-tab-${def.id}`}
                onClick={() => setSection(def.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  // To hơn tab cấp 2 (13px) một bậc: hàng này là cấp trên, phải nặng hơn.
                  '-mb-px flex h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]',
                  isActive
                    ? 'border-[var(--color-primary)] text-[var(--color-foreground)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-foreground)]'
                )}
              >
                <span className={cn('shrink-0 [&_svg]:size-4', isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]')} aria-hidden="true">
                  {def.icon}
                </span>
                {labelOf(def)}
                <Badge value={sections.find(s => s.id === def.id)?.badge} />
              </button>
            )
          })}
        </div>
      )}

      {/* `id` cố định để hướng dẫn của BẤT KỲ mục nào cũng luôn có ít nhất một điểm
          bám, kể cả những mục dựng bảng riêng chứ không dùng `WorkspaceHeader`. */}
      <div id="tour-section-root" className="min-w-0">
        {sections.find(s => s.id === active.id)?.render()}
      </div>
    </div>
  )
}
