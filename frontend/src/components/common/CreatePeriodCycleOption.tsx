import { Fragment, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SelectItem, SelectSeparator } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/components/auth/PermissionGate'

/** Giá trị gác của mục "+ Tạo mới" — không bao giờ lọt vào form (bị chặn ở `wrap`). */
export const CREATE_PERIOD_CYCLE_VALUE = '__create_period_cycle__'

type Kind = 'period' | 'cycle'

/** Tham số trang Đợt & Kỳ đọc lại: mở sẵn form tạo và tạo xong thì quay về `returnTo`. */
export const CREATE_PARAM = 'create'
export const RETURN_TO_PARAM = 'returnTo'

/**
 * Lối tắt từ một ô chọn đợt/kỳ sang trang Đợt & Kỳ để tạo cái còn thiếu, thay vì bắt người
 * dùng đóng modal, tự tìm trang, tạo, rồi quay lại mở modal lần nữa.
 *
 * Trang đích mở sẵn form tạo và tạo xong tự quay về trang hiện tại. Modal đóng khi rời trang,
 * nhưng nội dung đang nhập được giữ bằng bản nháp (`useFormDraft`) nên mở lại là còn nguyên.
 *
 * Chỉ hiện với người có quyền tạo — người không tạo được thì mục này chỉ dẫn vào ngõ cụt.
 */
export function useCreatePeriodCycleOption(kind: Kind) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { hasPermission } = useHasPermission()
  const canCreate = hasPermission(kind === 'cycle' ? 'KPI_CYCLE:CREATE' : 'KPI_PERIOD:CREATE')
  const label = kind === 'cycle' ? t('createPeriodCycle.newCycle') : t('createPeriodCycle.newPeriod')

  const go = () => {
    const params = new URLSearchParams({
      section: 'kpi-cycles',
      tab: kind === 'cycle' ? 'cycles' : 'periods',
      [CREATE_PARAM]: '1',
      [RETURN_TO_PARAM]: location.pathname + location.search,
    })
    navigate(`/settings/tools?${params.toString()}`)
  }

  /** Bọc `onValueChange` của Select: chọn mục "+ Tạo mới" thì điều hướng, không đổi giá trị. */
  const wrap = <T,>(onChange: (value: string) => T) => (value: string) => {
    if (value === CREATE_PERIOD_CYCLE_VALUE) {
      go()
      return
    }
    return onChange(value)
  }

  /** Đặt cuối `SelectContent`. */
  const item = canCreate ? (
    <Fragment>
      <SelectSeparator />
      <SelectItem value={CREATE_PERIOD_CYCLE_VALUE} className="font-medium text-[var(--color-primary)]">
        <span className="inline-flex items-center gap-1.5">
          <Plus size={14} aria-hidden="true" /> {label}
        </span>
      </SelectItem>
    </Fragment>
  ) : null

  /** Cho chỗ chọn không phải Select (popover ô tick): đặt cuối danh sách, trông như mục cuối menu. */
  const button = canCreate ? (
    <div className="mt-1 border-t border-[var(--color-border)] pt-1">
      <Button type="button" variant="ghost" size="sm" onClick={go}
              className="w-full justify-start font-medium text-[var(--color-primary)]">
        <Plus aria-hidden="true" /> {label}
      </Button>
    </div>
  ) : null

  return { canCreate, go, wrap, item, button, label }
}

/**
 * Phía trang Đợt / Kỳ: đọc `?create=1&returnTo=…` do `useCreatePeriodCycleOption` gắn vào.
 * Mở form tạo một lần rồi gỡ hai tham số khỏi URL (reload không mở lại form, và lần tạo sau
 * không tự nhảy đi). Tạo xong thì `returnAfterCreate()` đưa người dùng về trang cũ.
 */
export function useCreateFromLink(kind: Kind, openCreate: () => void) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const returnToRef = useRef<string | null>(null)

  useEffect(() => {
    if (searchParams.get(CREATE_PARAM) !== '1') return
    const returnTo = searchParams.get(RETURN_TO_PARAM)
    // Chỉ nhận đường dẫn nội bộ — `//evil.com` hay URL tuyệt đối là open redirect.
    returnToRef.current = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null
    openCreate()
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.delete(CREATE_PARAM)
      p.delete(RETURN_TO_PARAM)
      return p
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  /** Gọi sau khi tạo xong. Trả `true` nếu đã điều hướng về trang cũ. */
  const returnAfterCreate = () => {
    const to = returnToRef.current
    returnToRef.current = null
    if (!to) return false
    toast.success(kind === 'cycle' ? t('createPeriodCycle.cycleCreatedBack') : t('createPeriodCycle.periodCreatedBack'))
    navigate(to)
    return true
  }

  /** Đóng form mà không tạo: bỏ chuyến quay về, ở lại trang này. */
  const cancelReturn = () => { returnToRef.current = null }

  return { returnAfterCreate, cancelReturn }
}
