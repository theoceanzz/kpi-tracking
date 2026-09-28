import { useState } from 'react'
import { Check, Plus, Send, UserCheck, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import UserAvatar from '@/components/common/UserAvatar'
import { RELATIONSHIP_LABEL, type F360Nomination, type F360Relationship } from '../api/feedback360Api'
import { useF360Approvals, useF360NominationMutations, useF360Nominations } from '../hooks/useFeedback360'
import { UserSearchPicker } from './F360Common'
import { fmtDate, type PickedUser } from '../utils/f360Format'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const DEFAULT_STATUS = perLanguage(() => ({ label: i18n.t('feedback360:NominationPanels.nominationsNotSubmitted'), variant: 'secondary' as const }))
const SUBJECT_STATUS = perLanguage((): Record<string, { label: string; variant: 'secondary' | 'info' | 'success' }> => ({
  NOMINATING: { label: i18n.t('feedback360:NominationPanels.nominationsNotSubmitted'), variant: 'secondary' },
  NOMINATION_SUBMITTED: { label: i18n.t('feedback360:NominationPanels.pendingApproval'), variant: 'info' },
  APPROVED: { label: i18n.t('feedback360:NominationPanels.approved'), variant: 'success' },
}))

function RaterList({ n, onRemove }: { n: F360Nomination; onRemove?: (assignmentId: string) => void }) {
  const { t } = useTranslation('feedback360')
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
      {n.raters.map(r => (
        <li key={r.assignmentId} className="flex items-center gap-3 px-3 py-2">
          <UserAvatar fullName={r.name} avatarUrl={r.avatarUrl} className="h-7 w-7 rounded-full text-xs" />
          <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
          <Badge variant="secondary">{RELATIONSHIP_LABEL()[r.relationship]}</Badge>
          {r.source === 'NOMINATED' && <Badge variant="info">{t('NominationPanels.nomination')}</Badge>}
          {onRemove && (
            <Button size="icon-sm" variant="ghost" aria-label={t('NominationPanels.remove', { name: r.name })} onClick={() => onRemove(r.assignmentId)}><X /></Button>
          )}
        </li>
      ))}
      {n.raters.length === 0 && <li className="p-3 text-caption">{t('NominationPanels.noRatersYet')}</li>}
    </ul>
  )
}

/**
 * Người được đánh giá xem danh sách người chấm ĐỀ XUẤT và đề cử thêm. Chỉ hiện trong giai đoạn đề
 * cử — đó là ngoại lệ ẩn danh có chủ đích (§6.2); từ lúc bắt đầu chấm, danh sách này biến mất.
 */
