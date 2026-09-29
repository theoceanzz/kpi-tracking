import { useState } from 'react'
import { Building2, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { HintOn, InfoHint } from '@/components/common/InfoHint'
import AiUnitSelect from './AiUnitSelect'
import {
  useAiReviewUnitSettings, useDeleteAiReviewUnitSetting, useSaveAiReviewUnitSetting,
} from '../hooks/useAiReview'
import type { AiReviewSettings, AiReviewUnitSetting } from '../api/aiReviewApi'

const WEIGHT_KEYS = [
  { key: 'weightTarget', label: 'Đáp ứng' },
  { key: 'weightQuality', label: 'Chất lượng' },
  { key: 'weightOnTime', label: 'Đúng hạn' },
] as const

const DEFAULT: AiReviewSettings = { enabled: true, weightTarget: 60, weightQuality: 30, weightOnTime: 10 }

/**
 * Riêng theo đơn vị. Luật: công ty tắt thì mọi cấp tắt; công ty bật thì đơn vị GẦN NHẤT có cấu
 * hình riêng quyết (áp cả đơn vị con); không có thì theo công ty.
 */
export default function AiReviewUnitSettingsSection() {
  const { data: rows = [], isLoading } = useAiReviewUnitSettings()
  const save = useSaveAiReviewUnitSetting()
  const remove = useDeleteAiReviewUnitSetting()
  const [editing, setEditing] = useState<{ orgUnitId: string | null; body: AiReviewSettings; isNew: boolean } | null>(null)

  const startNew = () => setEditing({ orgUnitId: null, body: DEFAULT, isNew: true })
  const startEdit = (r: AiReviewUnitSetting) => setEditing({
    orgUnitId: r.orgUnitId, isNew: false,
    body: { enabled: r.enabled, weightTarget: r.weightTarget, weightQuality: r.weightQuality, weightOnTime: r.weightOnTime },
  })

  const total = editing ? editing.body.weightTarget + editing.body.weightQuality + editing.body.weightOnTime : 100
  const taken = new Set(rows.map(r => r.orgUnitId))

  return (
    <div className="space-y-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Building2 size={20} className="mt-0.5 text-[var(--color-ai)]" aria-hidden="true" />
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-foreground)]">
              Riêng theo đơn vị
              <InfoHint>
                Đơn vị không có cấu hình riêng sẽ theo đơn vị cha gần nhất, rồi theo công ty. Công ty tắt thì mọi đơn vị
                đều tắt.
              </InfoHint>
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">Tắt hoặc đổi cách tính cho một đơn vị (gồm cả đơn vị con).</p>
          </div>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startNew}><Plus aria-hidden="true" /> Thêm đơn vị</Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-[var(--color-muted-foreground)]" /></div>
      ) : rows.length === 0 && !editing ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">Chưa có — mọi đơn vị theo cấu hình chung.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-control border border-[var(--color-border)]">
          {rows.map(r => (
            <li key={r.orgUnitId} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{r.orgUnitName ?? r.orgUnitId}</span>
              <Badge variant={r.enabled ? 'success' : 'secondary'}>{r.enabled ? 'Bật' : 'Tắt'}</Badge>
              <HintOn hint="Đạt chỉ tiêu / Chất lượng / Đúng hạn (%)"
                      className="text-xs text-[var(--color-muted-foreground)] underline decoration-dotted underline-offset-2">
                {r.weightTarget}/{r.weightQuality}/{r.weightOnTime}
              </HintOn>
              <Button variant="ghost" size="sm" onClick={() => startEdit(r)}>Sửa</Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Bỏ cấu hình riêng của ${r.orgUnitName ?? ''}`}
                      disabled={remove.isPending} onClick={() => remove.mutate(r.orgUnitId)}>
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="space-y-3 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {editing.isNew ? (
              <AiUnitSelect value={editing.orgUnitId} exclude={taken} className="w-full sm:w-72"
                            onChange={id => setEditing({ ...editing, orgUnitId: id })} />
            ) : (
              <span className="text-sm font-medium">{rows.find(r => r.orgUnitId === editing.orgUnitId)?.orgUnitName}</span>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm">
              Bật
              <Switch checked={editing.body.enabled}
                      onCheckedChange={enabled => setEditing({ ...editing, body: { ...editing.body, enabled } })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {WEIGHT_KEYS.map(w => (
              <label key={w.key} className="space-y-1">
                <span className="text-label">{w.label}</span>
                <Input type="number" min={0} max={100} value={editing.body[w.key]} invalid={total !== 100}
                       suffix={<span className="text-xs text-[var(--color-muted-foreground)]">%</span>}
                       onChange={e => setEditing({
                         ...editing,
                         body: { ...editing.body, [w.key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) },
                       })} />
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={total === 100 ? 'text-xs text-[var(--color-muted-foreground)]' : 'text-xs text-[var(--color-error)]'}>
              Tổng: {total}% {total !== 100 && '— phải bằng 100%'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Hủy</Button>
              <Button size="sm" disabled={!editing.orgUnitId || total !== 100 || save.isPending}
                      onClick={() => save.mutate({ orgUnitId: editing.orgUnitId!, body: editing.body },
                        { onSuccess: () => setEditing(null) })}>
                {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Lưu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
