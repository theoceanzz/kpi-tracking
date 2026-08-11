import { useEffect, useState } from 'react'
import { AlertCircle, Check, Coins, Loader2, Search, UserCircle2, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/useDebounce'
import Pagination from '@/components/common/Pagination'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import NumberInput from '@/components/common/NumberInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/store/authStore'
import {
  useAiQuotaAllocations,
  useAiQuotaOverview,
  useMyAiQuota,
  useSetAiDelegation,
  useSetAiQuotaLimit,
} from '../hooks/useAiQuota'
import type { AiQuotaAllocation, AiQuotaStatusFilter } from '../api/ai-quota.api'

const PAGE_SIZE = 10
const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('vi-VN')

/**
 * Giá trị "không lọc". Radix Select cấm SelectItem có value là chuỗi rỗng — nó ném lỗi runtime
 * và làm trắng cả component — nên dùng sentinel rồi ánh xạ về undefined lúc gọi API.
 * Quy ước này đã dùng sẵn ở BscAnalyticsTab và SummaryTab.
 */
const ALL = '__ALL__'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: ALL, label: 'Tất cả trạng thái' },
  { value: 'UNALLOCATED', label: 'Chưa được cấp' },
  { value: 'ALLOCATED', label: 'Đã cấp' },
  { value: 'NEAR_LIMIT', label: 'Sắp hết (≥80%)' },
]

const triggerCls =
  'h-auto w-full py-2.5 rounded-xl border-[var(--color-border)] bg-[var(--color-background)] text-sm font-normal sm:w-44'

function StatBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
      <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-black text-[var(--color-foreground)]">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>}
    </div>
  )
}

/**
 * Hạn mức của chính người đang đăng nhập. Tách thành thẻ riêng vì với quản lý cấp cao nhất, ô
 * "Ngân sách công ty" ở trên là tiền của cả công ty chứ không phải của họ — và dòng của họ trong
 * bảng có thể rơi sang trang khác do sắp xếp theo tên.
 */
