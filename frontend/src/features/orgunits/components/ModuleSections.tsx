import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Target, GitBranch, SlidersHorizontal, Gift, Wallet, ChevronDown, ArrowRight, AlertTriangle, HeartHandshake } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

/**
 * Bật/tắt module của tổ chức.
 *
 * Trước đây mỗi module là một thẻ riêng xếp thành lưới 3 cột. Nội dung mỗi thẻ dài
 * ngắn rất khác nhau — OKR có thêm sơ đồ 3 bước nên cao gấp ba thẻ BSC — khiến lưới
 * so le và thẻ ngắn để lại mảng trống lớn. Quan trọng hơn: thứ người dùng đến đây để
 * làm chỉ là GẠT CÔNG TẮC, mà công tắc lại nằm rải rác ở sáu vị trí khác nhau.
 *
 * Giờ là một danh sách: mỗi module một dòng cao bằng nhau, mọi công tắc thẳng một cột
 * bên phải nên mắt quét dọc một lần là biết tổ chức đang bật gì. Phần giải thích dài
 * thu vào mục "Chi tiết" — vẫn còn đó cho ai cần, nhưng không chiếm chỗ mặc định.
 */

type OrgFlagField =
  | 'enableOkr'
  | 'enableQualitative'
  | 'enableConduct'
  | 'enableBsc'
  | 'enableWaterfall'
  | 'enableReward'
  | 'enableCashWallet'

interface ModuleDef {
  field: OrgFlagField
  icon: ReactNode
  /** Màu ô icon — mỗi module một sắc để nhận ra nhanh khi quét danh sách. */
  tone: string
  title: string
  subtitle: string
  /** Tên dùng trong thông báo sau khi bật/tắt. */
  toastName: string
  detail: ReactNode
  /** Cảnh báo hiện ngay trên dòng, không giấu trong "Chi tiết". */
  caution?: string
  manageTo?: string
  manageLabel?: string
}

