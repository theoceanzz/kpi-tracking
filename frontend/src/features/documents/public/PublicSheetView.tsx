import { lazy, Suspense, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import type { IWorkbookData } from '@univerjs/presets'
import { Button } from '@/components/ui/button'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useThemeStore } from '@/store/themeStore'
import { saveBlob } from '../utils'

const SheetEditor = lazy(() => import('../editor/SheetEditor'))

/** Bảng tính trực tuyến (`.kgsheet`) chỉ đọc cho người mở link công khai, kèm tải về Excel. */
export default function PublicSheetView({ title, content }: { title: string; content: string }) {
  const { t, i18n } = useTranslation('documents')
  const isDark = useThemeStore(s => s.isDark)
  const initial = useMemo(() => parseWorkbook(content), [content])
  const reader = useRef<(() => IWorkbookData | null) | null>(null)

  const exportXlsx = async () => {
    const wb = reader.current?.() ?? initial
    if (!wb) return
    const conv = await import('../editor/sheetConvert')
    saveBlob(`${title}.xlsx`, await conv.workbookToXlsx(wb))
  }

  return (
    <>
      <div className="flex justify-end border-b border-[var(--color-border)] px-4 py-2">
        <Button size="sm" variant="ghost" onClick={() => void exportXlsx()}>
          <Download aria-hidden="true" /> {t('editor.exportXlsx')}
        </Button>
      </div>
      <Suspense fallback={<div className="p-4"><LoadingSkeleton type="table" rows={10} /></div>}>
        <SheetEditor initial={initial} editable={false} dark={isDark} language={i18n.language}
                     onChange={() => {}} readerRef={reader} />
      </Suspense>
    </>
  )
}

function parseWorkbook(json: string): IWorkbookData | null {
  try {
    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'sheets' in parsed ? (parsed as IWorkbookData) : null
  } catch {
    return null
  }
}
