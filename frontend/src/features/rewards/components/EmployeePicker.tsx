import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { userApi } from '@/features/users/api/userApi'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useDebounce } from '@/hooks/useDebounce'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * SelectContent render qua portal với z-50, trong khi modal của phần thưởng là z-[1000] —
 * không nâng lên thì danh sách xổ ra nằm PHÍA SAU modal và không bấm được.
 */
const SELECT_CONTENT_Z = 'z-[1100]'

export interface PickedEmployee {
  id: string
  fullName: string
  email?: string
}

interface EmployeePickerProps {
  /** Người đã chọn — bị loại khỏi kết quả để không bấm trùng. */
  selectedIds: string[]
  onPick: (user: PickedEmployee) => void
  enabled?: boolean
  /** Chiều cao danh sách kết quả, tuỳ chỗ dùng mà cần cao thấp khác nhau. */
  listClassName?: string
}

/**
 * Ô tìm nhân sự dùng chung cho modal thưởng điểm và modal cấp hạn mức.
 *
 * <p>Tách riêng vì hai chỗ cần y hệt nhau: lọc theo đơn vị, tìm theo tên/email, và loại
 * người đã chọn. Viết hai lần thì bộ lọc sẽ lệch nhau ngay lần sửa đầu tiên.
 *
 * <p>Lọc theo đơn vị dùng `orgUnitId` của API người dùng — backend đã tự giới hạn theo
 * phạm vi quản lý của người đang đăng nhập, nên đây thuần tuý là để tìm cho nhanh chứ
 * không phải lớp bảo mật.
 */
export default function EmployeePicker({
  selectedIds,
  onPick,
  enabled = true,
  listClassName = 'max-h-44',
}: EmployeePickerProps) {
  const [keyword, setKeyword] = useState('')
  const [orgUnitId, setOrgUnitId] = useState('')
  const debouncedKeyword = useDebounce(keyword, 500)

  const { data: treeData } = useOrgUnitTree()

  /**
   * Dẹp cây thành danh sách phẳng, kèm SẴN id của toàn bộ cây con mỗi nút.
   *
   * <p>API người dùng lọc bằng `uro.orgUnit.id IN :orgUnitIds` — so khớp CHÍNH XÁC, không
   * tự mở rộng xuống cấp dưới. Nếu chỉ gửi id của "Phòng IT" thì nhân viên thuộc
   * "Team Backend" bên trong nó sẽ không hiện ra. Vì vậy phải tự gom id cây con ở đây.
   *
   * <p>Nhãn thụt đầu dòng bằng gạch ngang để vẫn nhìn ra cấp bậc — cùng cách
   * EvaluationsPage và KpiFormModal đang làm.
   */
  const flatUnits = useMemo(() => {
    const collectIds = (node: any): string[] => [
      node.id,
      ...(node.children ?? []).flatMap(collectIds),
    ]
    const flatten = (nodes: any[], level = 0): { id: string; label: string; subtreeIds: string[] }[] => {
      let result: { id: string; label: string; subtreeIds: string[] }[] = []
      nodes?.forEach((node) => {
        result.push({
          id: node.id,
          label: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name,
          subtreeIds: collectIds(node),
        })
        if (node.children?.length) result = result.concat(flatten(node.children, level + 1))
      })
      return result
    }
    return treeData ? flatten(treeData as any[]) : []
  }, [treeData])

  // Mặc định chọn đơn vị gốc: nó bao trọn cây con nên tương đương "toàn công ty",
  // nhưng hiện tên đơn vị cụ thể để người dùng biết mình đang nhìn phạm vi nào.
  useEffect(() => {
    const root = flatUnits[0]
    if (!orgUnitId && root) setOrgUnitId(root.id)
  }, [flatUnits, orgUnitId])

  const selectedSubtreeIds = useMemo(
    () => flatUnits.find((u) => u.id === orgUnitId)?.subtreeIds,
    [flatUnits, orgUnitId],
  )

  const { data: userPage, isFetching } = useQuery({
    queryKey: ['users', 'rewardPicker', debouncedKeyword, orgUnitId],
    queryFn: () =>
      userApi.getAll({
        keyword: debouncedKeyword,
        // `orgUnitIds` (số nhiều) mới là tên tham số backend nhận — gửi `orgUnitId`
        // số ít thì Spring lặng lẽ bỏ qua và bộ lọc không có tác dụng gì.
        orgUnitIds: selectedSubtreeIds,
        page: 0,
        size: 30,
      }),
    enabled,
  })

  const candidates = useMemo(() => {
    const picked = new Set(selectedIds)
    return (userPage?.content ?? []).filter((u: any) => !picked.has(u.id))
  }, [userPage, selectedIds])

  const inputCls =
    'w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm'

  return (
    <div>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Không có mục "Tất cả đơn vị": đơn vị gốc đã bao trọn cây con nên nó chỉ là
            một cách gọi khác của cùng một phạm vi, thêm vào chỉ làm người dùng phân vân
            chọn cái nào. */}
        <Select value={orgUnitId} onValueChange={setOrgUnitId}>
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="Chọn đơn vị" />
          </SelectTrigger>
          <SelectContent className={SELECT_CONTENT_Z}>
            {flatUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      {/* custom-scrollbar chứ không phải scrollbar-hide: danh sách này cuộn được, ẩn hẳn
          thanh cuộn thì người dùng không biết còn nhân sự phía dưới. Lớp này chỉ bỏ hai
          nút mũi tên xấu của Windows và làm thanh mảnh lại. */}
      <div
        className={`${listClassName} custom-scrollbar overflow-y-auto rounded-lg border border-[var(--color-border)]`}
      >
        {isFetching && (
          <div className="px-3 py-4 text-center text-sm text-[var(--color-muted-foreground)]">
            Đang tìm...
          </div>
        )}
        {!isFetching && candidates.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-[var(--color-muted-foreground)]">
            {orgUnitId || debouncedKeyword
              ? 'Không có nhân viên nào khớp bộ lọc'
              : 'Không tìm thấy nhân viên'}
          </div>
        )}
        {!isFetching &&
          candidates.map((u: any) => (
            <button
              key={u.id}
              type="button"
              onClick={() => onPick({ id: u.id, fullName: u.fullName, email: u.email })}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-accent)]"
            >
              {u.fullName}
              <span className="ml-2 text-[var(--color-muted-foreground)]">{u.email}</span>
            </button>
          ))}
      </div>
    </div>
  )
}
