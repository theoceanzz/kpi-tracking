import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Building2, CalendarRange, Loader2, ShoppingBasket, Target, Trash2, Users } from 'lucide-react'
import { cn, formatAssigneeNames, formatDate, formatNumber, FREQUENCY_MAP } from '@/lib/utils'
import { groupByPerson, UNASSIGNED_ID } from '@/lib/personGrouping'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useScorecards } from '@/features/bsc/hooks/useBsc'
import { useKpiPeriods } from '../../hooks/useKpiPeriods'
import { useKpiCriteria } from '../../hooks/useKpiCriteria'
import { useKpiTotalWeight } from '../../hooks/useKpiTotalWeight'
import { useDeleteKpi } from '../../hooks/useDeleteKpi'
import { buildRealWeightById, findDecompositionParentIds, sumWeightForPerson } from '../../utils/realWeight'
import KpiFormModal from '../../components/KpiFormModal'
import KpiStatusBadge from '../../components/KpiStatusBadge'
import KpiDetailModal from '../../components/KpiDetailModal'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import type { KpiCriteria } from '@/types/kpi'

/** Chỉ cần đúng ba trường này để tra tên; khai riêng để khỏi kéo cả kiểu OrgUnit đầy đủ vào đây. */
interface UnitNode {
  id: string
  name: string
  children?: UnitNode[]
}

/** Trạng thái còn xoá tại chỗ được. Đã gửi đi hoặc đã duyệt thì phải qua trang Quản lý chỉ tiêu. */
const REMOVABLE_STATUSES = ['DRAFT', 'REJECTED']

/** Hằng số cấp module: mảng rỗng dùng chung để tham chiếu không đổi giữa các lần render. */
const NO_UNITS: string[] = []

/** Duyệt cây đơn vị để tra tên — cây lồng nhau nên không tra thẳng bằng một map phẳng được. */
function findUnitName(nodes: UnitNode[] | undefined, id: string): string | undefined {
  for (const node of nodes ?? []) {
    if (node.id === id) return node.name
    const inChild = findUnitName(node.children, id)
    if (inChild) return inChild
  }
  return undefined
}

/**
 * Bước Chỉ tiêu. Trái là form, phải là danh sách chỉ tiêu HIỆN CÓ của đơn vị đang trỏ tới.
 *
 * Mỗi chỉ tiêu thêm vào được lưu NGAY: đóng trình duyệt giữa chừng không mất việc, và tổng trọng
 * số đọc thẳng từ server thay vì cộng tay ở client rồi lệch với chốt chặn lúc duyệt.
 *
 * Thẻ bên phải bám theo ĐỢT + ĐƠN VỊ mà người dùng đang chọn trong form, cập nhật ngay khi họ
 * chọn chứ không đợi tới lúc lưu chỉ tiêu đầu tiên. Luật 100% tính theo từng cặp (đơn vị, đợt),
 * nên một con số không nói rõ nó thuộc về cặp nào thì không dùng được vào việc gì.
 */
