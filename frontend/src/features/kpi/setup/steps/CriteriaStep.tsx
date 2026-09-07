import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Building2, CalendarRange, Info, Loader2, ShoppingBasket, Target, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '../../hooks/useKpiPeriods'
import { useKpiCriteria } from '../../hooks/useKpiCriteria'
import { useKpiTotalWeight } from '../../hooks/useKpiTotalWeight'
import { useDeleteKpi } from '../../hooks/useDeleteKpi'
import KpiFormModal from '../../components/KpiFormModal'
import StepShell from '../StepShell'
import { useKpiSetupFlow } from '../useKpiSetupFlow'
import type { KpiCriteria } from '@/types/kpi'

/** Chỉ cần đúng ba trường này để tra tên; khai riêng để khỏi kéo cả kiểu OrgUnit đầy đủ vào đây. */
interface UnitNode {
  id: string
  name: string
  children?: UnitNode[]
}

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
 * Bước Chỉ tiêu. Trái là form, phải là "đơn hàng đang lập".
 *
 * Mỗi chỉ tiêu thêm vào được lưu NGAY ở trạng thái NHÁP: `DRAFT` chính là giỏ hàng mà hệ thống vốn
 * đã có, nên đóng trình duyệt giữa chừng không mất việc, và tổng trọng số đọc thẳng từ server thay
 * vì cộng tay ở client rồi lệch với chốt chặn lúc duyệt.
 *
 * Thẻ bên phải bám theo ĐỢT + ĐƠN VỊ mà người dùng đang chọn trong form, cập nhật ngay khi họ
 * chọn chứ không đợi tới lúc lưu chỉ tiêu đầu tiên. Luật 100% tính theo từng cặp (đơn vị, đợt),
 * nên một con số không nói rõ nó thuộc về cặp nào thì không dùng được vào việc gì.
 */
export default function CriteriaStep() {
  const { goNext, goBack, periodId: periodFromUrl, orgUnitId: unitFromUrl } = useKpiSetupFlow()
  const [, setSearchParams] = useSearchParams()
  const user = useAuthStore(s => s.user)
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(organizationId)
  const { data: orgUnitTree } = useOrgUnitTree()
  const { data: periodsData } = useKpiPeriods({ organizationId })

  const { mutate: deleteKpi, isPending: isDeleting } = useDeleteKpi()

  // Bối cảnh do chính form đang chọn. URL là giá trị khởi đầu; form là nguồn sự thật sau đó.
  const [formCtx, setFormCtx] = useState<{ kpiPeriodId?: string; orgUnitIds: string[] }>({
    kpiPeriodId: periodFromUrl ?? undefined,
    orgUnitIds: unitFromUrl ? [unitFromUrl] : [],
  })
  const onContextChange = useCallback(
    (ctx: { kpiPeriodId?: string; orgUnitIds: string[] }) => setFormCtx(ctx),
    [],
  )

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

  // Danh sách chỉ tiêu NHÁP của đúng cặp (đơn vị, đợt) đang lập.
  const { data, isLoading } = useKpiCriteria(
    {
      page: 0,
      size: 100,
      status: 'DRAFT',
      kpiPeriodId: activePeriodId,
      orgUnitId: activeUnitId,
      organizationId,
      sortBy: 'createdAt',
      sortDir: 'asc',
    },
    { enabled: ready },
  )
  const items = data?.content ?? []

  // Tổng lấy từ chính endpoint mà chốt chặn duyệt dùng, nên thanh này không bao giờ nói khác backend.
  const { data: serverWeight } = useKpiTotalWeight(activeUnitId, activePeriodId)
  const total = serverWeight ?? 0
  const isComplete = ready && Math.abs(total - 100) < 0.001

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
      description="Thêm liên tục cho tới khi tổng trọng số của đơn vị đạt đúng 100%. Mỗi chỉ tiêu được lưu ngay ở trạng thái NHÁP."
      onBack={goBack}
      footer={
        <button
          type="button"
          disabled={!isComplete}
          onClick={() => goNext({ periodId: activePeriodId, orgUnitId: activeUnitId })}
          title={isComplete ? undefined : 'Tổng trọng số của đơn vị phải đạt đúng 100% mới gửi duyệt được'}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
            submitLabel="Thêm chỉ tiêu"
            onClose={goBack}
            onCreated={rememberOrgUnit}
            onContextChange={onContextChange}
          />
        </div>

        {/* Phải: đơn hàng đang lập */}
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
                  <h3 className="flex-1 text-sm font-black text-slate-900 dark:text-white">Đã thêm</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-500 dark:bg-slate-800">
                    {items.length}
                  </span>
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                  {isLoading ? (
                    <div className="flex h-24 items-center justify-center">
                      <Loader2 className="animate-spin text-indigo-600" size={20} />
                    </div>
                  ) : items.length === 0 ? (
                    <p className="p-6 text-center text-xs font-medium text-slate-400">
                      Chưa có chỉ tiêu nào cho đơn vị này.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map(kpi => (
                        <li key={kpi.id} className="group flex items-start gap-3 p-4">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-black text-slate-800 dark:text-slate-100">{kpi.name}</span>
                            <span className="mt-0.5 block text-[11px] font-bold text-slate-400">
                              {kpi.weight ?? 0}%{kpi.isBonusKpi && <> · thưởng</>}
                            </span>
                          </span>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => deleteKpi(kpi.id)}
                            title="Bỏ khỏi danh sách"
                            className="shrink-0 rounded-lg p-1.5 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 disabled:opacity-30 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
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
                </div>
              </>
            )}
          </div>

          {/* Ghi chú BSC chỉ có nghĩa khi đã có con số để mà cảnh báo. */}
          {org?.enableBsc && ready && (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 dark:bg-amber-900/20">
              <Info size={13} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              {/* Bọc chữ trong span: để trần trong flex thì mỗi thẻ <b> thành một ô flex riêng và
                  câu văn bị cắt thành mấy cột rời rạc. */}
              <span className="text-[11px] font-bold leading-snug text-amber-700 dark:text-amber-400">
                Tổ chức đang bật BSC nên lúc duyệt, luật 100% xét theo <b>từng hạng mục</b>. Con số ở
                đây là tổng của cả đơn vị, có thể chưa phản ánh hết.
              </span>
            </div>
          )}
        </aside>
      </div>
    </StepShell>
  )
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