function MyQuotaCard() {
  const { data: mine } = useMyAiQuota()
  const myName = useAuthStore((s) => s.user?.fullName)
  if (!mine) return null

  const pct = mine.spendable > 0 ? Math.min(100, (mine.used / mine.spendable) * 100) : 0

  return (
    <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">
          <UserCircle2 size={14} /> Hạn mức AI của bạn
        </p>
        {myName && (
          <p className="text-xs text-[var(--color-muted-foreground)]">{myName}</p>
        )}
      </div>

      <p className="mt-1.5 text-2xl font-black text-[var(--color-foreground)]">
        {fmt(mine.monthlyLimit)}
        <span className="ml-1 text-xs font-semibold text-[var(--color-muted-foreground)]">token/tháng</span>
      </p>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
        Đã dùng <span className="font-bold text-[var(--color-foreground)]">{fmt(mine.used)}</span> · còn{' '}
        <span className="font-bold text-[var(--color-foreground)]">{fmt(mine.remaining)}</span>
      </p>

      {mine.allocatedToOthers > 0 && (
        <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
          Trong đó đã chia cho cấp dưới {fmt(mine.allocatedToOthers)} · bạn tự tiêu được{' '}
          {fmt(mine.spendable)}
        </p>
      )}
    </div>
  )
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div className="min-w-[7rem]">
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{fmt(used)}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={cn(
            'h-full rounded-full',
            pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[var(--color-primary)]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Ô nhập hạn mức. Giữ giá trị đang gõ ở state riêng để không gọi API mỗi ký tự. */
function LimitEditor({
  item,
  remainingToAllocate,
  onSave,
  saving,
}: {
  item: AiQuotaAllocation
  remainingToAllocate: number
  onSave: (userId: string, limit: number) => void
  saving: boolean
}) {
  const [value, setValue] = useState(item.monthlyLimit ?? 0)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setValue(item.monthlyLimit ?? 0)
  }, [item.monthlyLimit])

  // Giành quyền cấp thì toàn bộ hạn mức mới bị trừ vào túi mình, không phải phần chênh —
  // phải khớp với cách backend tính, nếu không nút Lưu sáng lên rồi mới nhận lỗi từ server.
  const charge = item.takeover ? value : value - (item.monthlyLimit ?? 0)
  const exceeds = charge > remainingToAllocate
  const dirty = value !== (item.monthlyLimit ?? 0)

  const commit = () => {
    setConfirming(false)
    onSave(item.userId, value)
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2">
        <NumberInput
          value={value}
          onChange={setValue}
          disabled={!item.editable || saving}
          className={cn(
            'w-28 rounded-lg border px-3 py-2 text-right text-sm outline-none transition-all',
            exceeds
              ? 'border-red-400 focus:ring-2 focus:ring-red-200'
              : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20',
            'bg-[var(--color-background)] disabled:opacity-50'
          )}
        />
        <button
          type="button"
          onClick={() => (item.takeover ? setConfirming(true) : commit())}
          disabled={!item.editable || !dirty || exceeds || saving}
          className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-bold text-white transition-all hover:shadow-md disabled:opacity-40"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
      </div>

      {exceeds && (
        <p className="mt-1 text-right text-[11px] font-semibold text-red-600 dark:text-red-400">
          Thiếu {fmt(charge - remainingToAllocate)} token
          {item.takeover && ' — giành lấy tính trọn hạn mức mới'}
        </p>
      )}

      {!item.editable && item.allocatedByName && (
        <p className="mt-1 text-right text-[11px] text-[var(--color-muted-foreground)]">
          Do {item.allocatedByName} cấp
        </p>
      )}
      {item.editable && item.takeover && (
        <p className="mt-1 text-right text-[11px] text-amber-600 dark:text-amber-400">
          Do {item.allocatedByName} cấp · sửa là chuyển sang bạn cấp
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={commit}
        loading={saving}
        title="Giành quyền cấp hạn mức?"
        confirmLabel="Giành quyền cấp"
        description={
          `${fmt(item.monthlyLimit)} token đang do ${item.allocatedByName} cấp sẽ được trả về túi của họ, ` +
          `và họ có thể chia lại cho người khác. Hạn mức mới ${fmt(value)} token sẽ trừ vào túi của bạn.`
        }
      />
    </div>
  )
}

function YouBadge() {
  return (
    <span className="shrink-0 rounded-md bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      Bạn
    </span>
  )
}

function RoleBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
  return (
    <span className="inline-block rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--color-foreground)]">
      {name}
    </span>
  )
}

export default function AiQuotaPanel() {
  const { data: overview, isLoading } = useAiQuotaOverview()
  const canAllocate = !!overview?.canAllocate
  const myUserId = useAuthStore((s) => s.user?.id)

  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 400)
  // State giữ sentinel ALL; ánh xạ về undefined đúng một chỗ, ngay tại lời gọi hook bên dưới.
  const [roleName, setRoleName] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [page, setPage] = useState(0)

  // Đổi bất kỳ bộ lọc nào cũng phải về trang đầu, nếu không đang ở trang 5
  // lọc xong sẽ thấy trang trống.
  useEffect(() => {
    setPage(0)
  }, [debouncedKeyword, roleName, status])

  const { data: pageData, isLoading: loadingList } = useAiQuotaAllocations(
    {
      keyword: debouncedKeyword,
      roleName: roleName === ALL ? undefined : roleName,
      status: status === ALL ? undefined : (status as AiQuotaStatusFilter),
      page,
      size: PAGE_SIZE,
    },
    canAllocate
  )

  const setLimit = useSetAiQuotaLimit()
  const setDelegation = useSetAiDelegation()

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (!overview?.canAllocate) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center">
        <Coins size={32} className="mx-auto text-[var(--color-muted-foreground)]/40" />
        <p className="mt-3 text-sm font-bold text-[var(--color-foreground)]">
          Bạn không có quyền phân bổ hạn mức token AI
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {overview && !overview.subDelegationEnabled
            ? 'Quản lý cấp cao nhất chưa bật cho phép cấp dưới tự phân bổ.'
            : 'Chỉ quản lý đơn vị mới phân bổ được hạn mức.'}
        </p>
      </div>
    )
  }

  const rows = pageData?.content ?? []
  const onSave = (userId: string, monthlyLimit: number) => setLimit.mutate({ userId, monthlyLimit })
  const isMe = (item: AiQuotaAllocation) => item.userId === myUserId

  return (
    <div className="space-y-4">
      {/* Hạn mức cá nhân — tách hẳn khỏi túi dùng để phân bổ bên dưới */}
      <MyQuotaCard />

      {/* Túi token dùng để phân bổ cho người khác */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox
          label={overview.isTopManager ? 'Ngân sách công ty' : 'Túi để phân bổ'}
          value={fmt(overview.allocatablePool)}
          hint={
            overview.isTopManager
              ? 'Tiền của cả công ty, không phải hạn mức riêng của bạn'
              : 'Lấy từ hạn mức của bạn ở trên'
          }
        />
        <StatBox label="Đã phân bổ" value={fmt(overview.allocated)} />
        <StatBox label="Còn lại có thể chia" value={fmt(overview.remainingToAllocate)} />
      </div>

      {overview.allocatablePool === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            {overview.isTopManager
              ? 'Công ty chưa được cấp ngân sách token AI. Vui lòng liên hệ quản trị hệ thống.'
              : 'Bạn chưa được cấp hạn mức token. Vui lòng liên hệ quản lý cấp trên.'}
          </p>
        </div>
      )}

      {/* Công tắc uỷ quyền — chỉ quản lý cao nhất */}
      {overview.isTopManager && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <Users size={18} className="shrink-0 text-[var(--color-primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--color-foreground)]">
              Cho phép quản lý cấp dưới tự phân bổ
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Khi bật, trưởng đơn vị có thể chia token cho nhân sự của họ — trừ vào chính hạn mức của họ.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDelegation.mutate(!overview.subDelegationEnabled)}
            disabled={setDelegation.isPending}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50',
              overview.subDelegationEnabled
                ? 'border border-[var(--color-border)] text-[var(--color-foreground)] hover:bg-[var(--color-muted)]/50'
                : 'bg-emerald-600 text-white hover:shadow-md'
            )}
          >
            {setDelegation.isPending && <Loader2 size={15} className="animate-spin" />}
            {overview.subDelegationEnabled ? 'Đang bật — bấm để tắt' : 'Bật'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {/* Thanh lọc */}
        <div className="flex flex-col gap-2 border-b border-[var(--color-border)] p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          <Select value={roleName} onValueChange={setRoleName}>
            <SelectTrigger className={triggerCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả vai trò</SelectItem>
              {(overview.availableRoles ?? []).map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={triggerCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadingList && rows.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">
            Không có nhân sự nào khớp bộ lọc.
          </p>
        ) : (
          <>
            {/* Desktop: bảng */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Nhân sự</th>
                    <th className="px-4 py-3 text-left font-medium">Vai trò</th>
                    <th className="px-4 py-3 text-left font-medium">Đơn vị</th>
                    <th className="px-4 py-3 text-left font-medium">Đã dùng</th>
                    <th className="px-4 py-3 text-right font-medium">Hạn mức/tháng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((item) => (
                    <tr
                      key={item.userId}
                      className={cn(isMe(item) && 'bg-[var(--color-primary)]/5')}
                    >
                      <td
                        className={cn(
                          'px-4 py-3',
                          isMe(item) && 'border-l-[3px] border-l-[var(--color-primary)]'
                        )}
                      >
                        <p className="flex items-center gap-2 font-semibold text-[var(--color-foreground)]">
                          {item.fullName}
                          {isMe(item) && <YouBadge />}
                        </p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">{item.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge name={item.roleName} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
                        {item.orgUnitName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <UsageBar used={item.usedThisMonth} limit={item.monthlyLimit} />
                      </td>
                      <td className="px-4 py-3">
                        <LimitEditor
                          item={item}
                          remainingToAllocate={overview.remainingToAllocate}
                          saving={setLimit.isPending}
                          onSave={onSave}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: thẻ */}
            <div className="divide-y divide-[var(--color-border)] md:hidden">
              {rows.map((item) => (
                <div
                  key={item.userId}
                  className={cn(
                    'space-y-2 p-4',
                    isMe(item) &&
                      'border-l-[3px] border-l-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-bold text-[var(--color-foreground)]">
                        {item.fullName}
                        {isMe(item) && <YouBadge />}
                      </p>
                      <p className="truncate text-xs text-[var(--color-muted-foreground)]">{item.email}</p>
                    </div>
                    <RoleBadge name={item.roleName} />
                  </div>
                  <UsageBar used={item.usedThisMonth} limit={item.monthlyLimit} />
                  <LimitEditor
                    item={item}
                    remainingToAllocate={overview.remainingToAllocate}
                    saving={setLimit.isPending}
                    onSave={onSave}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {pageData && pageData.totalPages > 1 && (
          <div className="border-t border-[var(--color-border)] px-4 py-3">
            <Pagination
              currentPage={pageData.page}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              size={pageData.size}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
