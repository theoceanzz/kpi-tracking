import { lazy, Suspense, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Link2Off } from 'lucide-react'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { BrandLogo } from '@/components/common/BrandLogo'
import FilePreview from '@/components/common/FilePreview'
import { useFormat } from '@/i18n/useFormat'
import { FileTypeIcon } from '../components/docUi'
import { publicDocumentApi } from './publicDocumentApi'

const PublicBlocksView = lazy(() => import('./PublicBlocksView'))
const PublicSheetView = lazy(() => import('./PublicSheetView'))

/**
 * Trang mở tài liệu từ link trong email (`/s/d/:token`) — cho cả người KHÔNG có tài khoản. Không có sidebar, không đăng
 * nhập. Tài liệu trực tuyến / Markdown / chữ thuần hiện thẳng nội dung ở chế độ đọc, PDF xem trong trang, loại khác
 * (Word, Excel…) tải về. Link hết hạn / bị thu hồi / tài liệu đã xoá thì báo chung một câu, mời liên hệ người gửi.
 */
export default function PublicDocumentPage() {
  const { token = '' } = useParams()
  const { t } = useTranslation('documents')
  const { dateTime } = useFormat()
  const meta = useQuery({
    queryKey: ['public-document', token],
    queryFn: () => publicDocumentApi.get(token),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const format = meta.data?.format ?? null
  const content = useQuery({
    queryKey: ['public-document', token, 'content'],
    queryFn: () => publicDocumentApi.content(token),
    enabled: !!format,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (meta.data) document.title = `${meta.data.title} · KeyGo`
  }, [meta.data])

  const doc = meta.data
  const fileUrl = publicDocumentApi.fileUrl(token)

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <BrandLogo className="h-7" />
          <span className="ml-auto truncate text-caption">{t('public.tagline')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
        {meta.isLoading ? (
          <LoadingSkeleton type="card" rows={6} />
        ) : meta.isError || !doc ? (
          <div className="mx-auto max-w-xl rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState icon={Link2Off} title={t('public.unavailableTitle')}
                        description={meta.error instanceof Error ? meta.error.message : t('public.unavailable')} />
          </div>
        ) : (
          <>
            <section className="flex flex-wrap items-start gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-[var(--color-muted)]">
                <FileTypeIcon doc={doc} size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-xl font-semibold text-[var(--color-foreground)]">{doc.title}</h1>
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {doc.organizationName
                    ? t('public.sentByOrg', { name: doc.senderName, org: doc.organizationName })
                    : t('public.sentBy', { name: doc.senderName })}
                </p>
                <p className="text-caption">
                  {t('public.updatedAt', { time: dateTime(doc.updatedAt) })} · {t('public.expiresAt', { time: dateTime(doc.expiresAt) })}
                </p>
              </div>
              {!format && (
                <Button asChild>
                  <a href={fileUrl} download><Download aria-hidden="true" /> {t('actions.download')}</a>
                </Button>
              )}
            </section>

            <article className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
              {format ? (
                content.isLoading ? <div className="p-4"><LoadingSkeleton type="card" rows={8} /></div>
                  : content.isError || !content.data ? (
                    <EmptyState icon={FileText} title={t('public.unavailableTitle')}
                                description={content.error instanceof Error ? content.error.message : t('public.unavailable')} />
                  ) : (
                    <Suspense fallback={<div className="p-4"><LoadingSkeleton type="card" rows={8} /></div>}>
                      {format === 'sheet'
                        ? <PublicSheetView title={doc.title} content={content.data.content} />
                        : format === 'blocks' || format === 'markdown'
                          ? <PublicBlocksView title={doc.title} content={content.data.content} format={format} fileUrl={fileUrl} />
                          : (
                            <>
                              <div className="flex justify-end border-b border-[var(--color-border)] px-4 py-2">
                                <Button asChild size="sm" variant="ghost">
                                  <a href={fileUrl} download><Download aria-hidden="true" /> {t('actions.download')}</a>
                                </Button>
                              </div>
                              <pre className="whitespace-pre-wrap break-words p-6 font-mono text-sm leading-6 text-[var(--color-foreground)]">
                                {content.data.content}
                              </pre>
                            </>
                          )}
                    </Suspense>
                  )
              ) : (
                // PDF / Word / Excel / CSV vẽ ngay trên trình duyệt (tải tệp rồi dựng), không nhúng iframe — nginx đặt
                // X-Frame-Options DENY. Loại không xem được thì FilePreview tự hiện nút tải về.
                <div className="h-[80vh] overflow-auto">
                  <FilePreview url={fileUrl} fileName={doc.fileName} contentType={doc.contentType} tone="card" />
                </div>
              )}
            </article>
          </>
        )}
      </main>
    </div>
  )
}
