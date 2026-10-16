import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import '../editor/blocknote.css'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/themeStore'
import { docSchema } from '../editor/schema'
import { blockNoteDictionary, parseBlocks, parseMarkdownToBlocks, saveTextFile, toHtmlDocument } from '../editor/blocks'

/** Tài liệu trực tuyến (`.kgdoc`) / Markdown ở chế độ chỉ đọc cho người mở link công khai. Nạp muộn (BlockNote nặng). */
export default function PublicBlocksView({ title, content, format, fileUrl }: {
  title: string
  content: string
  format: 'blocks' | 'markdown'
  /** Tệp .md gốc tải thẳng được; `.kgdoc` là JSON nội bộ nên xuất ra HTML / Markdown ngay trên trình duyệt. */
  fileUrl: string
}) {
  const { t, i18n } = useTranslation('documents')
  const isDark = useThemeStore(s => s.isDark)
  const dictionary = useMemo(() => blockNoteDictionary(i18n.language), [i18n.language])
  const initialContent = useMemo(
    () => (format === 'blocks' ? parseBlocks(content) : parseMarkdownToBlocks(content)),
    [format, content],
  )
  const editor = useCreateBlockNote({ schema: docSchema, initialContent, dictionary }, [])

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2 border-b border-[var(--color-border)] px-4 py-2">
        {format === 'blocks' ? (
          <>
            <Button size="sm" variant="ghost"
                    onClick={() => saveTextFile(`${title}.html`, 'text/html', toHtmlDocument(title, editor.blocksToHTMLLossy(editor.document)))}>
              <Download aria-hidden="true" /> {t('editor.exportHtml')}
            </Button>
            <Button size="sm" variant="ghost"
                    onClick={() => saveTextFile(`${title}.md`, 'text/markdown', editor.blocksToMarkdownLossy(editor.document))}>
              <Download aria-hidden="true" /> {t('editor.exportMarkdown')}
            </Button>
          </>
        ) : (
          <Button asChild size="sm" variant="ghost">
            <a href={fileUrl} download><Download aria-hidden="true" /> {t('actions.download')}</a>
          </Button>
        )}
      </div>
      <div className="mx-auto max-w-[900px] pb-16 pt-6">
        <BlockNoteView editor={editor} editable={false} theme={isDark ? 'dark' : 'light'} className="kg-doc-editor min-h-[50vh]" />
      </div>
    </>
  )
}