export default function CriteriaStep() {
  const { goNext, goBack, currentFlow, periodId: periodFromUrl, orgUnitId: unitFromUrl } = useKpiSetupFlow()
  const [, setSearchParams] = useSearchParams()
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: orgUnitTree } = useOrgUnitTree()
  const { data: periodsData } = useKpiPeriods({ organizationId })

  const { mutate: deleteKpi, isPending: isDeleting } = useDeleteKpi()

  // Bối cảnh do chính form đang chọn. URL là giá trị khởi đầu; form là nguồn sự thật sau đó.
  const [formCtx, setFormCtx] = useState<{ kpiPeriodId?: string; orgUnitIds: string[]; assigneeNames: string[] }>({
    kpiPeriodId: periodFromUrl ?? undefined,
    orgUnitIds: unitFromUrl ? [unitFromUrl] : [],
    assigneeNames: [],
  })
  const onContextChange = useCallback(
    (ctx: { kpiPeriodId?: string; orgUnitIds: string[]; assigneeNames: string[] }) => setFormCtx(ctx),
    [],
  )

  /**
   * Đơn vị trên URL, chốt lại ở lần mount đầu tiên.
   *
   * `rememberOrgUnit` GHI vào chính tham số này sau mỗi lần tạo chỉ tiêu. Đọc tiếp giá trị sống là
   * thành vòng lặp: URL đổi → `defaultUnitIds` ra mảng mới → `selectableDefaultUnitIds` bên
   * `KpiFormModal` đổi tham chiếu → mảng đó nằm trong deps của effect khởi tạo → cả form bị
   * `reset()` đè ngay lên phần dọn có chọn lọc mà `onSuccess` vừa làm. Chốt lại là cắt đứt vòng đó,
   * và lựa chọn đơn vị từ đây do chính form giữ.
   */
  const [unitAtMount] = useState(unitFromUrl)

  /**
   * Đơn vị tích sẵn khi mở form: đơn vị lần trước đã dùng, nếu chưa có thì lấy đơn vị người dùng
   * đang trực thuộc. `user` nạp bất đồng bộ nên nhánh sau có thể phải đợi một nhịp — nhưng chỉ
   * đúng một nhịp, sau đó tham chiếu đứng yên.
   */
  const defaultUnitIds = useMemo(() => {
    if (unitAtMount) return [unitAtMount]
    const mine = (user?.memberships ?? []).map(m => m.orgUnitId).find(Boolean)
    return mine ? [mine] : NO_UNITS
  }, [unitAtMount, user?.memberships])

  const activePeriodId = formCtx.kpiPeriodId ?? periodFromUrl ?? undefined
  // Chỉ theo dõi khi đúng MỘT đơn vị được chọn: chọn nhiều đơn vị cùng lúc thì mỗi đơn vị có một
  // pool 100% riêng, gộp lại thành một con số là nói sai.
  const activeUnitId = formCtx.orgUnitIds.length === 1 ? formCtx.orgUnitIds[0] : undefined

  const periodName = useMemo(
    () => periodsData?.content?.find(p => p.id === activePeriodId)?.name,
    [periodsData, activePeriodId],
  )
  const unitName = useMemo(
    () => (activeUnitId ? findUnitName(orgUnitTree, activeUnitId) : undefined),
    [orgUnitTree, activeUnitId],
  )

  const ready = !!activePeriodId && !!activeUnitId
  const multipleUnits = formCtx.orgUnitIds.length > 1

  /**
   * Chỉ tiêu hiện có của cặp (đơn vị, đợt) đang lập — MỌI trạng thái, không riêng bản nháp.
   *
   * Lọc `status: 'DRAFT'` như trước là sai: endpoint trọng số đếm cả PENDING_APPROVAL, APPROVED,
   * REJECTED, EDIT, EDITED (xem `WEIGHT_COUNTED_STATUSES` bên `KpiCriteriaService`). Người có
   * `KPI:APPROVE_OWN` thì chỉ tiêu vừa tạo đã ở trạng thái ĐÃ DUYỆT ngay từ backend, nên nó cộng
   * vào thanh trọng số mà không bao giờ lọt vào danh sách — thẻ tự mâu thuẫn: "chưa có chỉ tiêu
   * nào" ngay bên trên "tổng 25%".
   *
   * `sortDir: 'desc'` chứ không phải `'asc'`: endpoint lọc đơn vị theo TIỀN TỐ ĐƯỜNG DẪN nên trả
   * về cả cây con, và với `'asc'` thì chỉ tiêu vừa tạo nằm cuối, ở đơn vị lớn có thể rơi khỏi
   * trang đầu — vừa thêm xong lại không thấy đâu.
   */
  const { data, isLoading } = useKpiCriteria(
    {
      page: 0,
      size: 100,
      kpiPeriodId: activePeriodId,
      orgUnitId: activeUnitId,
      organizationId,
      sortBy: 'createdAt',
      sortDir: 'desc',
    },
    { enabled: ready },
  )

  // Cắt lại về ĐÚNG đơn vị đang trỏ tới: server trả cả cây con, còn thanh trọng số chỉ tính đúng
  // một đơn vị. Để lẫn chỉ tiêu của phòng con vào đây là lặp lại đúng kiểu mâu thuẫn vừa sửa.
  const items = useMemo(
    () => (data?.content ?? []).filter(k => k.orgUnitId === activeUnitId),
    [data, activeUnitId],
  )

  // Tổng lấy từ chính endpoint mà chốt chặn duyệt dùng, nên thanh này không bao giờ nói khác backend.
  const { data: serverWeight } = useKpiTotalWeight(activeUnitId, activePeriodId)
  const total = serverWeight ?? 0
  const isComplete = ready && Math.abs(total - 100) < 0.001

  /**
   * Trọng số THẬT của từng chỉ tiêu = trọng số form × %hạng mục, khi tổ chức bật BSC.
   *
   * Bật BSC thì con số trên form KHÔNG phải thứ được đem cộng — backend nhân với tỉ trọng của hạng
   * mục trong bộ tiêu chí của đơn vị. Không hiện ra thì người dùng nhập đủ 100% trên form mà tổng
   * vẫn không nhúc nhích.
   */
  const { data: bscScorecards } = useScorecards(org?.enableBsc ? organizationId : undefined)
  const realWeightById = useMemo(
    () => buildRealWeightById(items, bscScorecards, orgUnitTree, org?.enableBsc),
    [items, bscScorecards, orgUnitTree, org?.enableBsc],
  )
  // Nhận diện KPI cha phân rã trên TOÀN danh sách rồi truyền xuống từng nhóm: cha giao người này
  // mà con giao người khác thì nhìn riêng một nhóm sẽ không thấy con nào, và cha bị cộng nhầm.
  const decompositionParentIds = useMemo(() => findDecompositionParentIds(items), [items])

  /**
   * Gộp theo NGƯỜI THỰC HIỆN — không phải để cho đẹp, mà vì luật 100% của backend là
   * "phần chưa giao ai + người có tổng CAO NHẤT", không phải cộng dồn cả đơn vị
   * (`calculateTotalWeightByOrgUnit`). Danh sách phẳng không nói ai làm gì thì con số dưới thanh
   * không cách nào giải thích: ba chỉ tiêu 25% ra 75% khi cùng một người, nhưng chỉ ra 50% nếu
   * chia cho hai người.
   *
   * Một chỉ tiêu giao cho nhiều người sẽ nằm ở nhóm của từng người — `groupByPerson` lo sẵn, kể cả
   * việc đẩy nhóm "Chưa giao" xuống cuối.
   */
  const personGroups = useMemo(
    () =>
      groupByPerson(items, kpi =>
        (kpi.assignees ?? []).map(a => ({ id: a.id, name: a.fullName, avatarUrl: a.avatarUrl })),
      ),
    [items],
  )

  /** Chỉ tiêu đang mở xem chi tiết. Dòng trong danh sách quá hẹp để bày hết mọi trường. */
  const [detailKpi, setDetailKpi] = useState<KpiCriteria | null>(null)

  /**
   * Luồng đã gộp là luồng "giao chỉ tiêu và nộp báo cáo CHO BẢN THÂN" — người nhận luôn là chính
   * họ, nên tích sẵn tên và giữ nguyên qua từng lần thêm.
   *
   * Chỉ áp dụng ở luồng gộp: luồng Giao chỉ tiêu thường là giao cho CẤP DƯỚI, tự điền tên mình vào
   * đó là giao nhầm người ngay từ mặc định.
   */
  const userId = user?.id
  const selfAssigneeIds = useMemo(
    () => (currentFlow?.merged && userId ? [userId] : undefined),
    [currentFlow?.merged, userId],
  )

  /**
   * Sang bước sau, tự nói ra còn thiếu gì.
   *
   * Kiểm tại chỗ bằng `total` của CHÍNH bước này thay vì phó mặc cho chốt chặn trong `goNext`:
   * đơn vị đang chọn nằm trong form, có thể chưa kịp ghi lên URL — mà chốt chặn kia chỉ đọc được
   * URL. Ở đây mới có con số đúng của cặp (đơn vị, đợt) người dùng đang nhìn.
   */
  const onContinue = () => {
    if (!ready) {
      toast.error('Hãy chọn đợt và đơn vị thực hiện trước.')
      return
    }
    if (!isComplete) {
      toast.error(
        total > 100
          ? `Tổng trọng số đang là ${total.toFixed(1)}%, vượt 100%. Hãy giảm bớt trước khi đi tiếp.`
          : `Tổng trọng số mới đạt ${total.toFixed(1)}%, còn thiếu ${(100 - total).toFixed(1)}%. Hãy thêm chỉ tiêu cho đủ 100%.`,
      )
      return
    }
    goNext({ periodId: activePeriodId, orgUnitId: activeUnitId })
  }

  /** Ghi đơn vị vừa dùng vào URL để tải lại trang không mất bối cảnh. */
  const rememberOrgUnit = (kpi: KpiCriteria) => {
    const unit = kpi.orgUnitId ?? kpi.orgUnitIds?.[0]
    if (!unit || unitFromUrl === unit) return
    setSearchParams(prev => { prev.set('orgUnitId', unit); return prev }, { replace: true })
  }

  return (
    <StepShell
      bare
      title="Thêm chỉ tiêu cho đợt"
      description="Thêm liên tục cho tới khi tổng trọng số của đơn vị đạt đúng 100%. Mỗi chỉ tiêu được lưu ngay khi bấm thêm."
      onBack={goBack}
      // Nút KHÔNG bị vô hiệu hoá: bấm vào phải nói ra còn thiếu gì. Nút xám không giải thích được
      // vì sao nó xám, mà đây đúng là chỗ người dùng hay mắc kẹt nhất.
      footer={
        <button
          type="button"
          onClick={onContinue}
          className={cn(
            'flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95',
            isComplete
              ? 'bg-indigo-600 shadow-indigo-500/25 hover:bg-indigo-700'
              : 'bg-slate-300 shadow-none hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600',
          )}
        >
          Tiếp tục
          <ArrowRight size={14} />
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Trái: form nhập, ở lại sau mỗi lần thêm */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30">
              <Target size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Chỉ tiêu mới</h3>
              <p className="text-[11px] font-bold text-slate-400">Thêm xong, form tự dọn để bạn nhập tiếp</p>
            </div>
          </div>

          <KpiFormModal
            open
            variant="inline"
            keepOpenAfterCreate
            compactOrgUnits
            singleOrgUnit
            submitLabel="Thêm chỉ tiêu"
            lockedPeriodId={periodFromUrl ?? undefined}
            defaultOrgUnitIds={defaultUnitIds}
            defaultAssigneeIds={selfAssigneeIds}
            lockAssignees={!!selfAssigneeIds}
            onlyMyOrgUnits={!!selfAssigneeIds}
            onClose={goBack}
            onCreated={rememberOrgUnit}
            onContextChange={onContextChange}
          />
        </div>

        {/* Phải: chỉ tiêu hiện có của đơn vị đang trỏ tới */}
        <aside className="space-y-4 xl:sticky xl:top-44 xl:self-start">
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {/* Bối cảnh: trả lời "con số bên dưới là của ai" trước khi đưa ra con số nào. */}
            <div className="space-y-2.5 border-b border-slate-100 p-5 dark:border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đang lập cho</p>

              <ContextRow
                icon={<CalendarRange size={14} />}
                label="Đợt"
                value={periodName}
                placeholder="Chọn đợt ở form bên trái"
              />
              <ContextRow
                icon={<Building2 size={14} />}
                label="Đơn vị"
                value={multipleUnits ? `${formCtx.orgUnitIds.length} đơn vị` : unitName}
                placeholder="Chọn đơn vị thực hiện"
              />
              {/* Người thực hiện quyết định con số trọng số bên dưới (luật là "người cao nhất"),
                  nên phải nằm ngay trong phần nói "đang lập cho ai" — mọi luồng, không riêng luồng
                  tự giao. */}
              <ContextRow
                icon={<Users size={14} />}
                label="Người"
                value={formatAssigneeNames(formCtx.assigneeNames)}
                placeholder="Chọn người thực hiện"
              />
            </div>

            {!ready ? (
              <p className="p-8 text-center text-xs font-medium leading-relaxed text-slate-400">
                {multipleUnits
                  ? 'Bạn đang giao cho nhiều đơn vị cùng lúc. Mỗi đơn vị có mức 100% riêng, nên phần theo dõi trọng số chỉ hiện khi chọn đúng một đơn vị.'
                  : 'Chọn đợt và đơn vị thực hiện, phần theo dõi trọng số sẽ hiện ở đây.'}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  <ShoppingBasket size={18} className="text-slate-400" />
                  <h3 className="flex-1 text-sm font-black text-slate-900 dark:text-white">Chỉ tiêu của đơn vị</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-500 dark:bg-slate-800">
                    {items.length}
                  </span>
                </div>

                <div className="max-h-[440px] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex h-24 items-center justify-center">
                      <Loader2 className="animate-spin text-indigo-600" size={20} />
                    </div>
                  ) : items.length === 0 ? (
                    <p className="p-6 text-center text-xs font-medium text-slate-400">
                      Đơn vị này chưa có chỉ tiêu nào trong đợt.
                    </p>
                  ) : (
                    personGroups.map(group => {
                      const groupWeight = sumWeightForPerson(group.items, realWeightById, decompositionParentIds)
                      const groupDone = Math.round(groupWeight) === 100
                      return (
                        <section key={group.id}>
                          {/* Tiêu đề nhóm là nơi DUY NHẤT nói được người này đã đủ 100% hay chưa —
                              thanh phía dưới chỉ nói về cả đơn vị. */}
                          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-100 bg-slate-50/95 px-5 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/95">
                            <span
                              className={cn(
                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                group.id === UNASSIGNED_ID ? 'bg-slate-300' : groupDone ? 'bg-emerald-500' : 'bg-indigo-500',
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate text-[11px] font-black text-slate-700 dark:text-slate-200">
                              {group.name}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 text-[11px] font-black tabular-nums',
                                groupDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400',
                              )}
                            >
                              {formatNumber(groupWeight)}%
                              {!groupDone && group.id !== UNASSIGNED_ID && (
                                <span className="font-bold text-slate-400">
                                  {groupWeight > 100
                                    ? ` · vượt ${formatNumber(groupWeight - 100)}%`
                                    : ` · thiếu ${formatNumber(100 - groupWeight)}%`}
                                </span>
                              )}
                            </span>
                          </header>

                          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {group.items.map(kpi => {
                              const shown = kpi.weight ?? 0
                              const real = realWeightById.get(kpi.id)
                              const realDiffers = real != null && Math.abs(real - shown) > 0.01
                              return (
                                <li key={kpi.id}>
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setDetailKpi(kpi)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        setDetailKpi(kpi)
                                      }
                                    }}
                                    className="group flex w-full cursor-pointer items-start gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-black text-slate-800 dark:text-slate-100">{kpi.name}</span>
                                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                        <KpiStatusBadge status={kpi.status} className="px-2 py-0 text-[10px] font-bold" />
                                        <span className="text-[11px] font-bold text-slate-400">
                                          {formatNumber(shown)}%
                                          {/* Bật BSC thì đây mới là con số backend đem cộng. */}
                                          {realDiffers && <> → {formatNumber(real)}% thật</>}
                                          {kpi.isBonusKpi && <> · thưởng, không tính vào 100%</>}
                                        </span>
                                      </span>
                                      <span className="mt-1 block truncate text-[11px] font-medium text-slate-400">
                                        {describeKpi(kpi, org?.enableBsc)}
                                      </span>
                                    </span>
                                    {/* Xoá tại chỗ chỉ với bản còn sửa được. Backend không chặn theo
                                        trạng thái, nên một nút thùng rác cạnh chỉ tiêu ĐÃ DUYỆT là
                                        cái bẫy. */}
                                    {REMOVABLE_STATUSES.includes(kpi.status) && (
                                      <button
                                        type="button"
                                        disabled={isDeleting}
                                        // Chặn nổi bọt: không có dòng này thì xoá xong lại mở luôn
                                        // màn chi tiết của chỉ tiêu vừa bị xoá.
                                        onClick={e => {
                                          e.stopPropagation()
                                          deleteKpi(kpi.id)
                                        }}
                                        title="Bỏ khỏi danh sách"
                                        className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-30 dark:hover:bg-rose-900/20"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </section>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tổng trọng số</span>
                    <span className={cn('text-lg font-black tabular-nums', isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')}>
                      {total.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', isComplete ? 'bg-emerald-500' : total > 100 ? 'bg-rose-500' : 'bg-indigo-500')}
                      style={{ width: `${Math.min(total, 100)}%` }}
                    />
                  </div>
                  <p className={cn('mt-2 text-[11px] font-bold', isComplete ? 'text-emerald-600 dark:text-emerald-400' : total > 100 ? 'text-rose-500' : 'text-slate-400')}>
                    {isComplete
                      ? 'Đủ 100% — sẵn sàng gửi duyệt'
                      : total > 100
                        ? `Vượt ${(total - 100).toFixed(1)}% — cần giảm bớt`
                        : `Còn thiếu ${(100 - total).toFixed(1)}%`}
                  </p>
                  {/* Câu luật cố định, không phải cảnh báo có điều kiện: đây là thứ người dùng
                      không suy ra được từ danh sách, và nó đúng ở mọi lúc. */}
                  <p className="mt-2 text-[11px] font-medium leading-snug text-slate-400">
                    Tổng của đơn vị = phần chưa giao ai + người có tổng cao nhất.
                  </p>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <KpiDetailModal open={!!detailKpi} kpi={detailKpi} onClose={() => setDetailKpi(null)} />
    </StepShell>
  )
}

/**
 * Dòng phụ nhận dạng một chỉ tiêu: mục tiêu · tần suất · hạn nộp · hạng mục.
 *
 * Tên chỉ tiêu thường bị đặt trùng nhau ("a", "a"), nên chỉ mình tên là không phân biệt được cái
 * nào với cái nào. Phần rỗng bị bỏ qua để câu không đầy dấu chấm giữa.
 */
function describeKpi(kpi: KpiCriteria, enableBsc?: boolean): string {
  const parts: string[] = [
    kpi.targetValue != null
      ? `${formatNumber(kpi.targetValue)}${kpi.unit ? ` ${kpi.unit}` : ''}`
      : 'Chưa đặt mục tiêu',
    FREQUENCY_MAP[kpi.frequency] ?? kpi.frequency,
  ]
  if (kpi.effectiveDeadline) parts.push(`hạn ${formatDate(kpi.effectiveDeadline)}`)
  if (enableBsc && kpi.effectivePerspectiveName) parts.push(kpi.effectivePerspectiveName)
  return parts.join(' · ')
}

function ContextRow({
  icon,
  label,
  value,
  placeholder,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('shrink-0', value ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600')}>{icon}</span>
      <span className="w-12 shrink-0 text-[11px] font-bold text-slate-400">{label}</span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs',
          value ? 'font-black text-slate-800 dark:text-slate-100' : 'font-medium italic text-slate-400',
        )}
      >
        {value || placeholder}
      </span>
    </div>
  )
}