/** Ba bước của một mô hình, dùng chung cho OKR và Thác nước. */
function Steps({ items, tone }: { items: [string, string][]; tone: string }) {
  return (
    <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {items.map(([name, desc], i) => (
        <li key={name} className="flex items-start gap-3 p-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
          <span className={cn('w-6 h-6 shrink-0 rounded-full bg-[var(--color-card)] flex items-center justify-center text-xs font-semibold shadow-sm', tone)}>
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-foreground)]">{name}</p>
            <p className="text-caption font-medium leading-relaxed">{desc}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

const MODULES: ModuleDef[] = [
  {
    field: 'enableOkr',
    icon: <Target size={18} />,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    title: 'OKR',
    subtitle: 'Mục tiêu chiến lược và kết quả then chốt',
    toastName: 'tính năng OKR',
    manageTo: '/settings/tools?section=okr',
    manageLabel: 'Quản lý OKR',
    detail: (
      <div className="space-y-3">
        <p>
          Khi bật, bạn thiết lập các Mục tiêu chiến lược (Objectives) và Kết quả then chốt
          (Key Results). KPI được liên kết trực tiếp vào Key Result để đo tiến độ thực hiện mục tiêu.
        </p>
        <Steps
          tone="text-[var(--color-primary)]"
          items={[
            ['Objective (định tính)', 'Xác định các mục tiêu chiến lược của tổ chức.'],
            ['Key Result (định lượng)', 'Chỉ số then chốt đo việc hoàn thành Objective.'],
            ['KPI (vận hành)', 'Liên kết KPI vào Key Result để theo dõi tự động hàng ngày.'],
          ]}
        />
      </div>
    ),
  },
  {
    field: 'enableQualitative',
    icon: <SlidersHorizontal size={18} />,
    tone: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    title: 'KPI hành vi',
    subtitle: 'Chấm điểm bằng mức đánh giá thay vì con số',
    toastName: 'KPI hành vi',
    manageTo: '/settings/tools?section=scoring&scoring=qualitative',
    manageLabel: 'Thang điểm định tính',
    detail: (
      <p>
        Dành cho KPI không đo được bằng con số. Loại này không chấm tự động — quản lý chọn một
        mức trong <span className="font-semibold">Thang điểm định tính</span>. Khi tắt, hệ thống chỉ
        hiển thị và tính điểm KPI định lượng; Ma trận đánh giá cũng ẩn theo, trừ khi bạn bật
        <span className="font-semibold"> Chấm hạnh kiểm</span> để bù trục còn thiếu.
      </p>
    ),
  },
  {
    field: 'enableConduct',
    icon: <HeartHandshake size={18} />,
    tone: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    title: 'Chấm hạnh kiểm',
    subtitle: 'Điểm hành vi theo bộ tiêu chí có trọng số',
    toastName: 'chấm hạnh kiểm',
    manageTo: '/settings/tools?section=scoring&scoring=conduct',
    manageLabel: 'Bộ tiêu chí hạnh kiểm',
    detail: (
      <div className="space-y-3">
        <p>
          Mỗi đợt hoặc mỗi kỳ, nhân sự tự chấm và nêu dẫn chứng cho từng tiêu chí hành vi, cán bộ
          quản lý trực tiếp chấm lại và nhận xét. Điểm hạnh kiểm ={' '}
          <span className="font-semibold">Σ(điểm tiêu chí × trọng số)</span>. Mặc định là 4 tiêu chí —
          Trung thực, Nhân ái, Trách nhiệm, Học tập suốt đời — mỗi tiêu chí 25%, sửa được tuỳ ý.
        </p>
        <p>
          Điểm này còn <span className="font-semibold">lấp trục còn thiếu của Ma trận đánh giá</span>:
          tổ chức chỉ có KPI định lượng thì hạnh kiểm thành trục điểm hành vi; chỉ có KPI định tính
          thì hạnh kiểm thành trục % hoàn thành. Có đủ cả hai loại KPI thì ma trận giữ nguyên hai
          trục cũ, hạnh kiểm vẫn được chấm và lưu riêng.
        </p>
      </div>
    ),
  },
  {
    field: 'enableBsc',
    icon: <Layers size={18} />,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    title: 'Bộ tiêu chí (BSC)',
    subtitle: 'Quản trị chiến lược theo 4 lĩnh vực',
    toastName: 'bộ tiêu chí (BSC)',
    manageTo: '/settings/tools?section=bsc',
    manageLabel: 'Quản lý BSC',
    detail: (
      <p>
        Mỗi kỳ dựng một bộ tiêu chí gồm các hạng mục kèm trọng số, xếp theo 4 lĩnh vực cố định —
        Tài chính, Khách hàng, Quy trình nội bộ, Học hỏi &amp; phát triển — rồi nhóm KPI theo
        hạng mục để chấm điểm cân bằng giữa các lĩnh vực.
      </p>
    ),
  },
  {
    field: 'enableWaterfall',
    icon: <GitBranch size={18} />,
    tone: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    title: 'KPI thác nước',
    subtitle: 'Phân rã chỉ tiêu xuống dưới, cộng dồn kết quả lên trên',
    toastName: 'tính năng KPI Thác nước',
    detail: (
      <div className="space-y-3">
        <p>
          Cho phép trưởng đơn vị giao lại một phần hoặc toàn bộ chỉ tiêu của mình cho cấp dưới.
          Kết quả của nhân viên tự động cộng dồn lên kết quả của cấp quản lý.
        </p>
        <Steps
          tone="text-[var(--color-info)]"
          items={[
            ['Giao xuống', 'Trưởng đơn vị chia nhỏ 1 tỷ doanh số cho 3 nhân viên.'],
            ['Thực hiện', 'Nhân viên nộp báo cáo kết quả phần việc được giao.'],
            ['Cộng dồn', 'Hệ thống tự tổng hợp kết quả nhân viên cho trưởng đơn vị.'],
          ]}
        />
      </div>
    ),
  },
  {
    field: 'enableReward',
    icon: <Gift size={18} />,
    tone: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    title: 'Thưởng điểm',
    subtitle: 'Trao điểm ghi nhận, đổi quà',
    toastName: 'tính năng thưởng điểm',
    manageTo: '/settings/tools?section=rewards',
    manageLabel: 'Quản lý thưởng',
    detail: (
      <p>
        Quản lý trao điểm cho nhân viên trong hạn mức được cấp; vượt hạn mức thì đề nghị chuyển
        sang chờ duyệt. Điểm thưởng <span className="font-semibold">tách biệt hoàn toàn</span> với
        điểm đánh giá KPI — không cộng vào kết quả đánh giá của bất kỳ ai. Tắt chỉ ẩn menu,
        không xoá điểm đã phát; bật lại thấy nguyên số dư và lịch sử.
      </p>
    ),
  },
  {
    field: 'enableCashWallet',
    icon: <Wallet size={18} />,
    tone: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    title: 'Ví tiền',
    subtitle: 'Nạp tiền thật qua VietQR để đổi sang điểm',
    toastName: 'tính năng ví tiền',
    caution: 'Đây là tiền thật chuyển vào tài khoản ngân hàng công ty và không có đường rút ra.',
    manageTo: '/settings/tools?section=wallet',
    manageLabel: 'Quản lý ví',
    detail: (
      <p>
        Nhân viên nạp tiền qua mã VietQR rồi tự đổi số dư sang điểm thưởng theo tỉ giá công ty
        đặt. Cần cấu hình tài khoản ngân hàng ở trang Quản lý ví trước khi nhân viên nạp được.
        Tắt chỉ ẩn menu và chặn tạo đơn nạp mới, không xoá số dư đã có.
      </p>
    ),
  },
]

/** Ranh giới cụm: từ "Thưởng điểm" trở đi là nhóm ghi nhận & thưởng. */
const REWARD_GROUP_START: OrgFlagField = 'enableReward'

type OrgFlags = { id: string } & Partial<Record<OrgFlagField, boolean>>

export function ModuleTogglesSection({ org }: { org: OrgFlags }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [openField, setOpenField] = useState<OrgFlagField | null>(null)
  const [savingField, setSavingField] = useState<OrgFlagField | null>(null)
  /** Giá trị vừa gạt, hiển thị trong lúc chờ máy chủ trả lời. */
  const [pending, setPending] = useState<Partial<Record<OrgFlagField, boolean>>>({})

  // `org` là nguồn sự thật; `pending` chỉ đè lên trong lúc lưu và TỰ TIÊU ngay khi
  // dữ liệu mới về khớp với giá trị đã gạt. Nhờ vậy không cần mirror state trong
  // useEffect — thứ vừa gây render thừa vừa dễ lệch khi org đổi từ nơi khác.
  const overrides = Object.fromEntries(
    Object.entries(pending).filter(([field, value]) => !!org[field as OrgFlagField] !== value)
  ) as Partial<Record<OrgFlagField, boolean>>

  const isEnabled = (field: OrgFlagField) => overrides[field] ?? !!org[field]

  const handleToggle = (mod: ModuleDef) => {
    const next = !isEnabled(mod.field)
    setPending(prev => ({ ...prev, [mod.field]: next }))
    setSavingField(mod.field)
    updateMutation.mutate({ [mod.field]: next }, {
      onSuccess: () => {
        setSavingField(null)
        toast.success(`Đã ${next ? 'bật' : 'tắt'} ${mod.toastName}`)
      },
      onError: (error) => {
        // Bỏ override để công tắc quay về đúng trạng thái máy chủ đang giữ —
        // giao diện không được nói dối về thứ chưa lưu được.
        setSavingField(null)
        setPending(prev => {
          const rest = { ...prev }
          delete rest[mod.field]
          return rest
        })
        toast.error(getApiErrorMessage(error, `Không thể cập nhật ${mod.toastName}`))
      },
    })
  }

  return (
    <section className="mx-auto max-w-4xl overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="border-b border-[var(--color-border)] px-5 py-4">
        <h3 className="text-section-title">Module & tính năng</h3>
        <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
          Tắt module nào thì mục menu và các bước liên quan cũng biến mất theo.
        </p>
      </div>

      <div className="divide-y divide-[var(--color-border)]">
        {MODULES.map(mod => {
          const enabled = isEnabled(mod.field)
          const isOpen = openField === mod.field

          return (
            <div key={mod.field}>
              {mod.field === REWARD_GROUP_START && (
                <div className="bg-[var(--color-muted)] px-5 py-2">
                  <span className="text-eyebrow">Ghi nhận & thưởng</span>
                </div>
              )}

              <div className="flex items-start gap-4 px-5 py-4">
                <div className={cn('w-10 h-10 shrink-0 rounded-card flex items-center justify-center', mod.tone)}>
                  {mod.icon}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{mod.title}</h4>
                  <p className="text-caption leading-relaxed">{mod.subtitle}</p>

                  {mod.caution && (
                    <p className="flex items-start gap-1.5 text-xs font-medium text-[var(--color-warning)] pt-0.5">
                      <AlertTriangle size={13} className="shrink-0 mt-px" />
                      {mod.caution}
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-1">
                    <Button variant="ghost" size="sm" type="button" onClick={() => setOpenField(isOpen ? null : mod.field)} aria-expanded={isOpen}>
                      Chi tiết
                      <ChevronDown aria-hidden="true" className={cn('transition-transform', isOpen && 'rotate-180')} />
                    </Button>

                    {/* Chỉ hiện khi đã bật: module đang tắt thì trang quản lý của nó cũng
                        không vào được, đưa link ra chỉ dẫn tới ngõ cụt. */}
                    {enabled && mod.manageTo && (
                      <Link
                        to={mod.manageTo}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                      >
                        {mod.manageLabel}
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>

                  {isOpen && (
                    <div className="space-y-3 pt-3 text-caption leading-relaxed">
                      {mod.detail}
                    </div>
                  )}
                </div>

                {/* Công tắc thẳng một cột bên phải ở mọi dòng — đây là thứ duy nhất
                    người dùng đến trang này để bấm. */}
                <Switch
                  checked={enabled}
                  onCheckedChange={() => handleToggle(mod)}
                  disabled={savingField === mod.field}
                  aria-label={`${enabled ? 'Tắt' : 'Bật'} ${mod.title}`}
                  className="mt-0.5"
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
