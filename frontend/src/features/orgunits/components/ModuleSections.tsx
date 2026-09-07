import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Layers, Target, GitBranch, SlidersHorizontal, Gift, Wallet, ChevronDown, ArrowRight, AlertTriangle, HeartHandshake } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'

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
        <li key={name} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <span className={cn('w-6 h-6 shrink-0 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-[10px] font-black shadow-sm', tone)}>
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{name}</p>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{desc}</p>
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
    tone: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
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
          tone="text-violet-600"
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
    tone: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    title: 'KPI hành vi',
    subtitle: 'Chấm điểm bằng mức đánh giá thay vì con số',
    toastName: 'KPI hành vi',
    manageTo: '/settings/tools?section=scoring&scoring=qualitative',
    manageLabel: 'Thang điểm định tính',
    detail: (
      <p>
        Dành cho KPI không đo được bằng con số. Loại này không chấm tự động — quản lý chọn một
        mức trong <span className="font-bold">Thang điểm định tính</span>. Khi tắt, hệ thống chỉ
        hiển thị và tính điểm KPI định lượng; Ma trận đánh giá cũng ẩn theo, trừ khi bạn bật
        <span className="font-bold"> Chấm hạnh kiểm</span> để bù trục còn thiếu.
      </p>
    ),
  },
  {
    field: 'enableConduct',
    icon: <HeartHandshake size={18} />,
    tone: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
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
          <span className="font-bold">Σ(điểm tiêu chí × trọng số)</span>. Mặc định là 4 tiêu chí —
          Trung thực, Nhân ái, Trách nhiệm, Học tập suốt đời — mỗi tiêu chí 25%, sửa được tuỳ ý.
        </p>
        <p>
          Điểm này còn <span className="font-bold">lấp trục còn thiếu của Ma trận đánh giá</span>:
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
    tone: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
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
    tone: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
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
          tone="text-cyan-600"
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
    tone: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    title: 'Thưởng điểm',
    subtitle: 'Trao điểm ghi nhận, đổi quà',
    toastName: 'tính năng thưởng điểm',
    manageTo: '/settings/tools?section=rewards',
    manageLabel: 'Quản lý thưởng',
    detail: (
      <p>
        Quản lý trao điểm cho nhân viên trong hạn mức được cấp; vượt hạn mức thì đề nghị chuyển
        sang chờ duyệt. Điểm thưởng <span className="font-bold">tách biệt hoàn toàn</span> với
        điểm đánh giá KPI — không cộng vào kết quả đánh giá của bất kỳ ai. Tắt chỉ ẩn menu,
        không xoá điểm đã phát; bật lại thấy nguyên số dư và lịch sử.
      </p>
    ),
  },
  {
    field: 'enableCashWallet',
    icon: <Wallet size={18} />,
    tone: 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
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
      onError: () => {
        // Bỏ override để công tắc quay về đúng trạng thái máy chủ đang giữ —
        // giao diện không được nói dối về thứ chưa lưu được.
        setSavingField(null)
        setPending(prev => {
          const rest = { ...prev }
          delete rest[mod.field]
          return rest
        })
        toast.error(`Không thể cập nhật ${mod.toastName}`)
      },
    })
  }

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-6 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Module & tính năng</h3>
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
          Tắt module nào thì mục menu và các bước liên quan cũng biến mất theo
        </p>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {MODULES.map(mod => {
          const enabled = isEnabled(mod.field)
          const isOpen = openField === mod.field

          return (
            <div key={mod.field}>
              {mod.field === REWARD_GROUP_START && (
                <div className="px-6 sm:px-8 py-2.5 bg-slate-50/70 dark:bg-slate-800/40">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi nhận & thưởng</span>
                </div>
              )}

              <div className="px-6 sm:px-8 py-5 flex items-start gap-4">
                <div className={cn('w-10 h-10 shrink-0 rounded-xl flex items-center justify-center', mod.tone)}>
                  {mod.icon}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{mod.title}</h4>
                  <p className="text-[12px] font-medium text-slate-500 leading-relaxed">{mod.subtitle}</p>

                  {mod.caution && (
                    <p className="flex items-start gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 pt-0.5">
                      <AlertTriangle size={13} className="shrink-0 mt-px" />
                      {mod.caution}
                    </p>
                  )}

                  <div className="flex items-center gap-4 pt-1">
                    <button
                      onClick={() => setOpenField(isOpen ? null : mod.field)}
                      className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      Chi tiết
                      <ChevronDown size={12} className={cn('transition-transform', isOpen && 'rotate-180')} />
                    </button>

                    {/* Chỉ hiện khi đã bật: module đang tắt thì trang quản lý của nó cũng
                        không vào được, đưa link ra chỉ dẫn tới ngõ cụt. */}
                    {enabled && mod.manageTo && (
                      <Link
                        to={mod.manageTo}
                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        {mod.manageLabel}
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>

                  {isOpen && (
                    <div className="pt-3 text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      {mod.detail}
                    </div>
                  )}
                </div>

                {/* Công tắc thẳng một cột bên phải ở mọi dòng — đây là thứ duy nhất
                    người dùng đến trang này để bấm. */}
                <button
                  onClick={() => handleToggle(mod)}
                  disabled={savingField === mod.field}
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? 'Tắt' : 'Bật'} ${mod.title}`}
                  className={cn(
                    'w-12 h-6 shrink-0 mt-0.5 rounded-full relative transition-all duration-300 disabled:opacity-50',
                    enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                >
                  <div className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm',
                    enabled ? 'left-7' : 'left-1'
                  )} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