export function MyNominationsSection() {
  const { t } = useTranslation('feedback360')
  const { data: items = [] } = useF360Nominations()
  const [editing, setEditing] = useState<F360Nomination | null>(null)
  if (items.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-eyebrow">{t('NominationPanels.nominateRatersForYourself')}</h2>
      {items.map(n => {
        const st = SUBJECT_STATUS()[n.status] ?? DEFAULT_STATUS()
        return (
          <div key={n.subjectId} className="space-y-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 font-semibold">{n.campaignName}</p>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <p className="text-caption">
              {t('NominationPanels.thisIsTheSuggestedRaterList')} {n.maxNominees} {t('NominationPanels.morePeopleWhoWorkWithYou')}{n.nominationDeadline ? t('NominationPanels.before', { nominationDeadline: fmtDate(n.nominationDeadline) }) : ''}.
              {n.approverName ? t('NominationPanels.approver', { approverName: n.approverName }) : t('NominationPanels.theListWillBeApprovedAutomatically')}
            </p>
            <RaterList n={n} />
            {n.status !== 'APPROVED' && (
              <Button size="sm" onClick={() => setEditing(n)}><Users /> {n.status === 'NOMINATING' ? t('NominationPanels.nominateRaters') : t('NominationPanels.editNominations')}</Button>
            )}
          </div>
        )
      })}
      {editing && <NominateDialog nomination={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function NominateDialog({ nomination, onClose }: { nomination: F360Nomination; onClose: () => void }) {
  const { t } = useTranslation('feedback360')
  const m = useF360NominationMutations()
  const [picked, setPicked] = useState<PickedUser[]>(
    nomination.raters.filter(r => r.source === 'NOMINATED').map(r => ({ id: r.raterId, fullName: r.name, avatarUrl: r.avatarUrl })),
  )
  const others = nomination.raters.filter(r => r.source !== 'NOMINATED').map(r => r.raterId)
  const tooMany = picked.length > nomination.maxNominees

  return (
    <Dialog open onClose={onClose} size="md" title={t('NominationPanels.nominateRaters2')}
      description={t('NominationPanels.chooseUpToPeopleWhoWork', { maxNominees: nomination.maxNominees })}
      footer={<DialogFooter
        note={tooMany ? t('NominationPanels.youCanNominateAtMostPeople', { maxNominees: nomination.maxNominees }) : undefined}
        secondary={<Button variant="outline" onClick={onClose}>{t('NominationPanels.cancel')}</Button>}
        primary={<Button disabled={tooMany || m.nominate.isPending}
          onClick={() => m.nominate.mutate({ subjectId: nomination.subjectId, raterIds: picked.map(p => p.id) }, { onSuccess: onClose })}>
          <Send /> {t('NominationPanels.submitNominations')}
        </Button>}
      />}>
      <UserSearchPicker multiple selected={picked} onChange={setPicked} excludeIds={[nomination.subjectUserId, ...others]} />
      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {picked.map(p => (
            <Badge key={p.id} variant="info" className="gap-1">
              {p.fullName}
              <button type="button" aria-label={t('NominationPanels.remove2', { fullName: p.fullName })} onClick={() => setPicked(picked.filter(x => x.id !== p.id))}><X size={12} /></button>
            </Badge>
          ))}
        </div>
      )}
    </Dialog>
  )
}

const ADDABLE: F360Relationship[] = ['MANAGER', 'PEER', 'DIRECT_REPORT', 'OTHER']

/** Hàng chờ duyệt đề cử của người duyệt (thường là cấp trên trực tiếp). */
export function ApprovalsSection() {
  const { t } = useTranslation('feedback360')
  const { data: items = [] } = useF360Approvals()
  const [open, setOpen] = useState<F360Nomination | null>(null)
  if (items.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-eyebrow">{t('NominationPanels.approveRaters')}{items.length})</h2>
      <div className="space-y-2">
        {items.map(n => (
          <button key={n.subjectId} type="button" onClick={() => setOpen(n)}
            className="flex w-full items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left hover:border-[var(--color-border-strong)]">
            <UserAvatar fullName={n.subjectName} avatarUrl={n.subjectAvatarUrl} className="h-9 w-9 rounded-full text-xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{n.subjectName}</span>
              <span className="block truncate text-caption">{n.campaignName} · {n.raters.length} {t('NominationPanels.suggestedRaters')}</span>
            </span>
            <Badge variant={n.status === 'NOMINATION_SUBMITTED' ? 'info' : 'secondary'}>
              {n.status === 'NOMINATION_SUBMITTED' ? t('NominationPanels.nominationsSubmitted') : t('NominationPanels.nominationsNotSubmitted')}
            </Badge>
          </button>
        ))}
      </div>
      {open && <ApproveDialog nomination={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function ApproveDialog({ nomination, onClose }: { nomination: F360Nomination; onClose: () => void }) {
  const { t } = useTranslation('feedback360')
  const m = useF360NominationMutations()
  const [current, setCurrent] = useState(nomination)
  const [picked, setPicked] = useState<PickedUser[]>([])
  const [relationship, setRelationship] = useState<F360Relationship>('PEER')

  const apply = (body: Parameters<typeof m.approve.mutate>[0]['body'], close = false) =>
    m.approve.mutate({ subjectId: nomination.subjectId, body }, {
      onSuccess: next => { setCurrent(next); setPicked([]); if (close) onClose() },
    })

  return (
    <Dialog open onClose={onClose} size="lg" title={t('NominationPanels.ratersOf', { subjectName: nomination.subjectName })}
      description={t('NominationPanels.addOrRemoveRatersThenApprove')}
      footer={<DialogFooter
        secondary={<Button variant="outline" onClick={onClose}>{t('NominationPanels.close')}</Button>}
        primary={<Button disabled={m.approve.isPending} onClick={() => apply({ approve: true }, true)}><Check /> {t('NominationPanels.approveList')}</Button>}
      />}>
      <div className="space-y-4">
        <RaterList n={current} onRemove={id => apply({ remove: [id] })} />
        <div className="space-y-3 rounded-card border border-[var(--color-border)] p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><UserCheck size={16} className="text-slate-400" />{t('NominationPanels.addRater')}</h4>
          <Select value={relationship} onValueChange={v => setRelationship(v as F360Relationship)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ADDABLE.map(r => <SelectItem key={r} value={r}>{RELATIONSHIP_LABEL()[r]}</SelectItem>)}
            </SelectContent>
          </Select>
          <UserSearchPicker selected={picked} onChange={setPicked}
            excludeIds={[nomination.subjectUserId, ...current.raters.map(r => r.raterId)]} />
          <Button size="sm" disabled={!picked[0] || m.approve.isPending}
            onClick={() => picked[0] && apply({ add: [{ raterId: picked[0].id, relationship }] })}>
            <Plus /> {t('NominationPanels.add')} {picked[0]?.fullName ?? ''}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
