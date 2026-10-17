import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCheck, Hourglass, Inbox, PanelLeftClose, PanelLeftOpen, Search, Send, type LucideIcon } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useDebounce } from '@/hooks/useDebounce'
import { useFormat } from '@/i18n/useFormat'
import { cn } from '@/lib/utils'
import { useRequestCounts, useRequestList } from '../../hooks/useApprovalForms'
import { pickName } from '../../model/formState'
import type { RequestBox, RequestItem } from '../../types'
import FormIcon from '../FormIcon'
import RequestDetailDrawer from './RequestDetailDrawer'
import { RequestStatusBadge, SummaryLine } from './requestParts'

const COLLAPSE_KEY = 'approval-requests:sidebar-collapsed'

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

const BOXES: { key: RequestBox; icon: LucideIcon }[] = [
  { key: 'TODO', icon: Inbox },
  { key: 'DONE', icon: CheckCheck },
  { key: 'SUBMITTED', icon: Send },
  { key: 'IN_REVIEW', icon: Hourglass },
]

/**
 * "Trạng thái đơn": sidebar trái (Cần duyệt · Đã hoàn thành · Đã nộp · Đang được xem xét, ô tìm ở trên, nút thu gọn ở
 * đáy — thu gọn vẫn còn icon), danh sách đơn bên phải, bấm đơn mở ngăn chi tiết. Mục và đơn đang mở nằm trên URL
 * (`?box=` / `?request=`) để thông báo trỏ thẳng vào được.
 */
