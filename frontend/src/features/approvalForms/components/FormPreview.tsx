import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GitBranch } from 'lucide-react'
import { stepCodes, topologicalOrder } from '@/features/approvalProcess/model/processGraphModel'
import type { ProcessGraph } from '@/features/approvalProcess/types'
import type { FormSchema, FormValues } from '../types'
import FormIcon from './FormIcon'
import FormRenderer from './renderer/FormRenderer'

/**
 * Xem trước một đơn như người nộp sẽ thấy: form trong khung điện thoại (điền thử được, không tải tệp) và tóm tắt
 * các bước của quy trình duyệt.
 */
export default function FormPreview({ icon, color, name, description, schema, process }: {
  icon: string
  color: string
  name: string
  description?: string
  schema: FormSchema
  process?: ProcessGraph | null
}) {
  const { t } = useTranslation('approvalForms')
  const [values, setValues] = useState<FormValues>({})
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[380px] rounded-[32px] border-[6px] border-[var(--color-border)] bg-[var(--color-background)] p-1 shadow-lg">
        <div className="max-h-[68vh] overflow-y-auto rounded-[24px] bg-[var(--color-card)]">
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
            <FormIcon icon={icon} color={color} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name || t('editor.untitled')}</p>
              {description && <p className="truncate text-caption">{description}</p>}
            </div>
          </div>
          <div className="p-4">
            {schema.widgets.length === 0
              ? <p className="py-8 text-center text-caption">{t('preview.emptyForm')}</p>
              : <FormRenderer schema={schema} values={values} onChange={setValues} mode="preview" />}
          </div>
        </div>
      </div>
      {process && <ProcessSummary process={process} />}
    </div>
  )
}

/** Các bước duyệt theo thứ tự đánh số (điều kiện hiện thành nhánh "Nếu …"). */
export function ProcessSummary({ process }: { process: ProcessGraph }) {
  const { t } = useTranslation('approvalForms')
  const rows = useMemo(() => {
    const codes = stepCodes(process)
    const order = topologicalOrder(process) ?? process.nodes.map((n) => n.id)
    const byId = new Map(process.nodes.map((n) => [n.id, n]))
    return order.map((id) => byId.get(id)).filter((n) => n && (n.type === 'STEP' || n.type === 'CONDITION'))
      .map((n) => ({ id: n!.id, type: n!.type, code: codes[n!.id], name: n!.name ?? '' }))
  }, [process])
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-section-title">
        <GitBranch size={18} aria-hidden="true" /> {t('preview.process')}
      </h3>
      {rows.length === 0 ? (
        <p className="text-caption">{t('preview.noSteps')}</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-card border border-[var(--color-border)] px-3 py-2 text-sm">
              {r.type === 'STEP' ? (
                <>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-primary-soft)] px-1.5 text-xs font-semibold text-[var(--color-primary)]">
                    {r.code}
                  </span>
                  <span className="truncate">{r.name}</span>
                </>
              ) : (
                <span className="truncate italic text-[var(--color-muted-foreground)]">{t('preview.ifCondition', { name: r.name })}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
