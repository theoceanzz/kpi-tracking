import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Coins, Search, Users, Wallet } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounce } from '@/hooks/useDebounce'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { formatCurrency } from '@/lib/utils'
import { useCashWalletSummary, useCashWallets } from '../hooks/useWallet'
import UserLedgerModal from './UserLedgerModal'
import type { CashWallet } from '../types'

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'primary'
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        tone === 'primary'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-[var(--color-border)] bg-[var(--color-card)]'
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 truncate text-2xl font-bold tabular-nums">{value}</div>
      {hint && (
        <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">{hint}</div>
      )}
    </div>
  )
}

export default function CashWalletsTab() {
  const [keyword, setKeyword] = useState('')
  const [unitId, setUnitId] = useState('')
  const [onlyInconsistent, setOnlyInconsistent] = useState(false)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<CashWallet | null>(null)
  const size = 20

  const debounced = useDebounce(keyword, 500)
  const { data: treeData } = useOrgUnitTree()

  /**
   * Dẹp cây thành danh sách phẳng, thụt đầu dòng bằng gạch ngang để vẫn nhìn ra
   * cấp bậc — cùng cách EmployeePicker và EvaluationsPage đang làm.
   *
   * <p>KHÔNG cần gom id cây con như EmployeePicker: backend lọc theo tiền tố
   * {@code path} nên gửi một id là đã bao trọn các đơn vị bên dưới.
   */
  const flatUnits = useMemo(() => {
    const flatten = (nodes: any[], level = 0): { id: string; label: string }[] => {
      let result: { id: string; label: string }[] = []
      nodes?.forEach((node) => {
        result.push({
          id: node.id,
          label: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name,
        })
        if (node.children?.length) result = result.concat(flatten(node.children, level + 1))
      })
      return result
    }
    return treeData ? flatten(treeData as any[]) : []
  }, [treeData])

  // Mặc định chọn đơn vị gốc: nó bao trọn cây con nên tương đương "toàn công ty",
  // nhưng hiện tên đơn vị cụ thể để người dùng biết mình đang nhìn phạm vi nào —
  // cùng cách EmployeePicker đang làm.
  useEffect(() => {
    const root = flatUnits[0]
    if (!unitId && root) setUnitId(root.id)
  }, [flatUnits, unitId])

  const { data: summary } = useCashWalletSummary()
  const { data, isLoading } = useCashWallets(
    debounced,
    unitId || undefined,
    onlyInconsistent,
    page,
    size,
    // Cây rỗng thì không có đơn vị nào để chọn, cứ chạy và hiện toàn bộ.
    !!unitId || flatUnits.length === 0,
  )

  const wallets = data?.content ?? []
  const broken = summary?.inconsistentCount ?? 0

  // Đơn vị gốc bao trọn cây con nên chọn nó không phải là "đã thu hẹp phạm vi" —
  // chỉ tính là có lọc khi người dùng chọn xuống một đơn vị con.
  const narrowed = !!keyword || (!!unitId && unitId !== flatUnits[0]?.id)

  return (
    <div>
      {/* Tổng số dư là con số duy nhất chỉ màn hình này tính được: sổ đối soát chỉ
          thấy tiền vào, không biết đã đổi ra điểm bao nhiêu. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Wallet size={13} />}
          label="Đang giữ"
          value={formatCurrency(summary?.totalBalance)}
          hint="Đã nạp nhưng chưa đổi thành điểm"
          tone="primary"
        />
        <StatCard
          icon={<Coins size={13} />}
          label="Tổng đã nạp"
          value={formatCurrency(summary?.totalTopup)}
        />
        <StatCard
          icon={<Coins size={13} />}
          label="Đã đổi ra điểm"
          value={formatCurrency(summary?.totalConverted)}
        />
        <StatCard
          icon={<Users size={13} />}
          label="Số ví"
          value={(summary?.walletCount ?? 0).toLocaleString('vi-VN')}
          hint="Ví tạo khi nhân viên nạp lần đầu"
        />
      </div>

      {/* Con số ví lệch sổ ở màn hình đối soát chỉ nói CÓ BAO NHIÊU. Đây là đường
          duy nhất xem chúng là ví nào. */}
      {broken > 0 && !onlyInconsistent && (
        <button
          type="button"
          onClick={() => {
            setOnlyInconsistent(true)
            setPage(0)
          }}
          className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-5 py-4 text-left text-sm transition-colors hover:bg-rose-500/15"
        >
          <AlertTriangle size={18} className="flex-shrink-0 text-rose-600" />
          <span className="min-w-0 flex-1">
            <strong>{broken} ví</strong> có số dư lệch so với sổ cái. Đây là lỗi dữ liệu tiền tệ,
            không phải cảnh báo nghiệp vụ — cần kiểm tra ngay.
          </span>
          <ChevronRight size={18} className="flex-shrink-0 text-rose-600" />
        </button>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(0)
            }}
            disabled={onlyInconsistent}
            placeholder="Tìm theo tên hoặc email"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] py-2.5 pl-9 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-primary)] disabled:opacity-50"
          />
        </div>

        {/* Không có mục "Tất cả đơn vị": đơn vị gốc đã bao trọn cây con nên nó chỉ
            là một cách gọi khác của cùng một phạm vi, thêm vào chỉ làm người dùng
            phân vân chọn cái nào. */}
        <Select
          value={unitId}
          onValueChange={(v) => {
            setUnitId(v)
            setPage(0)
          }}
          disabled={onlyInconsistent}
        >
          <SelectTrigger className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm disabled:opacity-50 sm:w-56">
            <SelectValue placeholder="Chọn đơn vị" />
          </SelectTrigger>
          <SelectContent>
            {flatUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onlyInconsistent && (
          <button
            type="button"
            onClick={() => {
              setOnlyInconsistent(false)
              setPage(0)
            }}
            className="whitespace-nowrap rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-1.5 text-sm font-semibold text-rose-700 dark:text-rose-400"
          >
            Đang lọc ví lệch sổ · Bỏ lọc
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton type="table" rows={4} />
      ) : wallets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={
              onlyInconsistent
                ? 'Không có ví nào lệch sổ'
                : narrowed
                  ? 'Không tìm thấy ví nào'
                  : 'Chưa có ví nào'
            }
            description={
              onlyInconsistent
                ? 'Số dư của mọi ví đều khớp với tổng sổ cái.'
                : narrowed
                  ? 'Thử bỏ bớt bộ lọc, hoặc nhân sự trong phạm vi này chưa ai nạp tiền lần nào.'
                  : 'Ví được tạo tự động khi nhân viên nạp tiền lần đầu.'
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[var(--color-muted)]/50 text-left">
                <tr className="text-[11px] font-black uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <th className="px-4 py-3">Nhân viên</th>
                  <th className="px-4 py-3 text-right">Số dư</th>
                  <th className="px-4 py-3 text-right">Tổng đã nạp</th>
                  <th className="px-4 py-3 text-right">Đã đổi ra điểm</th>
                  <th className="px-4 py-3 text-right">Đổi được</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {wallets.map((w) => (
                  <tr
                    key={w.id}
                    onClick={() => setSelected(w)}
                    className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold">{w.fullName}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">
                        {w.employeeCode ? `${w.employeeCode} · ` : ''}
                        {w.email}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(w.balance)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--color-muted-foreground)]">
                      {formatCurrency(w.lifetimeTopup)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-[var(--color-muted-foreground)]">
                      {formatCurrency(w.lifetimeConverted)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {w.convertiblePoints.toLocaleString('vi-VN')} điểm
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight size={16} className="ml-auto text-[var(--color-muted-foreground)]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data?.totalPages ?? 0) > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={data?.totalPages ?? 0}
                totalElements={data?.totalElements ?? 0}
                size={size}
                onPageChange={setPage}
                itemLabel="ví"
              />
            </div>
          )}
        </>
      )}

      <UserLedgerModal wallet={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