export default function StatusTab() {
  const { t } = useTranslation('approvalForms')
  const [params, setParams] = useSearchParams()
  const box = (BOXES.some((b) => b.key === params.get('box')) ? params.get('box') : 'TODO') as RequestBox
  const openId = params.get('request')
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [keyword, setKeyword] = useState('')
  const q = useDebounce(keyword.trim(), 300)
  const [page, setPage] = useState(0)
  const { data: counts } = useRequestCounts()
  const { data, isLoading, isFetching } = useRequestList(box, q, page)

  const setParam = (key: string, value: string | null) => {
    if (key === 'box') setPage(0)
    setParams((prev) => {
      const p = new URLSearchParams(prev)
      if (value) p.set(key, value)
      else p.delete(key)
      return p
    }, { replace: true })
  }

  const toggleCollapsed = () => setCollapsed((c) => {
    try {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
    } catch { /* trình duyệt chặn lưu: chỉ không nhớ được trạng thái */ }
    return !c
  })

  const badge = (k: RequestBox) => (k === 'TODO' ? counts?.todo : k === 'IN_REVIEW' ? counts?.inReview : undefined)

  return (
    <div className="space-y-4">
      <WorkspaceHeader title={t('status.title')} description={t('status.description')} />
      <div className="flex min-h-[60vh] overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
        <aside {...tourAnchor('requests.boxes')}
          className={cn('flex shrink-0 flex-col border-r border-[var(--color-border)] transition-[width] duration-200',
            collapsed ? 'w-16' : 'w-16 md:w-64')}>
          {!collapsed && (
            <div className="hidden p-3 md:block">
              <Input type="search" size="sm" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
                placeholder={t('status.search')} aria-label={t('status.search')} prefix={<Search size={14} aria-hidden="true" />} />
            </div>
          )}
          <nav aria-label={t('status.boxes')} className="flex-1 space-y-1 p-2">
            {BOXES.map(({ key, icon: Icon }) => {
              const active = box === key
              const n = badge(key)
              const item = (
                <button type="button" onClick={() => setParam('box', key)} aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? t(`status.box_${key}`) : undefined}
                  className={cn('relative flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
                    active ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]' : 'hover:bg-[var(--color-muted)]',
                    collapsed && 'justify-center px-0')}>
                  <Icon size={18} aria-hidden="true" className="shrink-0" />
                  <span className={cn('min-w-0 flex-1 truncate text-left', collapsed ? 'hidden' : 'hidden md:block')}>{t(`status.box_${key}`)}</span>
                  {!!n && (
                    <span className={cn('rounded-full bg-[var(--color-error)] px-1.5 text-[11px] font-semibold leading-5 text-white',
                      collapsed ? 'absolute right-1 top-0.5' : 'max-md:absolute max-md:right-1 max-md:top-0.5')}>
                      {n > 99 ? '99+' : n}
                    </span>
                  )}
                </button>
              )
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>{item}</TooltipTrigger>
                  <TooltipContent side="right" className={collapsed ? undefined : 'md:hidden'}>{t(`status.box_${key}`)}</TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
          <div className="hidden border-t border-[var(--color-border)] p-2 md:block">
            <Button variant="ghost" size={collapsed ? 'icon' : 'sm'} className={cn(!collapsed && 'w-full justify-start')} onClick={toggleCollapsed}
              aria-label={collapsed ? t('status.expand') : t('status.collapse')} title={collapsed ? t('status.expand') : t('status.collapse')}>
              {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <><PanelLeftClose aria-hidden="true" /> {t('status.collapse')}</>}
            </Button>
          </div>
        </aside>

        <section className="min-w-0 flex-1" {...tourAnchor('requests.list')}>
          {/* Ô tìm ở đầu danh sách khi sidebar thu gọn hoặc màn hẹp (sidebar chỉ còn icon). */}
          <div className={cn('border-b border-[var(--color-border)] p-3', !collapsed && 'md:hidden')}>
            <Input type="search" size="sm" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(0) }}
              placeholder={t('status.search')} aria-label={t('status.search')} prefix={<Search size={14} aria-hidden="true" />} />
          </div>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h2 className="text-section-title">{t(`status.box_${box}`)}</h2>
            {data && <span className="text-caption">{t('status.total', { count: data.totalElements })}</span>}
          </div>
          {isLoading ? (
            <div className="p-4"><LoadingSkeleton type="table" rows={5} /></div>
          ) : !data?.content.length ? (
            <EmptyState icon={Inbox} title={q ? t('status.noMatch') : t(`status.empty_${box}`)} />
          ) : (
            <>
              <ul className={cn('divide-y divide-[var(--color-border)]', isFetching && 'opacity-70')}>
                {data.content.map((r) => (
                  <RequestRow key={r.id} item={r} active={openId === r.id} onOpen={() => setParam('request', r.id)} />
                ))}
              </ul>
              {data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 border-t border-[var(--color-border)] p-3">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('status.prev')}</Button>
                  <span className="text-caption">{t('status.page', { page: page + 1, total: data.totalPages })}</span>
                  <Button variant="outline" size="sm" disabled={data.last} onClick={() => setPage((p) => p + 1)}>{t('status.next')}</Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <RequestDetailDrawer requestId={openId} onClose={() => setParam('request', null)} />
    </div>
  )
}

function RequestRow({ item, active, onOpen }: { item: RequestItem; active: boolean; onOpen: () => void }) {
  const { t } = useTranslation('approvalForms')
  const { lang, dateTime } = useFormat()
  return (
    <li>
      <button type="button" onClick={onOpen}
        className={cn('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]',
          active && 'bg-[var(--color-primary-soft)]')}>
        <FormIcon icon={item.formIcon} color={item.formColor} size="sm" className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">
              {t('status.rowTitle', { name: item.requester.name, form: pickName(item.formName, lang) })}
            </span>
            <RequestStatusBadge status={item.status} />
          </span>
          <SummaryLine item={item} />
          <span className="mt-0.5 block text-caption">
            {item.code} · {item.orgUnitName} · {dateTime(item.submittedAt)}
            {item.status === 'PENDING' && item.approval && item.approval.holderNames.length > 0 && (
              <> · {t('status.waitingFor', { names: item.approval.holderNames.join(', ') })}</>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}
